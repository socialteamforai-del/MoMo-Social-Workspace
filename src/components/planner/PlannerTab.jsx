import React, { useState, useEffect } from 'react'
import { Calendar, ChevronDown, ChevronUp, Check, Database, LayoutGrid, Pencil, ArrowLeft, RefreshCw } from 'lucide-react'

import { useApp } from '../../context/AppContext.jsx'
import { generateWeeklyCalendar } from '../../utils/calendarGen.js'
import InputPanel from './InputPanel.jsx'
import SignalSummary from './SignalSummary.jsx'
import WeeklyBoard from './WeeklyBoard.jsx'
import HookPicker from './HookPicker.jsx'
import SlotDetailDrawer from './SlotDetailDrawer.jsx'
import styles from './PlannerTab.module.css'

const FORMAT_COLOR_PS = {
  poll: 'badge-blue', educational_post: 'badge-green', market_update: 'badge-teal',
  qa: 'badge-orange', service_faq: 'badge-gray', minigame: 'badge-purple',
  confession_discussion: 'badge-gray', promo_info: 'badge-yellow',
}
const FORMAT_SHORT_PS = {
  poll: 'Poll', educational_post: 'Edu', market_update: 'Market',
  qa: 'Q&A', service_faq: 'FAQ', minigame: 'Game',
  confession_discussion: 'Discuss', promo_info: 'Promo',
}
const DAY_VI_PS = { Monday:'T2',Tuesday:'T3',Wednesday:'T4',Thursday:'T5',Friday:'T6',Saturday:'T7',Sunday:'CN' }

