import React, { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Eye, MessageCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './TopPosts.module.css'

const FORMAT_LABELS = {
  poll: 'Poll', educational_post: 'Giáo dục', market_update: 'Thị trường',
  qa: 'Q&A', service_faq: 'FAQ', minigame: 'Minigame',
  confession_discussion: 'Thảo luận', promo_info: 'Ưu đãi',
}

function analyzeTopPost(post, allPosts, timingBenchmarks) {
  const reasons = []

  if (post.has_reward) {
    reasons.push({ icon: '🎁', text: 'Có gắn thưởng — tăng động lực tham gia', type: 'info' })
  }

  const sameFormat = allPosts.filter(p => p.content_format === post.content_format && !p.has_reward)
  if (sameFormat.length > 0) {
    const avgER = sameFormat.reduce((s, p) => s + p.er_user, 0) / sameFormat.length
    if (post.er_user > avgER * 1.3) {
      reasons.push({
        icon: '📊',
        text: `ER cao hơn 30% so với trung bình format ${FORMAT_LABELS[post.content_format] ?? post.content_format} (organic)`,
        type: 'positive',
      })
    }
  }

  const bench = timingBenchmarks.find(b =>
    b.topic_group === post.topic_group && b.content_format === post.content_format
  )
  if (bench && post.created_hour === bench.best_hour) {
    reasons.push({ icon: '⏰', text: `Đăng đúng khung giờ tối ưu (${bench.best_hour}:00)`, type: 'positive' })
  }

  const commentRatio = post.view_users > 0 ? post.comment_users / post.view_users : 0
  const globalAvgComment = allPosts.length
    ? allPosts.reduce((s, p) => s + (p.view_users > 0 ? p.comment_users / p.view_users : 0), 0) / allPosts.length
    : 0
  if (commentRatio > globalAvgComment * 1.5) {
    reasons.push({ icon: '💬', text: 'Tỷ lệ bình luận cao — nội dung kích thích thảo luận tốt', type: 'positive' })
  }

  if (post.view_anomaly) {
    reasons.push({ icon: '⚠️', text: 'view_users > view_count — dữ liệu bất thường, ER có thể không chính xác', type: 'warning' })
  }

  if (reasons.length === 0) {
    reasons.push({ icon: '✨', text: 'Nội dung organic hiệu quả tốt — không có yếu tố bất thường', type: 'positive' })
  }

  return reasons
}

function analyzeContent(post) {
  const content = (post.post_content || '').toLowerCase()
  const raw = post.post_content || ''
  const insights = []

  // Hook type
  if (raw.match(/^(🔥|📊|📈|💰|🎮|💬|❓|⚡|👇|🚨)/)) {
    insights.push({ label: 'Hook', value: 'Emoji dẫn đầu — bắt mắt trên newsfeed' })
  } else if (raw.match(/^[""]/)) {
    insights.push({ label: 'Hook', value: 'Mở đầu bằng quote/confession' })
  } else if (content.match(/^(bạn có biết|bạn đã|bao giờ bạn|liệu bạn)/)) {
    insights.push({ label: 'Hook', value: 'Hook câu hỏi trực tiếp đến reader' })
  } else {
    insights.push({ label: 'Hook', value: 'Dạng thông tin thẳng (straight fact)' })
  }

  // Số liệu cụ thể
  const hasNumbers = /\d+[%,.\d]*\s*(tỷ|triệu|nghìn|điểm|%|lần|ngày|tháng)/.test(content)
  if (hasNumbers) insights.push({ label: 'Điểm mạnh', value: 'Có số liệu cụ thể — tăng credibility' })

  // CTA dạng nào
  if (content.includes('bình chọn') || content.includes('vote')) {
    insights.push({ label: 'CTA', value: 'Poll / Bình chọn → engagement cao' })
  } else if (content.includes('comment') || content.includes('bình luận')) {
    insights.push({ label: 'CTA', value: 'Kêu gọi comment → discussion' })
  } else if (content.includes('tag') || content.includes('chia sẻ')) {
    insights.push({ label: 'CTA', value: 'Viral loop (tag/share)' })
  }

  // Độ dài nội dung
  const wordCount = raw.split(/\s+/).length
  if (wordCount < 60) insights.push({ label: 'Độ dài', value: `Ngắn (~${wordCount} từ) — phù hợp mobile` })
  else if (wordCount < 120) insights.push({ label: 'Độ dài', value: `Vừa (~${wordCount} từ) — đọc nhanh được` })
  else insights.push({ label: 'Độ dài', value: `Dài (~${wordCount} từ) — cần hook mạnh` })

  return insights
}

function PostRow({ post, rank, allPosts, timingBenchmarks }) {
  const [expanded, setExpanded] = useState(false)
  const reasons = analyzeTopPost(post, allPosts, timingBenchmarks)
  const contentInsights = analyzeContent(post)

  return (
    <div className={styles.postRow}>
      <div className={styles.postHeader} onClick={() => setExpanded(v => !v)}>
        <span className={styles.rank}>#{rank}</span>

        <div className={styles.postMeta}>
          <div className={styles.titleRow}>
            <span className={`badge ${post.has_reward ? 'badge-yellow' : 'badge-green'}`}>
              {post.has_reward ? 'Có thưởng' : 'Organic'}
            </span>
            <span className="badge badge-blue">{FORMAT_LABELS[post.content_format] ?? post.content_format}</span>
            {post.view_anomaly && <AlertTriangle size={13} className={styles.anomalyIcon} />}
          </div>
          <p className={styles.preview}>{post.post_content?.slice(0, 72)}…</p>
          <div className={styles.postStats}>
            <span>📅 {post.created_date} {post.created_hour}:00</span>
            <span><Eye size={11} /> {post.view_users?.toLocaleString('vi-VN')}</span>
            <span><MessageCircle size={11} /> {post.comment_users}</span>
          </div>
        </div>

        <div className={styles.erBadge}>
          <span
            className={styles.erVal}
            style={{ color: post.er_user >= 0.45 ? 'var(--green)' : post.er_user >= 0.30 ? '#9A7000' : 'var(--red)' }}
          >
            {(post.er_user * 100).toFixed(1)}%
          </span>
          <span className={styles.erLabel}>ER</span>
        </div>

        <button className={styles.expandBtn}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {expanded && (
        <div className={styles.detail}>
          <p className={styles.fullContent}>{post.post_content}</p>
          <div className={styles.reasons}>
            <p className={styles.reasonsTitle}>Tại sao bài này hiệu quả:</p>
            {reasons.map((r, i) => (
              <div
                key={i}
                className={`${styles.reasonItem} ${r.type === 'warning' ? styles.reasonWarn : r.type === 'positive' ? styles.reasonGood : styles.reasonInfo}`}
              >
                <span>{r.icon}</span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>
          {contentInsights.length > 0 && (
            <div className={styles.reasons} style={{ marginTop: 8, borderTop: '1px solid var(--gray-100)', paddingTop: 8 }}>
              <p className={styles.reasonsTitle}>Phân tích content:</p>
              <div className={styles.contentGrid}>
                {contentInsights.map((ins, i) => (
                  <div key={i} className={styles.contentInsightItem}>
                    <span className={styles.insightLabel}>{ins.label}</span>
                    <span className={styles.insightVal}>{ins.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TopPosts() {
  const { data } = useApp()
  const { posts, timingBenchmarks } = data

  const top5 = [...posts].sort((a, b) => b.er_user - a.er_user).slice(0, 5)

  return (
    <div className={`${styles.card} card`}>
      <div className="section-banner section-banner-pink">
        <span>🏆 Top 5 bài — ER cao nhất</span>
        <span style={{ marginLeft: 'auto', fontWeight: 400, opacity: 0.8, fontSize: 11 }}>{posts.length} bài phân tích</span>
      </div>
      <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
      <div className={styles.list}>
        {top5.map((post, i) => (
          <PostRow
            key={post.post_id}
            post={post}
            rank={i + 1}
            allPosts={posts}
            timingBenchmarks={timingBenchmarks}
          />
        ))}
      </div>
      </div>
    </div>
  )
}
