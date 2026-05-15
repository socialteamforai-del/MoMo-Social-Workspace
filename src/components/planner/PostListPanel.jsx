import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronRight, CheckCircle, Lock, Trash2, Sparkles, Copy, ImagePlus, X as XIcon, Loader, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './PostListPanel.module.css'

const FORMAT_LABELS = {
  poll: 'Poll', educational_post: 'Edu', market_update: 'Market',
  qa: 'Q&A', service_faq: 'FAQ', minigame: 'Game',
  confession_discussion: 'Discuss', promo_info: 'Promo',
}
const FORMAT_COLOR = {
  poll: 'badge-blue', educational_post: 'badge-green', market_update: 'badge-teal',
  qa: 'badge-orange', service_faq: 'badge-gray', minigame: 'badge-purple',
  confession_discussion: 'badge-gray', promo_info: 'badge-yellow',
}
const STATUS_OPTS = [
  { val: 'draft',     label: 'Bản nháp',   color: '#9ca3af' },
  { val: 'scheduled', label: 'Đã lên lịch', color: '#f59e0b' },
  { val: 'published', label: 'Đã đăng',     color: '#16a34a' },
]
const DAY_VI = { Monday:'T2', Tuesday:'T3', Wednesday:'T4', Thursday:'T5', Friday:'T6', Saturday:'T7', Sunday:'CN' }
const HOUR_OPTS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21]
const TOPIC_OPTS = [
  'Dự đoán giá cổ phiếu','Phân tích xu hướng thị trường','Tin tức tài chính cá nhân',
  'Kiến thức đầu tư cơ bản','Giới thiệu tính năng MoMo','Câu chuyện người dùng',
  'Ưu đãi & Khuyến mãi','Tư vấn tiết kiệm','Minigame & Tương tác','Khác',
]
const FORMAT_OPTS = Object.entries(FORMAT_LABELS).map(([val, label]) => ({ val, label }))

