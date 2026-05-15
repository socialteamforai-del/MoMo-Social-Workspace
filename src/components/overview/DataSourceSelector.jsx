import React, { useRef, useState } from 'react'
import { FolderOpen, Upload, CheckCircle, AlertCircle, Wifi, FileText, Merge, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useApp } from '../../context/AppContext.jsx'
import { getMomoDataCache } from '../momodata/MomoDataTab.jsx'
import styles from './DataSourceSelector.module.css'

const DATE_FILTERS = [
  { val: '7',   label: '7 ngày'  },
  { val: '14',  label: '14 ngày' },
  { val: '30',  label: '30 ngày' },
  { val: '60',  label: '60 ngày' },
  { val: '90',  label: '90 ngày' },
  { val: 'all', label: 'Tất cả'  },
  { val: 'custom', label: 'Tuỳ chỉnh' },
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
    } else if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const text = e.target.result
          const firstLine = text.split('\n')[0] || ''
          const delim = firstLine.includes(';') ? ';' : ','
          const wb = XLSX.read(text, { type: 'string', FS: delim })
          const ws = wb.Sheets[wb.SheetNames[0]]
          resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }))
        } catch { reject(new Error('Không đọc được file CSV')) }
      }
      reader.onerror = () => reject(new Error('Không đọc được file'))
      reader.readAsText(file, 'UTF-8')
    } else {
      file.arrayBuffer().then(buf => {
        const wb   = XLSX.read(buf, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }))
      }).catch(() => reject(new Error('Không đọc được file Excel')))
    }
  })
}

