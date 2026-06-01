import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  CheckCircle, AlertCircle, Database, Calendar, TrendingUp,
  X, Sparkles, Loader, PenLine, FileText, Info, Paperclip, Link2,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import DataSourceSelector from '../overview/DataSourceSelector.jsx'
import TrendManager from './TrendManager.jsx'
import styles from './InputPanel.module.css'

// Parse Vietnamese date input → YYYY-MM-DD
// Accepts: "20/5", "20/05", "20/5/2026", "20-5-2026", "2026-05-20"
function parseVNDate(raw) {
  const s = raw.trim()
  if (!s) return ''
  const thisYear = new Date().getFullYear()
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM or DD-MM
  const short = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
  if (short) {
    const d = short[1].padStart(2,'0'), m = short[2].padStart(2,'0')
    return `${thisYear}-${m}-${d}`
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const full = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (full) {
    const d = full[1].padStart(2,'0'), m = full[2].padStart(2,'0')
    const y = full[3].length === 2 ? `20${full[3]}` : full[3]
    return `${y}-${m}-${d}`
  }
  return ''
}

// Display YYYY-MM-DD as DD/MM/YYYY
function formatDisplayDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const TABS = [
  { id: 'history',  step: 1, label: 'Historical Data', Icon: Database,   required: true,
    desc: 'Dữ liệu tự động load 90 ngày · Cập nhật timeframe nếu cần' },
  { id: 'events',   step: 2, label: 'Upcoming Events', Icon: Calendar,   required: false,
    desc: 'Bạn chưa có kế hoạch về event sắp tới? Để trống, plan sẽ tự động bỏ qua' },
  { id: 'trending', step: 3, label: 'Trending Topics', Icon: TrendingUp, required: false,
    desc: 'Bạn chưa tìm thấy trend phù hợp? Để trống, plan sẽ tự động bỏ qua' },
]

const INPUT_METHODS = [
  { id: 'text', Icon: PenLine,   label: 'Mô tả / AI Fill', hint: 'Dán text, AI tự điền' },
  { id: 'url',  Icon: Link2,     label: 'Link online',      hint: 'Website, Google Doc' },
  { id: 'file', Icon: FileText,  label: 'Upload tài liệu',  hint: 'PDF, ảnh PNG/JPG'   },
]

const mkEvent = () => ({
  id: `${Date.now()}_${Math.random()}`,
  name: '', date: '', mechanic: '', reward: '', cta: '', keyMessage: '', stats: '',
  inputMethod: 'text',
  aiInput: '', aiLoading: false, aiError: '', aiParsed: false,
  collapsed: false,
  fileData: null, fileName: '', fileType: '',
  urlInput: '', urlLoading: false, urlError: '',
})

export default function InputPanel() {
  const {
    data, extraTrends,
    plannerSubmitted, setPlannerSubmitted,
    setSubmittedInputs,
  } = useApp()

  const [activeTab, setActiveTab]         = useState('history')
  const [toast, setToast]                 = useState(null)
  const [dirtyTabs, setDirtyTabs]         = useState({})
  const [confirmedTabs, setConfirmedTabs] = useState({})
  const [submitTime, setSubmitTime]       = useState(null)
  const toastTimer                        = useRef(null)

  const [savedEvents,  setSavedEvents]  = useState([])
  const [activeEvent,  setActiveEvent]  = useState(mkEvent())
  const [dragOverId,   setDragOverId]   = useState(null)

  const fileInputRef = useRef(null)

  // ── Mark tab dirty after confirm (any edit post-confirm) ──
  const markDirty = (tabId) => {
    if (confirmedTabs[tabId]) setDirtyTabs(p => ({ ...p, [tabId]: true }))
  }

  // ── Auto-confirm trending whenever extraTrends changes ──
  const hasMountedTrend = useRef(false)
  const prevExtraTrendsRef = useRef(extraTrends)
  useEffect(() => {
    if (!hasMountedTrend.current) { hasMountedTrend.current = true; return }
    if (extraTrends !== prevExtraTrendsRef.current) {
      setConfirmedTabs(p => ({ ...p, trending: true }))
      setDirtyTabs(p => ({ ...p, trending: false }))
    }
    prevExtraTrendsRef.current = extraTrends
  }, [extraTrends])

  // ── Auto-confirm history when data loads ──
  const historyDone = data.posts.length > 0
  const latestPostDate = (() => {
    if (!data.posts.length) return null
    const d = data.posts.slice().sort((a, b) => (b.created_date ?? '').localeCompare(a.created_date ?? ''))[0]?.created_date
    if (!d) return null
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  })()
  useEffect(() => {
    if (historyDone && !confirmedTabs.history)
      setConfirmedTabs(p => ({ ...p, history: true }))
  }, [historyDone])

  // ── Completion checks (for confirm button labels) ──
  const eventsDone   = savedEvents.some(e => e.name.trim() || e.date || e.mechanic.trim())
  const trendingDone = extraTrends.length > 0

  // ── Per-tab confirmed indicator ──
  const tabIndicator = (id) => {
    const confirmed = confirmedTabs[id]
    const dirty     = dirtyTabs[id]
    if (confirmed && !dirty) return 'check'
    if (id === 'history' ? historyDone : id === 'events' ? eventsDone : trendingDone) return 'dot'
    return null
  }

  const anyDirty = Object.values(dirtyTabs).some(Boolean)
  const btnState = !plannerSubmitted ? 'initial' : anyDirty ? 'dirty' : 'submitted'

  // ── Toast ──
  const showToast = (type, msg) => {
    setToast({ type, msg })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  // ── Per-tab confirm ──
  const confirmTab = (tabId) => {
    const wasConfirmed = !!confirmedTabs[tabId]
    setConfirmedTabs(p => ({ ...p, [tabId]: true }))
    // If already submitted and this tab is being confirmed for the first time,
    // keep it dirty so the re-submit button activates (user needs to update the plan)
    if (plannerSubmitted && !wasConfirmed && (tabId === 'events' || tabId === 'trending')) {
      setDirtyTabs(p => ({ ...p, [tabId]: true }))
    } else {
      setDirtyTabs(p => ({ ...p, [tabId]: false }))
    }
    const msgs = {
      history:  `Đã xác nhận — ${data.posts.length} bài lịch sử`,
      events:   eventsDone   ? 'Đã xác nhận sự kiện — bấm Update & Submit để cập nhật lịch' : 'Đã xác nhận — Không có sự kiện',
      trending: trendingDone ? 'Đã xác nhận xu hướng — bấm Update & Submit để cập nhật lịch' : 'Đã xác nhận — Không dùng trending',
    }
    showToast('success', plannerSubmitted && !wasConfirmed ? msgs[tabId] : msgs[tabId].split(' — bấm')[0])
    // events tab: no collapse needed (list-based UI)
  }

  // ── Final Submit (fire plan) ──
  const handleSubmit = () => {
    if (!confirmedTabs.history) {
      showToast('error', 'Cần xác nhận tab Historical Data trước')
      return
    }
    const snapshot = {
      events:         confirmedTabs.events   ? savedEvents.filter(e => e.name.trim() || e.date) : [],
      trendingTopics: confirmedTabs.trending ? extraTrends : [],
      submittedAt: new Date().toISOString(),
    }
    setSubmittedInputs(snapshot)
    setPlannerSubmitted(true)
    setDirtyTabs({})
    setSubmitTime(new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
    showToast('success', 'Đã submit — chuyển sang Bước 2')
  }

  // ── Active event handlers ──
  const patchActive  = (patch)       => setActiveEvent(e => ({ ...e, ...patch }))
  const updateActive = (key, val)    => { setActiveEvent(e => ({ ...e, [key]: val })); markDirty('events') }

  const handleSaveActive = () => {
    if (!activeEvent.name.trim() && !activeEvent.date && !activeEvent.mechanic.trim()) {
      showToast('error', 'Vui lòng điền ít nhất tên hoặc ngày sự kiện')
      return
    }
    setSavedEvents(p => [...p, activeEvent])
    setActiveEvent(mkEvent())
    // Mark dirty regardless of whether events tab was confirmed —
    // if already submitted, user must re-submit to include the new event
    setDirtyTabs(p => ({ ...p, events: true }))
    showToast('success', `Đã lưu: "${activeEvent.name || activeEvent.date || 'sự kiện'}"`)
  }

  const handleEditSaved = (id) => {
    const ev = savedEvents.find(e => e.id === id)
    if (!ev) return
    setActiveEvent(ev)
    setSavedEvents(p => p.filter(e => e.id !== id))
    markDirty('events')
  }

  const handleDeleteSaved = (id) => {
    setSavedEvents(p => p.filter(e => e.id !== id))
    markDirty('events')
  }

  // ── File handlers (operate on activeEvent) ──
  const readFileIntoActive = (file) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { patchActive({ aiError: 'File quá lớn. Vui lòng chọn file dưới 10MB.' }); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1]
      patchActive({ fileData: base64, fileName: file.name, fileType: file.type, aiParsed: false, aiError: '' })
    }
    reader.readAsDataURL(file)
  }

  const handleFileSelect = useCallback((e) => {
    readFileIntoActive(e.target.files?.[0])
    e.target.value = ''
  }, [])

  const openFilePicker = () => fileInputRef.current?.click()
  const removeFile     = ()  => patchActive({ fileData: null, fileName: '', fileType: '' })
  const handleFileDrop = useCallback((file) => readFileIntoActive(file), [])

  // ── AI parse (operates on activeEvent) ──
  const applyParsed = (fields) => {
    const clean = k => (fields[k] && fields[k] !== 'null' ? fields[k] : '')
    patchActive({
      name: clean('name'), date: clean('date'), mechanic: clean('mechanic'),
      reward: clean('reward'), cta: clean('cta'), keyMessage: clean('keyMessage'),
      stats: clean('stats'), aiLoading: false, aiParsed: true, aiError: '',
    })
    markDirty('events')
  }

  const parseEventFromAI = useCallback(async () => {
    const ev = activeEvent
    if (ev.fileData) {
      patchActive({ aiLoading: true, aiError: '' })
      try {
        const res  = await fetch('/api/parse-event-file', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: ev.fileData, fileType: ev.fileType, fileName: ev.fileName }) })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        applyParsed(json)
        if (json.warning) patchActive({ aiError: json.warning })
      } catch (err) { patchActive({ aiLoading: false, aiError: err.message }) }
      return
    }
    if (!ev.aiInput.trim()) return
    patchActive({ aiLoading: true, aiError: '' })
    const prompt = `Bạn là công cụ trích xuất thông tin. Đọc đoạn mô tả bên dưới và điền vào JSON. Chỉ lấy thông tin CÓ THẬT. Trả về JSON thuần, không giải thích.
{"name":"Tóm tắt ý chính (luôn có)","date":"YYYY-MM-DD — nếu chỉ có ngày/tháng mà không có năm thì mặc định năm ${new Date().getFullYear()} (năm nay) — null nếu không nhắc đến ngày","mechanic":"hình thức tham gia hoặc null","reward":"phần thưởng hoặc null","cta":"kêu gọi hành động hoặc null","keyMessage":"thông điệp chính tối đa 2 câu hoặc null","stats":"số liệu cụ thể cách nhau dấu phẩy hoặc null"}
Mô tả: ${ev.aiInput}`
    try {
      const res  = await fetch('/api/ai-fill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const raw     = (json.message?.content ?? '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
      const parsed  = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
      applyParsed(parsed)
    } catch (err) {
      patchActive({ aiLoading: false, aiError: err.message.includes('fetch') ? 'Không kết nối được server.' : err.message })
    }
  }, [activeEvent])

  const parseEventFromUrl = useCallback(async () => {
    if (!activeEvent.urlInput.trim()) return
    patchActive({ urlLoading: true, urlError: '' })
    try {
      const res  = await fetch('/api/parse-event-url', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeEvent.urlInput.trim() }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      applyParsed(json)
      if (json.warning) patchActive({ urlError: json.warning })
    } catch (err) { patchActive({ urlLoading: false, urlError: err.message }) }
  }, [activeEvent])

  return (
    <div className={styles.inputWrapper}>
    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
      style={{ display: 'none' }}
      onChange={handleFileSelect}
    />
    <div className={styles.panel}>

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        {TABS.map(({ id, step, label, Icon, required }) => {
          const indicator  = tabIndicator(id)
          const isConfirmed = confirmedTabs[id] && !dirtyTabs[id]
          return (
            <button
              key={id}
              className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''} ${isConfirmed ? styles.tabSubmitted : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={13} />
              {label}
              {required
                ? <span className={styles.tabRequired}>Bắt buộc</span>
                : <span className={styles.tabOptional}>Optional</span>}
              {indicator === 'check' && <CheckCircle size={11} className={styles.tabCheck} />}
              {indicator === 'dot'   && <span className={styles.doneDot} />}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ── */}
      <div className={styles.tabContent}>

        {/* Historical Data */}
        <div className={`${styles.tabPane} ${activeTab !== 'history' ? styles.tabPaneHidden : ''}`}>
          <p className={styles.tabDesc}><Info size={11} /> {TABS[0].desc}</p>
          <DataSourceSelector />
          {!(confirmedTabs.history && !dirtyTabs.history) && (
            <div className={styles.tabConfirmBar}>
              <button
                className={`${styles.tabConfirmCta} ${dirtyTabs.history ? styles.tabConfirmCtaAmber : ''}`}
                onClick={() => confirmTab('history')}
                disabled={!historyDone}
              >
                <CheckCircle size={14} />
                {dirtyTabs.history
                  ? `Cập nhật xác nhận (${data.posts.length} bài)`
                  : historyDone ? `Xác nhận dữ liệu lịch sử · ${data.posts.length} bài` : 'Đang chờ dữ liệu…'}
              </button>
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className={`${styles.tabPane} ${activeTab !== 'events' ? styles.tabPaneHidden : ''}`}>
          <p className={styles.tabDesc}><Info size={11} /> {TABS[1].desc}</p>

          {/* ── THAO TÁC: form nhập 1 event ── */}
          <div className={styles.activeEventWrap}>
            <div className={styles.activeEventHeader}>
              <span className={styles.activeEventTitle}>
                {activeEvent.aiParsed ? <><CheckCircle size={11} className={styles.parsedIcon} /> Đã phân tích</> : 'Nhập thông tin sự kiện'}
              </span>
            </div>

            {/* Method picker */}
            <div className={styles.methodPicker}>
              {INPUT_METHODS.map(({ id, Icon, label, hint }) => (
                <button key={id}
                  className={`${styles.methodBtn} ${activeEvent.inputMethod === id ? styles.methodBtnActive : ''}`}
                  onClick={() => patchActive({ inputMethod: id, aiError: '', urlError: '' })}
                >
                  <Icon size={14} className={styles.methodBtnIcon} />
                  <span className={styles.methodBtnLabel}>{label}</span>
                  <span className={styles.methodBtnHint}>{hint}</span>
                </button>
              ))}
            </div>

            {/* Method area */}
            <div className={styles.methodArea}>
              {activeEvent.inputMethod === 'text' && (
                <div className={styles.textMethodArea}>
                  <textarea className={styles.aiTextarea} rows={3}
                    placeholder="Dán mô tả sự kiện / campaign vào đây…"
                    value={activeEvent.aiInput}
                    onChange={e => patchActive({ aiInput: e.target.value, aiParsed: false })}
                  />
                  <div className={styles.methodActions}>
                    <span className={styles.methodHintText}>AI tự điền các ô bên dưới — hoặc điền tay trực tiếp</span>
                    <button className={styles.aiParseBtn} onClick={parseEventFromAI}
                      disabled={activeEvent.aiLoading || !activeEvent.aiInput.trim()}>
                      {activeEvent.aiLoading ? <><Loader size={12} className={styles.spin} /> Đang phân tích…</> : <><Sparkles size={12} /> AI Fill</>}
                    </button>
                  </div>
                  {activeEvent.aiError && <p className={styles.aiParseError}><AlertCircle size={11} /> {activeEvent.aiError}</p>}
                </div>
              )}
              {activeEvent.inputMethod === 'url' && (
                <div className={styles.urlMethodArea}>
                  <div className={styles.urlRow}>
                    <Link2 size={11} className={styles.urlIcon} />
                    <input className={styles.urlInput} placeholder="Dán link website, landing page, Google Doc đã mở quyền public…"
                      value={activeEvent.urlInput}
                      onChange={e => patchActive({ urlInput: e.target.value, urlError: '' })}
                      onKeyDown={e => e.key === 'Enter' && parseEventFromUrl()}
                    />
                    <button className={styles.urlParseBtn} onClick={parseEventFromUrl}
                      disabled={activeEvent.urlLoading || !activeEvent.urlInput.trim()}>
                      {activeEvent.urlLoading ? <><Loader size={11} className={styles.spin} /> Đang đọc…</> : <><Sparkles size={11} /> Tự động điền</>}
                    </button>
                  </div>
                  {activeEvent.urlError && <p className={styles.aiParseError}><AlertCircle size={11} /> {activeEvent.urlError}</p>}
                  <p className={styles.methodHintText}>Hỗ trợ: website sự kiện, Facebook post công khai, Google Doc đã bật chia sẻ</p>
                </div>
              )}
              {activeEvent.inputMethod === 'file' && (
                <div className={styles.fileMethodArea}>
                  {activeEvent.fileData ? (
                    <div className={styles.fileReadyRow}>
                      <div className={styles.fileTag}>
                        <Paperclip size={10} />
                        <span className={styles.fileTagName}>{activeEvent.fileName}</span>
                        <button className={styles.fileTagRemove} onClick={removeFile}><X size={10} /></button>
                      </div>
                      <button className={styles.aiParseBtn} onClick={parseEventFromAI} disabled={activeEvent.aiLoading}>
                        {activeEvent.aiLoading ? <><Loader size={12} className={styles.spin} /> Đang đọc…</> : <><Sparkles size={12} /> AI đọc file</>}
                      </button>
                    </div>
                  ) : (
                    <div className={`${styles.fileDropZone} ${dragOverId === 'active' ? styles.fileDropZoneActive : ''}`}
                      onClick={openFilePicker}
                      onDragOver={e => { e.preventDefault(); setDragOverId('active') }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={e => { e.preventDefault(); setDragOverId(null); handleFileDrop(e.dataTransfer.files[0]) }}
                    >
                      <FileText size={22} className={styles.fileDropIcon} />
                      <span className={styles.fileDropTitle}>Kéo thả hoặc click để upload</span>
                      <span className={styles.fileDropHint}>PDF · PNG · JPG · WEBP · tối đa 10MB</span>
                    </div>
                  )}
                  {activeEvent.aiError && <p className={styles.aiParseError}><AlertCircle size={11} /> {activeEvent.aiError}</p>}
                </div>
              )}
            </div>

            {/* Fields divider */}
            <div className={styles.fieldsDivider}>
              {activeEvent.aiParsed ? <><CheckCircle size={11} className={styles.parsedIcon} /> Đã phân tích — chỉnh sửa nếu cần</> : 'Điền trực tiếp vào các ô bên dưới'}
            </div>

            {/* Structured fields */}
            <div className={styles.eventFields}>
              <div className={styles.fieldItem}>
                <label className={styles.fieldLabel}>Tên sự kiện / Campaign</label>
                <input className={`${styles.fieldInput} ${activeEvent.aiParsed && !activeEvent.name.trim() ? styles.fieldInputMissing : ''}`}
                  placeholder="VD: Ra mắt Quỹ tiết kiệm tự động Q3"
                  value={activeEvent.name} onChange={e => updateActive('name', e.target.value)} />
              </div>
              <div className={styles.fieldItem}>
                <label className={styles.fieldLabel}>Ngày ra mắt</label>
                <input
                  className={`${styles.fieldInput} ${activeEvent.aiParsed && !activeEvent.date ? styles.fieldInputMissing : ''}`}
                  placeholder="VD: 20/5 hoặc 20/05/2026"
                  value={activeEvent.date ? formatDisplayDate(activeEvent.date) : ''}
                  onChange={e => {
                    const iso = parseVNDate(e.target.value)
                    updateActive('date', iso || e.target.value)
                  }}
                  onBlur={e => {
                    const iso = parseVNDate(e.target.value)
                    if (iso) updateActive('date', iso)
                  }}
                />
              </div>
              <div className={`${styles.fieldItem} ${styles.fieldFull}`}>
                <label className={styles.fieldLabel}>Hình thức tham gia / Mechanic</label>
                <input className={styles.fieldInput} placeholder="VD: Top 50 tương tác sớm nhất…"
                  value={activeEvent.mechanic} onChange={e => updateActive('mechanic', e.target.value)} />
              </div>
              <div className={styles.fieldItem}>
                <label className={styles.fieldLabel}>Phần thưởng</label>
                <input className={styles.fieldInput} placeholder="VD: 10.000đ vào Túi Thần Tài…"
                  value={activeEvent.reward} onChange={e => updateActive('reward', e.target.value)} />
              </div>
              <div className={styles.fieldItem}>
                <label className={styles.fieldLabel}>CTA</label>
                <input className={styles.fieldInput} placeholder="VD: Comment đáp án, Like & Share…"
                  value={activeEvent.cta} onChange={e => updateActive('cta', e.target.value)} />
              </div>
              <div className={`${styles.fieldItem} ${styles.fieldFull}`}>
                <label className={styles.fieldLabel}>Key message</label>
                <textarea className={`${styles.fieldInput} ${styles.fieldTextarea}`} rows={2}
                  placeholder="Thông điệp chính…" value={activeEvent.keyMessage} onChange={e => updateActive('keyMessage', e.target.value)} />
              </div>
              <div className={`${styles.fieldItem} ${styles.fieldFull}`}>
                <label className={styles.fieldLabel}>Số liệu nổi bật</label>
                <input className={styles.fieldInput} placeholder="VD: 20 bé, 10.000đ, 50 người…"
                  value={activeEvent.stats} onChange={e => updateActive('stats', e.target.value)} />
              </div>
            </div>

            {/* Save button */}
            <div className={styles.saveEventRow}>
              <button className={styles.saveEventBtn} onClick={handleSaveActive}>
                <CheckCircle size={13} /> Lưu sự kiện
              </button>
            </div>
          </div>

          {/* ── KẾT QUẢ: danh sách đã lưu ── */}
          {savedEvents.length > 0 && (
            <div className={styles.savedEventsList}>
              <div className={styles.savedEventsHeader}>
                <span className={styles.savedEventsTitle}>Đã lưu ({savedEvents.length})</span>
              </div>
              {savedEvents.map((ev, i) => (
                <div key={ev.id} className={styles.savedEventItem}>
                  <div className={styles.savedEventInfo}>
                    <span className={styles.savedEventNum}>#{i + 1}</span>
                    <div className={styles.savedEventDetails}>
                      <span className={styles.savedEventName}>{ev.name || '(chưa có tên)'}</span>
                      {ev.date && <span className={styles.savedEventDate}>{ev.date}</span>}
                      {ev.mechanic && <span className={styles.savedEventMeta}>{ev.mechanic.slice(0, 50)}</span>}
                    </div>
                  </div>
                  <div className={styles.savedEventActions}>
                    <button className={styles.savedEventEditBtn} onClick={() => handleEditSaved(ev.id)}>Sửa</button>
                    <button className={styles.savedEventDeleteBtn} onClick={() => handleDeleteSaved(ev.id)}><X size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.tabConfirmBar}>
            {confirmedTabs.events && !dirtyTabs.events ? (
              <div className={styles.tabConfirmedState}>
                <CheckCircle size={13} className={styles.tabStatusIconOk} />
                <span>{eventsDone ? `Đã xác nhận ${savedEvents.length} sự kiện` : 'Đã xác nhận — Không có sự kiện'}</span>
                <button className={styles.tabReconfirmLink} onClick={() => confirmTab('events')}>Xác nhận lại</button>
              </div>
            ) : (
              <button
                className={`${styles.tabConfirmCta} ${dirtyTabs.events ? styles.tabConfirmCtaAmber : !eventsDone ? styles.tabConfirmCtaGray : ''}`}
                onClick={() => confirmTab('events')}
              >
                <CheckCircle size={14} />
                {dirtyTabs.events ? 'Cập nhật xác nhận' : eventsDone ? `Xác nhận ${savedEvents.length} sự kiện` : 'Xác nhận — Không có sự kiện'}
              </button>
            )}
          </div>
        </div>

        {/* Trending Topics */}
        <div className={`${styles.tabPane} ${activeTab !== 'trending' ? styles.tabPaneHidden : ''}`}>
          <p className={styles.tabDesc}><Info size={11} /> {TABS[2].desc}</p>
          <TrendManager variant="inline" />
        </div>

      </div>

    </div>

    {/* ── Submit bar — outside panel, covers all 3 tabs ── */}
    <div className={`${styles.submitBar} ${btnState === 'submitted' ? styles.submitBarDone : btnState === 'dirty' ? styles.submitBarDirty : ''}`}>
      <div className={styles.submitSummary}>
        {confirmedTabs.history
          ? <span className={styles.submitTag}><CheckCircle size={11} /> {data.posts.length} bài lịch sử</span>
          : <span className={styles.submitTagMissing}>Chưa xác nhận Historical Data</span>
        }
        {confirmedTabs.events && eventsDone &&
          <span className={styles.submitTag}><CheckCircle size={11} /> {savedEvents.filter(e => e.name.trim() || e.date).length} sự kiện</span>
        }
        {confirmedTabs.trending && trendingDone &&
          <span className={styles.submitTag}><CheckCircle size={11} /> {extraTrends.length} xu hướng</span>
        }
        {(() => {
          const skipped = [
            !(confirmedTabs.events   && eventsDone)   && 'Upcoming Events',
            !(confirmedTabs.trending && trendingDone) && 'Trending Topics',
          ].filter(Boolean)
          return skipped.length > 0 && (
            <span className={styles.submitTagSkip}>
              Tips: Đừng bỏ qua {skipped.join(' & ')} để bài đăng thêm chất lượng!
            </span>
          )
        })()}
      </div>
      <div className={styles.submitRight}>
        {toast && (
          <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
            {toast.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
            {toast.msg}
          </div>
        )}
        {btnState === 'submitted' && submitTime && !toast && (
          <span className={styles.submittedNote}><CheckCircle size={12} /> Đã submit lúc {submitTime}</span>
        )}
        <button
          className={`${styles.submitBtn} ${styles['submitBtn_' + btnState]}`}
          onClick={handleSubmit}
          disabled={btnState === 'submitted' || !confirmedTabs.history}
        >
          {btnState === 'submitted' ? <><CheckCircle size={14} /> Submitted</> :
           btnState === 'dirty'     ? 'Update & Submit' : 'Submit Inputs'}
        </button>
      </div>
    </div>
    </div>
  )
}
