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
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import { PDFParse } from 'pdf-parse'
import { PAGE_CONFIGS, DEFAULT_PAGE_ID } from './src/config/pages.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const app = express()
app.use(express.json({ limit: '20mb' }))
// Serve public/ folder (elements, post-images, data) for both dev and prod
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')))
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// ── Path helpers ──────────────────────────────────────────────────────────────
const ROOT_DIR       = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR       = path.join(ROOT_DIR, 'data')
const CHARACTERS_DIR = path.join(DATA_DIR, 'characters')
const APPROVED_DIR   = path.join(DATA_DIR, 'approved')

if (!fs.existsSync(CHARACTERS_DIR)) fs.mkdirSync(CHARACTERS_DIR, { recursive: true })
if (!fs.existsSync(APPROVED_DIR))   fs.mkdirSync(APPROVED_DIR,   { recursive: true })

// ── MCP / data proxy ─────────────────────────────────────────────────────────
const TOKEN_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.mcp-auth/mcp-remote-0.1.37/b8bf4fefa28c3b5b22446f25a076e79a_tokens.json'
)
const CLIENT_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.mcp-auth/mcp-remote-0.1.37/b8bf4fefa28c3b5b22446f25a076e79a_client_info.json'
)
const MCP_URL        = 'https://mdp-mcp-gateway.mservice.io/servers/adc70a2c746049c08fdf1c0e1965a94e/mcp'
const TOKEN_ENDPOINT = 'https://mdp-mcp-gateway.mservice.io/oauth/token'
const DATASOURCE_ID  = '3c0ba297-ea18-429e-9225-6980d7f21463'
const CACHE_TTL_MS   = 5 * 60 * 1000
const cache          = new Map()

// In-memory token store (fallback when no local file — e.g. Render)
let memTokens = process.env.MCP_REFRESH_TOKEN ? {
  access_token:  process.env.MCP_ACCESS_TOKEN  || '',
  refresh_token: process.env.MCP_REFRESH_TOKEN || '',
} : null
const MCP_CLIENT_ID = process.env.MCP_CLIENT_ID || null

function readTokens() {
  if (memTokens) return memTokens
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
}

function saveTokens(t) {
  if (memTokens) { memTokens = { ...memTokens, ...t }; return }
  try { fs.writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2)) } catch {}
}

