import React, { useState } from 'react'
import { TrendingUp, Clock, Zap, Plus, X, RefreshCw, Flame, Facebook } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { generateWeeklyCalendar } from '../../utils/calendarGen.js'
import styles from './SignalSummary.module.css'

const FORMAT_OPTIONS = ['poll','educational_post','market_update','qa','service_faq','minigame','confession_discussion','promo_info']

function isExpired(trend) {
  const exp = new Date(trend.trend_date)
  exp.setDate(exp.getDate() + (trend.expiry_window_days || 7))
  return new Date() > exp
}

function daysLeft(trend) {
  const exp = new Date(trend.trend_date)
  exp.setDate(exp.getDate() + (trend.expiry_window_days || 7))
  const diff = Math.ceil((exp - new Date()) / 86400000)
  return diff
}

export default function SignalSummary() {
  const {
    data, extraTrends, setExtraTrends,
    weeklySlots, setWeeklySlots,
    pageConfig, plannerInputs, selectedWeek,
  } = useApp()
  const { posts, timingBenchmarks } = data

  const [showModal, setShowModal]   = useState(false)
  const [toast, setToast]           = useState(null)
  const [hotTopics, setHotTopics]   = useState([])
  const [loadingHot, setLoadingHot] = useState(false)
  const [showHot, setShowHot]       = useState(false)
  const [hotFetchedAt, setHotFetchedAt] = useState(null)
  const [showFbForm, setShowFbForm] = useState(false)
  const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const [fbForm, setFbForm]         = useState({
    mode: 'single',
    groupName: 'Vén Khéo',
    // single mode
    title: '', likes: '', comments: '', shares: '', views: '',
    publishedAt: nowLocal(),
    // bulk mode
    bulkText: '',
    bulkDate: new Date().toISOString().split('T')[0],
  })
  const [fbLoading, setFbLoading]   = useState(false)
  const [appliedTrendTopic, setAppliedTrendTopic] = useState(null)
  const [hiddenTrendIds, setHiddenTrendIds] = useState(new Set())
  const [form, setForm]             = useState({
    trend_topic: '', trend_type: 'short-term', trend_strength: 0.7,
    expiry_window_days: 5, recommended_format: 'poll', recommended_angle: '',
  })

  // Top 3 topics organic
  const topicStats = {}
  for (const p of posts) {
    if (!topicStats[p.topic_group]) topicStats[p.topic_group] = { sum: 0, count: 0 }
    topicStats[p.topic_group].sum   += p.er_user
    topicStats[p.topic_group].count += 1
  }
  const topTopics = Object.entries(topicStats)
    .map(([topic, { sum, count }]) => ({ topic, avgER: sum / count, count }))
    .sort((a, b) => b.avgER - a.avgER)
    .slice(0, 3)

  const bestTiming = [...timingBenchmarks].sort((a, b) => b.avg_er - a.avg_er).slice(0, 3)

  const trendId = (t) => `${t.trend_topic}__${t.trend_date ?? ''}`

  const ageLabel = (pubDate) => {
    if (!pubDate) return ''
    const h = (Date.now() - new Date(pubDate).getTime()) / 3_600_000
    if (h < 1) return `${Math.round(h * 60)}p`
    if (h < 24) return `${Math.round(h)}g`
    return `${Math.round(h / 24)}n`
  }

  const trendDateLabel = (trend) => {
    const d = new Date(trend.trend_date)
    if (isNaN(d.getTime())) return ''
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm} · ${hh}:${min}`
  }
  const allTrends   = data.marketTrends.filter(t => !hiddenTrendIds.has(trendId(t)))
  const liveTrends  = allTrends.filter(t => t.status === 'active' && !isExpired(t))
  const deadTrends  = allTrends.filter(t => t.status !== 'active' || isExpired(t))

  const regenFlexible = (trendsList) => {
    const fresh = generateWeeklyCalendar(pageConfig, {
      weekStart: selectedWeek, numPosts: plannerInputs.numPosts,
      mode: plannerInputs.mode, buInputs: [],
    }, { posts, timingBenchmarks, trends: trendsList })
    const fixed = weeklySlots.filter(s => s.slot_type === 'fixed')
    const flexible = fresh.filter(s => s.slot_type !== 'fixed')
    setWeeklySlots([...fixed, ...flexible].sort((a, b) => a.date.localeCompare(b.date) || a.publish_hour - b.publish_hour))
    return flexible.length
  }

  const applyTrend = (trend) => {
    if (!weeklySlots.length) return
    if (appliedTrendTopic === trend.trend_topic) {
      // Revert: regenerate with normal weights
      regenFlexible(data.marketTrends)
      setAppliedTrendTopic(null)
      setToast('Đã hoàn tác — lịch về trạng thái mặc định')
      setTimeout(() => setToast(null), 2500)
      return
    }
    // Boost this trend's strength to 1.0 so calendar engine prioritises matching format/topic
    const boostedTrends = data.marketTrends.map(t =>
      t.trend_topic === trend.trend_topic ? { ...t, trend_strength: 1.0 } : t
    )
    const count = regenFlexible(boostedTrends)
    setAppliedTrendTopic(trend.trend_topic)
    setToast(`Lịch đã tái tạo theo trend "${trend.trend_topic}" (${count} slot)`)
    setTimeout(() => setToast(null), 3000)
  }

  const hideTrend = (t) => {
    const id = trendId(t)
    setHiddenTrendIds(prev => new Set([...prev, id]))
    if (appliedTrendTopic === t.trend_topic) setAppliedTrendTopic(null)
    // Also remove from extraTrends if it's one of those
    if (extraTrends.some(et => trendId(et) === id)) {
      setExtraTrends(prev => prev.filter(et => trendId(et) !== id))
    }
  }

  const fetchHotTopics = async () => {
    setLoadingHot(true)
    setShowHot(true)
    try {
      const res = await fetch('/api/trending')
      const json = await res.json()
      setHotTopics(json.items ?? [])
      setHotFetchedAt(json.fetchedAt)
    } catch { setHotTopics([]) }
    finally { setLoadingHot(false) }
  }

  const addFromHot = (item) => {
    const newTrend = {
      trend_topic: item.title.slice(0, 80),
      trend_type: 'short-term',
      trend_strength: 0.75,
      expiry_window_days: 3,
      recommended_format: 'market_update',
      recommended_angle: `Góc nhìn từ: ${item.title.slice(0, 60)}`,
      trend_date: item.pubDate || new Date().toISOString(),
      status: 'active',
      page_id: pageConfig.page_id,
      source: item.source,
    }
    setExtraTrends(prev => [...prev, newTrend])
    setToast(`Đã thêm trend: "${newTrend.trend_topic.slice(0, 40)}…"`)
    setTimeout(() => setToast(null), 3000)
  }

  const submitFbPost = async () => {
    setFbLoading(true)
    try {
      if (fbForm.mode === 'bulk') {
        const lines = fbForm.bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 3)
        if (!lines.length) { setFbLoading(false); return }
        const publishedAt = fbForm.bulkDate ? new Date(fbForm.bulkDate).toISOString() : new Date().toISOString()
        await Promise.all(lines.map(title =>
          fetch('/api/trending/facebook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, groupName: fbForm.groupName, publishedAt, likes: 0, comments: 0, shares: 0, views: 0 }),
          })
        ))
        setToast(`Đã thêm ${lines.length} bài từ ${fbForm.groupName}!`)
      } else {
        if (!fbForm.title.trim()) { setFbLoading(false); return }
        await fetch('/api/trending/facebook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:       fbForm.title.trim(),
            groupName:   fbForm.groupName,
            publishedAt: fbForm.publishedAt,
            likes:    Number(fbForm.likes    || 0),
            comments: Number(fbForm.comments || 0),
            shares:   Number(fbForm.shares   || 0),
            views:    Number(fbForm.views    || 0),
          }),
        })
        setToast('Đã thêm bài Facebook vào trending!')
      }
      setFbForm(f => ({ ...f, title: '', likes: '', comments: '', shares: '', views: '', bulkText: '', publishedAt: nowLocal() }))
      setShowFbForm(false)
      const res = await fetch('/api/trending?force=1')
      const json = await res.json()
      setHotTopics(json.items ?? [])
      setHotFetchedAt(json.fetchedAt)
      setShowHot(true)
      setTimeout(() => setToast(null), 3000)
    } catch { setToast('Lỗi khi thêm bài Facebook') }
    finally { setFbLoading(false) }
  }

  const addTrend = () => {
    if (!form.trend_topic.trim()) return
    const now = new Date()
    const newTrend = {
      ...form,
      trend_date: now.toISOString().split('T')[0],
      status: 'active',
      page_id: pageConfig.page_id,
    }
    setExtraTrends(prev => [...prev, newTrend])

    // Re-score flexible slots
    if (weeklySlots.length) {
      const fresh = generateWeeklyCalendar(pageConfig, {
        weekStart: selectedWeek, numPosts: plannerInputs.numPosts,
        mode: plannerInputs.mode, buInputs: [],
      }, { posts, timingBenchmarks, trends: [...data.marketTrends, newTrend] })
      const fixed = weeklySlots.filter(s => s.slot_type === 'fixed')
      const flexible = fresh.filter(s => s.slot_type !== 'fixed')
      setWeeklySlots([...fixed, ...flexible].sort((a, b) => a.date.localeCompare(b.date)))
      const affected = flexible.length
      setToast(`Đã thêm trend. ${affected} slot flexible được cập nhật.`)
      setTimeout(() => setToast(null), 3000)
    }

    setForm({ trend_topic: '', trend_type: 'short-term', trend_strength: 0.7, expiry_window_days: 5, recommended_format: 'poll', recommended_angle: '' })
    setShowModal(false)
  }

  return (
    <>
      <div className={styles.topRow}>
        {/* Top topics */}
        <div className={`${styles.card} card`}>
          <div className="section-banner section-banner-pink">
            <TrendingUp size={13} /> <span>Top chủ đề</span>
          </div>
          <div className={styles.cardInner}>
          <div className={styles.list}>
            {topTopics.map(({ topic, avgER }) => (
              <div key={topic} className={styles.item}>
                <span className={styles.itemLabel}>{topic}</span>
                <span className={styles.itemVal} style={{ color: avgER >= 0.45 ? 'var(--green)' : avgER >= 0.30 ? '#9A7000' : 'var(--red)' }}>
                  ER {(avgER * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Best timing */}
        <div className={`${styles.card} card`}>
          <div className="section-banner section-banner-pink">
            <Clock size={13} /> <span>Khung giờ tốt nhất</span>
          </div>
          <div className={styles.cardInner}>
          <div className={styles.list}>
            {bestTiming.map((b, i) => (
              <div key={i} className={styles.item}>
                <span className={styles.itemLabel}>{b.best_day} · {b.best_hour}:00 — {b.content_format}</span>
                <span className={styles.itemVal} style={{ color: 'var(--blue)' }}>ER {(b.avg_er * 100).toFixed(1)}%</span>
              </div>
            ))}
            {bestTiming.length === 0 && <p className={styles.empty}>Chưa có dữ liệu</p>}
          </div>
          </div>
        </div>

      </div>{/* end topRow */}

      {/* Trend manager — full width row */}
      <div className={`${styles.trendFullCard} card`}>
          <div className="section-banner section-banner-pink" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={13} /> Xu hướng đang theo dõi</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button
                style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', color: 'white', padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={fetchHotTopics} disabled={loadingHot}
                title="Lấy trend mới nhất từ báo"
              >
                {loadingHot ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Flame size={11} />}
                {loadingHot ? 'Đang tải…' : 'Trend mới'}
              </button>
              <button
                style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', color: 'white', padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => { setShowFbForm(f => !f); setShowHot(true) }}
                title="Thêm bài từ Facebook group"
              >
                <Facebook size={11} /> FB
              </button>
              <button
                style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', color: 'white', padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => setShowModal(true)}
              >
                <Plus size={11} /> Thêm
              </button>
            </span>
          </div>

          {/* Hot topics from news + FB manual */}
          {showHot && (
            <div className={styles.hotPanel}>
              <div className={styles.hotHeader}>
                <Flame size={12} style={{ color: 'var(--momo-pink)' }} />
                <span>Tin nóng từ báo VN &amp; cộng đồng</span>
                {hotFetchedAt && <span className={styles.hotTime}>{new Date(hotFetchedAt).toLocaleTimeString('vi-VN')}</span>}
                <button className={styles.hotClose} onClick={() => { setShowHot(false); setShowFbForm(false) }}><X size={12} /></button>
              </div>

              {/* Facebook paste form */}
              {showFbForm && (
                <div className={styles.fbForm}>
                  {/* Mode tabs + group */}
                  <div className={styles.fbTopRow}>
                    <div className={styles.fbModeTabs}>
                      <button className={`${styles.fbModeTab} ${fbForm.mode === 'single' ? styles.fbModeActive : ''}`}
                        onClick={() => setFbForm(f => ({ ...f, mode: 'single' }))}>
                        Một bài
                      </button>
                      <button className={`${styles.fbModeTab} ${fbForm.mode === 'bulk' ? styles.fbModeActive : ''}`}
                        onClick={() => setFbForm(f => ({ ...f, mode: 'bulk' }))}>
                        Nhiều bài
                      </button>
                    </div>
                    <select className={styles.fbSelect} value={fbForm.groupName}
                      onChange={e => setFbForm(f => ({ ...f, groupName: e.target.value }))}>
                      <option>Vén Khéo</option>
                      <option>Tự Học Chứng Khoán DNSE</option>
                      <option>Facebook</option>
                    </select>
                  </div>

                  {fbForm.mode === 'single' ? (
                    <>
                      <textarea className={styles.fbTextarea} rows={2}
                        placeholder="Dán tiêu đề / nội dung bài FB vào đây…"
                        value={fbForm.title}
                        onChange={e => setFbForm(f => ({ ...f, title: e.target.value }))}
                      />
                      <div className={styles.fbDateEngRow}>
                        <label className={styles.fbDateLabel}>
                          <span>🕐 Ngày đăng gốc</span>
                          <input type="datetime-local" className={styles.fbDateInput}
                            value={fbForm.publishedAt}
                            onChange={e => setFbForm(f => ({ ...f, publishedAt: e.target.value }))}
                          />
                        </label>
                        <div className={styles.fbEngRow}>
                          {[['likes','👍'],['comments','💬'],['shares','🔁'],['views','👁']].map(([k, icon]) => (
                            <label key={k} className={styles.fbEngLabel}>
                              <span>{icon}</span>
                              <input type="number" min={0} className={styles.fbEngInput} placeholder="0"
                                value={fbForm[k]} onChange={e => setFbForm(f => ({ ...f, [k]: e.target.value }))} />
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <textarea className={styles.fbTextarea} rows={5}
                        placeholder={'Mỗi dòng = 1 bài. Paste nhiều title từ Facebook:\nVD:\nChứng khoán Mỹ tăng mạnh hôm nay\nVN-Index vượt 1,300 điểm lần đầu\nLãi suất ngân hàng tháng 4...'}
                        value={fbForm.bulkText}
                        onChange={e => setFbForm(f => ({ ...f, bulkText: e.target.value }))}
                      />
                      <label className={styles.fbDateLabel}>
                        <span>🕐 Ngày đăng (áp dụng tất cả)</span>
                        <input type="date" className={styles.fbDateInput}
                          value={fbForm.bulkDate}
                          onChange={e => setFbForm(f => ({ ...f, bulkDate: e.target.value }))}
                        />
                      </label>
                      {fbForm.bulkText.trim() && (
                        <p className={styles.fbBulkCount}>
                          {fbForm.bulkText.split('\n').filter(l => l.trim().length > 3).length} bài sẽ được thêm
                        </p>
                      )}
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className={styles.fbCancel} onClick={() => setShowFbForm(false)}>Hủy</button>
                    <button className={styles.fbSubmit} onClick={submitFbPost}
                      disabled={fbLoading || (fbForm.mode === 'single' ? !fbForm.title.trim() : !fbForm.bulkText.trim())}>
                      {fbLoading ? 'Đang thêm…' :
                        fbForm.mode === 'bulk'
                          ? `Thêm ${fbForm.bulkText.split('\n').filter(l => l.trim().length > 3).length || 0} bài`
                          : 'Thêm vào Trending'}
                    </button>
                  </div>
                </div>
              )}

              {loadingHot ? (
                <p className={styles.empty}>Đang tải…</p>
              ) : hotTopics.length === 0 ? (
                <p className={styles.empty}>Không lấy được dữ liệu</p>
              ) : (
                <div className={styles.hotList}>
                  {hotTopics.map((item, i) => (
                    <div key={i} className={styles.hotItem}>
                      <div className={styles.hotItemContent}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className={styles.hotSource}>{item.source}</span>
                          {item.score !== undefined && (
                            <span className={styles.hotScore} data-level={item.score >= 80 ? 'hot' : item.score >= 60 ? 'warm' : item.score >= 40 ? 'mild' : 'low'}>
                              {item.score}
                            </span>
                          )}
                          {item.pubDate && (
                            <span className={styles.hotAge}>{ageLabel(item.pubDate)}</span>
                          )}
                        </div>
                        <span className={styles.hotTitle}>{item.title}</span>
                      </div>
                      <button className={styles.hotAdd} onClick={() => addFromHot(item)} title="Thêm vào theo dõi">
                        <Plus size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.cardInner}>
          <div className={styles.trendList}>
            {liveTrends.map((t, i) => {
              const isApplied = appliedTrendTopic === t.trend_topic
              return (
                <div key={i} className={styles.trendItem}>
                  <div className={styles.trendInfo}>
                    <span className={styles.trendName}>● {t.trend_topic}</span>
                    <span className={styles.trendMeta}>
                      {t.trend_type} · {trendDateLabel(t)} · còn {daysLeft(t)} ngày · {Math.round(t.trend_strength * 100)}%
                      {t.source && <span style={{ marginLeft: 4, color: 'var(--momo-pink)' }}>· {t.source}</span>}
                    </span>
                    <span className={styles.trendAngle}>→ {t.recommended_angle}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '3px 8px', color: isApplied ? 'var(--momo-pink)' : undefined, fontWeight: isApplied ? 700 : undefined }}
                      onClick={() => applyTrend(t)}
                    >
                      {isApplied ? '✓ Bỏ áp dụng' : 'Áp dụng'}
                    </button>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                      onClick={() => hideTrend(t)}
                      title="Ẩn trend này"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
            {deadTrends.map((t, i) => (
              <div key={`dead-${i}`} className={`${styles.trendItem} ${styles.trendDead}`}>
                <span>◌ {t.trend_topic}</span>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', padding: '2px 4px', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}
                  onClick={() => hideTrend(t)} title="Ẩn trend này"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            {allTrends.length === 0 && hiddenTrendIds.size > 0 && (
              <p className={styles.empty} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Tất cả trend đã ẩn.
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setHiddenTrendIds(new Set())}>
                  Hiện lại
                </button>
              </p>
            )}
            {allTrends.length === 0 && hiddenTrendIds.size === 0 && <p className={styles.empty}>Chưa có trend. Nhấn "Trend mới" hoặc "+ Thêm".</p>}
          </div>
          </div>
      </div>{/* end trendFullCard */}

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Modal thêm trend */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Thêm trend mới</h3>
              <button onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <div className={styles.modalBody}>
              <Field label="Tên trend *">
                <input placeholder="VD: VN-Index vượt 1,300 điểm" value={form.trend_topic}
                  onChange={e => setForm(f => ({ ...f, trend_topic: e.target.value }))} />
              </Field>

              <Field label="Loại">
                <div style={{ display: 'flex', gap: 8 }}>
                  {['short-term','medium-term'].map(t => (
                    <button key={t}
                      className={`btn btn-sm ${form.trend_type === t ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setForm(f => ({ ...f, trend_type: t }))}>
                      {t}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={`Độ mạnh: ${Math.round(form.trend_strength * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05}
                  value={form.trend_strength}
                  onChange={e => setForm(f => ({ ...f, trend_strength: parseFloat(e.target.value) }))}
                  style={{ width: '100%' }} />
              </Field>

              <Field label="Hết hạn sau (ngày)">
                <input type="number" min={1} max={30} value={form.expiry_window_days}
                  onChange={e => setForm(f => ({ ...f, expiry_window_days: Number(e.target.value) }))} />
              </Field>

              <Field label="Format phù hợp">
                <select value={form.recommended_format}
                  onChange={e => setForm(f => ({ ...f, recommended_format: e.target.value }))}>
                  {FORMAT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>

              <Field label="Góc content gợi ý">
                <input placeholder="VD: Dự đoán xu hướng tuần tới"
                  value={form.recommended_angle}
                  onChange={e => setForm(f => ({ ...f, recommended_angle: e.target.value }))} />
              </Field>
            </div>

            <div className={styles.modalFooter}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={addTrend} disabled={!form.trend_topic.trim()}>
                Thêm và áp dụng vào lịch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-700)' }}>{label}</label>
      {children}
    </div>
  )
}
