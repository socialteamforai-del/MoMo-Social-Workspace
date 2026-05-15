import React, { useState } from 'react'
import { X, Lock, Unlock, Copy, Trash2, CheckCircle, RotateCcw, ClipboardCopy, Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { confidenceLabel } from '../../utils/scoring.js'
import { generateWeeklyCalendar } from '../../utils/calendarGen.js'
import styles from './SlotDetailDrawer.module.css'

const TOPIC_OPTIONS = [
  'Dự đoán giá cổ phiếu','Phân tích xu hướng thị trường','Tin tức tài chính cá nhân',
  'Kiến thức đầu tư cơ bản','Giới thiệu tính năng MoMo','Câu chuyện người dùng',
  'Ưu đãi & Khuyến mãi','Tư vấn tiết kiệm','Minigame & Tương tác',
]
const FORMAT_OPTIONS = [
  { val: 'poll', label: 'Poll' },
  { val: 'educational_post', label: 'Bài giáo dục' },
  { val: 'market_update', label: 'Cập nhật thị trường' },
  { val: 'qa', label: 'Hỏi & Đáp' },
  { val: 'service_faq', label: 'FAQ dịch vụ' },
  { val: 'minigame', label: 'Minigame' },
  { val: 'confession_discussion', label: 'Thảo luận' },
  { val: 'promo_info', label: 'Thông tin ưu đãi' },
]
const HOUR_OPTIONS = [8, 9, 11, 12, 14, 15, 17, 18, 20]

const FORMAT_LABELS = {
  poll: 'Poll', educational_post: 'Bài giáo dục', market_update: 'Cập nhật thị trường',
  qa: 'Hỏi & Đáp', service_faq: 'FAQ dịch vụ', minigame: 'Minigame',
  confession_discussion: 'Thảo luận', promo_info: 'Thông tin ưu đãi',
}

const STATUS_LABELS = { draft: 'Bản nháp', scheduled: 'Đã lên lịch', published: 'Đã đăng' }

function buildClaudePrompt(slot) {
  const d = slot.direction || {}
  return `Viết angle content cho bài đăng MaMa Tài Chính:

- Định dạng: ${slot.content_format}
- Chủ đề: ${slot.topic_group}
- Mục tiêu: ${slot.objective}
- Ngày đăng: ${slot.date} ${slot.publish_hour}:00
- Đối tượng: Nhà đầu tư cá nhân, người quan tâm tài chính, 22–45 tuổi

Gợi ý từ hệ thống:
- Hook: ${d.hook || ''}
- Góc nội dung: ${d.content_angle || ''}
- CTA: ${d.cta || ''}
- Caption: ${d.caption_direction || ''}
${d.similar_post_ref ? `\nBài tham khảo (ER ${(d.similar_post_ref.er * 100).toFixed(1)}%): ${d.similar_post_ref.preview}` : ''}
${slot.bu_campaign ? `\nCampaign BU: ${slot.bu_campaign}` : ''}

Yêu cầu: Viết 2–3 angle content khác nhau (mỗi angle 50–80 chữ). Giọng văn thân thiện, gần gũi, không quá formal. Kết thúc bằng câu hỏi mở.`
}

function NewSlotForm({ prefill, onClose }) {
  const { setWeeklySlots } = useApp()
  const [form, setForm] = useState({
    date:           prefill?.date          || '',
    publish_hour:   prefill?.publish_hour  || 9,
    day_of_week:    prefill?.day_of_week   || 'Monday',
    topic_group:    TOPIC_OPTIONS[0],
    content_format: 'poll',
    objective:      'engagement',
    hook:           '',
    content_angle:  '',
    notes:          '',
    status:         'draft',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.date) return
    const newSlot = {
      id: `manual_${Date.now()}`,
      slot_type: 'fixed',
      locked: false,
      date:         form.date,
      publish_hour: Number(form.publish_hour),
      day_of_week:  form.day_of_week,
      topic_group:  form.topic_group,
      content_format: form.content_format,
      objective:    form.objective,
      status:       form.status,
      priority_score: 0.5,
      confidence:   { label: 'Thủ công', color: 'gray' },
      direction: {
        hook:          form.hook,
        content_angle: form.content_angle,
        cta:           '',
        caption_direction: '',
        visual_direction:  '',
      },
      notes: form.notes,
      score_components: {},
    }
    setWeeklySlots(prev => [...prev, newSlot].sort((a, b) => a.date.localeCompare(b.date)))
    onClose()
  }

  const Field = ({ label, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </label>
      {children}
    </div>
  )

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Thêm bài vào lịch</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Thời gian đăng</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Field label="Ngày *">
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </Field>
              <Field label="Giờ đăng">
                <select value={form.publish_hour} onChange={e => set('publish_hour', e.target.value)}>
                  {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}:00</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Nội dung</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Field label="Chủ đề">
                <select value={form.topic_group} onChange={e => set('topic_group', e.target.value)}>
                  {TOPIC_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Định dạng">
                <select value={form.content_format} onChange={e => set('content_format', e.target.value)}>
                  {FORMAT_OPTIONS.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
                </select>
              </Field>
              <Field label="Hook mở đầu">
                <input placeholder="VD: Bạn có biết..." value={form.hook} onChange={e => set('hook', e.target.value)} />
              </Field>
              <Field label="Góc content">
                <input placeholder="VD: So sánh 2 cách tiết kiệm..." value={form.content_angle} onChange={e => set('content_angle', e.target.value)} />
              </Field>
              <Field label="Ghi chú">
                <textarea rows={3} placeholder="Thêm ghi chú cho team..." value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
              </Field>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--gray-200)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.date}>
            <Plus size={14} /> Thêm vào lịch
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SlotDetailDrawer({ slot, onClose }) {
  const { setWeeklySlots, pageConfig, data, plannerInputs, selectedWeek } = useApp()
  const [copied, setCopied] = useState(false)

  if (!slot) return null

  if (slot.isNew) {
    return <NewSlotForm prefill={slot.prefill} onClose={onClose} />
  }

  const confidence = slot.confidence ?? confidenceLabel(slot.priority_score ?? 0)
  const scoreComponents = slot.score_components ?? {}
  const direction = slot.direction ?? {}

  const updateSlot = (changes) =>
    setWeeklySlots(prev => prev.map(s => s.id === slot.id ? { ...s, ...changes } : s))

  const deleteSlot = () => {
    setWeeklySlots(prev => prev.filter(s => s.id !== slot.id))
    onClose()
  }

  const duplicateSlot = () =>
    setWeeklySlots(prev => [...prev, { ...slot, id: slot.id + '_copy', status: 'draft' }])

  const regenerate = () => {
    if (slot.locked) return
    const fresh = generateWeeklyCalendar(pageConfig, {
      weekStart: selectedWeek, numPosts: plannerInputs.numPosts,
      mode: plannerInputs.mode, buInputs: [],
    }, { posts: data.posts, timingBenchmarks: data.timingBenchmarks, trends: data.marketTrends })
    const match = fresh.find(s => s.day_of_week === slot.day_of_week)
    if (match) updateSlot({ ...match, id: slot.id })
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(buildClaudePrompt(slot)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const SCORE_LABELS = {
    historical: 'Hiệu suất lịch sử',
    userDemand: 'Nhu cầu người dùng',
    trend:      'Trend hiện tại',
    buPriority: 'Ưu tiên BU',
    timingFit:  'Phù hợp khung giờ',
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <span className="badge badge-gray">{slot.day_vi ?? slot.day_of_week}</span>
            <span className="badge badge-gray">{slot.date}</span>
            <span className={`badge badge-${confidence.color}`}>{confidence.label}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          {/* A */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>A. Lịch đăng</h4>
            <Row label="Ngày" value={slot.date} />
            <Row label="Giờ đăng" value={`${slot.publish_hour}:00`} />
            <Row label="Loại slot" value={
              <span className={`badge badge-${slot.slot_type === 'fixed' ? 'pink' : slot.slot_type === 'reactive' ? 'teal' : 'gray'}`}>
                {slot.slot_type}
              </span>
            } />
            <Row label="Trạng thái" value={
              <select className={styles.inlineSelect} value={slot.status}
                onChange={e => updateSlot({ status: e.target.value })}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            } />
          </section>

          {/* B */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>B. Chiến lược nội dung</h4>
            <Row label="Chủ đề" value={slot.topic_group} />
            <Row label="Định dạng" value={FORMAT_LABELS[slot.content_format] ?? slot.content_format} />
            <Row label="Mục tiêu" value={slot.objective} />
            {slot.bu_campaign && <Row label="BU Campaign" value={slot.bu_campaign} />}
          </section>

          {/* C */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>C. Hướng nội dung</h4>

            {direction.hook && <DirRow label="Hook mở đầu gợi ý" value={direction.hook} />}
            {direction.content_angle && (
              <DirRow
                label="Góc nội dung"
                value={direction.content_angle}
                sub={direction.angle_basis ? `Cơ sở: ${direction.angle_basis}` : null}
              />
            )}
            {direction.cta && <DirRow label="CTA" value={direction.cta} />}
            {direction.caption_direction && <DirRow label="Caption direction" value={direction.caption_direction} />}
            {direction.visual_direction  && <DirRow label="Visual" value={direction.visual_direction} />}

            {direction.similar_post_ref && (
              <div className={styles.refPost}>
                <p className={styles.refTitle}>Bài tương tự hiệu quả cao</p>
                <p className={styles.refPreview}>{direction.similar_post_ref.preview}</p>
                <p className={styles.refNote}>{direction.similar_post_ref.note}</p>
              </div>
            )}

            {direction.has_reward_note && (
              <p className={styles.rewardNote}>{direction.has_reward_note}</p>
            )}

            <button
              className={`btn btn-outline btn-sm ${styles.copyBtn}`}
              onClick={copyPrompt}
              title="Copy prompt để paste vào Claude.ai hoặc ChatGPT"
            >
              <ClipboardCopy size={14} />
              {copied ? '✓ Đã copy!' : 'Copy prompt → Claude.ai'}
            </button>
          </section>

          {/* D */}
          {Object.keys(scoreComponents).length > 0 && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>D. Lý do đề xuất</h4>
              <div className={styles.scores}>
                {Object.entries(scoreComponents).map(([key, val]) => (
                  <div key={key} className={styles.scoreRow}>
                    <span className={styles.scoreLabel}>{SCORE_LABELS[key] ?? key}</span>
                    <div className={styles.scoreBar}>
                      <div className={styles.scoreFill} style={{
                        width: `${Math.round(val * 100)}%`,
                        background: val >= 0.7 ? 'var(--green)' : val >= 0.4 ? 'var(--yellow)' : 'var(--red)',
                      }} />
                    </div>
                    <span className={styles.scoreVal}>{Math.round(val * 100)}%</span>
                  </div>
                ))}
                <div className={styles.totalScore}>
                  Priority score: <strong>{Math.round((slot.priority_score ?? 0) * 100)}%</strong>
                </div>
              </div>
              {direction.basis && (
                <div className={styles.basisList}>
                  {Object.entries(direction.basis).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className={styles.basisItem}>
                      <span className={styles.basisKey}>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* E */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>E. Tính linh hoạt</h4>
            <Row label="Có thể thay?" value={slot.locked ? 'Không (đã khoá)' : 'Có'} />
            {slot.fallback_idea && (
              <Row label="Phương án dự phòng" value={`${slot.fallback_idea.content_format} — ${slot.fallback_idea.note}`} />
            )}
            {slot.notes && <p className={styles.notes}>{slot.notes}</p>}
          </section>

          {/* F */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>F. Hành động</h4>
            <div className={styles.actions}>
              <button className="btn btn-primary btn-sm" onClick={() => updateSlot({ status: 'published' })}>
                <CheckCircle size={14} /> Đánh dấu đã đăng
              </button>
              <button className="btn btn-outline btn-sm" onClick={regenerate} disabled={slot.locked}>
                <RotateCcw size={14} /> Tạo lại slot
              </button>
              <button className="btn btn-outline btn-sm" onClick={duplicateSlot}>
                <Copy size={14} /> Nhân bản
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => updateSlot({ locked: !slot.locked })}>
                {slot.locked ? <><Unlock size={14} /> Mở khoá</> : <><Lock size={14} /> Khoá</>}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={deleteSlot}
                style={{ color: 'var(--red)', marginLeft: 'auto' }}>
                <Trash2 size={14} /> Xoá
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowVal}>{value}</span>
    </div>
  )
}

function DirRow({ label, value, sub }) {
  return (
    <div className={styles.dirRow}>
      <span className={styles.dirLabel}>{label}</span>
      <span className={styles.dirVal}>{value}</span>
      {sub && <span className={styles.dirSub}>{sub}</span>}
    </div>
  )
}