function PickerSummary({ slots, open, onToggle, onRevise }) {
  return (
    <div className={styles.pickerSummary}>
      <div className={styles.pickerSummaryHeader}>
        <div className={styles.pickerSummaryLeft} onClick={onToggle}>
          <div className={styles.pickerSummaryCheck}><Check size={10} strokeWidth={3} /></div>
          <span className={styles.pickerSummaryLabel}>{slots.length} chủ đề đã xác nhận</span>
          <div className={styles.pickerSummaryChips}>
            {slots.map(s => (
              <span key={s.id} className={`badge ${FORMAT_COLOR_PS[s.content_format] ?? 'badge-gray'}`} style={{ fontSize: 10 }}>
                {s.topic_group}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.pickerSummaryRight}>
          <button className={styles.pickerReviseBtn} onClick={onRevise}>
            <Pencil size={11} /> Chỉnh sửa
          </button>
          <button className={styles.pickerToggleBtn} onClick={onToggle}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {open && (
        <div className={styles.pickerSummaryBody}>
          {slots.map(s => {
            const dateLabel = s.date
              ? (() => { const [,m,d] = s.date.split('-'); return `${d}/${m}` })()
              : ''
            return (
              <div key={s.id} className={styles.pickerSummaryCard}>
                <div className={styles.pickerSummaryCardMeta}>
                  <span className={`badge ${FORMAT_COLOR_PS[s.content_format] ?? 'badge-gray'}`} style={{ fontSize: 10 }}>
                    {FORMAT_SHORT_PS[s.content_format] ?? s.content_format}
                  </span>
                  <span className={styles.pickerSummaryTime}>
                    {DAY_VI_PS[s.day_of_week]} · {s.publish_hour}:00 · {dateLabel}
                  </span>
                </div>
                <div className={styles.pickerSummaryTopic}>{s.topic_group}</div>
                {s.direction?.content_angle && (
                  <div className={styles.pickerSummaryAngle}>{s.direction.content_angle}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PlannerTab() {
  const {
    setWeeklySlots, weeklySlots, pageConfig, data,
    plannerInputs, setPlannerInputs,
    plannerSubmitted, submittedInputs, selectedWeek,
  } = useApp()

  const [selectedSlot, setSelectedSlot] = useState(null)
  const [part1Open, setPart1Open] = useState(true)
  const [part2Open, setPart2Open] = useState(false)
  const [hookCandidates, setHookCandidates] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [genKey, setGenKey] = useState(0)
  const [pendingRefresh, setPendingRefresh] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const setNum = val =>
    setPlannerInputs(p => ({ ...p, numPosts: Math.max(1, Math.min(24, Number(val) || 1)) }))

  const numTarget = plannerInputs.numPosts

  const generate = () => {
    if (!plannerSubmitted) return
    setPendingRefresh(false)
    const buffer = Math.max(3, Math.ceil(numTarget * 0.4))

    // Wire submitted events → buInputs for plan engine
    const buInputs = (submittedInputs?.events ?? [])
      .filter(e => e.name?.trim() || e.date)
      .map(e => ({
        event_name:        e.name?.trim() || '',
        must_publish_date: e.date || null,
        cta:               e.cta        || '',
        mechanic:          e.mechanic   || '',
        reward:            e.reward     || '',
        keyMessage:        e.keyMessage || '',
        stats:             e.stats      || '',
      }))

    const candidates = generateWeeklyCalendar(pageConfig, {
      weekStart: selectedWeek,
      numPosts:  numTarget + buffer,
      mode:      plannerInputs.mode ?? 'balanced',
      buInputs,
    }, { posts: data.posts, timingBenchmarks: data.timingBenchmarks, trends: data.marketTrends })
    setHookCandidates(candidates)
    setShowPicker(true)
    setPart2Open(true)
    setGenKey(k => k + 1)
  }

  const handlePickerConfirm = (picks) => {
    setWeeklySlots(picks)
    setShowPicker(false)
    setSummaryOpen(false)
  }

  const handleRegenerate = () => {
    setShowPicker(false)
    setHookCandidates([])
    generate()
  }

  const resetToStep1 = () => {
    setShowPicker(false)
    setHookCandidates([])
    setWeeklySlots([])
  }

  // Auto-collapse Part 1, open Part 2 after submit; clear stale plan from previous session
  useEffect(() => {
    if (plannerSubmitted) {
      setPart1Open(false)
      setPart2Open(true)
      setWeeklySlots([])
      setShowPicker(false)
      setHookCandidates([])
    }
  }, [plannerSubmitted])

  // Re-submit after initial: mark "Tạo lại" as pending without destroying current plan
  const prevSubmittedAt = React.useRef(null)
  useEffect(() => {
    const at = submittedInputs?.submittedAt
    if (!at) return
    if (prevSubmittedAt.current && prevSubmittedAt.current !== at) {
      setPendingRefresh(true)   // highlight "Tạo lại" — don't clear existing plan
    }
    prevSubmittedAt.current = at
  }, [submittedInputs?.submittedAt])

  useEffect(() => {
    if (weeklySlots.length > 0) setPart2Open(true)
  }, [weeklySlots.length])

  const step1Done = plannerSubmitted
  const step2Done = weeklySlots.length > 0

  return (
    <div className={styles.container}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <Calendar size={13} style={{ color: 'var(--gray-400)' }} />
        <h1 className={styles.title}>Social Content Planner</h1>
      </div>

      {/* ── Stepper ── */}
      <div className={styles.stepper}>

        {/* ── Step 1: Dữ liệu đầu vào ── */}
        <div className={styles.stepRow}>
          <div className={styles.stepSide}>
            <div className={`${styles.stepDot} ${step1Done ? styles.stepDotDone : styles.stepDotActive}`}>
              {step1Done ? <Check size={12} strokeWidth={3} /> : '1'}
            </div>
            <div className={styles.stepConnector} />
          </div>
          <div className={styles.stepBody}>
            <button
              className={`${styles.stepHeader} ${step1Done ? styles.stepHeaderDone : styles.stepHeaderActive} ${part1Open ? styles.stepHeaderOpen : ''}`}
              onClick={() => setPart1Open(v => !v)}
            >
              <Database size={14} style={!step1Done ? { color: 'rgba(255,255,255,0.85)' } : {}} />
              <div className={styles.stepTitleBlock}>
                <span className={styles.stepSubLabel} style={!step1Done ? { color: 'rgba(255,255,255,0.65)' } : {}}>Bước 1</span>
                <span className={styles.stepTitle} style={!step1Done ? { color: 'white' } : {}}>Input Dữ liệu đầu vào</span>
              </div>
              {step1Done && <span className={styles.stepBadge}>Đã submit</span>}
              {part1Open
                ? <ChevronUp size={15} style={!step1Done ? { color: 'rgba(255,255,255,0.7)' } : {}} className={styles.stepChevron} />
                : <ChevronDown size={15} style={!step1Done ? { color: 'rgba(255,255,255,0.7)' } : {}} className={styles.stepChevron} />}
            </button>
            {part1Open && (
              <div className={styles.stepContent}>
                <InputPanel />
              </div>
            )}
          </div>
        </div>

        {/* ── Step 2: Lịch đăng bài ── */}
        <div className={styles.stepRow}>
          <div className={styles.stepSide}>
            <div className={`${styles.stepDot} ${!plannerSubmitted ? styles.stepDotWaiting : step2Done ? styles.stepDotDone : styles.stepDotActive}`}>
              {plannerSubmitted && step2Done ? <Check size={12} strokeWidth={3} /> : '2'}
            </div>
          </div>
          <div className={styles.stepBody}>
            {(() => {
              const s2Active = plannerSubmitted && !step2Done
              return (
                <button
                  className={`${styles.stepHeader} ${!plannerSubmitted ? styles.stepHeaderWaiting : step2Done ? styles.stepHeaderDone : styles.stepHeaderActive} ${part2Open && plannerSubmitted ? styles.stepHeaderOpen : ''}`}
                  onClick={() => setPart2Open(v => !v)}
                  disabled={!plannerSubmitted}
                >
                  <LayoutGrid size={14} style={s2Active ? { color: 'rgba(255,255,255,0.85)' } : {}} />
                  <div className={styles.stepTitleBlock}>
                    <span className={styles.stepSubLabel} style={s2Active ? { color: 'rgba(255,255,255,0.65)' } : {}}>Bước 2</span>
                    <span className={styles.stepTitle} style={s2Active ? { color: 'white' } : {}}>Lên lịch bài đăng</span>
                  </div>
                  {plannerSubmitted && step2Done && <span className={styles.stepBadge}>{weeklySlots.length} slots</span>}
                  {!plannerSubmitted
                    ? <span className={styles.stepHintWaiting}>Cần Submit inputs Step 1 trước khi bắt đầu Step 2</span>
                    : part2Open
                      ? <ChevronUp size={15} style={s2Active ? { color: 'rgba(255,255,255,0.7)' } : {}} className={styles.stepChevron} />
                      : <ChevronDown size={15} style={s2Active ? { color: 'rgba(255,255,255,0.7)' } : {}} className={styles.stepChevron} />}
                </button>
              )
            })()}
            {part2Open && plannerSubmitted && (
              <div className={styles.step2Wrapper}>
                {/* Sub-step nav */}
                <div className={styles.subStepNav}>
                  {[
                    { n: 1, label: 'Số lượng bài' },
                    { n: 2, label: 'Chọn chủ đề' },
                    { n: 3, label: 'Duyệt nội dung' },
                  ].map((s, i) => {
                    const active = (s.n === 1 && !showPicker && !step2Done)
                                || (s.n === 2 && showPicker)
                                || (s.n === 3 && step2Done && !showPicker)
                    const done   = (s.n === 1 && (showPicker || step2Done))
                                || (s.n === 2 && step2Done && !showPicker)
                    return (
                      <React.Fragment key={s.n}>
                        <div className={`${styles.subStep} ${active ? styles.subStepActive : done ? styles.subStepDone : ''}`}>
                          <div className={styles.subStepDot}>
                            {done ? <Check size={9} strokeWidth={3} /> : s.n}
                          </div>
                          <span className={styles.subStepLabel}>{s.label}</span>
                        </div>
                        {i < 2 && <div className={`${styles.subStepLine} ${done ? styles.subStepLineDone : ''}`} />}
                      </React.Fragment>
                    )
                  })}
                </div>

                {/* Generate bar — locked when past step 1 */}
                {(showPicker || step2Done) ? (
                  <div className={styles.step2GenerateBarLocked}>
                    <div className={styles.generateLockedLeft}>
                      <Check size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                      <span className={styles.generateLockedLabel}>Số lượng bài</span>
                      <span className={styles.generateLockedValue}>{plannerInputs.numPosts} bài / tuần</span>
                    </div>
                    <div className={styles.generateLockedActions}>
                      <button className={styles.stepBackBtn} onClick={resetToStep1}>
                        <ArrowLeft size={12} /> Thay đổi
                      </button>
                      <button
                        className={`${styles.regenPlanBtn} ${pendingRefresh ? styles.regenPlanBtnPending : ''}`}
                        onClick={generate}
                      >
                        <RefreshCw size={12} />
                        Tạo lại
                        {pendingRefresh && <span className={styles.regenPendingDot} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.step2GenerateBar}>
                    <div className={styles.generateLeft}>
                      <span className={styles.generateLabel}>Số bài trong tuần</span>
                      <div className={styles.numControl}>
                        <button className={styles.numBtn} onClick={() => setNum(plannerInputs.numPosts - 1)}>−</button>
                        <input
                          type="number" min={3} max={14}
                          value={plannerInputs.numPosts}
                          onChange={e => setNum(e.target.value)}
                          className={styles.numInput}
                        />
                        <button className={styles.numBtn} onClick={() => setNum(plannerInputs.numPosts + 1)}>+</button>
                      </div>
                      <span className={styles.generateHint}>min 1 · max 24 bài/tuần</span>
                    </div>
                    <button className={styles.generateBtn} onClick={generate}>
                      <Calendar size={16} />
                      Tạo bài đăng
                    </button>
                  </div>
                )}

                <div className={styles.step2Body}>
                  {showPicker && hookCandidates.length > 0 ? (
                    <>
                      <SignalSummary />
                      <HookPicker
                        key={genKey}
                        candidates={hookCandidates}
                        numTarget={numTarget}
                        onConfirm={handlePickerConfirm}
                        onRegenerate={handleRegenerate}
                      />
                    </>
                  ) : step2Done ? (
                    <>
                      <PickerSummary
                        slots={weeklySlots}
                        open={summaryOpen}
                        onToggle={() => setSummaryOpen(v => !v)}
                        onRevise={() => setShowPicker(true)}
                      />
                      <WeeklyBoard onSelectSlot={setSelectedSlot} onGenerate={generate} />
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>{/* end stepper */}

      {selectedSlot && (
        <SlotDetailDrawer slot={selectedSlot} onClose={() => setSelectedSlot(null)} />
      )}
    </div>
  )
}
