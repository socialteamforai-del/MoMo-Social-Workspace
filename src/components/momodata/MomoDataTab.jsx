import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './MomoDataTab.module.css'

const PREVIEW_ROWS = 5

const today        = new Date().toISOString().split('T')[0]
const daysAgo = n  => new Date(Date.now() - n * 864e5).toISOString().split('T')[0]

const PRESETS = [
  { label: '7 ngày',  days: 7   },
  { label: '30 ngày', days: 30  },
  { label: '90 ngày', days: 90  },
  { label: '6 tháng', days: 180 },
  { label: 'Tuỳ chọn', days: null },
]

// Persist data across tab switches (module-level — survives unmount)
let _cache = {
  rows: [], refreshTime: '', isCached: false, searched: false,
  startDate: daysAgo(30), endDate: today, pageId: '', pageOptions: [],
  preset: 30,
}

export function getMomoDataCache() { return _cache }

const MEASURES = [
  { key: 'feed_agg_user_engagement.view_users',      label: 'View Users',  type: 'num' },
  { key: 'feed_agg_user_engagement.engaged_users',   label: 'Engaged',     type: 'num' },
  { key: 'feed_agg_user_engagement.interact_users',  label: 'Interact',    type: 'num' },
  { key: 'feed_agg_user_engagement.like_users',      label: 'Like',        type: 'num' },
  { key: 'feed_agg_user_engagement.comment_users',   label: 'Comment',     type: 'num' },
  { key: 'feed_agg_user_engagement.share_users',     label: 'Share',       type: 'num' },
  { key: 'feed_agg_user_engagement.click_cta_users', label: 'CTA',         type: 'num' },
  { key: 'feed_agg_user_engagement.view_count',      label: 'Views',       type: 'num' },
  { key: 'feed_agg_user_engagement.like_count',      label: 'Likes',       type: 'num' },
  { key: 'feed_agg_user_engagement.comment_count',   label: 'Comments',    type: 'num' },
  { key: 'feed_agg_user_engagement.share_count',     label: 'Shares',      type: 'num' },
  { key: 'feed_agg_user_engagement.click_cta_count', label: 'CTA Clicks',  type: 'num' },
  { key: 'feed_agg_user_engagement.click_poll_count',label: 'Poll Clicks', type: 'num' },
  { key: 'feed_agg_user_engagement.er_user',         label: 'ER',          type: 'pct' },
  { key: 'feed_agg_user_engagement.ctr_user',        label: 'CTR',         type: 'pct' },
]

function fmt(val, type) {
  const n = Number(val ?? 0)
  if (type === 'pct') return `${(n * 100).toFixed(2)}%`
  return n.toLocaleString('vi-VN')
}

