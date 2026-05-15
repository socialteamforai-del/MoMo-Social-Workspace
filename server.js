// Disable TLS verification for MoMo internal MCP gateway
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// Load .env
import { readFileSync } from 'fs'
try {
  const env = readFileSync('.env', 'utf8')
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k?.trim() && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim()
  })
} catch {}

import express from 'express'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const app = express()
app.use(express.json())
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

const TOKEN_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.mcp-auth/mcp-remote-0.1.37/b8bf4fefa28c3b5b22446f25a076e79a_tokens.json'
)
const CLIENT_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.mcp-auth/mcp-remote-0.1.37/b8bf4fefa28c3b5b22446f25a076e79a_client_info.json'
)
const MCP_URL = 'https://mdp-mcp-gateway.mservice.io/servers/adc70a2c746049c08fdf1c0e1965a94e/mcp'
const TOKEN_ENDPOINT = 'https://mdp-mcp-gateway.mservice.io/oauth/token'
const DATASOURCE_ID = '3c0ba297-ea18-429e-9225-6980d7f21463'
const CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map()

function readTokens() {
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
}
function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2))
}

async function refreshToken() {
  const tokens = readTokens()
  const client = JSON.parse(fs.readFileSync(CLIENT_PATH, 'utf-8'))
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
  })
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)
  const newTokens = await res.json()
  saveTokens({ ...tokens, ...newTokens })
  console.log('[token] refreshed')
  return newTokens.access_token
}

