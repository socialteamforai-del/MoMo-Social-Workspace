import React, { useRef, useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Wifi, FileText, X, ChevronDown, ChevronRight, Info, Download, Database } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useApp } from '../../context/AppContext.jsx'
import { getMomoDataCache } from '../momodata/MomoDataTab.jsx'
import styles from './DataSourceSelector.module.css'

const today   = new Date().toISOString().split('T')[0]
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().split('T')[0]

const PRESETS = [
  { label: '7 ngày',  days: 7   },
  { label: '30 ngày', days: 30  },
  { label: '90 ngày', days: 90  },
  { label: 'Custom',  days: null },
]

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'json') {
      const reader = new FileReader()
      reader.onload = e => {
        try { resolve(JSON.parse(e.target.result)) }
        catch { reject(new Error('File JSON không hợp lệ')) }
      }
      reader.onerror = () => reject(new Error('Không đọc được file'))
      reader.readAsText(file)
    } else {
      file.arrayBuffer().then(buf => {
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }))
      }).catch(() => reject(new Error('Không đọc được file Excel')))
    }
  })
}

const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// Map MCP feed_agg_post_criteria row (cube-prefixed keys) to flat content row
function normaliseMcpContentRow(r) {
  const pfx = 'feed_agg_post_criteria.'
  return {
    post_id:        String(r[pfx + 'post_id'] ?? ''),
    page_name:      r[pfx + 'page_name']      ?? '',
    post_content:   r[pfx + 'post_desc']      ?? '',
    created_date:   r[pfx + 'created_date']   ?? '',
    created_hour:   parseInt(r[pfx + 'created_hour']) || 12,
    day_of_week:    r[pfx + 'day_of_week']    ?? 'Monday',
    topic_group:    r[pfx + 'topic_group']    ?? '',
    content_format: r[pfx + 'content_format'] ?? '',
    has_reward:     r[pfx + 'has_reward'] === true || r[pfx + 'has_reward'] === 'TRUE' || r[pfx + 'has_reward'] === 1,
  }
}

function normaliseContentRow(r) {
  // Cover all common export column names: MoMo CMS, Facebook Graph API, manual templates
  const postContent = r['post_content'] ?? r['message'] ?? r['Message']
    ?? r['Content'] ?? r['content'] ?? r['caption'] ?? r['Caption']
    ?? r['Post Message'] ?? r['Post Content'] ?? r['body'] ?? r['text'] ?? ''
  const postId      = String(r['post_id'] ?? r['Post ID'] ?? r['postId'] ?? '')
  let createdDate   = r['created_date'] ?? ''
  let createdHour   = parseInt(r['created_hour']) || 12
  let dayOfWeek     = r['day_of_week'] ?? 'Monday'
  const rawTime = r['Created time'] ?? r['created_time'] ?? r['Created Time'] ?? ''
  if (rawTime) {
    const m = String(rawTime).match(/(\d{1,2}):(\d{2})(?::\d{2})?\s+(\d{1,2})\/(\d{2})\/(\d{4})/)
    if (m) {
      const [, hh, , dd, mm, yyyy] = m
      createdDate = `${yyyy}-${mm}-${dd.padStart(2,'0')}`
      createdHour = parseInt(hh)
      dayOfWeek   = DAYS_EN[new Date(`${yyyy}-${mm}-${dd}`).getDay()] ?? 'Monday'
    }
  }
  const c = postContent.toLowerCase()
  let topicGroup = r['topic_group'] ?? ''
  if (!topicGroup) {
    if (/vn-?index|cổ phiếu|chứng khoán/.test(c))
      topicGroup = /dự đoán|dự báo/.test(c) ? 'Dự đoán giá cổ phiếu' : 'Phân tích thị trường chứng khoán'
    else if (/tiết kiệm|lãi suất|gửi tiền/.test(c))         topicGroup = 'Sản phẩm tiết kiệm & lãi suất'
    else if (/chi tiêu|ngân sách|tài chính cá nhân/.test(c)) topicGroup = 'Giáo dục tài chính & chi tiêu'
    else if (/minigame|mini game/.test(c))                   topicGroup = 'Minigame & tương tác'
    else if (/tín dụng|vay|thẻ/.test(c))                    topicGroup = 'Tín dụng & vay vốn'
    else                                                     topicGroup = 'Khác'
  }
  let contentFormat = r['content_format'] ?? ''
  if (!contentFormat) {
    if (/minigame|mini game/.test(c))                  contentFormat = 'minigame'
    else if (/dự đoán|bạn nghĩ|vote|bình chọn/.test(c)) contentFormat = 'poll'
    else if (/tổng hợp|diễn biến|thị trường hôm nay/.test(c)) contentFormat = 'market_update'
    else if (/học|hiểu|kiến thức|tips?|mẹo/.test(c))  contentFormat = 'educational_post'
    else if (/lãi suất|tiết kiệm|sản phẩm/.test(c))   contentFormat = 'service_faq'
    else                                                contentFormat = 'post'
  }
  const hasReward = r['has_reward'] === true || r['has_reward'] === 'TRUE' || r['has_reward'] === 1
    || /nhận quà|lượt quay|thưởng|giải thưởng/.test(c)
  return {
    ...r, post_id: postId, post_content: postContent, created_date: createdDate,
    created_hour: createdHour, day_of_week: dayOfWeek,
    topic_group: topicGroup, content_format: contentFormat, has_reward: hasReward,
  }
}