async function refreshToken() {
  const tokens = readTokens()
  const clientId = MCP_CLIENT_ID ||
    JSON.parse(fs.readFileSync(CLIENT_PATH, 'utf-8')).client_id
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: clientId,
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

app.post('/api/momo-data', async (req, res) => {
  // mcpPageId is the numeric Facebook page_id from pageConfig.mcp_page_id
  // We cache ALL pages together (shared cache key), then filter per page.
  // This avoids non-deterministic MCP results when two page-specific requests
  // each make independent MCP calls and get different 1000-row slices.
  const { startDate, endDate, limit = 1000, mcpPageId } = req.body

  const allPagesKey = `${startDate}|${endDate}|${limit}|all`

  const cached = cache.get(allPagesKey)
  if (cached && Date.now() < cached.expiresAt) {
    const rows = mcpPageId
      ? cached.data.rows.filter(r => String(r['feed_agg_user_engagement.page_id'] ?? '') === String(mcpPageId))
      : cached.data.rows
    console.log(`[cache] HIT ${allPagesKey} → ${rows.length} rows (pageId=${mcpPageId ?? 'all'})`)
    return res.json({ rows, refreshTime: cached.data.refreshTime, cached: true })
  }

  console.log(`[mcp] querying engagement ${allPagesKey}`)
  const t0 = Date.now()

  try {
    const query = {
      measures: ALL_MEASURES,
      dimensions: [
        'feed_agg_user_engagement.page_name',
        'feed_agg_user_engagement.page_id',
        'feed_agg_user_engagement.post_id',
      ],
      filters: [
        { member: 'feed_agg_user_engagement.post_type', operator: 'equals', values: ['Fanpage post'] },
      ],
      limit,
      timezone: 'Asia/Ho_Chi_Minh',
      order: { 'feed_agg_user_engagement.date': 'desc' },
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
    const allRows = result?.data?.data ?? []
    const refreshTime = result?.data?.lastRefreshTime

    if (allRows.length > 0) {
      cache.set(allPagesKey, { data: { rows: allRows, refreshTime }, expiresAt: Date.now() + CACHE_TTL_MS })
    }

    const rows = mcpPageId
      ? allRows.filter(r => String(r['feed_agg_user_engagement.page_id'] ?? '') === String(mcpPageId))
      : allRows

    console.log(`[mcp] done in ${Date.now() - t0}ms, ${allRows.length} total → ${rows.length} rows (pageId=${mcpPageId ?? 'all'})`)
    res.json({ rows, refreshTime })
  } catch (e) {
    console.error('[mcp] error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════════════
// CONTENT DATA — from feed_agg_post_criteria cube
// Confirmed dimensions: post_id, page_id, page_name
// Pending data-team permission: post_desc, created_date, created_hour, day_of_week,
//   topic_group, content_format, has_reward
// ══════════════════════════════════════════════

const CONTENT_DIMENSIONS = [
  'feed_agg_post_criteria.page_name',
  'feed_agg_post_criteria.post_id',
  'feed_agg_post_criteria.post_desc',
  'feed_agg_post_criteria.created_date',
  'feed_agg_post_criteria.created_hour',
  'feed_agg_post_criteria.day_of_week',
  'feed_agg_post_criteria.topic_group',
  'feed_agg_post_criteria.content_format',
  'feed_agg_post_criteria.has_reward',
]

app.post('/api/momo-content', async (req, res) => {
  const { startDate, endDate, limit = 1000, mcpPageId } = req.body

  const cacheKey = `content|${startDate}|${endDate}|${limit}|${mcpPageId ?? 'all'}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[cache] HIT ${cacheKey}`)
    return res.json({ ...cached.data, cached: true })
  }

  console.log(`[mcp-content] querying ${cacheKey}`)
  const t0 = Date.now()

  try {
    const query = {
      dimensions: CONTENT_DIMENSIONS,
      filters: [],
      limit,
      timezone: 'Asia/Ho_Chi_Minh',
      order: { 'feed_agg_post_criteria.created_date': 'desc' },
    }
    if (startDate && endDate) {
      query.timeDimensions = [{
        dimension: 'feed_agg_post_criteria.created_date',
        dateRange: [startDate, endDate],
      }]
    }

    const d = await callMcp({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
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
    if (rows.length > 0) {
      cache.set(cacheKey, { data: responseData, expiresAt: Date.now() + CACHE_TTL_MS })
    }
    console.log(`[mcp-content] done in ${Date.now() - t0}ms, ${rows.length} rows`)
    res.json(responseData)
  } catch (e) {
    console.error('[mcp-content] error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════════════
// TRENDING ENGINE — page-aware
// ══════════════════════════════════════════════
const TRENDING_TTL = 30 * 60 * 1000

// Per-page caches and manual FB items
const trendingCacheMap  = new Map()  // pageId → { items, expiresAt, fetchedAt }
const fbManualItemsMap  = new Map()  // pageId → item[]

function getTrendConfig(pageId) {
  const cfg = PAGE_CONFIGS[pageId] ?? PAGE_CONFIGS[DEFAULT_PAGE_ID]
  return cfg.trend_config ?? PAGE_CONFIGS[DEFAULT_PAGE_ID].trend_config
}

function getFbItems(pageId) {
  if (!fbManualItemsMap.has(pageId)) fbManualItemsMap.set(pageId, [])
  return fbManualItemsMap.get(pageId)
}

function isRelevant(item, trendConfig) {
  if (item.sourceType === 'facebook') return true
  if (trendConfig.priority_sources?.includes(item.source)) return true
  const t = item.title.toLowerCase()
  return (trendConfig.domain_keywords ?? []).some(k => t.includes(k))
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
  return Math.min(100, Math.round(Math.log10(raw + 1) * 33))
}

function computeScore(item, allTitles, trendConfig) {
  const rec = recencyScore(item.pubDate) * 0.30
  const eng = engagementScore(item.engagement) * 0.40
  const titleWords = item.title.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  const multiHit  = allTitles.filter(t => t !== item.title && titleWords.some(w => t.includes(w))).length
  const diversity = Math.min(20, multiHit * 7)
  const relevance = isRelevant(item, trendConfig) ? 10 : 0
  return Math.round(rec + eng + diversity + relevance)
}

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

async function fetchGoogleTrends(geo = 'VN') {
  const r = await fetch(`https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`, {
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
      engagement: { views: 1000 },
    }))
    .filter(i => i.title.length > 3)
}

// GET /api/trending?pageId=mama_tai_chinh&force=1
app.get('/api/trending', async (req, res) => {
  const pageId   = req.query.pageId || DEFAULT_PAGE_ID
  const force    = req.query.force === '1'
  const cfg      = getTrendConfig(pageId)
  const cached   = trendingCacheMap.get(pageId)

  if (!force && cached && Date.now() < cached.expiresAt) {
    return res.json({ items: cached.items, cached: true, fetchedAt: cached.fetchedAt })
  }

  const raw = [...getFbItems(pageId)]

  await Promise.allSettled([
    ...(cfg.rss_sources ?? []).map(async s => {
      try {
        const r = await fetch(s.url, { signal: AbortSignal.timeout(8000) })
        raw.push(...parseRSS(await r.text(), s.name))
      } catch { }
    }),
    ...(cfg.reddit_subs ?? []).map(async s => {
      try { raw.push(...await fetchReddit(s)) } catch { }
    }),
    (async () => {
      try { raw.push(...await fetchGoogleTrends(cfg.google_trends_geo || 'VN')) } catch { }
    })(),
  ])

  const filtered = raw.filter(item => isRelevant(item, cfg))

  const seen = []
  const deduped = filtered.filter(item => {
    const words = item.title.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    const dup = seen.some(s => words.filter(w => s.includes(w)).length >= 3)
    if (!dup) seen.push(item.title.toLowerCase())
    return !dup
  })

  const allTitles = deduped.map(i => i.title.toLowerCase())
  const scored = deduped
    .map(item => ({ ...item, score: computeScore(item, allTitles, cfg) }))
    .sort((a, b) => b.score - a.score)

  const fetchedAt = new Date().toISOString()
  trendingCacheMap.set(pageId, { items: scored, expiresAt: Date.now() + TRENDING_TTL, fetchedAt })
  console.log(`[trending:${pageId}] ${raw.length} raw → ${filtered.length} relevant → ${scored.length} final`)
  res.json({ items: scored, cached: false, fetchedAt })
})

// POST /api/trending/facebook?pageId=mama_tai_chinh
app.post('/api/trending/facebook', (req, res) => {
  const pageId = req.query.pageId || req.body.pageId || DEFAULT_PAGE_ID
  const { title, likes = 0, comments = 0, shares = 0, views = 0, groupName = 'Facebook', publishedAt } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title required' })

  const pubDate = publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString()
  const item = {
    title: title.trim(), pubDate, link: '',
    source: groupName, sourceType: 'facebook',
    engagement: { likes: +likes, comments: +comments, shares: +shares, views: +views },
  }

  const items = getFbItems(pageId)
  const updated = items.filter(i => i.title !== item.title)
  updated.unshift(item)
  fbManualItemsMap.set(pageId, updated.slice(0, 30))
  trendingCacheMap.delete(pageId)  // invalidate page cache
  res.json({ ok: true, count: fbManualItemsMap.get(pageId).length })
})

// ══════════════════════════════════════════════
// CHARACTER PROFILE — per-page knowledge base
// ══════════════════════════════════════════════

function getRecencyWeight(createdDate) {
  if (!createdDate) return 1.0
  const ageDays = (Date.now() - new Date(createdDate).getTime()) / 86_400_000
  if (ageDays <= 30)  return 2.0
  if (ageDays <= 90)  return 1.0
  return 0.5
}

function loadApproved(pageId) {
  const filePath = path.join(APPROVED_DIR, `${pageId}.json`)
  if (!fs.existsSync(filePath)) return []
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { return [] }
}

function buildCharacterProfile(posts, pageConfig) {
  const withContent = posts.filter(p => p.post_content?.length > 30)
  const organic     = withContent.filter(p => !p.has_reward)

  // Load approved captions for this page
  const approvedItems = loadApproved(pageConfig.page_id)

  // Format-level stats with recency weighting
  const formatStats = {}
  for (const p of withContent) {
    const f = p.content_format
    if (!f) continue
    const w = getRecencyWeight(p.created_time)
    if (!formatStats[f]) formatStats[f] = { posts: [], totalER: 0, totalWeight: 0 }
    formatStats[f].posts.push({ ...p, _weight: w })
    formatStats[f].totalER     += (p.er_user || 0) * w
    formatStats[f].totalWeight += w
  }

  const formatAnalysis = {}
  for (const [fmt, stats] of Object.entries(formatStats)) {
    // Sort by weighted ER descending for top openers
    const sorted = [...stats.posts].sort((a, b) => ((b.er_user || 0) * b._weight) - ((a.er_user || 0) * a._weight))
    const approvedForFmt = approvedItems.filter(a => a.content_format === fmt)

    formatAnalysis[fmt] = {
      sample_size:      stats.posts.length,
      avg_er:           Math.round((stats.totalER / stats.totalWeight) * 10000) / 10000,
      avg_length_chars: Math.round(sorted.reduce((s, p) => s + p.post_content.length, 0) / sorted.length),
      // Approved captions first, then top historical openers
      top_openers: [
        ...approvedForFmt.slice(0, 2).map(a => ({
          preview:      a.caption.substring(0, 120).trim(),
          er:           null,
          has_reward:   false,
          is_approved:  true,
          approved_at:  a.created_at,
        })),
        ...sorted.slice(0, 3).map(p => ({
          preview:    p.post_content.substring(0, 120).trim(),
          er:         p.er_user,
          has_reward: p.has_reward,
        })),
      ].slice(0, 4),
    }
  }

  // Top angles (organic posts, by topic × format) with recency weighting
  const angleMap = {}
  for (const p of organic) {
    const w   = getRecencyWeight(p.created_time)
    const key = `${p.topic_group}__${p.content_format}`
    if (!angleMap[key]) {
      angleMap[key] = {
        topic:             p.topic_group,
        format:            p.content_format,
        best_er:           0,
        best_post_preview: '',
        sample_count:      0,
        weighted_er_sum:   0,
        weight_sum:        0,
        avg_er:            0,
        has_approved:      false,
        approved_preview:  null,
      }
    }
    const slot = angleMap[key]
    slot.sample_count++
    slot.weighted_er_sum += (p.er_user || 0) * w
    slot.weight_sum      += w
    slot.avg_er           = slot.weighted_er_sum / slot.weight_sum
    if ((p.er_user || 0) > slot.best_er) {
      slot.best_er           = p.er_user || 0
      slot.best_post_preview = p.post_content.substring(0, 200).trim()
    }
  }

  // Merge approved content into angle map
  for (const a of approvedItems) {
    const key = `${a.topic_group}__${a.content_format}`
    if (angleMap[key]) {
      angleMap[key].has_approved     = true
      angleMap[key].approved_preview = a.caption.substring(0, 120).trim()
    }
  }

  // Sort: approved angles first, then by weighted avg ER
  const sortedAngles = Object.values(angleMap).sort((a, b) => {
    if (a.has_approved !== b.has_approved) return a.has_approved ? -1 : 1
    return b.avg_er - a.avg_er
  })

  // Engagement trigger analysis — use only last 90 days for recency signal
  const cutoff90 = Date.now() - 90 * 86_400_000
  const recentOrg = organic.filter(p => {
    if (!p.created_time) return true
    return new Date(p.created_time).getTime() >= cutoff90
  })
  const goodER      = pageConfig.benchmarks?.er_good || 0.45
  const highOrg     = recentOrg.filter(p => p.er_user >= goodER)
  const hasEmoji    = c => /\p{Emoji}/u.test(c.substring(0, 60))
  const hasNumber   = c => /\d+[%.,]?\d*/.test(c)
  const hasQuestion = c => c.includes('?')

  return {
    page_id:   pageConfig.page_id,
    page_name: pageConfig.page_name,
    built_at:  new Date().toISOString(),
    recency_weighted:       true,
    approved_content_count: approvedItems.length,
    organic_posts_analyzed: organic.length,
    total_posts_analyzed:   withContent.length,
    format_analysis: formatAnalysis,
    top_angles_organic: sortedAngles.slice(0, 12),
    engagement_triggers: {
      high_er_organic_count: highOrg.length,
      window_days:           90,
      emoji_in_opener_pct:   highOrg.length ? Math.round(highOrg.filter(p => hasEmoji(p.post_content)).length / highOrg.length * 100) : 0,
      number_in_content_pct: highOrg.length ? Math.round(highOrg.filter(p => hasNumber(p.post_content)).length / highOrg.length * 100) : 0,
      question_present_pct:  highOrg.length ? Math.round(highOrg.filter(p => hasQuestion(p.post_content)).length / highOrg.length * 100) : 0,
    },
  }
}

// GET /api/character/:pageId
app.get('/api/character/:pageId', (req, res) => {
  const { pageId } = req.params
  const filePath   = path.join(CHARACTERS_DIR, `${pageId}.json`)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Character profile for '${pageId}' not found.`, hint: 'POST /api/build-character to create it.' })
  }
  res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')))
})

// POST /api/build-character  { pageId, posts }
app.post('/api/build-character', (req, res) => {
  const { pageId, posts = [] } = req.body
  const pageCfg = PAGE_CONFIGS[pageId]
  if (!pageCfg) return res.status(400).json({ error: `Unknown pageId: ${pageId}` })

  const profile  = buildCharacterProfile(posts, pageCfg)
  const filePath = path.join(CHARACTERS_DIR, `${pageId}.json`)

  // Merge with existing editorial knowledge if file exists
  let existing = {}
  if (fs.existsSync(filePath)) {
    try { existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch {}
  }
  // Preserve hand-crafted editorial sections, overwrite data-driven sections
  const merged = {
    ...existing,           // keeps voice, storytelling, visual_design, frameworks from hand-craft
    ...profile,            // overwrites data-driven sections
    voice:          existing.voice          ?? profile.voice,
    storytelling:   existing.storytelling   ?? profile.storytelling,
    visual_design:  existing.visual_design  ?? profile.visual_design,
    frameworks:     existing.frameworks     ?? profile.frameworks,
    format_patterns:existing.format_patterns ?? {},
  }
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2))
  console.log(`[character] built for ${pageId}: ${profile.organic_posts_analyzed} organic / ${profile.total_posts_analyzed} total posts`)
  res.json({ ok: true, profile: merged })
})

// ══════════════════════════════════════════════
// APPROVED CONTENT — human-in-the-loop feedback
// ══════════════════════════════════════════════

// POST /api/approved-content
app.post('/api/approved-content', (req, res) => {
  const { pageId, topicGroup, contentFormat, caption, source, slotDate, slotId } = req.body
  if (!pageId || !caption?.trim()) return res.status(400).json({ error: 'pageId and caption required' })

  const filePath = path.join(APPROVED_DIR, `${pageId}.json`)
  let items = []
  if (fs.existsSync(filePath)) {
    try { items = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch {}
  }

  const newItem = {
    id:             `approved_${Date.now()}`,
    page_id:        pageId,
    topic_group:    topicGroup   || null,
    content_format: contentFormat || null,
    caption:        caption.trim(),
    source:         source        || 'generated_kept',
    slot_date:      slotDate      || null,
    slot_id:        slotId        || null,
    created_at:     new Date().toISOString(),
  }

  // Deduplicate by caption prefix (first 60 chars) then prepend, keep max 200
  const prefix = newItem.caption.substring(0, 60)
  const deduped = items.filter(i => i.caption.substring(0, 60) !== prefix)
  deduped.unshift(newItem)
  const trimmed = deduped.slice(0, 200)

  fs.writeFileSync(filePath, JSON.stringify(trimmed, null, 2))
  console.log(`[approved] saved for ${pageId}: "${newItem.caption.substring(0, 50)}…"`)
  res.json({ ok: true, id: newItem.id, total: trimmed.length })
})

// GET /api/approved-content/:pageId
app.get('/api/approved-content/:pageId', (req, res) => {
  const { pageId } = req.params
  res.json({ items: loadApproved(pageId) })
})

// DELETE /api/approved-content/:pageId/:id
app.delete('/api/approved-content/:pageId/:id', (req, res) => {
  const { pageId, id } = req.params
  const filePath = path.join(APPROVED_DIR, `${pageId}.json`)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not found' })
  let items = []
  try { items = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch {}
  const filtered = items.filter(i => i.id !== id)
  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2))
  res.json({ ok: true, removed: items.length - filtered.length })
})

// ══════════════════════════════════════════════
// CONTENT GENERATION — character-aware
// ══════════════════════════════════════════════

function loadCharacter(pageId) {
  const filePath = path.join(CHARACTERS_DIR, `${pageId}.json`)
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch {}
  }
  return null
}

const FORMAT_VI = {
  // MMTC formats — giữ nguyên
  poll:                  'Poll / Bình chọn',
  educational_post:      'Bài giáo dục tài chính',
  market_update:         'Cập nhật thị trường',
  qa:                    'Hỏi & Đáp',
  service_faq:           'FAQ dịch vụ MoMo',
  minigame:              'Minigame / Tương tác',
  confession_discussion: 'Thảo luận / Chia sẻ',
  promo_info:            'Thông tin ưu đãi',
  // Heo Đất formats
  minigame_quiz:         'Minigame / Đố vui rinh lộc',
  gamified_reward:       'Gamified reward — thả tim nhận quà',
  thanh_qua_du_an:       'Thành quả dự án quyên góp',
  donation_call:         'Kêu gọi quyên góp chiến dịch',
  event_comms:           'Event comms — sự kiện cộng đồng',
  kindness_story:        'Kindness story — câu chuyện cộng đồng',
}

function buildGenPrompt(slot, character, samplePosts) {
  const d       = slot.direction || {}
  const pageId  = slot.page_id || DEFAULT_PAGE_ID
  const pageCfg = PAGE_CONFIGS[pageId] ?? PAGE_CONFIGS[DEFAULT_PAGE_ID]

  // Approved captions matching this topic+format (highest priority learning signal)
  const allApproved = loadApproved(pageId)
  const matchedApproved = allApproved.filter(a =>
    (!a.topic_group    || a.topic_group    === slot.topic_group) &&
    (!a.content_format || a.content_format === slot.content_format)
  ).slice(0, 5)
  const broadApproved = matchedApproved.length < 2
    ? allApproved.filter(a => a.content_format === slot.content_format).slice(0, 3)
    : []

  // Style examples from top organic posts
  const styleExamples = samplePosts
    .filter(p => !p.has_reward && p.post_content && p.er_user > 0)
    .sort((a, b) => b.er_user - a.er_user)
    .slice(0, 3)
    .map((p, i) => `Bài ${i + 1} (ER ${(p.er_user * 100).toFixed(1)}%):\n"${p.post_content.slice(0, 280)}"`)
    .join('\n\n')

  // Character sections (if profile exists)
  const voice          = character?.voice
  const storytelling   = character?.storytelling
  const fmtPattern     = character?.format_patterns?.[slot.content_format]
  const fmtAnalysis    = character?.format_analysis?.[slot.content_format]
  const topAngle       = character?.top_angles_organic?.find(
    a => a.topic === slot.topic_group && a.format === slot.content_format
  )

  let prompt = `Bạn là ${voice?.persona ?? `copywriter cho fanpage ${pageCfg.page_name}`}.\n`
  prompt += `Đối tượng: ${pageCfg.audience}\n\n`

  if (voice) {
    prompt += `══ PHONG CÁCH TRANG ══\n`
    prompt += `Tone: ${voice.tone}\n`
    prompt += `Xưng hô: ${voice.address_style}\n`
    if (voice.emoji_style) prompt += `Emoji: ${voice.emoji_style}\n`
    if (voice.vocabulary?.preferred?.length)
      prompt += `Từ hay dùng: ${voice.vocabulary.preferred.join(', ')}\n`
    if (voice.vocabulary?.avoid?.length)
      prompt += `Từ TRÁNH: ${voice.vocabulary.avoid.join(', ')}\n`
    prompt += '\n'
  }

  if (storytelling) {
    prompt += `══ FRAMEWORK VIẾT BÀI ══\n`
    prompt += `${storytelling.primary_framework}\n`
    if (storytelling.structure_principles?.length)
      prompt += storytelling.structure_principles.map(p => `• ${p}`).join('\n') + '\n'
    prompt += '\n'
  }

  if (fmtPattern) {
    prompt += `══ PATTERN FORMAT "${FORMAT_VI[slot.content_format] ?? slot.content_format}" ══\n`
    prompt += `Opener: ${fmtPattern.opener}\n`
    prompt += `Cấu trúc: ${fmtPattern.structure}\n`
    if (fmtPattern.avg_length_chars) prompt += `Độ dài target: ~${fmtPattern.avg_length_chars} ký tự\n`
    if (fmtPattern.emoji_anchors?.length) prompt += `Emoji anchors: ${fmtPattern.emoji_anchors.join(' ')}\n`
    if (fmtPattern.cta_pattern) prompt += `CTA điển hình: ${fmtPattern.cta_pattern}\n`
    prompt += '\n'
    if (fmtPattern.mandatory_elements?.length) {
      prompt += `══ YÊU CẦU BẮT BUỘC TRONG BÀI ══\n`
      fmtPattern.mandatory_elements.forEach(e => prompt += `• ${e}\n`)
      prompt += '\n'
    }
    if (fmtPattern.tone_note) {
      prompt += `══ LƯU Ý TONE ══\n${fmtPattern.tone_note}\n\n`
    }
    if (fmtPattern.reward_position) {
      prompt += `Vị trí announce reward: ${fmtPattern.reward_position}\n\n`
    }
  } else if (fmtAnalysis) {
    prompt += `══ DỮ LIỆU FORMAT "${FORMAT_VI[slot.content_format] ?? slot.content_format}" ══\n`
    prompt += `Avg ER: ${(fmtAnalysis.avg_er * 100).toFixed(1)}% · Avg length: ${fmtAnalysis.avg_length_chars} ký tự\n`
    prompt += '\n'
  }

  if (topAngle) {
    prompt += `══ GÓC NỘI DUNG ĐÃ PROVEN (organic) ══\n`
    prompt += `Topic "${slot.topic_group}" × "${slot.content_format}": avg ER ${(topAngle.avg_er * 100).toFixed(1)}%\n`
    prompt += `Bài mẫu tốt nhất: "${topAngle.best_post_preview}"\n\n`
  }

  // Inject approved captions — highest priority learning signal
  const approvedExamples = [...matchedApproved, ...broadApproved]
  if (approvedExamples.length) {
    prompt += `══ CAPTION ĐÃ ĐƯỢC DUYỆT — HỌC STYLE NÀY (ưu tiên tuyệt đối) ══\n`
    prompt += `[Đây là các caption thực tế đã được team content duyệt và sử dụng. Học tone, cấu trúc, ngữ điệu từ các bài này.]\n`
    approvedExamples.forEach((a, i) => {
      const meta = [a.topic_group, a.content_format, a.slot_date].filter(Boolean).join(' · ')
      prompt += `Bài duyệt ${i + 1}${meta ? ` (${meta})` : ''}:\n"${a.caption}"\n\n`
    })
  }

  if (styleExamples) {
    prompt += `══ BÀI MẪU THỰC TẾ (học style) ══\n${styleExamples}\n\n`
  }

  prompt += `══ YÊU CẦU BÀI NÀY ══\n`
  prompt += `Định dạng: ${FORMAT_VI[slot.content_format] ?? slot.content_format}\n`
  prompt += `Chủ đề: ${slot.topic_group}\n`
  prompt += `Ngày đăng: ${slot.date} lúc ${slot.publish_hour}:00\n`
  if (d.hook)            prompt += `Hook gợi ý: ${d.hook}\n`
  if (d.content_angle)   prompt += `Góc nội dung: ${d.content_angle}\n`
  if (d.cta)             prompt += `CTA: ${d.cta}\n`
  if (d.caption_direction) prompt += `Caption direction: ${d.caption_direction}\n`
  if (slot.notes)        prompt += `Ghi chú: ${slot.notes}\n`
  if (slot.bu_campaign)  prompt += `BU Campaign: ${slot.bu_campaign}\n`
  prompt += '\n'

  prompt += `Viết 1 caption tiếng Việt:
- Học đúng tone/style bài mẫu
- Áp dụng đúng format pattern
- Hook thu hút, kết thúc câu hỏi mở hoặc CTA rõ ràng
- Không hashtag (trừ minigame/poll)

Chỉ trả về caption, không có tiêu đề "Phiên bản" hay chú thích thêm.`

  return prompt
}

// POST /api/parse-event-file  { fileData, fileType, fileName }
app.post('/api/parse-event-file', express.json({ limit: '15mb' }), async (req, res) => {
  const { fileData, fileType, fileName } = req.body
  if (!fileData || !fileType) return res.status(400).json({ error: 'fileData và fileType là bắt buộc' })

  const isImage = fileType.startsWith('image/')
  const isPDF   = fileType === 'application/pdf'
  if (!isImage && !isPDF) {
    return res.status(400).json({ error: 'Chỉ hỗ trợ hình ảnh (PNG, JPG, WEBP) và PDF.' })
  }

  const extractPrompt = `Trích xuất thông tin sự kiện / campaign từ nội dung bên dưới. Trả về JSON hợp lệ:
{
  "name": "Tóm tắt ý chính / chủ đề trung tâm của nội dung trong 1 câu ngắn (luôn có — nếu không tìm được tên chính thức thì viết ý chính)",
  "date": "ngày ra mắt định dạng YYYY-MM-DD (null nếu không rõ)",
  "mechanic": "hình thức tham gia (null nếu không mô tả rõ)",
  "reward": "phần thưởng cụ thể (null nếu không có)",
  "cta": "kêu gọi hành động (null nếu không có)",
  "keyMessage": "thông điệp chính tối đa 2 câu (null nếu không rõ)",
  "stats": "các số liệu / con số cụ thể được nhắc đến trong nội dung, cách nhau bằng dấu phẩy (VD: 20 bé, 10.000đ, 50 người) — null nếu không có số liệu nào"
}
Chỉ lấy thông tin có thật. Không suy diễn. Trả về JSON thuần, không giải thích.`

  try {
    let aiText = ''

    if (isImage) {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 512,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${fileType};base64,${fileData}` } },
          { type: 'text', text: extractPrompt },
        ]}],
      })
      aiText = resp.choices[0]?.message?.content ?? ''
    } else {
      // PDF: extract text with pdf-parse, then send to GPT-4o mini as plain text
      const pdfBuf  = Buffer.from(fileData, 'base64')
      const pdfUint = new Uint8Array(pdfBuf)
      const parser  = new PDFParse({ data: pdfUint, verbosity: 0 })
      await parser.load()
      const extracted = await parser.getText()
      const pdfText = extracted.text?.replace(/\s+/g, ' ').trim().slice(0, 3000) ?? ''
      if (!pdfText) throw new Error('Không đọc được nội dung PDF. File có thể bị scan dạng ảnh — thử upload ảnh chụp màn hình thay thế.')

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 512,
        temperature: 0.1,
        messages: [{ role: 'user', content: `${extractPrompt}\n\nNội dung tài liệu:\n${pdfText}` }],
      })
      aiText = resp.choices[0]?.message?.content ?? ''
    }

    const start = aiText.indexOf('{')
    const end   = aiText.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('AI không trả về JSON hợp lệ')
    const parsed = JSON.parse(aiText.slice(start, end + 1))
    const clean  = k => (parsed[k] && parsed[k] !== 'null' && parsed[k] !== 'N/A' && String(parsed[k]).trim() !== '') ? String(parsed[k]).trim() : ''

    const result = {
      name: clean('name'), date: clean('date'), mechanic: clean('mechanic'),
      reward: clean('reward'), cta: clean('cta'), keyMessage: clean('keyMessage'),
      stats: clean('stats'),
    }
    const filledCount = Object.values(result).filter(v => v).length
    console.log(`[parse-event-file] ${fileName} (${isPDF ? 'PDF' : 'image'}) → ${filledCount}/7 fields filled`)

    if (filledCount === 0) {
      return res.json({ ...result, warning: 'AI không tìm thấy thông tin campaign trong file. File có thể không phải brief — nhập thủ công hoặc thử file khác.' })
    }
    res.json(result)
  } catch (err) {
    console.error('[parse-event-file]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/parse-event-url  { url }
app.post('/api/parse-event-url', async (req, res) => {
  const { url } = req.body
  if (!url?.trim() || !url.startsWith('http')) {
    return res.status(400).json({ error: 'url không hợp lệ — phải bắt đầu bằng http' })
  }

  const extractPrompt = `Trích xuất thông tin sự kiện / campaign từ nội dung trang web bên dưới. Trả về JSON hợp lệ:
{
  "name": "Tóm tắt ý chính / chủ đề trung tâm trong 1 câu ngắn (luôn có)",
  "date": "ngày ra mắt định dạng YYYY-MM-DD (null nếu không rõ)",
  "mechanic": "hình thức tham gia (null nếu không mô tả rõ)",
  "reward": "phần thưởng cụ thể (null nếu không có)",
  "cta": "kêu gọi hành động (null nếu không có)",
  "keyMessage": "thông điệp chính tối đa 2 câu (null nếu không rõ)",
  "stats": "các số liệu / con số cụ thể, cách nhau dấu phẩy (null nếu không có)"
}
Chỉ lấy thông tin có thật. Không suy diễn. Trả về JSON thuần, không giải thích.`

  try {
    // ── Fetch page HTML ──
    const pageRes = await fetch(url.trim(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoMo-SocialTool/1.0)' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    if (!pageRes.ok) throw new Error(`Không tải được trang (HTTP ${pageRes.status})`)

    const html = await pageRes.text()

    // ── Strip HTML → plain text ──
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3500)

    if (text.length < 40) throw new Error('Trang không có nội dung đọc được — thử upload ảnh chụp màn hình thay thế.')

    // ── GPT extract ──
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      temperature: 0.1,
      messages: [{ role: 'user', content: `${extractPrompt}\n\nNội dung trang:\n${text}` }],
    })
    const aiText = resp.choices[0]?.message?.content ?? ''
    const start  = aiText.indexOf('{')
    const end    = aiText.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('AI không trả về JSON hợp lệ')

    const parsed = JSON.parse(aiText.slice(start, end + 1))
    const clean  = k => (parsed[k] && parsed[k] !== 'null' && parsed[k] !== 'N/A' && String(parsed[k]).trim() !== '') ? String(parsed[k]).trim() : ''
    const result = {
      name: clean('name'), date: clean('date'), mechanic: clean('mechanic'),
      reward: clean('reward'), cta: clean('cta'), keyMessage: clean('keyMessage'),
      stats: clean('stats'),
    }
    const filledCount = Object.values(result).filter(v => v).length
    console.log(`[parse-event-url] ${url} → ${filledCount}/7 fields filled`)

    if (filledCount === 0) {
      return res.json({ ...result, warning: 'AI không tìm thấy thông tin campaign trong trang. Thử upload file brief thay thế.' })
    }
    res.json(result)
  } catch (err) {
    console.error('[parse-event-url]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai-fill  { prompt } — GPT-4o mini, non-streaming, returns Ollama-compatible shape
app.post('/api/ai-fill', async (req, res) => {
  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: 'prompt required' })
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    })
    const content = resp.choices[0]?.message?.content ?? ''
    // Return Ollama-compatible shape so existing callers work unchanged
    res.json({ message: { content } })
  } catch (err) {
    console.error('[ai-fill]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/gen-content  — GPT-4o streaming SSE
app.post('/api/gen-content', async (req, res) => {
  const { slot, samplePosts = [] } = req.body
  if (!slot) return res.status(400).json({ error: 'slot required' })

  const character = loadCharacter(slot.page_id || DEFAULT_PAGE_ID)
  const prompt    = buildGenPrompt(slot, character, samplePosts)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.8,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    })
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
      if (chunk.choices[0]?.finish_reason === 'stop') break
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[gen-content]', err.message)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

// MaMa character illustration prompt (center element only — template frame is rendered in HTML/CSS)
const MAMA_BRAND_VISUAL = `
CHARACTER ILLUSTRATION ONLY — for center area of a MaMa Tài Chính social media post template.
The background frame (pink canvas, stripes, badge, CTA bar) is already fixed in HTML — do NOT add them.

WHAT TO DRAW:
- Subject: A stylized flat 2D illustrated Vietnamese woman ("MaMa character") in pink/magenta monochrome line-art style
- Outfit: modern blazer or smart-casual clothing, expressive pose fitting the scene below
- Small thematic props/icons floating nearby (flat illustration style, pink/magenta or teal accent)
- 1–2 small decorative elements that relate to the topic

BACKGROUND: Solid flat pastel pink (#FFE8F4) — same as the template background so it blends seamlessly. No patterns, no stripes, no bars.

STYLE: Clean flat vector illustration. Monochrome pink/magenta line-art. No gradients. No realistic shading. No text, no letters, no numbers anywhere in the image.`

// POST /api/gen-image  { slot }  — gpt-image-1
app.post('/api/gen-image', async (req, res) => {
  const { slot } = req.body
  if (!slot) return res.status(400).json({ error: 'slot required' })

  const topic    = slot.topic_group || ''
  const format   = slot.content_format || ''

  // Map format → center illustration scene
  const FORMAT_SCENE = {
    poll:                  'MaMa holding a large question mark card, curious tilted head expression, small poll options floating around her',
    educational_post:      'MaMa in a presenting pose with one arm raised, lightbulb icon and small bar chart floating nearby',
    market_update:         'MaMa sitting and looking at a smartphone showing an upward arrow chart, teal phone screen glow',
    qa:                    'MaMa with index finger raised in a "did you know" gesture, small speech bubble icon nearby',
    service_faq:           'MaMa pointing to a smartphone with MoMo app icon, step arrows floating around',
    minigame:              'MaMa in a jumping celebratory pose, confetti pieces and a gift box with ribbon floating around',
    confession_discussion: 'MaMa in a gentle listening pose, small speech bubbles floating beside her',
    promo_info:            'MaMa in an excited forward-leaning pose, large golden coin and sparkle stars floating around her',
  }

  const scene = FORMAT_SCENE[format] || 'MaMa in a friendly welcoming pose with small financial icons floating around'

  const englishPrompt = `${MAMA_BRAND_VISUAL}

Center illustration for this post:
- Topic context: ${topic}
- Scene: ${scene}`

  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: englishPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    })
    const b64 = resp.data[0].b64_json
    const dataUrl = b64 ? `data:image/png;base64,${b64}` : resp.data[0].url
    res.json({ url: dataUrl })
  } catch (err) {
    console.error('[gen-image]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════
// SNAPSHOT — pull MCP → save static JSON per page
// ══════════════════════════════════════════════

// POST /api/snapshot  { pageId, startDate?, endDate?, limit? }
app.post('/api/snapshot', async (req, res) => {
  const { pageId, startDate, endDate, limit = 1000 } = req.body
  const pageCfg = PAGE_CONFIGS[pageId]
  if (!pageCfg) return res.status(400).json({ error: `Unknown pageId: ${pageId}` })

  try {
    // ── 1. Engagement data (filtered by mcp_page_id) ──
    const engQuery = {
      measures: ALL_MEASURES,
      dimensions: [
        'feed_agg_user_engagement.page_name',
        'feed_agg_user_engagement.page_id',
        'feed_agg_user_engagement.post_id',
      ],
      filters: [
        { member: 'feed_agg_user_engagement.post_type', operator: 'equals', values: ['Fanpage post'] },
        { member: 'feed_agg_user_engagement.page_id',   operator: 'equals', values: [String(pageCfg.mcp_page_id)] },
      ],
      limit,
      timezone: 'Asia/Ho_Chi_Minh',
      order: { 'feed_agg_user_engagement.date': 'desc' },
    }
    if (startDate && endDate) {
      engQuery.timeDimensions = [{ dimension: 'feed_agg_user_engagement.date', dateRange: [startDate, endDate] }]
    }

    // ── 2. Content metadata (all pages — filter by post_id locally) ──
    const contentQuery = {
      dimensions: CONTENT_DIMENSIONS,
      filters: [],
      limit,
      timezone: 'Asia/Ho_Chi_Minh',
      order: { 'feed_agg_post_criteria.created_date': 'desc' },
    }
    if (startDate && endDate) {
      contentQuery.timeDimensions = [{ dimension: 'feed_agg_post_criteria.created_date', dateRange: [startDate, endDate] }]
    }

    const [engResp, contentResp] = await Promise.all([
      callMcp({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'semantic-load', arguments: { datasourceId: DATASOURCE_ID, body: { query: engQuery } } } }),
      callMcp({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'semantic-load', arguments: { datasourceId: DATASOURCE_ID, body: { query: contentQuery } } } }),
    ])

    const parseResult = (d, label) => {
      if (d?.error) throw new Error(`MCP ${label}: ${d.error.message ?? JSON.stringify(d.error)}`)
      const text = d?.result?.content?.[0]?.text ?? ''
      if (!text || text.startsWith('Error:')) throw new Error(`MCP ${label} rỗng`)
      return JSON.parse(text)?.data?.data ?? []
    }

    const engRows     = parseResult(engResp, 'engagement')
    const contentRows = parseResult(contentResp, 'content')

    // ── 3. Build post_id → content lookup (normalize to string to avoid type mismatch) ──
    const contentMap = new Map()
    for (const r of contentRows) {
      const pid = r['feed_agg_post_criteria.post_id']
      if (pid != null) contentMap.set(String(pid), r)
    }

    // ── 4. Merge into posts.json schema ──
    const E = 'feed_agg_user_engagement.'
    const C = 'feed_agg_post_criteria.'
    const posts = engRows.map(eng => {
      const pid     = String(eng[`${E}post_id`] ?? '')
      const content = contentMap.get(pid) ?? {}
      return {
        post_id:          pid,
        page_id:          pageId,
        created_date:     content[`${C}created_date`]    ?? null,
        created_hour:     content[`${C}created_hour`]    ?? null,
        day_of_week:      content[`${C}day_of_week`]     ?? null,
        post_content:     content[`${C}post_desc`]       ?? '',
        has_reward:       content[`${C}has_reward`]      ?? false,
        topic_group:      content[`${C}topic_group`]     ?? '',
        content_format:   content[`${C}content_format`]  ?? '',
        view_users:       eng[`${E}view_users`]          ?? 0,
        view_count:       eng[`${E}view_count`]          ?? 0,
        like_users:       eng[`${E}like_users`]          ?? 0,
        like_count:       eng[`${E}like_count`]          ?? 0,
        comment_users:    eng[`${E}comment_users`]       ?? 0,
        comment_count:    eng[`${E}comment_count`]       ?? 0,
        bp_comment_count: 0,
        share_users:      eng[`${E}share_users`]         ?? 0,
        share_count:      eng[`${E}share_count`]         ?? 0,
        er_user:          eng[`${E}er_user`]             ?? 0,
        ctr_user:         eng[`${E}ctr_user`]            ?? 0,
      }
    }).filter(p => p.post_id)

    // ── 5. Derive overall.json ──
    const sum = (key) => posts.reduce((s, p) => s + (p[key] || 0), 0)
    const avg = (key) => posts.length ? sum(key) / posts.length : 0
    const overall = [{
      page_name:        pageCfg.page_name,
      page_id:          pageId,
      view_users:       sum('view_users'),
      view_count:       sum('view_count'),
      like_users:       sum('like_users'),
      like_count:       sum('like_count'),
      comment_users:    sum('comment_users'),
      comment_count:    sum('comment_count'),
      bp_comment_count: 0,
      share_users:      sum('share_users'),
      share_count:      sum('share_count'),
      er_user:          Math.round(avg('er_user')  * 1e6) / 1e6,
      ctr_user:         Math.round(avg('ctr_user') * 1e6) / 1e6,
      engage_user:      sum('like_users') + sum('comment_users') + sum('share_users'),
      click_user:       Math.round(sum('view_users') * avg('ctr_user')),
    }]

    // ── 6. Derive timing_benchmark.json ──
    const tbMap = {}
    for (const p of posts) {
      if (!p.topic_group || !p.content_format || p.created_hour == null || !p.day_of_week) continue
      const key = `${p.topic_group}__${p.content_format}`
      if (!tbMap[key]) tbMap[key] = { topic_group: p.topic_group, content_format: p.content_format, hours: {}, days: {}, erSum: 0, ctrSum: 0, n: 0 }
      const s = tbMap[key]
      s.erSum += p.er_user; s.ctrSum += p.ctr_user; s.n++
      const h = s.hours[p.created_hour] ??= { erSum: 0, n: 0 }
      h.erSum += p.er_user; h.n++
      const d = s.days[p.day_of_week] ??= { erSum: 0, n: 0 }
      d.erSum += p.er_user; d.n++
    }
    const timingBenchmark = Object.values(tbMap).map(s => {
      const bestHour = Object.entries(s.hours).sort((a, b) => (b[1].erSum / b[1].n) - (a[1].erSum / a[1].n))[0]
      const bestDay  = Object.entries(s.days).sort((a, b)  => (b[1].erSum / b[1].n) - (a[1].erSum / a[1].n))[0]
      return {
        topic_group:    s.topic_group,
        content_format: s.content_format,
        best_hour:      bestHour ? Number(bestHour[0]) : 15,
        best_day:       bestDay  ? bestDay[0]          : 'Monday',
        avg_er:         Math.round(s.erSum  / s.n * 10000) / 10000,
        avg_ctr:        Math.round(s.ctrSum / s.n * 10000) / 10000,
        avg_view_users: Math.round(posts.filter(p => `${p.topic_group}__${p.content_format}` === `${s.topic_group}__${s.content_format}`).reduce((a, p) => a + p.view_users, 0) / s.n),
        sample_size:    s.n,
      }
    })

    // ── 7. top_posts.json — top 30 by er_user ──
    const topPosts = [...posts]
      .sort((a, b) => b.er_user - a.er_user)
      .slice(0, 30)
      .map(({ post_id, view_users, view_count, like_users, like_count, comment_users, comment_count, share_users, share_count, er_user, ctr_user }) => ({
        post_id, view_users, view_count, like_users, like_count, comment_users, comment_count,
        bp_comment_count: 0, share_users, share_count, er_user, ctr_user,
        view_anomaly: view_users < 100,
      }))

    // ── 8. Stub files ──
    const buPriority  = [{ week_start: '', event_name: '', priority_topic: '', trending_topic: '', must_publish_date: null, cta: '', notes: '', page_id: pageId }]
    const marketTrends = []

    // ── 9. Save all to public/data/{pageId}/ ──
    const dir = path.join(ROOT_DIR, 'public', 'data', pageId)
    fs.mkdirSync(dir, { recursive: true })
    const save = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2))
    save('posts.json',            posts)
    save('overall.json',          overall)
    save('top_posts.json',        topPosts)
    save('timing_benchmark.json', timingBenchmark)
    save('bu_priority.json',      buPriority)
    save('market_trends.json',    marketTrends)

    const hasContentData = posts.some(p => p.topic_group || p.post_content)
    console.log(`[snapshot] ${pageId}: ${posts.length} posts, ${timingBenchmark.length} timing slots, contentData=${hasContentData}`)
    res.json({ ok: true, pageId, postCount: posts.length, timingCount: timingBenchmark.length, hasContentData })
  } catch (e) {
    console.error('[snapshot]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════════════
// PUBLISH — MoMo internal CMS API
// ══════════════════════════════════════════════

const MOMO_CMS_API_KEY = 'kUU7EtbkFvFm9wnEZpHIJwRoP4a9qmVtByfUNxzk9PmU6jwftAn4IZUUDtPExqZu'

// pageId → numeric oaId used by CMS API
// Pilot OA 9813269 dùng để test cho cả 2 page — swap sang prod oaId sau khi xác nhận
const PAGE_OA_IDS = {
  mama_tai_chinh: 10513780,
  heo_dat_momo:   9926377,
}

// Upload local image path to ImgBB, returns public URL
async function uploadLocalImageToImgBB(localPath) {
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY
  if (!IMGBB_API_KEY) throw new Error('IMGBB_API_KEY chưa được cấu hình trong .env')

  const absPath = path.join(ROOT_DIR, 'public', localPath.replace(/^\//, ''))
  if (!fs.existsSync(absPath)) throw new Error(`Không tìm thấy file ảnh: ${absPath}`)

  const base64 = fs.readFileSync(absPath).toString('base64')
  const form = new URLSearchParams()
  form.append('key', IMGBB_API_KEY)
  form.append('image', base64)

  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form })
  const json = await res.json()
  if (!json.success) throw new Error(`ImgBB upload thất bại: ${json.error?.message ?? JSON.stringify(json)}`)
  console.log(`[imgbb] uploaded → ${json.data.url}`)
  return json.data.url
}

// ── Slot persistence (server-side, shared across users) ──────────────────────
const SLOTS_DIR = path.join(ROOT_DIR, 'data', 'slots')
if (!fs.existsSync(SLOTS_DIR)) fs.mkdirSync(SLOTS_DIR, { recursive: true })

function slotsFile(pageId) {
  return path.join(SLOTS_DIR, `${pageId.replace(/[^a-z0-9_-]/gi, '')}.json`)
}

function readSlots(pageId) {
  try { return JSON.parse(fs.readFileSync(slotsFile(pageId), 'utf8')) } catch { return [] }
}

function writeSlots(pageId, slots) {
  fs.writeFileSync(slotsFile(pageId), JSON.stringify(slots, null, 2))
}

// GET /api/slots/:pageId
app.get('/api/slots/:pageId', (req, res) => {
  res.json(readSlots(req.params.pageId))
})

// POST /api/slots/:pageId  — upsert a slot by id
app.post('/api/slots/:pageId', (req, res) => {
  const { pageId } = req.params
  const slot = req.body
  if (!slot?.id) return res.status(400).json({ error: 'slot.id bắt buộc' })
  const slots = readSlots(pageId)
  const idx   = slots.findIndex(s => s.id === slot.id)
  if (idx >= 0) slots[idx] = slot
  else slots.push(slot)
  writeSlots(pageId, slots)
  res.json({ ok: true })
})

// POST /api/publish  { pageId, title?, desc, imageUrls?, ctaType?, ctaLabel?, actionUrls?, sendTime? }
app.post('/api/publish', async (req, res) => {
  const { pageId, title, desc, imageUrls = [], ctaType, ctaLabel, actionUrls = [], sendTime,
          tagIds, showInGroupIds, showInMainGroup = true } = req.body
  if (!pageId || !desc?.trim()) return res.status(400).json({ error: 'pageId và desc là bắt buộc' })

  const oaId = PAGE_OA_IDS[pageId]
  if (!oaId) return res.status(400).json({ error: `oaId chưa được cấu hình cho trang "${pageId}". Liên hệ admin để cập nhật PAGE_OA_IDS trong server.js.` })

  // Auto-upload local images to ImgBB → get public URLs
  const resolvedImageUrls = []
  for (const url of imageUrls) {
    if (url.startsWith('http')) {
      resolvedImageUrls.push(url)
    } else {
      try {
        const publicUrl = await uploadLocalImageToImgBB(url)
        resolvedImageUrls.push(publicUrl)
      } catch (e) {
        console.error(`[imgbb] failed for ${url}:`, e.message)
        return res.status(500).json({ error: `Upload ảnh thất bại: ${e.message}` })
      }
    }
  }

  const payload = { oaId, desc: desc.trim(), showInMainGroup }
  if (title?.trim())                    payload.title      = title.trim()
  if (resolvedImageUrls.length > 0)     payload.imageUrls  = resolvedImageUrls
  if (ctaType != null)            payload.ctaType        = ctaType
  if (ctaLabel?.trim())           payload.ctaLabel       = ctaLabel.trim()
  if (actionUrls.length > 0)      payload.actionUrls     = actionUrls
  if (sendTime)                   payload.sendTime       = sendTime
  if (tagIds?.length > 0)         payload.tagIds         = tagIds
  if (showInGroupIds?.length > 0) payload.showInGroupIds = showInGroupIds

  try {
    const momoRes = await fetch(`https://business.momo.vn/api/v2/business-pages/${oaId}/social/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': MOMO_CMS_API_KEY,
      },
      body: JSON.stringify(payload),
    })
    const json = await momoRes.json()
    console.log(`[publish] CMS raw response:`, JSON.stringify(json))
    if (!momoRes.ok || json.success === false || (json.resultCode != null && json.resultCode !== 0)) {
      throw new Error(json.description ?? json.message ?? `CMS trả về lỗi ${momoRes.status} (resultCode: ${json.resultCode})`)
    }
    const postId = json.data?.postId ?? json.data?.id ?? json.postId ?? json.id ?? null
    console.log(`[publish] ${pageId} → postId=${postId} sendTime=${sendTime} cta=${!!ctaType}`)
    res.json({ ok: true, postId, cmdId: json.cmdId, status: json.data?.status })
  } catch (err) {
    console.error('[publish]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Post image upload (actual images to attach to published posts) ────────────
app.post('/api/upload-post-image', (req, res) => {
  const { pageId, slotId, filename, data } = req.body
  if (!pageId || !filename || !data) return res.status(400).json({ error: 'pageId, filename, data required' })
  const safePageId = pageId.replace(/[^a-z0-9_-]/gi, '')
  const safeSlotId = (slotId || 'misc').replace(/[^a-z0-9_.-]/gi, '').slice(0, 60)
  const safeName   = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
  const dir = path.join(ROOT_DIR, 'public', 'post-images', safePageId, safeSlotId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64')
  fs.writeFileSync(path.join(dir, safeName), buffer)
  console.log(`[post-image] saved ${safePageId}/${safeSlotId}/${safeName} (${buffer.length}b)`)
  res.json({ ok: true, url: `/post-images/${safePageId}/${safeSlotId}/${safeName}` })
})

app.delete('/api/upload-post-image', (req, res) => {
  const { pageId, slotId, filename } = req.body
  const safePageId = (pageId || '').replace(/[^a-z0-9_-]/gi, '')
  const safeSlotId = (slotId || '').replace(/[^a-z0-9_.-]/gi, '').slice(0, 60)
  const safeName   = path.basename(filename || '').replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath   = path.join(ROOT_DIR, 'public', 'post-images', safePageId, safeSlotId, safeName)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  res.json({ ok: true })
})

// ── Visual element asset management ──────────────────────────────────────────
const ELEMENTS_DIR = path.join(ROOT_DIR, 'public', 'elements')

// List elements in a folder (common or page-specific)
app.get('/api/elements/:pageId', (req, res) => {
  const safeId = req.params.pageId.replace(/[^a-z0-9_-]/gi, '')
  const folder = path.join(ELEMENTS_DIR, safeId)
  if (!fs.existsSync(folder)) return res.json({ files: [] })
  const files = fs.readdirSync(folder)
    .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
    .sort()
    .map(f => ({ name: f, url: `/elements/${safeId}/${f}` }))
  res.json({ files })
})

// Upload element — body: { pageId, filename, data (data-URI base64) }
app.post('/api/upload-element', (req, res) => {
  const { pageId, filename, data } = req.body
  if (!pageId || !filename || !data) return res.status(400).json({ error: 'pageId, filename, data required' })
  const safeId   = pageId.replace(/[^a-z0-9_-]/gi, '')
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
  if (safeId === 'common' && safeName !== 'bg.png' && !safeName.match(/^1_\d/)) {
    // Allow any filename in page-specific folders; common is curated
  }
  const folder = path.join(ELEMENTS_DIR, safeId)
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
  const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64')
  fs.writeFileSync(path.join(folder, safeName), buffer)
  console.log(`[elements] uploaded ${safeId}/${safeName} (${buffer.length}b)`)
  res.json({ ok: true, url: `/elements/${safeId}/${safeName}` })
})

// Delete element from a page-specific folder (common is protected)
app.delete('/api/elements/:pageId/:filename', (req, res) => {
  const safeId   = req.params.pageId.replace(/[^a-z0-9_-]/gi, '')
  const safeName = path.basename(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, '_')
  if (safeId === 'common') return res.status(403).json({ error: 'Common elements are read-only' })
  const filePath = path.join(ELEMENTS_DIR, safeId, safeName)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })
  fs.unlinkSync(filePath)
  console.log(`[elements] deleted ${safeId}/${safeName}`)
  res.json({ ok: true })
})

// ── Serve built frontend ───────────────────────────────────────────────────
const distPath = path.join(ROOT_DIR, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((_, res) => res.sendFile(path.join(distPath, 'index.html')))
  console.log('Serving frontend from dist/')
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`MoMo proxy: http://localhost:${PORT} (cache TTL 5m)`))