function buildPrompt(slot, posts = []) {
  const d = slot.direction || {}

  const examples = posts
    .filter(p => !p.has_reward && p.post_content && p.er_user > 0)
    .sort((a, b) => b.er_user - a.er_user)
    .slice(0, 3)
    .map((p, i) => `Bài ${i+1} (ER ${(p.er_user*100).toFixed(1)}%):\n"${p.post_content.slice(0, 250)}"`)
    .join('\n\n')

  return `Bạn là copywriter cho fanpage MaMa Tài Chính (MMTC) của MoMo — trang tài chính cá nhân thân thiện, dành cho người Việt 22–45 tuổi quan tâm đầu tư, tiết kiệm, chứng khoán.
${examples ? `\n## Bài mẫu MMTC có ER cao (học style này):\n${examples}\n` : ''}
## Yêu cầu bài mới:
- Định dạng: ${FORMAT_LABELS[slot.content_format] ?? slot.content_format}
- Chủ đề: ${slot.topic_group}
- Ngày đăng: ${slot.date} lúc ${slot.publish_hour}:00
${d.hook ? `- Hook gợi ý: ${d.hook}` : ''}
${d.content_angle ? `- Góc nội dung: ${d.content_angle}` : ''}
${d.cta ? `- CTA: ${d.cta}` : ''}
${d.caption_direction ? `- Caption direction: ${d.caption_direction}` : ''}
${slot.notes ? `- Ghi chú: ${slot.notes}` : ''}

## Yêu cầu output:
Viết **2 phiên bản caption** hoàn chỉnh, mỗi bản 80–130 chữ. Học đúng tone/style bài mẫu. Hook thu hút, kết thúc bằng câu hỏi mở hoặc CTA rõ ràng. KHÔNG hashtag trừ khi minigame/poll.

**Phiên bản 1:**
[caption]

**Phiên bản 2:**
[caption]`
}

export default function PostListPanel({ onSelectSlot }) {
  const { weeklySlots, setWeeklySlots, data } = useApp()
  const [expandedId, setExpandedId] = useState(null)
  const [genContent, setGenContent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmtc_genContent') ?? '{}') } catch { return {} }
  })
  const [genHistory, setGenHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmtc_genHistory') ?? '{}') } catch { return {} }
  })
  const [genHistoryIdx, setGenHistoryIdx] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmtc_genHistoryIdx') ?? '{}') } catch { return {} }
  })
  const [copied, setCopied] = useState({})

  useEffect(() => {
    try { localStorage.setItem('mmtc_genContent', JSON.stringify(genContent)) } catch {}
  }, [genContent])
  useEffect(() => {
    try {
      localStorage.setItem('mmtc_genHistory', JSON.stringify(genHistory))
      localStorage.setItem('mmtc_genHistoryIdx', JSON.stringify(genHistoryIdx))
    } catch {}
  }, [genHistory, genHistoryIdx])

  const sorted = [...weeklySlots].sort((a, b) =>
    a.date.localeCompare(b.date) || a.publish_hour - b.publish_hour
  )

  const updateSlot = (id, changes) =>
    setWeeklySlots(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s))

  const updateDir = (id, changes) =>
    setWeeklySlots(prev => prev.map(s =>
      s.id === id ? { ...s, direction: { ...(s.direction || {}), ...changes } } : s
    ))

  const deleteSlot = (id) => {
    if (expandedId === id) setExpandedId(null)
    setWeeklySlots(prev => prev.filter(s => s.id !== id))
  }

  const genPost = useCallback(async (slot) => {
    setGenContent(prev => ({ ...prev, [slot.id]: { text: '', loading: true, error: null } }))

    const d = slot.direction || {}
    const FORMAT_VI = {
      poll: 'Poll / Bình chọn', educational_post: 'Bài giáo dục tài chính',
      market_update: 'Cập nhật thị trường', qa: 'Hỏi & Đáp',
      service_faq: 'FAQ dịch vụ MoMo', minigame: 'Minigame / Tương tác',
      confession_discussion: 'Thảo luận / Chia sẻ', promo_info: 'Thông tin ưu đãi',
    }
    const examples = (data?.posts ?? [])
      .filter(p => !p.has_reward && p.post_content && p.er_user > 0)
      .sort((a, b) => b.er_user - a.er_user).slice(0, 1)
      .map(p => `"${p.post_content.slice(0, 120)}"`)
      .join('')

    const prompt = `Copywriter MaMa Tài Chính (MoMo) — tài chính cá nhân, tiếng Việt, 22–45 tuổi.
${examples ? `Style mẫu: ${examples}\n` : ''}Định dạng: ${FORMAT_VI[slot.content_format] ?? slot.content_format} | Chủ đề: ${slot.topic_group}${d.hook ? ` | Hook: ${d.hook}` : ''}${d.cta ? ` | CTA: ${d.cta}` : ''}${d.content_angle ? ` | Góc: ${d.content_angle}` : ''}

Viết 2 caption tiếng Việt (70–100 chữ/bản), KHÁC NHAU:
Bản 1: hook số liệu/dữ kiện → nội dung → CTA
Bản 2: hook câu hỏi/kể chuyện → nội dung → câu hỏi mở

**Phiên bản 1:**

**Phiên bản 2:**`

    try {
      const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5:1.5b',
          stream: true,
          messages: [{ role: 'user', content: prompt }],
          options: { temperature: 0.85, num_predict: 350 },
        }),
      })
      if (!res.ok) {
        setGenContent(prev => ({ ...prev, [slot.id]: { text: '', loading: false, error: 'Ollama lỗi. Đảm bảo Ollama đang chạy.' } }))
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            const token = json.message?.content ?? ''
            if (token) {
              accumulated += token
              setGenContent(prev => ({ ...prev, [slot.id]: { text: accumulated, loading: false, error: null } }))
            }
          } catch {}
        }
      }
      if (accumulated) {
        setGenHistory(prev => {
          const list = [...(prev[slot.id] ?? []), accumulated]
          setGenHistoryIdx(i => ({ ...i, [slot.id]: list.length - 1 }))
          return { ...prev, [slot.id]: list }
        })
      }
      setGenContent(prev => ({ ...prev, [slot.id]: { text: accumulated, loading: false, error: null } }))
    } catch (err) {
      setGenContent(prev => ({ ...prev, [slot.id]: { text: '', loading: false, error: 'Không kết nối được Ollama (localhost:11434). Mở app Ollama rồi thử lại.' } }))
    }
  }, [data])

  const navHistory = (id, dir) => {
    setGenHistory(prev => {
      const list = prev[id] ?? []
      setGenHistoryIdx(i => {
        const next = Math.min(Math.max((i[id] ?? 0) + dir, 0), list.length - 1)
        setGenContent(c => ({ ...c, [id]: { text: list[next], loading: false, error: null } }))
        return { ...i, [id]: next }
      })
      return prev
    })
  }

  const handleCopyGen = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, [id]: true }))
      setTimeout(() => setCopied(prev => ({ ...prev, [id]: false })), 2000)
    })
  }

  if (!sorted.length) return null

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Danh sách bài trong tuần</span>
        <span className={styles.panelCount}>{sorted.length} bài</span>
      </div>

      <div className={styles.list}>
        {sorted.map((slot, idx) => {
          const isOpen = expandedId === slot.id
          const d = slot.direction || {}
          const statusObj = STATUS_OPTS.find(s => s.val === slot.status) || STATUS_OPTS[0]

          return (
            <div key={slot.id} className={`${styles.item} ${isOpen ? styles.itemOpen : ''}`}>
              {/* ── Row summary ── */}
              <div className={styles.row} onClick={() => setExpandedId(isOpen ? null : slot.id)}>
                <span className={styles.rowNum}>{idx + 1}</span>

                <div className={styles.rowDay}>
                  <span className={styles.dayBadge}>{DAY_VI[slot.day_of_week] ?? slot.day_of_week}</span>
                  <span className={styles.rowTime}>{slot.publish_hour}:00</span>
                </div>

                <span className={`badge ${FORMAT_COLOR[slot.content_format] ?? 'badge-gray'} ${styles.formatBadge}`}>
                  {FORMAT_LABELS[slot.content_format] ?? slot.content_format}
                </span>

                <span className={styles.rowTopic}>{slot.topic_group}</span>

                {d.basis?.trend_topic && (
                  <span className={styles.trendTag}>🔥 {d.basis.trend_topic.length > 20 ? d.basis.trend_topic.slice(0,18)+'…' : d.basis.trend_topic}</span>
                )}

                <span className={styles.statusDot} style={{ color: statusObj.color }}>● {statusObj.label}</span>

                {slot.locked && <Lock size={11} className={styles.lockIcon} />}
                <ChevronRight size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
              </div>

              {/* ── Expanded detail ── */}
              {isOpen && (
                <div className={styles.detail}>
                  <div className={styles.detailGrid}>

                    {/* Left: editable fields */}
                    <div className={styles.detailLeft}>
                      <Field label="Trạng thái">
                        <div className={styles.statusBtns}>
                          {STATUS_OPTS.map(s => (
                            <button
                              key={s.val}
                              className={`${styles.statusBtn} ${slot.status === s.val ? styles.statusBtnActive : ''}`}
                              style={slot.status === s.val ? { borderColor: s.color, color: s.color } : {}}
                              onClick={() => updateSlot(slot.id, { status: s.val })}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </Field>

                      <div className={styles.fieldRow}>
                        <Field label="Ngày">
                          <input type="date" className={styles.inp} value={slot.date}
                            onChange={e => updateSlot(slot.id, { date: e.target.value })} />
                        </Field>
                        <Field label="Giờ đăng">
                          <select className={styles.inp} value={slot.publish_hour}
                            onChange={e => updateSlot(slot.id, { publish_hour: Number(e.target.value) })}>
                            {HOUR_OPTS.map(h => <option key={h} value={h}>{h}:00</option>)}
                          </select>
                        </Field>
                      </div>

                      <Field label="Chủ đề">
                        <select className={styles.inp} value={slot.topic_group}
                          onChange={e => updateSlot(slot.id, { topic_group: e.target.value })}>
                          {TOPIC_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </Field>

                      <Field label="Định dạng">
                        <select className={styles.inp} value={slot.content_format}
                          onChange={e => updateSlot(slot.id, { content_format: e.target.value })}>
                          {FORMAT_OPTS.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
                        </select>
                      </Field>

                      <Field label="Hook mở đầu">
                        <input className={styles.inp} placeholder="VD: Bạn có biết…"
                          value={d.hook || ''}
                          onChange={e => updateDir(slot.id, { hook: e.target.value })} />
                      </Field>

                      <Field label="Góc nội dung">
                        <textarea className={styles.inp} rows={2} placeholder="Góc khai thác, điểm nhấn chính…"
                          value={d.content_angle || ''}
                          onChange={e => updateDir(slot.id, { content_angle: e.target.value })} />
                      </Field>

                      <Field label="CTA">
                        <input className={styles.inp} placeholder="VD: Comment ngay bên dưới!"
                          value={d.cta || ''}
                          onChange={e => updateDir(slot.id, { cta: e.target.value })} />
                      </Field>

                      <Field label="Ghi chú cho team">
                        <textarea className={styles.inp} rows={2} placeholder="Ghi chú thêm cho team designer / copywriter…"
                          value={slot.notes || ''}
                          onChange={e => updateSlot(slot.id, { notes: e.target.value })} />
                      </Field>
                    </div>

                    {/* Right: image + caption + actions */}
                    <div className={styles.detailRight}>

                      {/* Image upload */}
                      <Field label="Hình ảnh bài đăng">
                        <ImageUpload
                          value={slot.image_url}
                          onChange={url => updateSlot(slot.id, { image_url: url })}
                        />
                      </Field>

                      <Field label="Visual / Hướng hình ảnh">
                        <textarea className={styles.inp} rows={2} placeholder="Mô tả yêu cầu hình ảnh, màu sắc, layout…"
                          value={d.visual_direction || ''}
                          onChange={e => updateDir(slot.id, { visual_direction: e.target.value })} />
                      </Field>

                      <Field label="Caption direction">
                        <textarea className={styles.inp} rows={2} placeholder="Hướng viết caption, tone, độ dài…"
                          value={d.caption_direction || ''}
                          onChange={e => updateDir(slot.id, { caption_direction: e.target.value })} />
                      </Field>

                      {d.similar_post_ref && (
                        <div className={styles.refBox}>
                          <span className={styles.refLabel}>Bài tham khảo</span>
                          <p className={styles.refText}>{d.similar_post_ref.preview}</p>
                          <p className={styles.refNote}>{d.similar_post_ref.note}</p>
                        </div>
                      )}

                      <div className={styles.actions}>
                        <button className={`btn btn-primary btn-sm`}
                          onClick={() => updateSlot(slot.id, { status: 'published' })}>
                          <CheckCircle size={13} /> Đã đăng
                        </button>
                        <button className={`btn btn-sm ${styles.genBtn}`}
                          onClick={() => genPost(slot)}
                          disabled={genContent[slot.id]?.loading}>
                          {genContent[slot.id]?.loading
                            ? <><Loader size={13} className={styles.spin} /> Đang tạo…</>
                            : <><Sparkles size={13} /> Tạo content</>}
                        </button>
                        <button className={`btn btn-outline btn-sm`}
                          onClick={() => updateSlot(slot.id, { locked: !slot.locked })}>
                          <Lock size={13} /> {slot.locked ? 'Mở khoá' : 'Khoá'}
                        </button>
                        <button className={`btn btn-ghost btn-sm`}
                          style={{ color: 'var(--red)', marginLeft: 'auto' }}
                          onClick={() => deleteSlot(slot.id)}>
                          <Trash2 size={13} /> Xoá
                        </button>
                      </div>

                      {genContent[slot.id]?.error && (
                        <div className={styles.genError}>
                          ⚠ {genContent[slot.id].error}
                        </div>
                      )}

                      {(genContent[slot.id]?.text || genContent[slot.id]?.loading) && (
                        <div className={styles.genOutput}>
                          <div className={styles.genOutputHeader}>
                            <span className={styles.genOutputLabel}>
                              <Sparkles size={11} /> AI Caption
                              {(genHistory[slot.id]?.length ?? 0) > 1 && (
                                <span style={{ fontWeight: 400, color: 'var(--gray-400)', marginLeft: 6 }}>
                                  {(genHistoryIdx[slot.id] ?? 0) + 1}/{genHistory[slot.id].length}
                                </span>
                              )}
                            </span>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {(genHistory[slot.id]?.length ?? 0) > 1 && (
                                <>
                                  <button className={`btn btn-ghost btn-sm`} style={{ padding: '2px 6px' }}
                                    onClick={() => navHistory(slot.id, -1)}
                                    disabled={(genHistoryIdx[slot.id] ?? 0) === 0}>◀</button>
                                  <button className={`btn btn-ghost btn-sm`} style={{ padding: '2px 6px' }}
                                    onClick={() => navHistory(slot.id, 1)}
                                    disabled={(genHistoryIdx[slot.id] ?? 0) >= (genHistory[slot.id]?.length ?? 1) - 1}>▶</button>
                                </>
                              )}
                              <button className={`btn btn-ghost btn-sm`} style={{ padding: '2px 8px' }}
                                onClick={() => genPost(slot)}
                                disabled={genContent[slot.id]?.loading}
                                title="Gen thêm phiên bản mới">
                                <RefreshCw size={11} /> Làm mới
                              </button>
                              {genContent[slot.id]?.text && (
                                <button className={`btn btn-ghost btn-sm`} style={{ padding: '2px 8px' }}
                                  onClick={() => handleCopyGen(slot.id, genContent[slot.id].text)}>
                                  <Copy size={11} /> {copied[slot.id] ? '✓ Đã copy' : 'Copy'}
                                </button>
                              )}
                            </div>
                          </div>
                          <pre className={styles.genOutputText}>
                            {genContent[slot.id]?.loading && !genContent[slot.id]?.text
                              ? '...'
                              : genContent[slot.id]?.text}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function ImageUpload({ value, onChange }) {
  const ref = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => onChange(e.target.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className={styles.imgUpload}>
      {value ? (
        <div className={styles.imgPreviewWrap}>
          <img src={value} alt="preview" className={styles.imgPreview} />
          <button className={styles.imgRemove} onClick={() => onChange(null)} title="Xoá hình">
            <XIcon size={12} />
          </button>
        </div>
      ) : (
        <div
          className={styles.imgDropZone}
          onClick={() => ref.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
        >
          <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
          <ImagePlus size={20} className={styles.imgIcon} />
          <span className={styles.imgHint}>Click hoặc kéo thả hình vào đây</span>
          <span className={styles.imgHintSub}>PNG, JPG, GIF — tối đa 5MB</span>
        </div>
      )}
    </div>
  )
}