export default function DataSourceSelector() {
  const {
    data, dateFilter, setDateFilter,
    customDateFrom, setCustomDateFrom,
    customDateTo, setCustomDateTo,
    overridePosts, setOverridePosts,
    contentRows, setContentRows,
    contentFileName, setContentFileName,
    rawPostsCount,
  } = useApp()

  const fileRef        = useRef(null)
  const contentFileRef = useRef(null)

  const [source, setSource]           = useState('upload')
  const [status, setStatus]           = useState(null)
  const [parsing, setParsing]         = useState(false)

  // MCP mode state
  const [merging, setMerging]             = useState(false)
  const [mergeStatus, setMergeStatus]     = useState(null)
  const [mcpConnected, setMcpConnected]   = useState(false)

  /* ── Upload mode ── */
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setStatus(null)
    try {
      const rows = await parseFile(file)
      if (!rows[0]?.post_id && !rows[0]?.er_user) {
        throw new Error('File không đúng schema — cần cột post_id và er_user')
      }
      const normalised = normaliseMetricRows(rows)
      setOverridePosts(normalised)
      setStatus({ ok: true, name: file.name, count: normalised.length })
    } catch (err) {
      setStatus({ ok: false, name: file.name, error: err.message })
    } finally {
      setParsing(false)
      e.target.value = ''
    }
  }

  /* ── MCP mode: step 1 — upload content file ── */
  const handleContentFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setMergeStatus(null)
    try {
      const rows = await parseFile(file)
      const first = rows[0] ?? {}
      const hasId = first.post_id || first['Post ID'] || first.postId
      if (!hasId) {
        throw new Error('File cần có cột post_id')
      }
      const normalised = rows.map(normaliseContentRow)
      setContentRows(normalised)
      setContentFileName(file.name)
    } catch (err) {
      setMergeStatus({ ok: false, error: err.message })
    } finally {
      setParsing(false)
      e.target.value = ''
    }
  }

  /* ── MCP mode: dùng cache từ MoMo Data tab, hoặc fetch mới với date range ── */
  const handleMcpConnect = async () => {
    if (!contentRows) return
    setMerging(true)
    setMergeStatus(null)
    setMcpConnected(false)

    try {
      let metricsRows = []
      let cached = false

      // Ưu tiên dùng data đã fetch từ tab MoMo Data (có sẵn trong cache)
      const momoCache = getMomoDataCache()
      if (momoCache.rows?.length) {
        metricsRows = momoCache.rows
        cached = momoCache.isCached
        console.log(`[DataSource] dùng cache MoMo Data tab: ${metricsRows.length} rows`)
      } else {
        // Fallback: fetch trực tiếp với date range 90 ngày gần nhất
        const endDate   = new Date().toISOString().split('T')[0]
        const startDate = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0]
        const res = await fetch('/api/momo-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate, limit: 2000 }),
        })
        if (!res.ok) throw new Error('Không kết nối được MoMo MCP proxy (port 3001)')
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        metricsRows = json.rows ?? []
        cached = !!json.cached
      }

      if (!metricsRows.length) throw new Error('MoMo MCP không trả về dữ liệu. Hãy fetch dữ liệu ở "MoMo Feed Analytics" bên dưới trước.')

      // Build lookup: post_id → metrics
      const metricsMap = new Map()
      for (const r of metricsRows) {
        const pid = String(r['feed_agg_user_engagement.post_id'] ?? '')
        if (pid) metricsMap.set(pid, r)
      }

      // Build lookup: post_id → content
      const contentMap = new Map()
      for (const r of contentRows) {
        if (r.post_id) contentMap.set(String(r.post_id), r)
      }

      // Merge: Content file (master) LEFT JOIN MCP metrics
      const merged = []
      let missingMetrics = 0
      for (const content of contentRows) {
        const pid = String(content.post_id)
        const metrics = metricsMap.get(pid)
        if (!metrics) { missingMetrics++; continue }
        merged.push(normaliseMetricRows([{
          ...content,
          post_id:       pid,
          er_user:       metrics['feed_agg_user_engagement.er_user'],
          ctr_user:      metrics['feed_agg_user_engagement.ctr_user'],
          view_users:    metrics['feed_agg_user_engagement.view_users'],
          view_count:    metrics['feed_agg_user_engagement.view_count'],
          like_users:    metrics['feed_agg_user_engagement.like_users'],
          comment_users: metrics['feed_agg_user_engagement.comment_users'],
          share_users:   metrics['feed_agg_user_engagement.share_users'],
          engaged_users: metrics['feed_agg_user_engagement.engaged_users'],
          page_name:     metrics['feed_agg_user_engagement.page_name'],
        }])[0])
      }

      if (!merged.length) throw new Error('Không có post nào khớp post_id giữa file content và MCP')

      setOverridePosts(merged)
      setMcpConnected(true)
      setMergeStatus({
        ok: true,
        matched: merged.length,
        total: contentRows.length,
        missingContent: 0,
        missingMetrics,
        cached,
      })
    } catch (err) {
      setMergeStatus({ ok: false, error: err.message })
    } finally {
      setMerging(false)
    }
  }

  const activeCount = data.posts.length
  const lastUpdated = data.posts[0]?.created_date ?? '—'

  return (
    <div className={`${styles.card} card`}>
      <div className="section-banner section-banner-pink">
        <FolderOpen size={13} />
        <span>Nguồn dữ liệu</span>
      </div>

      <div className={styles.body}>
        <div className={styles.sourceOptions}>
          {/* MCP option */}
          <label
            className={`${styles.option} ${source === 'mcp' ? styles.active : ''}`}
            onClick={() => setSource('mcp')}
          >
            <input type="radio" name="source" value="mcp" checked={source === 'mcp'} onChange={() => setSource('mcp')} />
            <Wifi size={14} />
            <span>Kết nối MCP MoMo</span>
          </label>

          {/* Upload option */}
          <label
            className={`${styles.option} ${source === 'upload' ? styles.active : ''}`}
            onClick={() => setSource('upload')}
          >
            <input type="radio" name="source" value="upload" checked={source === 'upload'} onChange={() => setSource('upload')} />
            <Upload size={14} />
            <span>Upload file Excel / JSON</span>
          </label>
        </div>

        {/* ── Upload mode UI ── */}
        {source === 'upload' && (
          <div
            className={styles.dropZone}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) handleFile({ target: { files: [f], value: '' } })
            }}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.json" style={{ display: 'none' }} onChange={handleFile} />
            {parsing ? (
              <span className={styles.dropText}>Đang đọc file…</span>
            ) : (
              <>
                <Upload size={18} className={styles.dropIcon} />
                <span className={styles.dropText}>Chọn file .xlsx hoặc kéo thả vào đây</span>
              </>
            )}
          </div>
        )}

        {source === 'upload' && status && (
          <div className={`${styles.statusMsg} ${status.ok ? styles.ok : styles.err}`}>
            {status.ok
              ? <><CheckCircle size={13} /> Đã load: <strong>{status.name}</strong> — {status.count} bài</>
              : <><AlertCircle size={13} /> Lỗi: {status.error}</>
            }
          </div>
        )}

        {/* ── MCP mode UI ── */}
        {source === 'mcp' && (
          <div className={styles.mcpPanel}>
            {/* MCP status */}
            <div className={styles.mcpInfo}>
              <Wifi size={13} className={mcpConnected ? styles.wifiOn : styles.wifiOff} />
              <span>
                {mcpConnected
                  ? 'Đã kết nối MoMo MCP · dữ liệu tự động cập nhật'
                  : getMomoDataCache().rows?.length
                    ? `Sẽ dùng ${getMomoDataCache().rows.length} bài đã fetch (${getMomoDataCache().pageFilter || 'tất cả page'})`
                    : 'Chưa có dữ liệu MoMo Feed Analytics — sẽ fetch trực tiếp khi bấm Merge'}
              </span>
            </div>

            {/* Upload content file */}
            <div className={styles.mcpStep}>
              <div className={styles.stepLabel}>
                <FileText size={12} />
                <span>Tải file nội dung bài (post_id + content)</span>
              </div>
              <div
                className={`${styles.dropZone} ${styles.dropZoneSm}`}
                onClick={() => contentFileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f) handleContentFile({ target: { files: [f], value: '' } })
                }}
              >
                <input ref={contentFileRef} type="file" accept=".xlsx,.xls,.json" style={{ display: 'none' }} onChange={handleContentFile} />
                {parsing ? (
                  <span className={styles.dropText}>Đang đọc file…</span>
                ) : contentRows ? (
                  <span className={styles.dropTextOk}>
                    <CheckCircle size={13} /> {contentFileName} — {contentRows.length} bài
                  </span>
                ) : (
                  <span className={styles.dropText}>Chọn file .xlsx / .json có cột post_id + content</span>
                )}
              </div>
            </div>

            {/* Step 3: connect & merge */}
            <button
              className={`btn btn-primary ${styles.mergeBtn}`}
              onClick={handleMcpConnect}
              disabled={!contentRows || merging}
            >
              <Merge size={14} />
              {merging ? 'Đang kết nối & merge…' : 'Kết nối MCP & Merge dữ liệu'}
            </button>

            {/* Merge result */}
            {mergeStatus && (
              <div className={`${styles.statusMsg} ${mergeStatus.ok ? styles.ok : styles.err}`}>
                {mergeStatus.ok ? (
                  <>
                    <CheckCircle size={13} />
                    <span>
                      MoMo MCP → <strong>{mergeStatus.total}</strong> posts engagement
                      {' · '}matched content: <strong>{mergeStatus.matched}</strong>
                      {mergeStatus.missingContent > 0 && ` · ${mergeStatus.missingContent} thiếu content`}
                      {mergeStatus.missingMetrics > 0 && ` · ${mergeStatus.missingMetrics} post_id không có metrics`}
                      {mergeStatus.cached && ' · ⚡ cached'}
                    </span>
                  </>
                ) : (
                  <><AlertCircle size={13} /> {mergeStatus.error}</>
                )}
              </div>
            )}
          </div>
        )}

        {/* Date filter — always visible */}
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Bộ lọc thời gian:</span>
          <div className={styles.filterBtns}>
            {DATE_FILTERS.map(f => (
              <button
                key={f.val}
                className={`${styles.filterBtn} ${dateFilter === f.val ? styles.filterActive : ''}`}
                onClick={() => setDateFilter(f.val)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {dateFilter === 'custom' && (
          <div className={styles.customDateRow}>
            <label className={styles.filterLabel}>Từ ngày</label>
            <input type="date" className={styles.customDateInput}
              value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} />
            <label className={styles.filterLabel}>Đến ngày</label>
            <input type="date" className={styles.customDateInput}
              value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} />
          </div>
        )}

        <div className={styles.currentStatus}>
          <CheckCircle size={13} className={styles.okIcon} />
          <span>
            Đang dùng: <strong>
              {overridePosts
                ? (source === 'mcp' && mergeStatus?.ok ? `MCP + ${contentFileName}` : status?.name)
                : 'posts.json'}
            </strong>
            {' '}({rawPostsCount} bài gốc
            {dateFilter !== 'all' ? `, hiển thị ${activeCount} bài trong ${dateFilter} ngày` : `, hiển thị ${activeCount} bài`})
            {data.posts[0]?.created_date && ` · Mới nhất: ${lastUpdated}`}
          </span>
        </div>
      </div>
    </div>
  )
}

