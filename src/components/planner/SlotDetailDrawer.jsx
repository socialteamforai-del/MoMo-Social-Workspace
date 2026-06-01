import React, { useState } from 'react'
import { X, Lock, Unlock, Copy, Trash2, Check, Plus, Sparkles, ChevronDown, ChevronUp, Info, Send, Loader2, CalendarCheck, Clock, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { PAGE_CONFIGS, DEFAULT_PAGE_ID } from '../../config/pages.js'
import PostImageBuilder from './PostImageBuilder.jsx'
import styles from './SlotDetailDrawer.module.css'

const ALL_FORMAT_LABELS = {
  poll: 'Poll',
  educational_post: 'Bài giáo dục',
  market_update: 'Cập nhật thị trường',
  qa: 'Hỏi & Đáp',
  service_faq: 'FAQ dịch vụ',
  minigame: 'Minigame',
  confession_discussion: 'Thảo luận',
  promo_info: 'Thông tin ưu đãi',
  minigame_quiz: 'Đố vui',
  gamified_reward: 'Thả tim nhận quà',
  thanh_qua_du_an: 'Thành quả dự án',
  donation_call: 'Kêu gọi quyên góp',
  event_comms: 'Sự kiện cộng đồng',
  kindness_story: 'Câu chuyện',
}
const HOUR_OPTIONS  = [8, 9, 11, 12, 14, 15, 17, 18, 20]
const FORMAT_COLOR  = {
  poll: 'badge-blue', educational_post: 'badge-green', market_update: 'badge-teal',
  qa: 'badge-orange', service_faq: 'badge-gray', minigame: 'badge-purple',
  confession_discussion: 'badge-gray', promo_info: 'badge-yellow',
  minigame_quiz: 'badge-purple', gamified_reward: 'badge-pink',
  thanh_qua_du_an: 'badge-green', donation_call: 'badge-orange',
  event_comms: 'badge-teal', kindness_story: 'badge-blue',
}
const DAY_VI = { Monday:'T2',Tuesday:'T3',Wednesday:'T4',Thursday:'T5',Friday:'T6',Saturday:'T7',Sunday:'CN' }

// ── Collapsible optional section (used by NewSlotForm) ───────────────────────
function OptSection({ label, tooltip, open, onToggle, children }) {
  return (
    <div className={`${styles.optSection} ${open ? styles.optSectionOpen : ''}`}>
      <div className={styles.optHeader} onClick={onToggle}>
        <input
          type="checkbox" checked={open} readOnly
          className={styles.optCheck}
          onClick={e => { e.stopPropagation(); onToggle() }}
        />
        <span className={styles.optLabel}>{label}</span>
        {tooltip && (
          <span className={styles.infoWrap} title={tooltip}>
            <Info size={13} className={styles.infoIcon} />
          </span>
        )}
      </div>
      {open && <div className={styles.optBody}>{children}</div>}
    </div>
  )
}

// ── New Slot Form ─────────────────────────────────────────────────────────────
function NewSlotForm({ prefill, onClose }) {
  const { setWeeklySlots, pageConfig } = useApp()
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [form, setForm] = useState({
    date:           prefill?.date         || '',
    publish_hour:   prefill?.publish_hour || 9,
    day_of_week:    prefill?.day_of_week  || 'Monday',
    topic_group:    pageConfig.topic_groups[0] ?? '',
    content_format: pageConfig.content_formats[0] ?? 'poll',
    cta:            '',
    visual:         '',
    notes:          '',
    status:         'draft',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [showFormat,  setShowFormat]  = useState(false)
  const [showMedia,   setShowMedia]   = useState(false)
  const [showCta,     setShowCta]     = useState(false)
  const [showTiming,  setShowTiming]  = useState(!!prefill?.publish_hour)
  const [showNotes,   setShowNotes]   = useState(false)

  const handleSubmit = () => {
    if (!form.date) return
    const newSlot = {
      id: `manual_${Date.now()}`,
      slot_type: 'fixed', locked: false,
      date: form.date, publish_hour: Number(form.publish_hour),
      day_of_week: form.day_of_week,
      topic_group: form.topic_group,
      content_format: form.content_format,
      objective: 'engagement', status: form.status,
      priority_score: 0.5,
      confidence: { label: 'Thủ công', color: 'gray' },
      direction: { hook: '', content_angle: '', cta: form.cta, caption_direction: '', visual_direction: form.visual },
      title, caption: content, notes: form.notes,
      score_components: {},
    }
    setWeeklySlots(prev => [...prev, newSlot].sort((a, b) => a.date.localeCompare(b.date)))
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerTitle}>Thêm bài vào lịch</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.body}>
          <div className={styles.cmsSection}>
            <span className={styles.cmsSectionTitle}>Nội dung bài đăng</span>
            <div className={styles.cmsField}>
              <label className={styles.cmsFieldLabel}>1.1: Tiêu đề</label>
              <div className={styles.cmsInputWrap}>
                <input className={styles.cmsInput} placeholder="(Không bắt buộc)" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} />
                <span className={styles.charCount}>{title.length}/200</span>
              </div>
            </div>
            <div className={styles.cmsField}>
              <label className={styles.cmsFieldLabel}>1.2: Nội dung</label>
              <div className={styles.cmsTextareaWrap}>
                <textarea className={styles.cmsTextarea} placeholder="(Tối đa 10000 ký tự)" maxLength={10000} rows={6} value={content} onChange={e => setContent(e.target.value)} />
                <span className={styles.charCountBottom}>{content.length}/10000</span>
              </div>
            </div>
          </div>
          <div className={styles.optList}>
            <OptSection label="Thêm format" tooltip="Chủ đề và định dạng nội dung" open={showFormat} onToggle={() => setShowFormat(v => !v)}>
              <div className={styles.optGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Chủ đề</label>
                  <select className={styles.fieldSelect} value={form.topic_group} onChange={e => set('topic_group', e.target.value)}>
                    {pageConfig.topic_groups.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Định dạng</label>
                  <select className={styles.fieldSelect} value={form.content_format} onChange={e => set('content_format', e.target.value)}>
                    {pageConfig.content_formats.map(f => <option key={f} value={f}>{ALL_FORMAT_LABELS[f] ?? f}</option>)}
                  </select>
                </div>
              </div>
            </OptSection>
            <OptSection label="Thêm media" tooltip="Mô tả ảnh/video cần thiết kế" open={showMedia} onToggle={() => setShowMedia(v => !v)}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Visual direction</label>
                <input className={styles.fieldInput} placeholder="VD: Infographic so sánh lãi suất, màu xanh MoMo…" value={form.visual} onChange={e => set('visual', e.target.value)} />
              </div>
            </OptSection>
            <OptSection label="Thêm CTA" tooltip="Kêu gọi hành động cuối bài" open={showCta} onToggle={() => setShowCta(v => !v)}>
              <div className={styles.field}>
                <input className={styles.fieldInput} placeholder="VD: Comment câu trả lời của bạn nhé!" value={form.cta} onChange={e => set('cta', e.target.value)} />
              </div>
            </OptSection>
            <OptSection label="Hẹn giờ đăng bài" tooltip="Ngày và giờ đăng lên Facebook" open={showTiming} onToggle={() => setShowTiming(v => !v)}>
              <div className={styles.optGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Ngày *</label>
                  <input type="date" className={styles.fieldInput} value={form.date} onChange={e => set('date', e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Giờ đăng</label>
                  <select className={styles.fieldSelect} value={form.publish_hour} onChange={e => set('publish_hour', e.target.value)}>
                    {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}:00</option>)}
                  </select>
                </div>
              </div>
            </OptSection>
            <OptSection label="Ghi chú nội bộ" tooltip="Không hiển thị trên bài đăng." open={showNotes} onToggle={() => setShowNotes(v => !v)}>
              <textarea className={styles.fieldTextarea} rows={2} placeholder="Ghi chú cho team…" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </OptSection>
          </div>
        </div>
        <div className={styles.footer}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <div className={styles.footerRight}>
            <button className={styles.saveBtn} onClick={handleSubmit} disabled={!form.date}>
              <Plus size={14} /> Thêm vào lịch
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reconfirm Modal ───────────────────────────────────────────────────────────
function ConfirmScheduleModal({ slot, form, scheduleEnabled, onCancel, onConfirm, loading, done, postId, error }) {
  const dateLabel = form.publish_date
    ? (() => { const [,m,d] = form.publish_date.split('-'); return `${d}/${m}` })()
    : ''
  const dayVI = DAY_VI[form.day_of_week] ?? form.day_of_week

  return (
    <div className={styles.confirmOverlay} onClick={onCancel}>
      <div className={styles.confirmCard} onClick={e => e.stopPropagation()}>
        <div className={styles.confirmHeader}>
          <CalendarCheck size={18} style={{ color: 'var(--momo-pink)' }} />
          <span className={styles.confirmTitle}>
            {scheduleEnabled ? 'Xác nhận lên lịch đăng bài' : 'Xác nhận đăng ngay'}
          </span>
        </div>
        <div className={styles.confirmBody}>
          <div className={styles.confirmSlotInfo}>
            <span className={`badge ${FORMAT_COLOR[slot.content_format] ?? 'badge-gray'}`}>
              {ALL_FORMAT_LABELS[slot.content_format] ?? slot.content_format}
            </span>
            {scheduleEnabled && (dateLabel || form.publish_time) && (
              <span className={styles.confirmTime}>
                {[dayVI, dateLabel, form.publish_time].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <div className={styles.confirmTopic}>{slot.topic_group}</div>
          <p className={styles.confirmNote}>
            {scheduleEnabled
              ? 'Bài đăng sẽ được gửi lên MoMo CMS và tự động đăng theo lịch. Bạn vẫn có thể chỉnh sửa trước giờ đăng.'
              : 'Bài đăng sẽ được gửi lên MoMo CMS và đăng ngay lập tức.'}
          </p>
          {done && postId && (
            <div className={styles.postIdRow}>
              <span className={styles.postIdLabel}>Post ID</span>
              <span className={styles.postIdValue}>{postId}</span>
              <button className={styles.postIdCopy} onClick={() => navigator.clipboard?.writeText(String(postId))} title="Copy">
                <Copy size={12} />
              </button>
            </div>
          )}
          {error && <p className={styles.confirmError}>{error}</p>}
        </div>
        <div className={styles.confirmFooter}>
          <button className={styles.confirmCancelBtn} onClick={onCancel} disabled={loading}>
            {done ? 'Đóng' : 'Huỷ'}
          </button>
          <button
            className={`${styles.confirmPublishBtn} ${done ? styles.confirmPublishBtnDone : ''}`}
            onClick={onConfirm}
            disabled={loading || done}
          >
            {loading ? (
              <><Loader2 size={14} className={styles.spinIcon} /> Đang xử lý...</>
            ) : done ? (
              <><Check size={14} /> {scheduleEnabled ? 'Đã lên lịch!' : 'Đã đăng!'}</>
            ) : (
              <><Send size={14} /> {scheduleEnabled ? 'Xác nhận lên lịch' : 'Đăng ngay'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Slot Detail Modal (CMS review) ────────────────────────────────────────────
export default function SlotDetailDrawer({ slot, onClose }) {
  const { setWeeklySlots, data, pageConfig } = useApp()
  const { currentUser } = useAuth()

  if (!slot) return null
  if (slot.isNew) return <NewSlotForm prefill={slot.prefill} onClose={onClose} />

  const direction = slot.direction ?? {}

  const [content, setContent] = useState(slot.caption ?? '')
  const [form, setForm] = useState({
    title:          slot.title          ?? '',
    topic_group:    slot.topic_group    ?? '',
    content_format: slot.content_format ?? 'poll',
    publish_hour:   slot.publish_hour   ?? 9,
    publish_time:   slot.publish_time   ?? `${String(slot.publish_hour ?? 9).padStart(2,'0')}:00`,
    publish_date:   slot.date           ?? '',
    day_of_week:    slot.day_of_week    ?? '',
    status:         slot.status         ?? 'draft',
    hook:           direction.hook             ?? '',
    cta:            direction.cta              ?? '',
    visual:         direction.visual_direction ?? '',
    notes:          slot.notes                 ?? '',
  })
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  const handleDateChange = (dateStr) => {
    if (!dateStr) { set('publish_date', ''); return }
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const [y, m, d] = dateStr.split('-').map(Number)
    const dayName = DAYS[new Date(y, m - 1, d).getDay()]
    setForm(f => ({ ...f, publish_date: dateStr, day_of_week: dayName }))
    setSaved(false)
    setTimeSuggestion(null)
  }

  const [showBrief,    setShowBrief]    = useState(true)
  const [saved,        setSaved]        = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [publishing,      setPublishing]      = useState(false)
  const [publishDone,     setPublishDone]     = useState(false)
  const [publishError,    setPublishError]    = useState('')
  const [publishedPostId, setPublishedPostId] = useState(null)
  const [genContentState, setGenContentState] = useState('idle')
  const [imageUrls,    setImageUrls]    = useState(slot.imageUrls ?? [])
  const [urlInput,     setUrlInput]     = useState('')
  const [timeSuggestion, setTimeSuggestion] = useState(null)

  const [ctaConfig, setCtaConfig] = useState(slot.ctaConfig ?? { enabled: false, ctaType: 1, ctaLabel: '', url: '' })
  const setCta = (k, v) => { setCtaConfig(c => ({ ...c, [k]: v })); setSaved(false) }

  const [scheduleEnabled, setScheduleEnabled] = useState(slot.scheduleEnabled ?? false)
  const [showInMainGroup,  setShowInMainGroup]  = useState(slot.showInMainGroup  ?? true)
  const [showInGroupIds,   setShowInGroupIds]   = useState(slot.showInGroupIds   ?? [])

  const slotPageConfig = PAGE_CONFIGS[slot.page_id] ?? PAGE_CONFIGS[DEFAULT_PAGE_ID]
  const communities    = slotPageConfig.communities ?? []

  const toggleGroup = (id) => setShowInGroupIds(prev =>
    prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
  )

  const handleSuggestTime = () => {
    const benchmarks = data.timingBenchmarks ?? []
    if (!benchmarks.length) { setTimeSuggestion({ noData: true }); return }
    const topic  = form.topic_group
    const format = form.content_format
    const day    = form.day_of_week || slot.day_of_week
    const sort   = arr => [...arr].sort((a, b) => b.avg_er - a.avg_er)
    const result =
      benchmarks.find(b => b.topic_group === topic && b.content_format === format && b.best_day === day) ||
      sort(benchmarks.filter(b => b.content_format === format && b.best_day === day))[0] ||
      sort(benchmarks.filter(b => b.content_format === format))[0] ||
      sort(benchmarks.filter(b => b.best_day === day))[0] ||
      null
    if (!result) { setTimeSuggestion({ noData: true }); return }
    const formatLabel = ALL_FORMAT_LABELS[format] ?? format
    const dayLabel    = DAY_VI[day] ?? day
    const basis = result.topic_group === topic && result.best_day === day
      ? `${formatLabel} · ${dayLabel}`
      : result.best_day === day
        ? `${dayLabel} (trung bình)`
        : `${formatLabel} (trung bình tất cả ngày)`
    setTimeSuggestion({ hour: result.best_hour, er: result.avg_er, basis })
    set('publish_time', `${String(result.best_hour).padStart(2,'0')}:00`)
  }

  const dateLabel = form.publish_date
    ? (() => { const [,m,d] = form.publish_date.split('-'); return `${d}/${m}` })()
    : ''
  const dayVI = DAY_VI[form.day_of_week] ?? form.day_of_week

  const saveToContext = (extraFields = {}) => {
    setWeeklySlots(prev => prev.map(s => {
      if (s.id !== slot.id) return s
      const updated = {
        ...s,
        title:          form.title,
        topic_group:    form.topic_group,
        content_format: form.content_format,
        publish_hour:   parseInt(form.publish_time?.split(':')[0] ?? form.publish_hour, 10),
        publish_time:   form.publish_time,
        date:           form.publish_date,
        day_of_week:    form.day_of_week,
        status:         form.status,
        caption:        content,
        notes:          form.notes,
        imageUrls,
        ctaConfig,
        scheduleEnabled,
        showInMainGroup,
        showInGroupIds,
        direction: { ...s.direction, hook: form.hook, cta: form.cta, visual_direction: form.visual },
        ...extraFields,
      }
      // Persist to server if published
      if (extraFields.status === 'scheduled' || updated.status === 'scheduled') {
        fetch(`/api/slots/${updated.page_id || slot.page_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        }).catch(() => {})
      }
      return updated
    }))
  }

  const save = () => {
    saveToContext()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const deleteSlot = () => {
    setWeeklySlots(prev => prev.filter(s => s.id !== slot.id))
    onClose()
  }

  const duplicateSlot = () => {
    setWeeklySlots(prev => [...prev, { ...slot, id: slot.id + '_copy', status: 'draft', caption: '' }])
  }

  const toggleLock = () => {
    setWeeklySlots(prev => prev.map(s => s.id === slot.id ? { ...s, locked: !s.locked } : s))
  }

  const handleGenContent = async () => {
    setGenContentState('loading')
    setContent('')
    setSaved(false)
    const samplePosts = (data?.posts ?? [])
      .filter(p => !p.has_reward && p.post_content && p.er_user > 0)
      .sort((a, b) => b.er_user - a.er_user)
      .slice(0, 5)
    try {
      const res = await fetch('/api/gen-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, samplePosts }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value, { stream: true }).split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') {
            setGenContentState('done')
            saveToContext({ caption: accumulated })
            return
          }
          try {
            const { text, error } = JSON.parse(raw)
            if (error) throw new Error(error)
            if (text) { accumulated += text; setContent(accumulated) }
          } catch {}
        }
      }
      setGenContentState('done')
      saveToContext({ caption: accumulated })
    } catch (err) {
      console.error('[gen-content]', err.message)
      setGenContentState('error')
    }
  }

  const handleConfirmSchedule = async () => {
    setPublishing(true)
    setPublishError('')
    try {
      const desc = [form.hook, content].filter(Boolean).join('\n\n')

      // Build schedule timestamp (UTC ms) from publish_date + publish_time (GMT+7)
      let sendTime = null
      if (scheduleEnabled && form.publish_date && form.publish_time) {
        sendTime = new Date(`${form.publish_date}T${form.publish_time}:00+07:00`).getTime()
        if (sendTime <= Date.now()) {
          setPublishError('Khung giờ hẹn đăng phải sau thời điểm hiện tại. Vui lòng chọn lại.')
          setPublishing(false)
          return
        }
      }

      const publicImageUrls = imageUrls.filter(u => u.startsWith('http'))
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId:      slot.page_id || 'mama_tai_chinh',
          title:       form.title.trim() || undefined,
          desc,
          imageUrls:      publicImageUrls,
          showInMainGroup,
          showInGroupIds: showInGroupIds.length > 0 ? showInGroupIds : undefined,
          ctaType:     ctaConfig.enabled ? ctaConfig.ctaType : undefined,
          ctaLabel:    ctaConfig.enabled && ctaConfig.ctaLabel.trim() ? ctaConfig.ctaLabel.trim() : undefined,
          actionUrls:  ctaConfig.enabled && ctaConfig.url.trim() ? [ctaConfig.url.trim()] : [],
          sendTime,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `Lỗi ${res.status}`)
      saveToContext({
        status:       'scheduled',
        postId:       json.postId,
        published_by: currentUser?.display_name ?? currentUser?.id ?? 'Unknown',
        published_at: Date.now(),
      })
      setPublishedPostId(json.postId ?? null)
      setPublishDone(true)
    } catch (err) {
      console.error('[publish]', err.message)
      setPublishError(err.message)
    } finally {
      setPublishing(false)
    }
  }

  const handleImgRemove = async (url) => {
    const parts = url.split('/')  // /post-images/{pageId}/{slotId}/{filename}
    if (parts.length >= 5) {
      await fetch('/api/upload-post-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: parts[2], slotId: parts[3], filename: parts[4] }),
      }).catch(() => {})
    }
    const next = imageUrls.filter(u => u !== url)
    setImageUrls(next)
    saveToContext({ imageUrls: next })
  }

  const hasBrief = !!(direction.hook || direction.content_angle || direction.visual_direction)
  const isScheduled = slot.status === 'scheduled'
  const isPosted = isScheduled

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.headerBadges}>
                <span className={`badge ${FORMAT_COLOR[slot.content_format] ?? 'badge-gray'}`}>
                  {ALL_FORMAT_LABELS[slot.content_format] ?? slot.content_format}
                </span>
                {slot.locked && <span className="badge badge-pink" style={{ fontSize: 10 }}>Đã khoá</span>}
                {isScheduled && <span className="badge badge-yellow" style={{ fontSize: 10 }}>Đã lên lịch</span>}
                <span className={styles.headerTime}>{dayVI} · {dateLabel} · {slot.publish_hour}:00</span>
              </div>
              <div className={styles.headerTitle}>{slot.topic_group}</div>
            </div>
            <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
          </div>

          {/* ── Body ── */}
          <div className={styles.body}>

            {/* Published banner */}
            {isPosted && (
              <div className={styles.postedBanner}>
                <CheckCircle2 size={14} />
                <div className={styles.postedBannerLeft}>
                  <span>Bài đã được gửi lên CMS</span>
                  {slot.published_by && (
                    <span className={styles.postedBannerBy}>Đăng bởi: {slot.published_by}</span>
                  )}
                </div>
                {slot.postId && (
                  <span className={styles.postedBannerId}>
                    Post ID: <strong>{slot.postId}</strong>
                    <button
                      className={styles.postedBannerCopy}
                      onClick={() => navigator.clipboard?.writeText(String(slot.postId))}
                      title="Copy"
                    ><Copy size={11} /></button>
                  </span>
                )}
              </div>
            )}

            {/* AI Brief — pink, open by default */}
            {hasBrief && (
              <div className={styles.briefSection}>
                <button className={styles.briefToggle} onClick={() => setShowBrief(v => !v)}>
                  <Sparkles size={12} />
                  Nội dung AI đề xuất
                  {showBrief ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showBrief && (
                  <div className={styles.briefBody}>
                    {direction.hook && (
                      <div className={styles.briefRow}>
                        <span className={styles.briefKey}>Hook</span>
                        <span className={styles.briefVal}>{direction.hook}</span>
                      </div>
                    )}
                    {direction.content_angle && (
                      <div className={styles.briefRow}>
                        <span className={styles.briefKey}>Angle</span>
                        <span className={styles.briefVal}>{direction.content_angle}</span>
                      </div>
                    )}
                    {direction.visual_direction && (
                      <div className={styles.briefRow}>
                        <span className={styles.briefKey}>Visual</span>
                        <span className={styles.briefVal}>{direction.visual_direction}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Content fields */}
            <div className={styles.contentField}>
              <label className={styles.contentLabel}>Tiêu đề bài đăng</label>
              <input
                className={styles.ctaInput}
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Tiêu đề ngắn gọn cho bài đăng…"
                disabled={isPosted}
              />
            </div>
            <div className={styles.contentField}>
              <label className={styles.contentLabel}>Hook mở đầu</label>
              <textarea
                className={styles.hookTextarea}
                value={form.hook}
                onChange={e => set('hook', e.target.value)}
                placeholder="Câu mở đầu thu hút…"
                rows={2}
                disabled={isPosted}
              />
            </div>
            <div className={styles.contentField}>
              <div className={styles.contentLabelRow}>
                <label className={styles.contentLabel} style={{ marginBottom: 0 }}>
                  Nội dung bài đăng
                  <span className={styles.charHint}>{content.length}/10000</span>
                </label>
                <button
                  className={`${styles.genContentBtn} ${genContentState === 'loading' ? styles.genContentBtnLoading : ''} ${genContentState === 'done' ? styles.genContentBtnDone : ''}`}
                  onClick={handleGenContent}
                  disabled={genContentState === 'loading'}
                >
                  {genContentState === 'loading' ? (
                    <><Loader2 size={12} className={styles.spinIcon} /> Đang viết...</>
                  ) : genContentState === 'done' ? (
                    <><Sparkles size={12} /> Viết lại</>
                  ) : genContentState === 'error' ? (
                    <><Sparkles size={12} /> Thử lại</>
                  ) : (
                    <><Sparkles size={12} /> Viết bài AI</>
                  )}
                </button>
              </div>
              <textarea
                className={styles.contentTextarea}
                value={content}
                onChange={e => { setContent(e.target.value); setSaved(false) }}
                placeholder="Nội dung bài đăng…"
                rows={6}
                disabled={isPosted}
              />
            </div>
            {/* Image section */}
            <div className={styles.imageSection}>
              <div className={styles.imageSectionHeader}>
                <label className={styles.contentLabel} style={{ marginBottom: 0 }}>Hình ảnh bài đăng</label>
                <span className={styles.imageCount}>{imageUrls.length}/3 ảnh</span>
              </div>

              {/* Image list */}
              {imageUrls.length > 0 && (
                <div className={styles.imageGrid}>
                  {imageUrls.map(url => (
                    <div key={url} className={`${styles.imageThumb} ${!url.startsWith('http') ? styles.imageThumbLocal : ''}`}>
                      <img src={url} alt="" className={styles.imageThumbImg} />
                      {!url.startsWith('http') && (
                        <div className={styles.imageLocalBadge} title="Ảnh local — CMS không đọc được. Hãy dán link public.">⚠ Local</div>
                      )}
                      {!isPosted && (
                        <button className={styles.imageRemoveBtn} onClick={() => handleImgRemove(url)} title="Xóa ảnh">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Paste public URL */}
              {!isPosted && imageUrls.length < 3 && (
                <div className={styles.urlInputRow}>
                  <input
                    className={styles.urlInput}
                    placeholder="Dán link ảnh public (https://lh3.googleusercontent.com/d/...)"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const u = urlInput.trim()
                        if (u.startsWith('http') && !imageUrls.includes(u)) {
                          const next = [...imageUrls, u]
                          setImageUrls(next)
                          saveToContext({ imageUrls: next })
                          setUrlInput('')
                        }
                      }
                    }}
                  />
                  <button
                    className={styles.urlAddBtn}
                    disabled={!urlInput.trim().startsWith('http')}
                    onClick={() => {
                      const u = urlInput.trim()
                      if (u.startsWith('http') && !imageUrls.includes(u)) {
                        const next = [...imageUrls, u]
                        setImageUrls(next)
                        saveToContext({ imageUrls: next })
                        setUrlInput('')
                      }
                    }}
                  >
                    <Plus size={13} /> Thêm
                  </button>
                </div>
              )}

              {/* Image builder */}
              <PostImageBuilder
                slot={slot}
                pageId={slot.page_id || 'mama_tai_chinh'}
                disabled={imageUrls.length >= 3 || isPosted}
                onAdd={url => {
                  const next = [...imageUrls, url]
                  setImageUrls(next)
                  saveToContext({ imageUrls: next })
                }}
              />
            </div>

            {/* CTA */}
            <div className={styles.ctaSection}>
              <label className={styles.ctaSectionToggle}>
                <input type="checkbox" checked={ctaConfig.enabled} onChange={e => setCta('enabled', e.target.checked)} />
                <span>Thêm CTA</span>
              </label>
              {ctaConfig.enabled && (
                <>
                  <input
                    className={styles.ctaUrlInput}
                    style={{ width: 130, flexShrink: 0 }}
                    placeholder="Label nút CTA…"
                    value={ctaConfig.ctaLabel}
                    onChange={e => setCta('ctaLabel', e.target.value)}
                  />
                  <div className={styles.ctaUrlRow}>
                    <input
                      className={styles.ctaUrlInput}
                      placeholder="https://mservice.feed/..."
                      value={ctaConfig.url}
                      onChange={e => setCta('url', e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Hiển thị trong group */}
            <div className={styles.groupSection}>
              <label className={styles.groupCheckLabel}>
                <input
                  type="checkbox"
                  checked={showInMainGroup}
                  disabled={isPosted}
                  onChange={e => setShowInMainGroup(e.target.checked)}
                />
                <span>Hiển thị trong group chính</span>
              </label>
            </div>

            {/* Lịch đăng bài */}
            <div className={styles.scheduleSection}>
              {/* Mode picker */}
              <div className={styles.scheduleModePicker}>
                <button
                  className={`${styles.scheduleModeBtn} ${!scheduleEnabled ? styles.scheduleModeActive : ''}`}
                  onClick={() => { setScheduleEnabled(false); setSaved(false) }}
                >
                  Đăng ngay
                </button>
                <button
                  className={`${styles.scheduleModeBtn} ${scheduleEnabled ? styles.scheduleModeActive : ''}`}
                  onClick={() => { setScheduleEnabled(true); setSaved(false) }}
                >
                  Hẹn giờ
                </button>
              </div>

              {scheduleEnabled && (() => {
                const isPastTime = form.publish_date && form.publish_time &&
                  new Date(`${form.publish_date}T${form.publish_time}:00+07:00`).getTime() <= Date.now()
                return (
                  <>
                    <input
                      type="date"
                      className={`${styles.dateInput} ${isPastTime ? styles.dateInputWarn : ''}`}
                      value={form.publish_date}
                      onChange={e => handleDateChange(e.target.value)}
                    />
                    {dayVI && <span className={styles.dayBadge}>{dayVI}</span>}
                    <input
                      type="time"
                      className={`${styles.timeInput} ${isPastTime ? styles.timeInputWarn : ''}`}
                      value={form.publish_time}
                      onChange={e => { set('publish_time', e.target.value); setTimeSuggestion(null) }}
                    />
                    <button className={styles.timeSuggestBtn} onClick={handleSuggestTime}>
                      <Sparkles size={12} /> Gợi ý
                    </button>
                    {isPastTime && (
                      <span className={styles.scheduleWarnText}>
                        <AlertCircle size={11} /> Khung giờ đã qua
                      </span>
                    )}
                    {!isPastTime && timeSuggestion && !timeSuggestion.noData && (
                      <span className={styles.schedulePreview}>
                        <TrendingUp size={11} /> {String(timeSuggestion.hour).padStart(2,'0')}:00 · ER {(timeSuggestion.er * 100).toFixed(1)}%
                      </span>
                    )}
                  </>
                )
              })()}
            </div>

          </div>

          {/* ── Footer ── */}
          <div className={styles.footer}>
            {!isPosted && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={deleteSlot}>
                <Trash2 size={13} /> Xóa
              </button>
            )}
            <div className={styles.footerRight}>
              <button className="btn btn-ghost btn-sm" onClick={duplicateSlot}>
                <Copy size={13} /> Nhân bản
              </button>
              {!isPosted && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={toggleLock}>
                    {slot.locked ? <><Unlock size={13} /> Mở khoá</> : <><Lock size={13} /> Khoá</>}
                  </button>
                  <button className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`} onClick={save}>
                    {saved ? <><Check size={14} /> Đã lưu</> : 'Lưu thay đổi'}
                  </button>
                  <button className={styles.publishBtn} onClick={() => setShowConfirm(true)}>
                    <CalendarCheck size={14} /> Confirm lên lịch đăng bài
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Reconfirm popup — rendered outside main modal to avoid z-index issues */}
      {showConfirm && (
        <ConfirmScheduleModal
          slot={slot}
          form={form}
          scheduleEnabled={scheduleEnabled}
          onCancel={() => { if (!publishing) { setShowConfirm(false); if (publishDone) onClose() } }}
          onConfirm={handleConfirmSchedule}
          loading={publishing}
          done={publishDone}
          postId={publishedPostId}
          error={publishError}
        />
      )}
    </>
  )
}
