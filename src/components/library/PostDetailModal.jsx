import React from 'react'
import { X, AlertTriangle, Gift } from 'lucide-react'
import styles from './PostDetailModal.module.css'

const FORMAT_LABELS = {
  poll: 'Poll', educational_post: 'Giáo dục', market_update: 'Thị trường',
  qa: 'Q&A', service_faq: 'FAQ', minigame: 'Minigame',
  confession_discussion: 'Thảo luận', promo_info: 'Ưu đãi',
}

function MetricRow({ label, value, tooltip }) {
  return (
    <div className={styles.metricRow}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricVal}>{value}</span>
    </div>
  )
}

export default function PostDetailModal({ post, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span className="badge badge-blue">{FORMAT_LABELS[post.content_format] ?? post.content_format}</span>
            <span className="badge badge-gray">{post.topic_group}</span>
            {post.has_reward   && <span className="badge badge-yellow">Có thưởng</span>}
            {post.view_anomaly && <span className="badge badge-yellow">View bất thường</span>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Nội dung bài viết</h4>
            <p className={styles.content}>{post.post_content}</p>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Thông tin đăng bài</h4>
            <div className={styles.infoGrid}>
              <MetricRow label="Ngày đăng" value={`${post.created_date} · ${post.created_hour}:00`} />
              <MetricRow label="Ngày trong tuần" value={post.day_of_week} />
              <MetricRow label="Mục tiêu" value={post.objective} />
              <MetricRow label="Boosted?" value={post.is_boosted ? 'Có' : 'Không'} />
            </div>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Chỉ số hiệu quả</h4>
            <div className={styles.metricsGrid}>
              <div className={styles.bigMetric}>
                <span className={styles.bigVal} style={{
                  color: post.er_user >= 0.45 ? 'var(--green)' : post.er_user >= 0.30 ? '#9A7000' : 'var(--red)'
                }}>
                  {(post.er_user * 100).toFixed(2)}%
                </span>
                <span className={styles.bigLabel}>ER (Engagement Rate)</span>
              </div>
              <div className={styles.bigMetric}>
                <span className={styles.bigVal}>{(post.ctr_user * 100).toFixed(2)}%</span>
                <span className={styles.bigLabel}>CTR (Click-Through Rate)</span>
              </div>
            </div>
            <div className={styles.infoGrid}>
              <MetricRow label="Lượt xem (người dùng)" value={post.view_users?.toLocaleString('vi-VN')} />
              <MetricRow label="Lượt xem (tổng)" value={post.view_count?.toLocaleString('vi-VN')} />
              <MetricRow label="Lượt thích" value={post.like_users?.toLocaleString('vi-VN')} />
              <MetricRow label="Bình luận" value={post.comment_users?.toLocaleString('vi-VN')} />
              <MetricRow label="Chia sẻ" value={post.share_users?.toLocaleString('vi-VN')} />
            </div>
          </section>

          {(post.view_anomaly || post.has_reward) && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Lưu ý khi đọc số liệu</h4>
              {post.has_reward && (
                <div className={styles.warning} style={{ background: 'var(--yellow-light)', color: '#9A7000' }}>
                  <Gift size={14} />
                  <span>Bài có thưởng — ER cao có thể do incentive, không phản ánh organic engagement.</span>
                </div>
              )}
              {post.view_anomaly && (
                <div className={styles.warning} style={{ background: 'var(--yellow-light)', color: '#9A7000' }}>
                  <AlertTriangle size={14} />
                  <span>View bất thường (view_users &gt; view_count) — dữ liệu có thể không chính xác.</span>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