async function callMcp(payload, retry = true) {
  const { access_token } = readTokens()
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${access_token}`,
    },
    body: JSON.stringify(payload),
  })
  if (res.status === 401 && retry) {
    await refreshToken()
    return callMcp(payload, false)
  }
  return res.json()
}

const ALL_MEASURES = [
  'feed_agg_user_engagement.view_users',
  'feed_agg_user_engagement.click_cta_users',
  'feed_agg_user_engagement.comment_users',
  'feed_agg_user_engagement.like_users',
  'feed_agg_user_engagement.share_users',
  'feed_agg_user_engagement.engaged_users',
  'feed_agg_user_engagement.interact_users',
  'feed_agg_user_engagement.like_count',
  'feed_agg_user_engagement.share_count',
  'feed_agg_user_engagement.comment_count',
  'feed_agg_user_engagement.click_cta_count',
  'feed_agg_user_engagement.click_poll_count',
  'feed_agg_user_engagement.view_count',
  'feed_agg_user_engagement.ctr_user',
  'feed_agg_user_engagement.er_user',
]

// POST /api/momo-data
app.post('/api/momo-data', async (req, res) => {
  const { startDate, endDate, limit = 500, pageName } = req.body
  const cacheKey = `${startDate}|${endDate}|${limit}|${pageName ?? ''}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[cache] HIT ${cacheKey}`)
    return res.json({ ...cached.data, cached: true })
  }

  console.log(`[mcp] querying ${cacheKey}`)
  const t0 = Date.now()

  try {
    const filters = [
      { member: 'feed_agg_user_engagement.post_type', operator: 'equals', values: ['Fanpage post'] }
    ]

    const query = {
      measures: ALL_MEASURES,
      dimensions: [
        'feed_agg_user_engagement.page_name',
        'feed_agg_user_engagement.post_id',
      ],
      filters,
      limit,
      timezone: 'Asia/Ho_Chi_Minh',
      order: { 'feed_agg_user_engagement.engaged_users': 'desc' },
    }
    if (startDate && endDate) {
      query.timeDimensions = [{
        dimension: 'feed_agg_user_engagement.date',
        dateRange: [startDate, endDate],
      }]
    }

    const d = await callMcp({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'semantic-load', arguments: { datasourceId: DATASOURCE_ID, body: { query } } }
    })
    if (d?.error) throw new Error(`MCP error: ${d.error.message ?? JSON.stringify(d.error)}`)
    const text = d?.result?.content?.[0]?.text ?? ''
    if (!text) throw new Error('MCP trả về response rỗng')
    if (text.startsWith("Tool '") || text.startsWith('Error:') || text.startsWith('error:')) {
      throw new Error(text.slice(0, 400))
    }
    const result = JSON.parse(text)
    const rows = result?.data?.data ?? []
    const refreshTime = result?.data?.lastRefreshTime

    const responseData = { rows, refreshTime }
    cache.set(cacheKey, { data: responseData, expiresAt: Date.now() + CACHE_TTL_MS })
    console.log(`[mcp] done in ${Date.now() - t0}ms, ${rows.length} rows`)
    res.json(responseData)
  } catch (e) {
    console.error('[mcp] error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════════════
// TRENDING ENGINE
// ══════════════════════════════════════════════
const TRENDING_TTL = 30 * 60 * 1000
let trendingCache = null

// Persistent FB manual items (in-memory, survives per server session)
let fbManualItems = []

const FINANCE_KW = [
  // Chứng khoán / đầu tư
  'chứng khoán','vnindex','vn-index','vn index','hose','hnx','upcom','cổ phiếu','cổ tức',
  'thị trường chứng khoán','nhà đầu tư','margin','phiên giao dịch','thanh khoản thị trường',
  'quỹ đầu tư','etf','nav','danh mục','bluechip','penny stock','ipo',
  // Ngân hàng / tín dụng
  'ngân hàng','lãi suất','tín dụng','vay','cho vay','thấu chi','thẻ tín dụng','tiết kiệm',
  'gửi tiết kiệm','nhnn','ngân hàng nhà nước','sbv','nợ xấu','room tín dụng','tỷ lệ dự trữ',
  'hệ thống ngân hàng','vietcombank','bidv','vietinbank','techcombank','mbbank','vpbank','acb','hdbank',
  // Bảo hiểm
  'bảo hiểm','bảo hiểm nhân thọ','bảo hiểm xe','bảo hiểm y tế','phí bảo hiểm',
  // Crypto / tài sản số
  'crypto','bitcoin','ethereum','btc','eth','blockchain','tiền số','tiền ảo','defi','nft','altcoin','stablecoin','usdt',
  // Tỷ giá / ngoại tệ / vĩ mô
  'tỷ giá','ngoại tệ','forex','usd','eur','đô la','vàng','giá vàng','sjc','pnj','lạm phát','cpi','gdp',
  'tăng trưởng kinh tế','kinh tế vĩ mô','fed','lãi suất fed','chính sách tiền tệ',
  // Thuế / tài chính cá nhân
  'thuế','thuế thu nhập','thuế giá trị gia tăng','kê khai thuế','hoàn thuế','tài chính cá nhân',
  'quản lý tài chính','chi tiêu','ngân sách','tiết kiệm tiền','tích lũy','kế hoạch tài chính',
  // MoMo / thanh toán số
  'momo','ví momo','thanh toán','chuyển tiền','ví điện tử','fintech','zalopay','vnpay','vnpt pay',
  'ngân hàng số','tài khoản số','open banking','qr code','contactless',
  // Bất động sản (tài sản đầu tư)
  'bất động sản','nhà đất','căn hộ','chung cư','đất nền','vay mua nhà','thị trường nhà',
  // Trái phiếu / quỹ
  'trái phiếu','trái phiếu doanh nghiệp','trái phiếu chính phủ','quỹ mở','quỹ bảo toàn',
]

// Sources that are inherently finance-focused — keep ALL their items
const FINANCE_SOURCES = new Set([
  'CafeF', 'VnEconomy', 'Vietstock', 'Tinnhanhchungkhoan',
  'Dân Trí Tài Chính', 'Báo Đầu Tư', 'Nhịp Cầu Đầu Tư',
  'VnExpress Kinh Doanh', 'Tuổi Trẻ Kinh Tế',
  'r/chungkhoan', 'r/VietNamTrading',
])

function isFinance(title) {
  const t = title.toLowerCase()
  return FINANCE_KW.some(k => t.includes(k))
}

function recencyScore(pubDateStr) {
  if (!pubDateStr) return 40
  const ageH = (Date.now() - new Date(pubDateStr).getTime()) / 3_600_000
  if (ageH < 1)  return 100
  if (ageH < 4)  return 85
  if (ageH < 12) return 70
  if (ageH < 24) return 55
  if (ageH < 48) return 35
  return 15
}

function engagementScore(eng = {}) {
  const { likes = 0, comments = 0, shares = 0, views = 0, upvotes = 0 } = eng
  const raw = likes + comments * 3 + shares * 5 + upvotes * 2 + views * 0.01
  // Normalize: 0 → 0, 1000 → ~60, 10000 → ~100
  return Math.min(100, Math.round(Math.log10(raw + 1) * 33))
}

function computeScore(item, allTitles) {
  const rec = recencyScore(item.pubDate) * 0.30
  const eng = engagementScore(item.engagement) * 0.40
  // multi-source: does this topic appear in 2+ sources?
  const titleWords = item.title.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  const multiHit = allTitles.filter(t => t !== item.title && titleWords.some(w => t.includes(w))).length
  const diversity = Math.min(20, multiHit * 7)
  const relevance = isFinance(item.title) ? 10 : 0
  return Math.round(rec + eng + diversity + relevance)
}

// ── RSS (news) ──
function parseRSS(xml, source, sourceType = 'news') {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10).map(m => {
    const raw = m[1]
    const title = (
      raw.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
      raw.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
    ).trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '')
    const pubDate = raw.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ''
    const link    = raw.match(/<link>(.*?)<\/link>/)?.[1] ?? ''
    return { title, pubDate, link, source, sourceType, engagement: {} }
  }).filter(i => i.title.length > 5)
}

const RSS_SOURCES = [
  // Finance-specific (priority — always pass filter)
  { name: 'CafeF',              url: 'https://cafef.vn/rss/home.rss' },
  { name: 'VnEconomy',          url: 'https://vneconomy.vn/rss/home.rss' },
  { name: 'Vietstock',          url: 'https://vietstock.vn/rss/home.rss' },
  { name: 'Tinnhanhchungkhoan', url: 'https://tinnhanhchungkhoan.vn/rss/thi-truong.rss' },
  { name: 'Dân Trí Tài Chính',  url: 'https://dantri.com.vn/kinh-doanh.rss' },
  { name: 'Báo Đầu Tư',         url: 'https://baodautu.vn/rss/home.rss' },
  { name: 'Nhịp Cầu Đầu Tư',    url: 'https://nhipcaudautu.vn/rss/home.rss' },
  // General — filtered by finance keywords
  { name: 'VnExpress Kinh Doanh', url: 'https://vnexpress.net/rss/kinh-doanh.rss' },
  { name: 'Tuổi Trẻ Kinh Tế',    url: 'https://tuoitre.vn/rss/kinh-te.rss' },
]

// ── Reddit ──
const REDDIT_SUBS = [
  { name: 'r/chungkhoan',      url: 'https://www.reddit.com/r/chungkhoan/hot.json?limit=10' },
  { name: 'r/VietNamTrading',  url: 'https://www.reddit.com/r/VietNamTrading/hot.json?limit=10' },
]

async function fetchReddit(sub) {
  const r = await fetch(sub.url, {
    headers: { 'User-Agent': 'MoMo-SocialTool/1.0' },
    signal: AbortSignal.timeout(8000),
  })
  const json = await r.json()
  return (json.data?.children ?? []).map(c => ({
    title:      c.data.title,
    pubDate:    new Date(c.data.created_utc * 1000).toISOString(),
    link:       `https://reddit.com${c.data.permalink}`,
    source:     sub.name,
    sourceType: 'reddit',
    engagement: { upvotes: c.data.ups, comments: c.data.num_comments },
  })).filter(i => i.title.length > 5)
}

