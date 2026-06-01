import React, { useState, useEffect, useRef } from 'react'
import { Zap, Plus, X, RefreshCw, Flame, Facebook, Sparkles, Loader, PenLine } from 'lucide-react'
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
  return Math.ceil((exp - new Date()) / 86400000)
}

// variant='card'   → full card + pink banner (used in SignalSummary)
// variant='inline' → light header, no card wrapper (used in InputPanel tab)
export default function TrendManager({ variant = 'card' }) {
  const {
    data, extraTrends, setExtraTrends,
    weeklySlots, setWeeklySlots,
    pageConfig, plannerInputs, selectedWeek,
  } = useApp()
  const { posts, timingBenchmarks } = data

  const nowLocal = () =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const [showModal,        setShowModal]        = useState(false)
  const [toast,            setToast]            = useState(null)
  const [hotTopics,        setHotTopics]        = useState([])
  const [loadingHot,       setLoadingHot]       = useState(false)
  const [showHot,          setShowHot]          = useState(false)
  const [hotFetchedAt,     setHotFetchedAt]     = useState(null)
  const [showFbForm,       setShowFbForm]       = useState(false)
  const [fbLoading,        setFbLoading]        = useState(false)
  const [appliedTrendTopic, setAppliedTrendTopic] = useState(null)
  const [hiddenTrendIds,   setHiddenTrendIds]   = useState(new Set())
  const [fbForm, setFbForm] = useState({
    mode: 'single', groupName: 'Vén Khéo',
    title: '', likes: '', comments: '', shares: '', views: '',
    publishedAt: nowLocal(),
    bulkText: '', bulkDate: new Date().toISOString().split('T')[0],
  })
  const [form, setForm] = useState({
    trend_topic: '', trend_type: 'short-term', trend_strength: 0.7,
    expiry_window_days: 5, recommended_format: 'poll', recommended_angle: '',
  })
  const [modalMode,    setModalMode]    = useState('ai')
  const [modalInput,   setModalInput]   = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError,   setModalError]   = useState('')
  const [modalParsed,  setModalParsed]  = useState(false)

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

  const allTrends  = data.marketTrends.filter(t => !hiddenTrendIds.has(trendId(t)))
  const liveTrends = allTrends.filter(t => t.status === 'active' && !isExpired(t))
  const deadTrends = allTrends.filter(t => t.status !== 'active' || isExpired(t))

  const regenFlexible = (trendsList) => {
    const fresh = generateWeeklyCalendar(pageConfig, {
      weekStart: selectedWeek, numPosts: plannerInputs.numPosts,
      mode: plannerInputs.mode, buInputs: [],
    }, { posts, timingBenchmarks, trends: trendsList })
    const fixed    = weeklySlots.filter(s => s.slot_type === 'fixed')
    const flexible = fresh.filter(s => s.slot_type !== 'fixed')
    setWeeklySlots([...fixed, ...flexible].sort((a, b) => a.date.localeCompare(b.date) || a.publish_hour - b.publish_hour))
    return flexible.length
  }

  const applyTrend = (trend) => {
    if (!weeklySlots.length) return
    if (appliedTrendTopic === trend.trend_topic) {
      regenFlexible(data.marketTrends)
      setAppliedTrendTopic(null)
      setToast('Đã hoàn tác — lịch về trạng thái mặc định')
      setTimeout(() => setToast(null), 2500)
      return
    }
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
    if (extraTrends.some(et => trendId(et) === id))
      setExtraTrends(prev => prev.filter(et => trendId(et) !== id))
  }

  const didAutoFetch = useRef(false)

  const fetchHotTopics = async () => {
    setLoadingHot(true); setShowHot(true)
    try {
      const res  = await fetch(`/api/trending?pageId=${pageConfig.page_id}`)
      const json = await res.json()
      setHotTopics(json.items ?? [])
      setHotFetchedAt(json.fetchedAt)
    } catch { setHotTopics([]) }
    finally { setLoadingHot(false) }
  }

  useEffect(() => {
    if (didAutoFetch.current) return
    didAutoFetch.current = true
    fetchHotTopics()
  }, [])

  const addFromHot = (item) => {
    if (extraTrends.some(et => et.trend_topic === item.title.slice(0, 80))) return
    const newTrend = {
      trend_topic: item.title.slice(0, 80),
      trend_type: 'short-term', trend_strength: 0.75,
      expiry_window_days: 3, recommended_format: 'market_update',
      recommended_angle: `Góc nhìn từ: ${item.title.slice(0, 60)}`,
      trend_date: item.pubDate || new Date().toISOString(),
      status: 'active', page_id: pageConfig.page_id, source: item.source,
    }
    setExtraTrends(prev => [...prev, newTrend])
    if (weeklySlots.length) {
      const boosted = [{ ...newTrend, trend_strength: 1.0 }, ...data.marketTrends]
      regenFlexible(boosted)
      setToast(`Đã áp dụng "${newTrend.trend_topic.slice(0, 38)}…" vào lịch`)
    } else {
      setToast(`Đã chọn "${newTrend.trend_topic.slice(0, 40)}…"`)
    }
    setTimeout(() => setToast(null), 2500)
  }

  const removeFromHot = (item) => {
    const topic = item.title.slice(0, 80)
    setExtraTrends(prev => prev.filter(et => et.trend_topic !== topic))
    if (weeklySlots.length) {
      const trendsWithout = data.marketTrends.filter(t => t.trend_topic !== topic)
      regenFlexible(trendsWithout)
      setToast('Đã bỏ áp dụng khỏi lịch')
    } else {
      setToast('Đã bỏ chọn')
    }
    setTimeout(() => setToast(null), 2000)
  }

  const removeExtraTrend = (trend) => {
    setExtraTrends(prev => prev.filter(et => et.trend_topic !== trend.trend_topic))
    if (weeklySlots.length) {
      const trendsWithout = data.marketTrends.filter(t => t.trend_topic !== trend.trend_topic)
      regenFlexible(trendsWithout)
      setToast(`Đã bỏ áp dụng "${trend.trend_topic.slice(0, 38)}…"`)
    }
    setTimeout(() => setToast(null), 2000)
  }

  const submitFbPost = async () => {
    setFbLoading(true)
    try {
      if (fbForm.mode === 'bulk') {
        const lines = fbForm.bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 3)
        if (!lines.length) { setFbLoading(false); return }
        const publishedAt = fbForm.bulkDate ? new Date(fbForm.bulkDate).toISOString() : new Date().toISOString()
        await Promise.all(lines.map(title =>
          fetch(`/api/trending/facebook?pageId=${pageConfig.page_id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, groupName: fbForm.groupName, publishedAt, likes: 0, comments: 0, shares: 0, views: 0 }),
          })
        ))
        setToast(`Đã thêm ${lines.length} bài từ ${fbForm.groupName}!`)
      } else {
        if (!fbForm.title.trim()) { setFbLoading(false); return }
        await fetch(`/api/trending/facebook?pageId=${pageConfig.page_id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: fbForm.title.trim(), groupName: fbForm.groupName,
            publishedAt: fbForm.publishedAt,
            likes: Number(fbForm.likes || 0), comments: Number(fbForm.comments || 0),
            shares: Number(fbForm.shares || 0), views: Number(fbForm.views || 0),
          }),
        })
        setToast('Đã thêm bài Facebook vào trending!')
      }
      setFbForm(f => ({ ...f, title: '', likes: '', comments: '', shares: '', views: '', bulkText: '', publishedAt: nowLocal() }))
      setShowFbForm(false)
      const res  = await fetch(`/api/trending?pageId=${pageConfig.page_id}&force=1`)
      const json = await res.json()
      setHotTopics(json.items ?? [])
      setHotFetchedAt(json.fetchedAt)
      setShowHot(true)
      setTimeout(() => setToast(null), 3000)
    } catch { setToast('Lỗi khi thêm bài Facebook') }
    finally { setFbLoading(false) }
  }

  const parseTrendFromAI = async () => {
    if (!modalInput.trim()) return
    setModalLoading(true); setModalError(''); setModalParsed(false)
    const prompt = `Trích xuất thông tin trend từ mô tả sau. Chỉ lấy thông tin CÓ THẬT, không suy diễn.

{
  "trend_topic": "tên/chủ đề trend ngắn gọn (tối đa 80 ký tự)",
  "recommended_angle": "góc content gợi ý nếu rõ ràng, null nếu không",
  "trend_type": "short-term nếu là tin tức/sự kiện ngắn hạn, medium-term nếu là xu hướng dài hạn"
}

Mô tả: ${modalInput}`
    try {
      const res  = await fetch('/api/ai-fill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const content = json.message?.content ?? ''
      const stripped = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
      const start = stripped.indexOf('{'), end = stripped.lastIndexOf('}')
      if (start === -1 || end === -1) throw new Error('Không parse được kết quả')
      const parsed = JSON.parse(stripped.slice(start, end + 1))
      setForm(f => ({
        ...f,
        trend_topic:       parsed.trend_topic       && parsed.trend_topic       !== 'null' ? parsed.trend_topic       : '',
        recommended_angle: parsed.recommended_angle && parsed.recommended_angle !== 'null' ? parsed.recommended_angle : '',
        trend_type: ['short-term','medium-term'].includes(parsed.trend_type) ? parsed.trend_type : 'short-term',
      }))
      setModalParsed(true)
    } catch (err) {
      setModalError(err.message.includes('fetch') ? 'Không kết nối được server.' : err.message)
    } finally { setModalLoading(false) }
  }

  const closeModal = () => {
    setShowModal(false)
    setModalInput(''); setModalError(''); setModalParsed(false); setModalMode('ai')
    setForm({ trend_topic: '', trend_type: 'short-term', trend_strength: 0.7, expiry_window_days: 5, recommended_format: 'poll', recommended_angle: '' })
  }

  const addTrend = () => {
    if (!form.trend_topic.trim()) return
    const newTrend = {
      ...form,
      trend_date: new Date().toISOString().split('T')[0],
      status: 'active', page_id: pageConfig.page_id,
    }
    setExtraTrends(prev => [...prev, newTrend])
    if (weeklySlots.length) {
      const fresh = generateWeeklyCalendar(pageConfig, {
        weekStart: selectedWeek, numPosts: plannerInputs.numPosts,
        mode: plannerInputs.mode, buInputs: [],
      }, { posts, timingBenchmarks, trends: [...data.marketTrends, newTrend] })
      const fixed    = weeklySlots.filter(s => s.slot_type === 'fixed')
      const flexible = fresh.filter(s => s.slot_type !== 'fixed')
      setWeeklySlots([...fixed, ...flexible].sort((a, b) => a.date.localeCompare(b.date)))
      setToast(`Đã thêm trend. ${flexible.length} slot flexible được cập nhật.`)
      setTimeout(() => setToast(null), 3000)
    }
    closeModal()
  }

  // ── Shared sub-sections ─────────────────────────────────────────────────────

  const hotPanel = showHot && (
    <div className={styles.hotPanel}>
      <div className={styles.hotHeader}>
        <Flame size={12} style={{ color: 'var(--momo-pink)' }} />
        <span>Tin nóng từ báo VN &amp; cộng đồng</span>
        {hotFetchedAt && <span className={styles.hotTime}>{new Date(hotFetchedAt).toLocaleTimeString('vi-VN')}</span>}
        <button className={styles.hotClose} onClick={() => { setShowHot(false); setShowFbForm(false) }}><X size={12} /></button>
      </div>

      {showFbForm && (
        <div className={styles.fbForm}>
          <div className={styles.fbTopRow}>
            <div className={styles.fbModeTabs}>
              <button className={`${styles.fbModeTab} ${fbForm.mode === 'single' ? styles.fbModeActive : ''}`}
                onClick={() => setFbForm(f => ({ ...f, mode: 'single' }))}>Một bài</button>
              <button className={`${styles.fbModeTab} ${fbForm.mode === 'bulk' ? styles.fbModeActive : ''}`}
                onClick={() => setFbForm(f => ({ ...f, mode: 'bulk' }))}>Nhiều bài</button>
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
                onChange={e => setFbForm(f => ({ ...f, title: e.target.value }))} />
              <div className={styles.fbDateEngRow}>
                <label className={styles.fbDateLabel}>
                  <span>🕐 Ngày đăng gốc</span>
                  <input type="datetime-local" className={styles.fbDateInput}
                    value={fbForm.publishedAt}
                    onChange={e => setFbForm(f => ({ ...f, publishedAt: e.target.value }))} />
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
                onChange={e => setFbForm(f => ({ ...f, bulkText: e.target.value }))} />
              <label className={styles.fbDateLabel}>
                <span>🕐 Ngày đăng (áp dụng tất cả)</span>
                <input type="date" className={styles.fbDateInput}
                  value={fbForm.bulkDate}
                  onChange={e => setFbForm(f => ({ ...f, bulkDate: e.target.value }))} />
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
          {hotTopics.map((item, i) => {
            const isPicked = extraTrends.some(et => et.trend_topic === item.title.slice(0, 80))
            return (
              <div key={i} className={`${styles.hotItem} ${isPicked ? styles.hotItemPicked : ''}`}>
                <div className={styles.hotItemContent}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={styles.hotSource}>{item.source}</span>
                    {item.score !== undefined && (
                      <span className={styles.hotScore} data-level={item.score >= 80 ? 'hot' : item.score >= 60 ? 'warm' : item.score >= 40 ? 'mild' : 'low'}>
                        {item.score}
                      </span>
                    )}
                    {item.pubDate && <span className={styles.hotAge}>{ageLabel(item.pubDate)}</span>}
                  </div>
                  <span className={styles.hotTitle}>{item.title}</span>
                </div>
                {isPicked ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span className={styles.hotPicked}>✓</span>
                    <button className={styles.hotRemove} onClick={() => removeFromHot(item)} title="Bỏ áp dụng">
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button className={styles.hotAdd} onClick={() => addFromHot(item)} title="Chọn và áp dụng vào lịch">
                    <Plus size={11} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const trendList = (
    <div className={styles.trendList}>
      {liveTrends.map((t, i) => {
        const isExtra   = extraTrends.some(et => et.trend_topic === t.trend_topic)
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
              {isExtra ? (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 10, padding: '3px 8px', color: 'var(--momo-pink)', fontWeight: 700 }}
                  onClick={() => removeExtraTrend(t)}
                >
                  ✓ Bỏ áp dụng
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 10, padding: '3px 8px', color: isApplied ? 'var(--momo-pink)' : undefined, fontWeight: isApplied ? 700 : undefined }}
                  onClick={() => applyTrend(t)}
                >
                  {isApplied ? '✓ Bỏ áp dụng' : 'Áp dụng'}
                </button>
              )}
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                onClick={() => hideTrend(t)} title="Ẩn trend này"
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
      {allTrends.length === 0 && hiddenTrendIds.size === 0 &&
        <p className={styles.empty}>Chưa có trend. Nhấn "Trend mới" hoặc "+ Thêm".</p>}
    </div>
  )

  const modal = showModal && (
    <div className={styles.modalOverlay} onClick={closeModal}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Thêm trend mới</h3>
          <button onClick={closeModal}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalModeToggle}>
            <button className={`${styles.modalModeBtn} ${modalMode === 'ai' ? styles.modalModeBtnActive : ''}`}
              onClick={() => setModalMode('ai')}><Sparkles size={11} /> AI Fill</button>
            <button className={`${styles.modalModeBtn} ${modalMode === 'manual' ? styles.modalModeBtnActive : ''}`}
              onClick={() => setModalMode('manual')}><PenLine size={11} /> Nhập tay</button>
          </div>

          {modalMode === 'ai' ? (
            <>
              <textarea
                className={styles.modalTextarea}
                rows={3}
                placeholder="Dán tiêu đề bài báo, mô tả xu hướng hoặc chủ đề muốn thêm vào plan…"
                value={modalInput}
                onChange={e => { setModalInput(e.target.value); setModalParsed(false) }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn btn-primary btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}
                  onClick={parseTrendFromAI} disabled={modalLoading || !modalInput.trim()}>
                  {modalLoading
                    ? <><Loader size={12} style={{ animation:'spin 0.8s linear infinite' }} /> Đang phân tích…</>
                    : <><Sparkles size={12} /> Phân tích</>}
                </button>
                {modalError && <span style={{ fontSize:11, color:'#b91c1c' }}>{modalError}</span>}
              </div>
              {modalParsed && form.trend_topic && (
                <div className={styles.modalParsedResult}>
                  <span className={styles.modalParsedTopic}>{form.trend_topic}</span>
                  {form.recommended_angle && <span className={styles.modalParsedAngle}>→ {form.recommended_angle}</span>}
                </div>
              )}
              {modalParsed && (
                <input className={styles.modalInput} placeholder="Chỉnh sửa tên trend nếu cần"
                  value={form.trend_topic}
                  onChange={e => setForm(f => ({ ...f, trend_topic: e.target.value }))} />
              )}
            </>
          ) : (
            <input className={styles.modalInput}
              placeholder="VD: VN-Index vượt 1,300 điểm"
              value={form.trend_topic}
              onChange={e => setForm(f => ({ ...f, trend_topic: e.target.value }))}
              autoFocus
            />
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className="btn btn-ghost" onClick={closeModal}>Hủy</button>
          <button className="btn btn-primary" onClick={addTrend} disabled={!form.trend_topic.trim()}>
            Thêm vào plan
          </button>
        </div>
      </div>
    </div>
  )

  // ── Render: inline variant (inside InputPanel tab) ──────────────────────────
  if (variant === 'inline') {
    return (
      <>
        <div className={styles.trendInlineHeader}>
          <span className={styles.trendInlineTitle}><Zap size={12} /> Xu hướng đã chọn</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button className={styles.trendInlineBtn} onClick={fetchHotTopics} disabled={loadingHot} title="Lấy trend mới nhất từ báo">
              {loadingHot ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Flame size={11} />}
              {loadingHot ? 'Đang tải…' : 'Lấy trend mới'}
            </button>
            <button className={styles.trendInlineBtn} onClick={() => { setShowFbForm(f => !f); setShowHot(true) }} title="Thêm bài từ Facebook group">
              <Facebook size={11} /> FB
            </button>
            <button className={styles.trendInlineBtn} onClick={() => setShowModal(true)}>
              <Plus size={11} /> Thêm thủ công
            </button>
          </span>
        </div>
        {hotPanel}

        {/* Only show user-picked trends (extraTrends), not all file trends */}
        {extraTrends.length > 0 ? (
          <div className={styles.pickedList}>
            {extraTrends.map((t, i) => (
              <div key={i} className={styles.pickedItem}>
                <div className={styles.pickedInfo}>
                  <span className={styles.pickedName}>{t.trend_topic}</span>
                  {t.recommended_angle && <span className={styles.pickedAngle}>→ {t.recommended_angle}</span>}
                </div>
                <button className={styles.pickedRemove} onClick={() => removeExtraTrend(t)} title="Bỏ áp dụng">
                  <X size={12} /> Bỏ áp dụng
                </button>
              </div>
            ))}
          </div>
        ) : (
          !showHot && <p className={styles.empty}>Chưa chọn xu hướng nào. Nhấn <strong>Lấy trend mới</strong> để xem tin nóng.</p>
        )}

        {toast && <div className={styles.toast}>{toast}</div>}
        {modal}
      </>
    )
  }

  // ── Render: card variant (inside SignalSummary) ─────────────────────────────
  const cardBtnStyle = {
    background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)',
    color: 'white', padding: '3px 10px', borderRadius: 'var(--radius-sm)',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
  }
  return (
    <div className={`${styles.trendFullCard} card`}>
      <div className="section-banner section-banner-pink" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={13} /> Xu hướng đang theo dõi</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button style={cardBtnStyle} onClick={fetchHotTopics} disabled={loadingHot} title="Lấy trend mới nhất từ báo">
            {loadingHot ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Flame size={11} />}
            {loadingHot ? 'Đang tải…' : 'Trend mới'}
          </button>
          <button style={cardBtnStyle} onClick={() => { setShowFbForm(f => !f); setShowHot(true) }} title="Thêm bài từ Facebook group">
            <Facebook size={11} /> FB
          </button>
          <button style={cardBtnStyle} onClick={() => setShowModal(true)}>
            <Plus size={11} /> Thêm
          </button>
        </span>
      </div>
      {hotPanel}
      <div className={styles.cardInner}>{trendList}</div>
      {toast && <div className={styles.toast}>{toast}</div>}
      {modal}
    </div>
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
