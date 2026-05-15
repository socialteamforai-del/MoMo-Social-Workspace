import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './MomoDataTab.module.css'

const PREVIEW_ROWS = 5

const today = new Date().toISOString().split('T')[0]
const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]

// Persist data across tab switches (module-level — survives unmount)
let _cache = { rows: [], refreshTime: '', isCached: false, searched: false, startDate: thirtyDaysAgo, endDate: today, pageFilter: '', pageOptions: [] }

// Export for DataSourceSelector to use cached MCP rows
export function getMomoDataCache() { return _cache }

const MEASURES = [
  { key: 'feed_agg_user_engagement.view_users',      label: 'View Users',       type: 'num' },
  { key: 'feed_agg_user_engagement.engaged_users',   label: 'Engaged Users',    type: 'num' },
  { key: 'feed_agg_user_engagement.interact_users',  label: 'Interact Users',   type: 'num' },
  { key: 'feed_agg_user_engagement.like_users',      label: 'Like Users',       type: 'num' },
  { key: 'feed_agg_user_engagement.comment_users',   label: 'Comment Users',    type: 'num' },
  { key: 'feed_agg_user_engagement.share_users',     label: 'Share Users',      type: 'num' },
  { key: 'feed_agg_user_engagement.click_cta_users', label: 'CTA Users',        type: 'num' },
  { key: 'feed_agg_user_engagement.view_count',      label: 'Views',            type: 'num' },
  { key: 'feed_agg_user_engagement.like_count',      label: 'Likes',            type: 'num' },
  { key: 'feed_agg_user_engagement.comment_count',   label: 'Comments',         type: 'num' },
  { key: 'feed_agg_user_engagement.share_count',     label: 'Shares',           type: 'num' },
  { key: 'feed_agg_user_engagement.click_cta_count', label: 'CTA Clicks',       type: 'num' },
  { key: 'feed_agg_user_engagement.click_poll_count',label: 'Poll Clicks',      type: 'num' },
  { key: 'feed_agg_user_engagement.er_user',         label: 'ER User',          type: 'pct' },
  { key: 'feed_agg_user_engagement.ctr_user',        label: 'CTR User',         type: 'pct' },
]

function fmt(val, type) {
  const n = Number(val ?? 0)
  if (type === 'pct') return `${(n * 100).toFixed(2)}%`
  return n.toLocaleString('vi-VN')
}

