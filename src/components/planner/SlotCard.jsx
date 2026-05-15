import React, { useState } from 'react'
import { Lock } from 'lucide-react'
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

const SLOT_TYPE_COLOR = {
  fixed:    'badge-pink',
  flexible: 'badge-gray',
  reactive: 'badge-teal',
}

export default function SlotCard({ slot, onClick }) {
  const [showTip, setShowTip] = useState(false)

  const topicShort = (slot.topic_group || '').length > 24
    ? slot.topic_group.slice(0, 22) + '…'
    : slot.topic_group

  const basis = slot.direction?.basis || {}
  const signals = []
  if (basis.trend)       signals.push({ icon: '🔥', label: 'Trend', tip: basis.trend })
  if (basis.bu)          signals.push({ icon: '💼', label: 'BU',    tip: basis.bu })
  if (basis.timing)      signals.push({ icon: '⏰', label: 'Timing',tip: basis.timing })
  if (basis.performance) signals.push({ icon: '📈', label: 'ER',    tip: basis.performance })

  const trendTag = basis.trend_topic
    ? `🔥 ${basis.trend_topic.length > 28 ? basis.trend_topic.slice(0, 26) + '…' : basis.trend_topic}`
    : null

  const tipLines = [
    `Format: ${FORMAT_SHORT[slot.content_format] ?? slot.content_format}`,
    `Chủ đề: ${slot.topic_group}`,
    slot.direction?.content_angle ? `Góc: ${slot.direction.content_angle.slice(0, 80)}` : null,
    ...signals.map(s => `${s.icon} ${s.tip}`),
  ].filter(Boolean)

  return (
    <div
      className={styles.card}
      onClick={onClick}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div className={styles.topRow}>
        <span className={`badge ${FORMAT_COLOR[slot.content_format] ?? 'badge-gray'}`}>
          {FORMAT_SHORT[slot.content_format] ?? slot.content_format}
        </span>
        <span className={`badge ${SLOT_TYPE_COLOR[slot.slot_type] ?? 'badge-gray'}`} style={{ fontSize: 9 }}>
          {slot.slot_type}
        </span>
        {slot.locked && <Lock size={10} className={styles.lockIcon} />}
      </div>

      <div className={styles.topic}>{topicShort}</div>

      {trendTag && (
        <div className={styles.trendTag} title={basis.trend_source ? `Nguồn: ${basis.trend_source}` : basis.trend_topic}>
          {trendTag}
        </div>
      )}

      {signals.length > 0 && (
        <div className={styles.signals}>
          {signals.map((s, i) => (
            <span key={i} className={styles.signalChip} title={s.tip}>{s.icon}</span>
          ))}
        </div>
      )}

      <div className={styles.bottomRow}>
        <span className={styles.time}>{slot.publish_hour}:00</span>
        <span className={`${styles.statusDot} ${styles['status_' + slot.status]}`} />
      </div>

      {showTip && tipLines.length > 0 && (
        <div className={styles.hoverTip}>
          {tipLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      <div className={`${styles.strip} ${styles['strip_' + slot.status]}`} />
    </div>
  )
}
