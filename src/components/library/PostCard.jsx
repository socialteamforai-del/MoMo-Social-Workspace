import React from 'react'
import { AlertTriangle, Gift } from 'lucide-react'
import styles from './PostCard.module.css'

const FORMAT_LABELS = {
  poll: 'Poll', educational_post: 'Giáo dục', market_update: 'Thị trường',
  qa: 'Q&A', service_faq: 'FAQ', minigame: 'Minigame',
  confession_discussion: 'Thảo luận', promo_info: 'Ưu đãi',
}

const FORMAT_COLOR = {
  poll: 'badge-pink', educational_post: 'badge-blue', market_update: 'badge-teal',
  qa: 'badge-purple', service_faq: 'badge-gray', minigame: 'badge-yellow',
  confession_discussion: 'badge-orange', promo_info: 'badge-green',
}

export default function PostCard({ post, onClick }) {
  const erGood = post.er_user >= 0.45
  const erAvg  = post.er_user >= 0.30

  return (
    <div className={`${styles.card} card`} onClick={onClick}>
      <div className={styles.topRow}>
        <span className={`badge ${FORMAT_COLOR[post.content_format] ?? 'badge-gray'}`}>
          {FORMAT_LABELS[post.content_format] ?? post.content_format}
        </span>
        <div className={styles.flags}>
          {post.view_anomaly && <AlertTriangle size={13} className={styles.anomaly} title="View bất thường" />}
          {post.has_reward   && <Gift size={13} className={styles.reward} title="Có thưởng" />}
        </div>
      </div>

      <p className={styles.preview}>
        {post.post_content?.slice(0, 100)}…
      </p>

      <span className="badge badge-gray" style={{ alignSelf: 'flex-start', fontSize: 10 }}>
        {post.topic_group}
      </span>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span
            className={styles.metricVal}
            style={{ color: erGood ? 'var(--green)' : erAvg ? '#9A7000' : 'var(--red)' }}
          >
            {(post.er_user * 100).toFixed(1)}%
          </span>
          <span className={styles.metricLabel}>ER</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricVal}>{(post.ctr_user * 100).toFixed(1)}%</span>
          <span className={styles.metricLabel}>CTR</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricVal}>{post.view_users?.toLocaleString('vi-VN')}</span>
          <span className={styles.metricLabel}>Views</span>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.date}>{post.created_date} · {post.created_hour}:00</span>
        {post.day_of_week && <span className={styles.date}>{post.day_of_week}</span>}
      </div>
    </div>
  )
}