// ── Google Trends VN ──
async function fetchGoogleTrends() {
  const r = await fetch('https://trends.google.com/trends/trendingsearches/daily/rss?geo=VN', {
    signal: AbortSignal.timeout(8000),
  })
  const xml = await r.text()
  return [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)]
    .slice(1, 16)
    .map(m => ({
      title:      m[1].trim(),
      pubDate:    new Date().toISOString(),
      link:       '',
      source:     'Google Trends VN',
      sourceType: 'trends',
      engagement: { views: 1000 }, // trending = popular by definition
    }))
    .filter(i => i.title.length > 3)
}

// ── GET /api/trending ──
app.get('/api/trending', async (req, res) => {
  const force = req.query.force === '1'
  if (!force && trendingCache && Date.now() < trendingCache.expiresAt) {
    return res.json({ items: trendingCache.items, cached: true, fetchedAt: trendingCache.fetchedAt })
  }

  const raw = [...fbManualItems] // start with manually added FB items

  await Promise.allSettled([
    ...RSS_SOURCES.map(async s => {
      try {
        const r = await fetch(s.url, { signal: AbortSignal.timeout(8000) })
        raw.push(...parseRSS(await r.text(), s.name))
      } catch { }
    }),
    ...REDDIT_SUBS.map(async s => {
      try { raw.push(...await fetchReddit(s)) } catch { }
    }),
    (async () => {
      try { raw.push(...await fetchGoogleTrends()) } catch { }
    })(),
  ])

  // Keep only finance-relevant items
  // Rule: always keep FB manual posts + dedicated finance sources + items matching finance keywords
  const financeFiltered = raw.filter(item =>
    item.sourceType === 'facebook' ||
    FINANCE_SOURCES.has(item.source) ||
    isFinance(item.title)
  )

  // Deduplicate by title similarity
  const seen = []
  const deduped = financeFiltered.filter(item => {
    const words = item.title.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    const dup = seen.some(s => words.filter(w => s.includes(w)).length >= 3)
    if (!dup) seen.push(item.title.toLowerCase())
    return !dup
  })

  // Score everything
  const allTitles = deduped.map(i => i.title.toLowerCase())
  const scored = deduped
    .map(item => ({ ...item, score: computeScore(item, allTitles) }))
    .sort((a, b) => b.score - a.score)

  const fetchedAt = new Date().toISOString()
  trendingCache = { items: scored, expiresAt: Date.now() + TRENDING_TTL, fetchedAt }
  console.log(`[trending] ${raw.length} raw → ${financeFiltered.length} finance → ${scored.length} final (fb:${fbManualItems.length})`)
  res.json({ items: scored, cached: false, fetchedAt })
})

