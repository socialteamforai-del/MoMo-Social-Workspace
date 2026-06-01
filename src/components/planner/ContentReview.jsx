import React, { useState } from 'react'
import { ArrowLeft, Calendar, Check, Pencil, Image as ImageIcon } from 'lucide-react'
import styles from './ContentReview.module.css'

const FORMAT_COLOR = {
  poll: 'badge-blue', educational_post: 'badge-green', market_update: 'badge-teal',
  qa: 'badge-orange', service_faq: 'badge-gray', minigame: 'badge-purple',
  confession_discussion: 'badge-gray', promo_info: 'badge-yellow',
}
const FORMAT_SHORT = {
  poll: 'Poll', educational_post: 'Edu', market_update: 'Market',
  qa: 'Q&A', service_faq: 'FAQ', minigame: 'Game',
  confession_discussion: 'Discuss', promo_info: 'Promo',
}
const DAY_VI = { Monday:'T2',Tuesday:'T3',Wednesday:'T4',Thursday:'T5',Friday:'T6',Saturday:'T7',Sunday:'CN' }

export default function ContentReview({ slots, onConfirm, onBack, onSelectSlot }) {
  const [confirmed, setConfirmed] = useState(new Set())

  const toggle = (id) => setConfirmed(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const confirmedCount = slots.filter(s => confirmed.has(s.id)).length
  const allConfirmed   = confirmedCount === slots.length

  const handleConfirmAll = () => {
    setConfirmed(new Set(slots.map(s => s.id)))
    onConfirm(slots)
  }

  const handleConfirmSelected = () => {
    if (confirmedCount === 0) return
    onConfirm(slots.filter(s => confirmed.has(s.id)))
  }

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={13} /> Quay lại
          </button>
          <div>
            <span className={styles.title}>Duyệt nội dung</span>
            <span className={styles.subtitle}>
              {slots.length} bài · xem nội dung AI gợi ý trước khi đưa vào lịch
            </span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {confirmedCount > 0 && confirmedCount < slots.length && (
            <button className={styles.confirmSelectedBtn} onClick={handleConfirmSelected}>
              <Calendar size={13} />
              Xác nhận {confirmedCount} bài đã chọn
            </button>
          )}
          <button className={styles.confirmAllBtn} onClick={handleConfirmAll}>
            <Check size={13} />
            Xác nhận tất cả {slots.length} bài
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className={styles.grid}>
        {slots.map(slot => {
          const dir        = slot.direction ?? {}
          const isChecked  = confirmed.has(slot.id)
          const dateLabel  = slot.date
            ? (() => { const [,m,d] = slot.date.split('-'); return `${d}/${m}` })()
            : ''

          return (
            <div
              key={slot.id}
              className={`${styles.card} ${isChecked ? styles.cardChecked : ''}`}
            >
              {/* Checkmark */}
              <button
                className={`${styles.checkBtn} ${isChecked ? styles.checkBtnOn : ''}`}
                onClick={() => toggle(slot.id)}
              >
                {isChecked && <Check size={10} strokeWidth={3} />}
              </button>

              {/* Meta */}
              <div className={styles.cardMeta}>
                <span className={`badge ${FORMAT_COLOR[slot.content_format] ?? 'badge-gray'}`} style={{ fontSize: 10 }}>
                  {FORMAT_SHORT[slot.content_format] ?? slot.content_format}
                </span>
                <span className={styles.cardTime}>
                  {DAY_VI[slot.day_of_week]} · {slot.publish_hour}:00 · {dateLabel}
                </span>
              </div>

              {/* Topic */}
              <div className={styles.cardTopic}>{slot.topic_group}</div>

              {/* Content preview */}
              <div className={styles.cardContent}>
                {dir.hook ? (
                  <div className={styles.contentBlock}>
                    <span className={styles.contentBlockLabel}>Hook</span>
                    <p className={styles.contentBlockText}>{dir.hook}</p>
                  </div>
                ) : (
                  <div className={styles.contentPlaceholder}>
                    Chưa có hook — nhấn Chỉnh sửa để thêm
                  </div>
                )}

                {dir.content_angle && (
                  <div className={styles.contentBlock}>
                    <span className={styles.contentBlockLabel}>Góc nội dung</span>
                    <p className={styles.contentBlockText}>{dir.content_angle}</p>
                  </div>
                )}

                {dir.visual_direction && (
                  <div className={styles.visualBlock}>
                    <ImageIcon size={11} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                    <span className={styles.visualBlockText}>{dir.visual_direction}</span>
                  </div>
                )}

                {!dir.hook && !dir.content_angle && !dir.visual_direction && (
                  <div className={styles.emptyContent}>
                    <ImageIcon size={20} style={{ color: 'var(--gray-200)' }} />
                    <span>Chưa có nội dung AI</span>
                  </div>
                )}
              </div>

              {/* Edit button */}
              <button
                className={styles.editBtn}
                onClick={() => onSelectSlot(slot)}
              >
                <Pencil size={11} /> Chỉnh sửa nội dung
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
