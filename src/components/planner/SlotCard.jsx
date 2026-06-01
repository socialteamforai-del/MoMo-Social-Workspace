import React from 'react'
import { Lock, CheckCircle2 } from 'lucide-react'
import styles from './SlotCard.module.css'

const FORMAT_COLOR = {
  poll:                  'badge-blue',
  educational_post:      'badge-green',
  market_update:         'badge-teal',
  qa:                    'badge-orange',
  service_faq:           'badge-gray',
  minigame:              'badge-purple',
  confession_discussion: 'badge-gray',
  promo_info:            'badge-yellow',
}

const FORMAT_SHORT = {
  poll: 'Poll', educational_post: 'Edu', market_update: 'Market',
  qa: 'Q&A', service_faq: 'FAQ', minigame: 'Game',
  confession_discussion: 'Discuss', promo_info: 'Promo',
}

export default function SlotCard({ slot, onClick, dragging, onDragStart, onDragEnd }) {
  const isTrending = !!(slot.direction?.basis?.trend_topic || slot.direction?.basis?.trend)

  const titleShort = slot.title
    ? (slot.title.length > 38 ? slot.title.slice(0, 36) + '…' : slot.title)
    : null

  const topicShort = (slot.topic_group || '').length > 28
    ? slot.topic_group.slice(0, 26) + '…'
    : slot.topic_group

  const isScheduled = slot.status === 'scheduled'
  const isPublished = slot.status === 'published'
  const timeDisplay = slot.publish_time
    ? slot.publish_time.slice(0, 5)
    : `${String(slot.publish_hour ?? 0).padStart(2,'0')}:00`

  return (
    <div
      className={`${styles.card} ${dragging ? styles.dragging : ''} ${isScheduled ? styles.cardScheduled : ''} ${isPublished ? styles.cardPublished : ''}`}
      draggable={!slot.locked}
      onClick={e => { e.stopPropagation(); onClick?.() }}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.() }}
      onDragEnd={onDragEnd}
    >
      {/* Format + lock + status badge */}
      <div className={styles.topRow}>
        <span className={`badge ${slot.bu_campaign ? 'badge-pink' : (FORMAT_COLOR[slot.content_format] ?? 'badge-gray')}`}>
          {slot.bu_campaign ? 'Event' : (FORMAT_SHORT[slot.content_format] ?? slot.content_format)}
        </span>
        {slot.locked && <Lock size={10} className={styles.lockIcon} />}
        <div style={{ marginLeft: 'auto' }}>
          {isScheduled && (
            <span className={styles.scheduledBadge}>
              <CheckCircle2 size={11} /> Đã lên lịch
            </span>
          )}
          {isPublished && (
            <span className={styles.publishedBadge}>
              <CheckCircle2 size={11} /> Đã đăng
            </span>
          )}
          {!isScheduled && !isPublished && (
            <span className={styles.statusDot} />
          )}
        </div>
      </div>

      {/* Chủ đề */}
      <div className={styles.topic}>{topicShort}</div>

      {/* Title nếu có */}
      {titleShort && (
        <div className={styles.title}>{titleShort}</div>
      )}

      {/* Bottom: giờ + trending tag */}
      <div className={styles.bottomRow}>
        <span className={styles.time}>{timeDisplay}</span>
        {isTrending && <span className={styles.trendPill}>Trending</span>}
      </div>

      {/* Post ID */}
      {(isScheduled || isPublished) && slot.postId && (
        <div className={styles.postId}>ID: {slot.postId}</div>
      )}

      <div className={`${styles.strip} ${styles['strip_' + slot.status]}`} />
    </div>
  )
}