const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function normaliseContentRow(r) {
  const postContent = r['Content'] ?? r['post_content'] ?? r['content'] ?? ''
  const postId = String(r['post_id'] ?? r['Post ID'] ?? r['postId'] ?? '')

  // Parse "HH:mm:ss DD/MM/YYYY" from "Created time" column
  let createdDate = r['created_date'] ?? ''
  let createdHour = parseInt(r['created_hour']) || 12
  let dayOfWeek   = r['day_of_week'] ?? 'Monday'
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

  // Infer topic_group
  let topicGroup = r['topic_group'] ?? ''
  if (!topicGroup) {
    if (/vn-?index|cổ phiếu|chứng khoán|vnindex/.test(c))
      topicGroup = /dự đoán|dự báo/.test(c) ? 'Dự đoán giá cổ phiếu' : 'Phân tích thị trường chứng khoán'
    else if (/tiết kiệm|lãi suất|gửi tiền/.test(c))
      topicGroup = 'Sản phẩm tiết kiệm & lãi suất'
    else if (/chi tiêu|ngân sách|tài chính cá nhân|quản lý tiền/.test(c))
      topicGroup = 'Giáo dục tài chính & chi tiêu'
    else if (/minigame|mini game/.test(c))
      topicGroup = 'Minigame & tương tác'
    else if (/tín dụng|vay|thẻ/.test(c))
      topicGroup = 'Tín dụng & vay vốn'
    else
      topicGroup = 'Khác'
  }

  // Infer content_format
  let contentFormat = r['content_format'] ?? ''
  if (!contentFormat) {
    if (/minigame|mini game/.test(c))
      contentFormat = 'minigame'
    else if (/dự đoán|bạn nghĩ|theo bạn|vote|bình chọn/.test(c))
      contentFormat = 'poll'
    else if (/tổng hợp|diễn biến|thị trường hôm nay|recap/.test(c))
      contentFormat = 'market_update'
    else if (/học|hiểu|giáo dục|kiến thức|tips?|mẹo/.test(c))
      contentFormat = 'educational_post'
    else if (/lãi suất|tiết kiệm|gửi tiền|sản phẩm/.test(c))
      contentFormat = 'service_faq'
    else
      contentFormat = 'post'
  }

  const hasReward = r['has_reward'] === true || r['has_reward'] === 'TRUE' || r['has_reward'] === 1
    || /nhận quà|lượt quay|thưởng|giải thưởng|phần thưởng/.test(c)

  return {
    ...r,
    post_id:        postId,
    post_content:   postContent,
    created_date:   createdDate,
    created_hour:   createdHour,
    day_of_week:    dayOfWeek,
    topic_group:    topicGroup,
    content_format: contentFormat,
    has_reward:     hasReward,
  }
}

function normaliseMetricRows(rows) {
  return rows.map(r => ({
    ...r,
    er_user:          parseFloat(r.er_user)          || 0,
    ctr_user:         parseFloat(r.ctr_user)         || 0,
    view_users:       parseInt(r.view_users)         || 0,
    view_count:       parseInt(r.view_count)         || 0,
    like_users:       parseInt(r.like_users)         || 0,
    comment_users:    parseInt(r.comment_users)      || 0,
    share_users:      parseInt(r.share_users)        || 0,
    bp_comment_count: parseInt(r.bp_comment_count)   || 0,
    has_reward:   r.has_reward   === true || r.has_reward   === 'TRUE' || r.has_reward   === 1,
    view_anomaly: r.view_anomaly === true || r.view_anomaly === 'TRUE' || r.view_anomaly === 1,
  }))
}
