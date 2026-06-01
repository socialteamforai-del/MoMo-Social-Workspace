import React, { useState } from 'react'
import { Check, RefreshCw, ChevronRight, Pencil, X, Lock, TrendingUp } from 'lucide-react'
import styles from './HookPicker.module.css'

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

function EditModal({ card, angle, onSave, onClose }) {
  const [draft, setDraft] = useState(angle)
  const dateLabel = card.date
    ? (() => { const [,m,d] = card.date.split('-'); return `${d}/${m}` })()
    : ''

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <div className={styles.modalMeta}>
              <span className={`badge ${card.bu_campaign ? 'badge-pink' : (FORMAT_COLOR[card.content_format] ?? 'badge-gray')}`} style={{ fontSize: 10 }}>
                {card.bu_campaign ? 'Event' : (FORMAT_SHORT[card.content_format] ?? card.content_format)}
              </span>
              <span className={styles.modalTime}>
                {DAY_VI[card.day_of_week]} · {card.publish_hour}:00 · {dateLabel}
              </span>
            </div>
            <div className={styles.modalTopic}>{card.topic_group}</div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div className={styles.modalBody}>
          {card.direction?.hook && (
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Hook</label>
              <div className={styles.modalHookText}>{card.direction.hook}</div>
            </div>
          )}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Góc nội dung</label>
            <textarea
              autoFocus
              className={styles.modalTextarea}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Mô tả góc tiếp cận, thông điệp chính của bài…"
              rows={4}
            />
          </div>
        </div>

        {/* Modal footer */}
        <div className={styles.modalFooter}>
          <button className={styles.modalCancelBtn} onClick={onClose}>Huỷ</button>
          <button className={styles.modalSaveBtn} onClick={() => onSave(draft)}>Lưu</button>
        </div>
      </div>
    </div>
  )
}

export default function HookPicker({ candidates, numTarget, onConfirm, onRegenerate }) {
  // Locked = event slots that are always selected
  const lockedIds = new Set(candidates.filter(c => c.locked).map(c => c.id))

  // AI top picks from non-locked pool — stable reference
  const aiPickIds = useState(() => {
    const nonLocked = candidates.filter(c => !c.locked)
    const sorted = [...nonLocked].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
    const needed = Math.max(0, numTarget - lockedIds.size)
    return new Set(sorted.slice(0, needed).map(c => c.id))
  })[0]

  const [selected, setSelected] = useState(() => new Set([...lockedIds, ...aiPickIds]))
  const [angles, setAngles] = useState(() => {
    const m = {}
    candidates.forEach(c => { m[c.id] = c.direction?.content_angle ?? '' })
    return m
  })
  const [editingCard, setEditingCard] = useState(null)

  const toggle = (id) => {
    if (lockedIds.has(id)) return  // locked event slots can't be deselected
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    const picks = candidates
      .filter(c => selected.has(c.id))
      .map(c => ({
        ...c,
        direction: { ...c.direction, content_angle: angles[c.id] ?? c.direction?.content_angle },
      }))
    onConfirm(picks)
  }

  const handleSaveAngle = (draft) => {
    setAngles(prev => ({ ...prev, [editingCard.id]: draft }))
    setEditingCard(null)
  }

  const selectedCount   = candidates.filter(c => selected.has(c.id)).length
  const numSelected     = selectedCount
  const flexibleSelected = selectedCount - lockedIds.size
  const flexibleTarget   = numTarget - lockedIds.size

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Chọn chủ đề</span>
          <span className={styles.subtitle}>
            AI gợi ý <strong>{candidates.length}</strong> chủ đề · chọn <strong>{numTarget}</strong> để đăng tuần này
          </span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.regenBtn} onClick={onRegenerate}>
            <RefreshCw size={13} /> Tạo lại
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={numSelected === 0}
          >
            Xác nhận {numSelected} bài
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Selection counter bar */}
      {lockedIds.size > 0 && (
        <div className={styles.lockedNotice}>
          <Lock size={11} /> {lockedIds.size} bài sự kiện đã cố định · chọn thêm {Math.max(0, flexibleTarget - flexibleSelected)} bài còn lại
        </div>
      )}
      <div className={styles.counterBar}>
        <div
          className={styles.counterFill}
          style={{ width: `${Math.min(100, (selectedCount / numTarget) * 100)}%` }}
        />
        <span className={styles.counterText}>
          {numSelected < numTarget
            ? `Chọn thêm ${numTarget - numSelected} bài nữa`
            : numSelected === numTarget
              ? `Đủ ${numTarget} bài — có thể xác nhận`
              : `Đã chọn ${numSelected} bài (nhiều hơn kế hoạch ${numSelected - numTarget})`}
        </span>
      </div>

      {/* Cards grid */}
      <div className={styles.grid}>
        {candidates.map(c => {
          const isPicked  = selected.has(c.id)
          const isLocked  = lockedIds.has(c.id)
          const isTrend   = !isLocked && c.notes?.startsWith('🔥 Trend')
          const isAiPick  = aiPickIds.has(c.id)
          const dateLabel = c.date
            ? (() => { const [,m,d] = c.date.split('-'); return `${d}/${m}` })()
            : ''

          let cardClass = styles.card
          if (isLocked)       cardClass += ` ${styles.cardEvent}`
          else if (isPicked)  cardClass += ` ${styles.cardPicked}`
          else                cardClass += ` ${styles.cardUnpicked}`

          return (
            <div
              key={c.id}
              className={cardClass}
              onClick={() => toggle(c.id)}
              style={isLocked ? { cursor: 'default' } : {}}
            >
              {/* Pick indicator */}
              {isLocked ? (
                <div className={`${styles.pickDot} ${styles.pickDotLocked}`}>
                  <Lock size={8} strokeWidth={3} />
                </div>
              ) : (
                <div className={`${styles.pickDot} ${isPicked ? styles.pickDotOn : ''}`}>
                  {isPicked && <Check size={10} strokeWidth={3} />}
                </div>
              )}

              {/* Type badge */}
              {isLocked  && <div className={styles.eventBadge}>📌 Sự kiện</div>}
              {isTrend   && <div className={styles.trendBadge}><TrendingUp size={9} /> Trending</div>}
              {!isLocked && !isTrend && isAiPick && <div className={styles.aiBadge}>AI đề xuất</div>}

              {/* Meta row */}
              <div className={styles.cardMeta}>
                <span className={`badge ${c.bu_campaign ? 'badge-pink' : (FORMAT_COLOR[c.content_format] ?? 'badge-gray')}`} style={{ fontSize: 10 }}>
                  {c.bu_campaign ? 'Event' : (FORMAT_SHORT[c.content_format] ?? c.content_format)}
                </span>
                <span className={styles.cardTime}>
                  {DAY_VI[c.day_of_week]} · {c.publish_hour}:00 · {dateLabel}
                </span>
              </div>

              {/* Topic */}
              <div className={styles.cardTopic}>{c.topic_group}</div>

              {/* Angle preview + edit trigger */}
              <div className={styles.cardAngle} onClick={e => { e.stopPropagation(); setEditingCard(c) }}>
                <span className={styles.angleText} title="Click để chỉnh sửa">
                  {angles[c.id] || <em className={styles.anglePlaceholder}>Chưa có góc nội dung</em>}
                  <Pencil size={10} className={styles.editIcon} />
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editingCard && (
        <EditModal
          card={editingCard}
          angle={angles[editingCard.id] ?? ''}
          onSave={handleSaveAngle}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  )
}