export default function MomoDataTab() {
  const { setOverridePosts, contentRows, contentFileName } = useApp()
  const [applyStatus, setApplyStatus] = useState(null)
  const [startDate, setStartDate]   = useState(_cache.startDate)
  const [endDate, setEndDate]       = useState(_cache.endDate)
  const [pageFilter, setPageFilter] = useState(_cache.pageFilter)
  const [rows, setRows]             = useState(_cache.rows)
  const [refreshTime, setRefreshTime] = useState(_cache.refreshTime)
  const [isCached, setIsCached]     = useState(_cache.isCached)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [searched, setSearched]     = useState(_cache.searched)
  const [showAll, setShowAll]       = useState(false)

  // Build content lookup from context (uploaded via DataSourceSelector)
  const contentMap = useMemo(() => {
    if (!contentRows?.length) return null
    const map = new Map()
    for (const r of contentRows) {
      if (r.post_id) map.set(String(r.post_id), r)
    }
    return map.size ? map : null
  }, [contentRows])

  // Page name dropdown
  const [pageOptions, setPageOptions]   = useState(_cache.pageOptions)
  const [showPageDrop, setShowPageDrop] = useState(false)
  const [pageSearch, setPageSearch]     = useState('')
  const [loadingPages, setLoadingPages] = useState(false)
  const dropRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowPageDrop(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadPageOptions = useCallback(async () => {
    if (_cache.pageOptions.length) { setPageOptions(_cache.pageOptions); return }
    setLoadingPages(true)
    try {
      const end   = new Date().toISOString().split('T')[0]
      const start = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0]
      const res  = await fetch('/api/momo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, limit: 500 }),
      })
      const json = await res.json()
      const names = [...new Set((json.rows ?? [])
        .map(r => r['feed_agg_user_engagement.page_name'])
        .filter(Boolean)
      )].sort()
      setPageOptions(names)
      _cache.pageOptions = names
    } catch {}
    finally { setLoadingPages(false) }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/momo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, limit: 500 }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // Update page options from fresh data
      const freshNames = [...new Set((json.rows ?? [])
        .map(r => r['feed_agg_user_engagement.page_name']).filter(Boolean)
      )].sort()
      if (freshNames.length) { setPageOptions(freshNames); _cache.pageOptions = freshNames }
      // Filter client-side by page name
      const keyword = pageFilter.trim().toLowerCase()
      const filtered = keyword
        ? json.rows.filter(r => (r['feed_agg_user_engagement.page_name'] ?? '').toLowerCase().includes(keyword))
        : json.rows
      setRows(filtered)
      setRefreshTime(json.refreshTime)
      setIsCached(!!json.cached)
      setSearched(true)
      _cache = { ..._cache, rows: filtered, refreshTime: json.refreshTime, isCached: !!json.cached, searched: true, startDate, endDate, pageFilter }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, pageFilter])

  const applyToOverview = useCallback(() => {
    if (!rows.length) return
    let matchedCount = 0
    const normalized = rows.map(r => {
      const pid = r['feed_agg_user_engagement.post_id'] ?? ''
      const content = contentMap?.get(String(pid))
      if (content) matchedCount++
      return {
        post_id:       pid,
        page_name:     r['feed_agg_user_engagement.page_name'] ?? '',
        er_user:       parseFloat(r['feed_agg_user_engagement.er_user'])    || 0,
        ctr_user:      parseFloat(r['feed_agg_user_engagement.ctr_user'])   || 0,
        view_users:    parseInt(r['feed_agg_user_engagement.view_users'])   || 0,
        view_count:    parseInt(r['feed_agg_user_engagement.view_count'])   || 0,
        like_users:    parseInt(r['feed_agg_user_engagement.like_users'])   || 0,
        comment_users: parseInt(r['feed_agg_user_engagement.comment_users'])|| 0,
        share_users:   parseInt(r['feed_agg_user_engagement.share_users'])  || 0,
        engaged_users: parseInt(r['feed_agg_user_engagement.engaged_users'])|| 0,
        // Use content from uploaded file if available, else placeholders
        topic_group:    content?.topic_group    ?? '',
        content_format: content?.content_format ?? '',
        post_content:   content?.post_content   ?? '',
        created_date:   content?.created_date   ?? startDate,
        created_hour:   content?.created_hour   ?? 12,
        day_of_week:    content?.day_of_week    ?? 'Monday',
        has_reward:     content?.has_reward     ?? false,
        view_anomaly: false,
        bp_comment_count: 0,
      }
    })
    setOverridePosts(normalized)
    if (contentMap && matchedCount > 0) {
      const missed = normalized.length - matchedCount
      setApplyStatus(
        `Đã áp dụng ${normalized.length} bài vào Overview · ghép content từ ${contentFileName || 'file'}: ${matchedCount} matched` +
        (missed > 0 ? ` · ${missed} bài thiếu content` : '') + '.'
      )
    } else {
      setApplyStatus(`Đã áp dụng ${normalized.length} bài vào Overview. Lưu ý: chưa có file content — biểu đồ topic/format sẽ trống, chỉ KPI cards là chính xác.`)
    }
    setTimeout(() => setApplyStatus(null), 6000)
  }, [rows, startDate, setOverridePosts, contentMap, contentFileName])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>MoMo Feed Analytics</h1>
        <p className={styles.subtitle}>
          Cube: <span>feed_agg_user_engagement</span> · Filter: <span>Fanpage post</span>
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.dateGroup}>
          <label className={styles.label}>Từ ngày</label>
          <input type="date" className={styles.dateInput} value={startDate} max={endDate}
            onChange={e => { setStartDate(e.target.value); _cache.startDate = e.target.value }} />
        </div>
        <div className={styles.dateGroup}>
          <label className={styles.label}>Đến ngày</label>
          <input type="date" className={styles.dateInput} value={endDate} min={startDate} max={today}
            onChange={e => { setEndDate(e.target.value); _cache.endDate = e.target.value }} />
        </div>
        <div className={styles.dateGroup} style={{ flex: 1 }}>
          <label className={styles.label}>Lọc theo Page Name</label>
          <input
            type="text"
            list="page-options-list"
            className={styles.dateInput}
            placeholder="Tất cả page (hoặc gõ tên page)"
            value={pageFilter}
            onChange={e => { setPageFilter(e.target.value); _cache.pageFilter = e.target.value }}
            onFocus={() => { if (!pageOptions.length) loadPageOptions() }}
          />
          <datalist id="page-options-list">
            {pageOptions.map(name => <option key={name} value={name} />)}
          </datalist>
        </div>
        <div className={styles.btnGroup}>
          <button className={styles.btn} onClick={fetchData} disabled={loading}>
            {loading ? 'Đang tải…' : 'Lấy dữ liệu'}
          </button>
          {rows.length > 0 && (
            <button className={styles.applyBtn} onClick={applyToOverview} title="Đẩy kết quả đang hiển thị vào tab Overview để phân tích KPI">
              ↗ Áp dụng {rows.length} bài → Overview
            </button>
          )}
        </div>
      </div>

      {applyStatus && <div className={styles.applyNote}>{applyStatus}</div>}

      {error && <div className={styles.error}>{error}</div>}

      {searched && !loading && (
        <div className={styles.meta}>
          <span className={styles.metaBadge}>
            <strong>{rows.length}</strong> posts
            {pageFilter && <> · filter: <em>{pageFilter}</em></>}
            {contentMap && <> · <span style={{ color: 'var(--momo-pink)' }}>đã có content ({contentFileName})</span></>}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isCached && <span className={styles.cached}>⚡ Cached</span>}
            {refreshTime && <span className={styles.refresh}>Cập nhật: {new Date(refreshTime).toLocaleString('vi-VN')}</span>}
          </span>
        </div>
      )}

      {rows.length > 0 && (() => {
        const visibleRows = showAll ? rows : rows.slice(0, PREVIEW_ROWS)
        const hasMore = rows.length > PREVIEW_ROWS
        return (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.stickyCol}>#</th>
                    <th className={styles.stickyCol2}>Page Name</th>
                    <th>Post ID</th>
                    {contentMap && <th>Content</th>}
                    {MEASURES.map(m => <th key={m.key}>{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, i) => {
                    const pid = r['feed_agg_user_engagement.post_id'] || ''
                    const content = contentMap?.get(String(pid))
                    return (
                      <tr key={i}>
                        <td className={`${styles.rankCell} ${styles.stickyCol} ${i < 3 ? styles[`rank${i+1}`] : ''}`}>{i + 1}</td>
                        <td className={`${styles.pageName} ${styles.stickyCol2}`}>
                          {r['feed_agg_user_engagement.page_name'] || '—'}
                        </td>
                        <td className={styles.postId}>{pid || '—'}</td>
                        {contentMap && (
                          <td className={styles.contentCell} title={content?.post_content || ''}>
                            {content?.post_content
                              ? content.post_content.slice(0, 80) + (content.post_content.length > 80 ? '…' : '')
                              : <span className={styles.contentMissing}>—</span>}
                          </td>
                        )}
                        {MEASURES.map(m => (
                          <td key={m.key} className={styles.numCell}>
                            {fmt(r[m.key], m.type)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <button className={styles.toggleBtn} onClick={() => setShowAll(v => !v)}>
                {showAll
                  ? `▲ Ẩn bớt (chỉ hiện ${PREVIEW_ROWS} bài đầu)`
                  : `▼ Xem tất cả ${rows.length} bài (đang ẩn ${rows.length - PREVIEW_ROWS})`}
              </button>
            )}
          </>
        )
      })()}

      {searched && !loading && rows.length === 0 && !error && (
        <div className={styles.empty}>Không có dữ liệu cho bộ lọc này.</div>
      )}
    </div>
  )
}