// ── POST /api/trending/facebook — manual FB paste ──
app.post('/api/trending/facebook', (req, res) => {
  const { title, likes = 0, comments = 0, shares = 0, views = 0, groupName = 'Facebook', publishedAt } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title required' })
  // Use provided publishedAt for accurate recency scoring; fall back to now
  const pubDate = publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString()
  const item = {
    title: title.trim(),
    pubDate,
    link: '',
    source: groupName,
    sourceType: 'facebook',
    engagement: { likes: +likes, comments: +comments, shares: +shares, views: +views },
  }
  fbManualItems = fbManualItems.filter(i => i.title !== item.title) // dedupe
  fbManualItems.unshift(item)
  fbManualItems = fbManualItems.slice(0, 30) // keep last 30
  trendingCache = null // invalidate cache
  res.json({ ok: true, count: fbManualItems.length })
})

// ── POST /api/gen-content — generate content via Ollama (local, free) ──
app.post('/api/gen-content', async (req, res) => {
  const { slot, samplePosts = [] } = req.body
  if (!slot) return res.status(400).json({ error: 'slot required' })

  // Check Ollama is running
  try {
    const check = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
    if (!check.ok) throw new Error()
  } catch {
    return res.status(503).json({ error: 'Ollama chưa chạy. Mở app Ollama rồi thử lại.' })
  }

  const FORMAT_VI = {
    poll: 'Poll / Bình chọn', educational_post: 'Bài giáo dục tài chính',
    market_update: 'Cập nhật thị trường', qa: 'Hỏi & Đáp',
    service_faq: 'FAQ dịch vụ MoMo', minigame: 'Minigame / Tương tác',
    confession_discussion: 'Thảo luận / Chia sẻ', promo_info: 'Thông tin ưu đãi',
  }
  const d = slot.direction || {}

  const styleExamples = samplePosts
    .filter(p => !p.has_reward && p.post_content && p.er_user > 0)
    .sort((a, b) => b.er_user - a.er_user)
    .slice(0, 3)
    .map((p, i) => `Bài ${i+1} (ER ${(p.er_user*100).toFixed(1)}%):\n"${p.post_content.slice(0, 250)}"`)
    .join('\n\n')

  const prompt = `Bạn là copywriter cho fanpage MaMa Tài Chính (MMTC) của MoMo — tài chính cá nhân, thân thiện, dành cho người Việt 22–45 tuổi.
${styleExamples ? `\nBài mẫu MMTC ER cao (học style này):\n${styleExamples}\n` : ''}
Yêu cầu:
- Định dạng: ${FORMAT_VI[slot.content_format] ?? slot.content_format}
- Chủ đề: ${slot.topic_group}
- Ngày: ${slot.date} lúc ${slot.publish_hour}:00
${d.hook ? `- Hook: ${d.hook}` : ''}
${d.content_angle ? `- Góc nội dung: ${d.content_angle}` : ''}
${d.cta ? `- CTA: ${d.cta}` : ''}
${d.caption_direction ? `- Caption direction: ${d.caption_direction}` : ''}
${slot.notes ? `- Ghi chú: ${slot.notes}` : ''}

Viết 2 phiên bản caption (80–130 chữ mỗi bản). Học tone/style bài mẫu. Hook thu hút, kết thúc câu hỏi mở hoặc CTA. Không hashtag trừ minigame/poll.

**Phiên bản 1:**
[caption]

**Phiên bản 2:**
[caption]`

  // Get available model — prefer qwen2.5:1.5b, fallback to first available
  let model = 'qwen2.5:1.5b'
  try {
    const tagsRes = await fetch('http://localhost:11434/api/tags')
    const tags = await tagsRes.json()
    const models = tags.models?.map(m => m.name) ?? []
    if (!models.some(m => m.startsWith('qwen2.5'))) {
      const first = models[0]
      if (!first) return res.status(503).json({ error: `Chưa có model nào. Chạy: ollama pull qwen2.5:1.5b` })
      model = first
    } else {
      model = models.find(m => m === 'qwen2.5:1.5b') || models.find(m => m.startsWith('qwen2.5')) || model
    }
  } catch {}

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
        options: { temperature: 0.8, num_predict: 800 },
      }),
    })

    const reader = ollamaRes.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const json = JSON.parse(line)
          const text = json.message?.content ?? ''
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
          if (json.done) { res.write('data: [DONE]\n\n'); res.end(); return }
        } catch {}
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[gen-content]', err.message)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

// Serve built frontend if dist/ exists
const distPath = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((_, res) => res.sendFile(path.join(distPath, 'index.html')))
  console.log('Serving frontend from dist/')
}

app.listen(3001, () => console.log('MoMo proxy: http://localhost:3001 (cache TTL 5m)'))