function normaliseMetricRows(rows) {
  return rows.map(r => ({
    ...r,
    er_user:          parseFloat(r.er_user)        || 0,
    ctr_user:         parseFloat(r.ctr_user)       || 0,
    view_users:       parseInt(r.view_users)       || 0,
    view_count:       parseInt(r.view_count)       || 0,
    like_users:       parseInt(r.like_users)       || 0,
    comment_users:    parseInt(r.comment_users)    || 0,
    share_users:      parseInt(r.share_users)      || 0,
    bp_comment_count: parseInt(r.bp_comment_count) || 0,
    has_reward:   r.has_reward   === true || r.has_reward   === 'TRUE' || r.has_reward   === 1,
    view_anomaly: r.view_anomaly === true || r.view_anomaly === 'TRUE' || r.view_anomaly === 1,
  }))
}

function mergeMetricsWithContent(metricsRows, contentRows) {
  if (!contentRows?.length) {
    return {
      posts: normaliseMetricRows(metricsRows.map(r => ({
        post_id:       String(r['feed_agg_user_engagement.post_id'] ?? ''),
        page_id:       String(r['feed_agg_user_engagement.page_id'] ?? ''),
        page_name:     r['feed_agg_user_engagement.page_name'] ?? '',
        er_user:       parseFloat(r['feed_agg_user_engagement.er_user'])    || 0,
        ctr_user:      parseFloat(r['feed_agg_user_engagement.ctr_user'])   || 0,
        view_users:    parseInt(r['feed_agg_user_engagement.view_users'])   || 0,
        view_count:    parseInt(r['feed_agg_user_engagement.view_count'])   || 0,
        like_users:    parseInt(r['feed_agg_user_engagement.like_users'])   || 0,
        comment_users: parseInt(r['feed_agg_user_engagement.comment_users'])|| 0,
        share_users:   parseInt(r['feed_agg_user_engagement.share_users'])  || 0,
        engaged_users: parseInt(r['feed_agg_user_engagement.engaged_users'])|| 0,
        topic_group: '', content_format: '', post_content: '',
        created_date: '', created_hour: 12, day_of_week: 'Monday',
        has_reward: false, view_anomaly: false, bp_comment_count: 0,
      }))),
      matched: 0, total: metricsRows.length, noContent: true,
    }
  }
  const metricsMap = new Map()
  for (const r of metricsRows) {
    const pid = String(r['feed_agg_user_engagement.post_id'] ?? '')
    if (pid) metricsMap.set(pid, r)
  }
  const merged = []; let matched = 0
  for (const content of contentRows) {
    const pid     = String(content.post_id)
    const metrics = metricsMap.get(pid)
    if (!metrics) continue
    matched++
    merged.push(normaliseMetricRows([{
      ...content, post_id: pid,
      page_id:       String(metrics['feed_agg_user_engagement.page_id'] ?? ''),
      page_name:     metrics['feed_agg_user_engagement.page_name']     ?? '',
      er_user:       metrics['feed_agg_user_engagement.er_user'],
      ctr_user:      metrics['feed_agg_user_engagement.ctr_user'],
      view_users:    metrics['feed_agg_user_engagement.view_users'],
      view_count:    metrics['feed_agg_user_engagement.view_count'],
      like_users:    metrics['feed_agg_user_engagement.like_users'],
      comment_users: metrics['feed_agg_user_engagement.comment_users'],
      share_users:   metrics['feed_agg_user_engagement.share_users'],
      engaged_users: metrics['feed_agg_user_engagement.engaged_users'],
    }])[0])
  }
  return { posts: merged, matched, total: contentRows.length, noContent: false }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DataSourceSelector() {
  const {
    data, rawPosts, setOverridePosts, setDateFilter,
    contentRows, setContentRows, contentFileName, setContentFileName,
    pageConfig,
  } = useApp()

  const contentFileRef   = useRef(null)
  const metricsRowsRef   = useRef([])   // stores last-fetched raw metrics rows for reMerge
  const prevPageNameRef  = useRef(pageConfig?.page_name)

  const [preset, setPreset]       = useState(90)
  const [startDate, setStartDate] = useState(daysAgo(90))
  const [endDate, setEndDate]     = useState(today)
  const [fetching, setFetching]   = useState(false)
  const [fetchResult, setFetchResult]   = useState(null)
  const [fetchError, setFetchError]     = useState('')
  const [usedFallback, setUsedFallback] = useState(false)

  const [parsing, setParsing]             = useState(false)
  const [contentError, setContentError]   = useState('')
  const [contentSource, setContentSource] = useState(null)  // 'mcp' | 'file' | 'pending'

  const [showResult, setShowResult]       = useState(true)
  const [showAllResult, setShowAllResult] = useState(false)

  const handlePreset = (days) => {
    setPreset(days)
    if (days !== null) { setStartDate(daysAgo(days)); setEndDate(today) }
  }

  const applyData = (mRows, cRows, cached) => {
    metricsRowsRef.current = mRows   // keep a local copy so reMerge works without _cache
    const result = mergeMetricsWithContent(mRows, cRows)
    // Filter by numeric page_id (stable, avoids Unicode string comparison issues)
    const mcpPageId = pageConfig?.mcp_page_id
    const posts = mcpPageId
      ? result.posts.filter(p => !p.page_id || String(p.page_id) === String(mcpPageId))
      : result.posts
    // Only override static data when MCP returned actual results — empty means no auth/no data,
    // fall back to static files so historical posts remain visible.
    setOverridePosts(posts.length > 0 ? posts : null)
    setDateFilter('all')
    setFetchResult({
      count:     posts.length,
      matched:   result.matched,
      noContent: result.noContent,
      cached,
      timeLabel: new Date().toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }),
    })
    setShowResult(true)
  }

  // Pick the best available content rows: manual file upload > static rawPosts
  // Excludes stale MCP-sourced contentRows (filename starts with 'MCP') — those are
  // only valid when freshly fetched from the API in this session.
  const resolveContentFallback = () => {
    const isStaleFromMcp = contentFileName?.startsWith('MCP')
    if (!isStaleFromMcp && contentRows?.length > 0) return contentRows
    return rawPosts?.length > 0 ? rawPosts : null
  }

  useEffect(() => {
    const cache = getMomoDataCache()
    // Only reuse cache if it was fetched for the same page (compare by numeric mcp_page_id)
    const cacheMatchesPage = !cache.pageId || cache.pageId === pageConfig?.mcp_page_id
    if (cacheMatchesPage && cache.rows?.length > 0) {
      metricsRowsRef.current = cache.rows
      applyData(cache.rows, resolveContentFallback(), cache.isCached)
    } else {
      fetchData()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refetch when user switches page
  useEffect(() => {
    if (prevPageNameRef.current === pageConfig?.page_name) return
    prevPageNameRef.current = pageConfig?.page_name
    metricsRowsRef.current = []
    setFetchResult(null)
    setFetchError('')
    fetchData()
  }, [pageConfig?.page_name]) // eslint-disable-line react-hooks/exhaustive-deps

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['post_id', 'post_content', 'topic_group', 'created_date'],
      ['12345678', 'Nội dung bài viết mẫu...', 'Tài chính cá nhân', '2026-05-01'],
      ['12345679', 'Bài viết về đầu tư...', 'Đầu tư', '2026-05-02'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'content_template.xlsx')
  }

  const reMerge = (cRows) => {
    // Prefer locally-stored rows from a DataSourceSelector fetch; fall back to MomoDataTab cache
    const rows = metricsRowsRef.current.length > 0
      ? metricsRowsRef.current
      : getMomoDataCache().rows
    if (rows?.length > 0) applyData(rows, cRows ?? resolveContentFallback(), fetchResult?.cached ?? false)
  }

  const fetchData = async () => {
    setFetching(true); setFetchError(''); setUsedFallback(false)
    try {
      // Step 1: engagement metrics
      const engRes  = await fetch('/api/momo-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, mcpPageId: pageConfig?.mcp_page_id }),
      })
      const engJson = await engRes.json()
      if (engJson.error) throw new Error(engJson.error)
      const engRows = engJson.rows ?? []

      // Step 2: try to auto-fetch content from MCP
      let resolvedContentRows = null
      try {
        const cRes  = await fetch('/api/momo-content', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate, mcpPageId: pageConfig?.mcp_page_id }),
        })
        const cJson = await cRes.json()
        if (!cJson.error && cJson.rows?.length > 0) {
          const pageName = pageConfig?.page_name
          const filtered = pageName
            ? cJson.rows.filter(r => r['feed_agg_post_criteria.page_name'] === pageName)
            : cJson.rows
          resolvedContentRows = filtered.map(normaliseMcpContentRow)
          setContentRows(resolvedContentRows)
          setContentFileName(`MCP · ${filtered.length} bài`)
          setContentSource('mcp')
        } else {
          setContentSource('pending')
          // MCP content unavailable — fall back to manual upload or static posts.json
          resolvedContentRows = resolveContentFallback()
        }
      } catch {
        setContentSource('pending')
        resolvedContentRows = resolveContentFallback()
      }

      applyData(engRows, resolvedContentRows, !!engJson.cached)
    } catch (err) {
      const cache = getMomoDataCache()
      if (cache.rows?.length > 0) { applyData(cache.rows, contentRows, cache.isCached); setUsedFallback(true) }
      setFetchError(err.message)
    } finally { setFetching(false) }
  }

  const handleContentFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setParsing(true); setContentError('')
    try {
      const rows = await parseFile(file)
      const first = rows[0] ?? {}
      if (!first.post_id && !first['Post ID'] && !first.postId)
        throw new Error('File cần có cột post_id')
      const normed = rows.map(normaliseContentRow)
      setContentRows(normed); setContentFileName(file.name); setContentSource('file'); reMerge(normed)
    } catch (err) { setContentError(err.message) }
    finally { setParsing(false); e.target.value = '' }
  }

  const removeContentFile = () => { setContentRows(null); setContentFileName(''); setContentSource(null); reMerge(null) }

  const dropContent = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleContentFile({ target: { files: [f], value: '' } })
  }

  return (
    <div className={styles.wrapper}>

      {/* Step 1: Lấy dữ liệu */}
      <div className={styles.stepCard}>
        <p className={styles.stepLabel}>
          <span className={styles.stepNum}>1</span> Lấy dữ liệu từ MCP
          <span className={styles.infoTooltipWrap}>
            <Info size={12} className={styles.infoIcon} />
            <span className={styles.infoTooltip}>Dữ liệu MCP chỉ lấy được tối đa timeframe 90 ngày.</span>
          </span>
        </p>
        <div className={styles.step1Body}>
          <div className={styles.timeframeCol}>
            <div className={styles.presetRow}>
              {PRESETS.map(p => (
                <button key={p.label}
                  className={`${styles.presetChip} ${preset === p.days ? styles.presetActive : ''}`}
                  onClick={() => handlePreset(p.days)}>{p.label}</button>
              ))}
            </div>
            {preset === null ? (
              <div className={styles.customDates}>
                <div className={styles.dateGroup}>
                  <label className={styles.dateLabel}>Từ ngày</label>
                  <input type="date" className={styles.dateInput} value={startDate} max={endDate}
                    onChange={e => setStartDate(e.target.value)} />
                </div>
                <span className={styles.dateSep}>→</span>
                <div className={styles.dateGroup}>
                  <label className={styles.dateLabel}>Đến ngày</label>
                  <input type="date" className={styles.dateInput} value={endDate} min={startDate} max={today}
                    onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            ) : (
              <span className={styles.dateRange}>{startDate} → {endDate}</span>
            )}
          </div>
          <div className={styles.fetchCol}>
            {fetchResult && (
              <div className={styles.fetchInfo}>
                <Wifi size={11} className={usedFallback ? styles.wifiOff : styles.wifiOn} />
                <span className={styles.fetchCount}>{fetchResult.count} bài</span>
                {fetchResult.cached && <span className={styles.cachedTag}>⚡ cached</span>}
                <span className={styles.fetchTime}>{fetchResult.timeLabel}</span>
              </div>
            )}
            <button className={styles.fetchBtn} onClick={fetchData} disabled={fetching}>
              {fetching
                ? <><span className={styles.spinner} /> Đang tải…</>
                : fetchResult ? 'Update' : '⬇ Tải dữ liệu'}
            </button>
          </div>
        </div>
        {usedFallback && (
          <div className={styles.fallbackNote}>
            <AlertCircle size={11} />
            Không kết nối được MCP · đang dùng dữ liệu đã lưu{fetchError && <> · {fetchError}</>}
          </div>
        )}
        {fetchError && !usedFallback && (
          <div className={styles.errorNote}><AlertCircle size={11} /> {fetchError}</div>
        )}

        {/* Result subbox — inside Step 1 */}
        {fetchResult && data.posts.length > 0 && (
          <div className={styles.resultBox}>
            <button className={styles.resultHeader} onClick={() => setShowResult(v => !v)}>
              <CheckCircle size={12} style={{ color: 'var(--green)', flexShrink: 0 }} />
              <span className={styles.resultTitle}>
                Kết quả: <strong>{data.posts.length} bài</strong>
                {!fetchResult.noContent && fetchResult.matched > 0
                  && ` · ${fetchResult.matched} có content`}
              </span>
              <span className={styles.resultRange}>{startDate} → {endDate}</span>
              {showResult ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {showResult && (
              <>
                <div className={styles.resultTableWrap}>
                  <table className={styles.resultTable}>
                    <thead>
                      <tr><th>#</th><th>Post ID</th><th>Page</th><th>View Users</th><th>ER</th><th>Content</th></tr>
                    </thead>
                    <tbody>
                      {(showAllResult ? data.posts : data.posts.slice(0, 5)).map((p, i) => (
                        <tr key={i}>
                          <td className={styles.rankCell}>{i + 1}</td>
                          <td className={styles.monoCell}>{p.post_id || '—'}</td>
                          <td>{p.page_name || '—'}</td>
                          <td className={styles.numCell}>{(p.view_users || 0).toLocaleString('vi-VN')}</td>
                          <td className={styles.numCell}>{((p.er_user || 0) * 100).toFixed(2)}%</td>
                          <td className={styles.contentCell}>
                            {p.post_content
                              ? p.post_content.slice(0, 60) + (p.post_content.length > 60 ? '…' : '')
                              : <span className={styles.noContent}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.posts.length > 5 && (
                  <button className={styles.resultToggle} onClick={() => setShowAllResult(v => !v)}>
                    {showAllResult ? '▲ Thu gọn' : `▼ Xem thêm ${data.posts.length - 5} bài`}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Content — auto from MCP, fallback to file upload */}
      <div className={styles.stepCard}>
        <p className={styles.stepLabel}>
          <span className={styles.stepNum}>2</span>
          Nội dung bài
          <span className={styles.optional}>Auto từ MCP</span>
          <span className={styles.infoTooltipWrap}>
            <Info size={12} className={styles.infoIcon} />
            <span className={styles.infoTooltip}>
              Hệ thống tự lấy nội dung từ MCP (feed_agg_post_criteria).
              Nếu chưa có quyền, upload file xlsx thủ công.
            </span>
          </span>
        </p>

        {/* MCP content status */}
        {contentSource === 'mcp' && contentRows?.length > 0 && (
          <div className={styles.fileRow}>
            <Database size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span className={styles.fileName}>{contentFileName}</span>
            {fetchResult && !fetchResult.noContent && fetchResult.matched > 0 && (
              <span className={styles.matchedTag}>{fetchResult.matched} matched</span>
            )}
            <button className={styles.removeBtn} onClick={removeContentFile}><X size={12} /></button>
          </div>
        )}

        {/* Manual file upload — shown when MCP content not available */}
        {contentSource !== 'mcp' && (
          <>
            {contentRows && contentSource === 'file' ? (
              <div className={styles.fileRow}>
                <CheckCircle size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <FileText size={13} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                <span className={styles.fileName}>{contentFileName}</span>
                <span className={styles.fileCount}>{contentRows.length} bài</span>
                {fetchResult && !fetchResult.noContent && fetchResult.matched > 0 && (
                  <span className={styles.matchedTag}>{fetchResult.matched} matched</span>
                )}
                <button className={styles.removeBtn} onClick={removeContentFile}><X size={12} /></button>
              </div>
            ) : (
              <div className={styles.dropZone}
                onClick={() => contentFileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={dropContent}>
                <input ref={contentFileRef} type="file" accept=".xlsx,.xls,.json"
                  style={{ display: 'none' }} onChange={handleContentFile} />
                <span className={styles.dropText}>
                  {parsing ? 'Đang đọc file…' : (
                    contentSource === 'pending'
                      ? <>MCP chưa cấp quyền · <span className={styles.dropLink}>upload .xlsx</span> để bổ sung</>
                      : <>.xlsx có cột <code>post_id</code> — <span className={styles.dropLink}>chọn file</span> hoặc kéo thả</>
                  )}
                </span>
              </div>
            )}
          </>
        )}

        {contentError && <div className={styles.errorNote}><AlertCircle size={11} /> {contentError}</div>}
        <button className={styles.templateBtn} onClick={downloadTemplate}>
          <Download size={11} /> Tải template .xlsx
        </button>
      </div>


    </div>
  )
}