export default function MomoDataTab() {
  const { setOverridePosts, contentRows, contentFileName, pageConfig } = useApp()

  const [preset, setPreset]         = useState(_cache.preset ?? 30)
  const [startDate, setStartDate]   = useState(_cache.startDate)
  const [endDate, setEndDate]       = useState(_cache.endDate)
  const [rows, setRows]             = useState(_cache.rows)
  const [refreshTime, setRefreshTime] = useState(_cache.refreshTime)
  const [isCached, setIsCached]     = useState(_cache.isCached)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [searched, setSearched]     = useState(_cache.searched)
  const [showAll, setShowAll]       = useState(false)
  const [applyStatus, setApplyStatus] = useState(null)
  const didAutoFetch                = useRef(false)

  const contentMap = useMemo(() => {
    if (!contentRows?.length) return null
    const map = new Map()
    for (const r of contentRows) {
      if (r.post_id) map.set(String(r.post_id), r)
    }
    return map.size ? map : null
  }, [contentRows])

  const handlePreset = (days) => {
    setPreset(days)
    if (days !== null) {
      const s = daysAgo(days)
      setStartDate(s)
      setEndDate(today)
      _cache.startDate = s
      _cache.endDate   = today
    }
    _cache.preset = days
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/momo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, limit: 500, mcpPageId: pageConfig?.mcp_page_id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      // Server already filters by mcp_page_id — no client-side page filter needed
      const rows = json.rows ?? []
      setRows(rows)
      setRefreshTime(json.refreshTime)
      setIsCached(!!json.cached)
      setSearched(true)
      _cache = { ..._cache, rows, refreshTime: json.refreshTime, isCached: !!json.cached, searched: true, startDate, endDate, pageId: pageConfig?.mcp_page_id ?? '' }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  // Auto-fetch on first mount if no cached data
  useEffect(() => {
    if (!didAutoFetch.current && !_cache.searched) {
      didAutoFetch.current = true
      fetchData()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyToOverview = useCallback(() => {
    if (!rows.length) return
    let matchedCount = 0
    const normalized = rows.map(r => {
      const pid     = r['feed_agg_user_engagement.post_id'] ?? ''
      const content = contentMap?.get(String(pid))
      if (content) matchedCount++
      return {
        post_id:        pid,
        page_name:      r['feed_agg_user_engagement.page_name'] ?? '',
        er_user:        parseFloat(r['feed_agg_user_engagement.er_user'])    || 0,
        ctr_user:       parseFloat(r['feed_agg_user_engagement.ctr_user'])   || 0,
        view_users:     parseInt(r['feed_agg_user_engagement.view_users'])   || 0,
        view_count:     parseInt(r['feed_agg_user_engagement.view_count'])   || 0,
        like_users:     parseInt(r['feed_agg_user_engagement.like_users'])   || 0,
        comment_users:  parseInt(r['feed_agg_user_engagement.comment_users'])|| 0,
        share_users:    parseInt(r['feed_agg_user_engagement.share_users'])  || 0,
        engaged_users:  parseInt(r['feed_agg_user_engagement.engaged_users'])|| 0,
        topic_group:    content?.topic_group    ?? '',
        content_format: content?.content_format ?? '',
        post_content:   content?.post_content   ?? '',
        created_date:   content?.created_date   ?? startDate,
        created_hour:   content?.created_hour   ?? 12,
        day_of_week:    content?.day_of_week    ?? 'Monday',
        has_reward:     content?.has_reward     ?? false,
        view_anomaly:   false,
        bp_comment_count: 0,
      }
    })
    setOverridePosts(normalized)
    const missed = normalized.length - matchedCount
    setApplyStatus(
      contentMap && matchedCount > 0
        ? `Đã áp dụng ${normalized.length} bài · ghép content: ${matchedCount} matched` + (missed > 0 ? ` · ${missed} thiếu content` : '')
        : `Đã áp dụng ${normalized.length} bài. Chưa có file content — biểu đồ topic/format sẽ trống.`
    )
    setTimeout(() => setApplyStatus(null), 6000)
  }, [rows, startDate, setOverridePosts, contentMap, contentFileName])

  const activePresetLabel = PRESETS.find(p => p.days === preset)?.label ?? 'Tuỳ chọn'

  return (
    <div className={styles.container}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>MoMo Feed Analytics</h1>
            <p className={styles.subtitle}>
              Cube: <span>feed_agg_user_engagement</span> · Filter: <span>Fanpage post</span>
            </p>
          </div>
          {/* Page lock badge */}
          <div className={styles.pageLockBadge}>
            <span className={styles.pageLockDot} />
            <span className={styles.pageLockName}>{pageConfig?.page_name}</span>
            <span className={styles.pageLockHint}>🔒 từ tài khoản</span>
          </div>
        </div>
      </div>

      {/* ── Step 1: Timeframe ── */}
      <div className={styles.filterCard}>
        <p className={styles.stepLabel}><span className={styles.stepNum}>1</span> Chọn thời gian</p>

        <div className={styles.presetRow}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              className={`${styles.presetChip} ${preset === p.days ? styles.presetActive : ''}`}
              onClick={() => handlePreset(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date pickers — only shown when "Tuỳ chọn" selected */}
        {preset === null && (
          <div className={styles.customDates}>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Từ ngày</label>
              <input
                type="date"
                className={styles.dateInput}
                value={startDate}
                max={endDate}
                onChange={e => { setStartDate(e.target.value); _cache.startDate = e.target.value }}
              />
            </div>
            <span className={styles.dateSep}>→</span>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Đến ngày</label>
              <input
                type="date"
                className={styles.dateInput}
                value={endDate}
                min={startDate}
                max={today}
                onChange={e => { setEndDate(e.target.value); _cache.endDate = e.target.value }}
              />
            </div>
          </div>
        )}

        {/* Date range summary */}
        <p className={styles.rangeSummary}>
          {startDate} → {endDate}
          {preset !== null && <> ({activePresetLabel})</>}
        </p>

        {/* Fetch button */}
        <button
          className={styles.fetchBtn}
          onClick={fetchData}
          disabled={loading}
        >
          {loading
            ? <><span className={styles.spinner} /> Đang tải dữ liệu…</>
            : '⬇  Tải dữ liệu'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── Step 2: Result ── */}
      {searched && !loading && (
        <div className={styles.resultCard}>
          <p className={styles.stepLabel}><span className={styles.stepNum}>2</span> Kết quả</p>

          <div className={styles.resultMeta}>
            <div className={styles.resultCount}>
              <span className={styles.resultNum}>{rows.length}</span>
              <span className={styles.resultSub}>bài · {pageConfig?.page_name}</span>
            </div>
            <div className={styles.resultRight}>
              {isCached && <span className={styles.cached}>⚡ Cached</span>}
              {refreshTime && (
                <span className={styles.refresh}>
                  Cập nhật: {new Date(refreshTime).toLocaleString('vi-VN')}
                </span>
              )}
            </div>
          </div>

          {contentMap && (
            <p className={styles.contentNote}>
              📎 File content đã ghép: <strong>{contentFileName}</strong>
            </p>
          )}

          {applyStatus && <div className={styles.applyNote}>{applyStatus}</div>}

          {rows.length > 0 && (
            <button className={styles.applyBtn} onClick={applyToOverview}>
              ↗ Áp dụng {rows.length} bài vào Workspace
            </button>
          )}
        </div>
      )}

      {/* ── Data table ── */}
      {rows.length > 0 && (() => {
        const visible = showAll ? rows : rows.slice(0, PREVIEW_ROWS)
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
                  {visible.map((r, i) => {
                    const pid     = r['feed_agg_user_engagement.post_id'] || ''
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

            {rows.length > PREVIEW_ROWS && (
              <button className={styles.toggleBtn} onClick={() => setShowAll(v => !v)}>
                {showAll
                  ? `▲ Thu gọn (chỉ hiện ${PREVIEW_ROWS} bài)`
                  : `▼ Xem tất cả ${rows.length} bài`}
              </button>
            )}
          </>
        )
      })()}

      {searched && !loading && rows.length === 0 && !error && (
        <div className={styles.empty}>Không có dữ liệu cho khoảng thời gian này.</div>
      )}
    </div>
  )
}
