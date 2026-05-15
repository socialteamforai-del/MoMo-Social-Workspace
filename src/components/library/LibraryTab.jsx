import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import PostCard from './PostCard.jsx'
import PostDetailModal from './PostDetailModal.jsx'
import LibraryFilters from './LibraryFilters.jsx'
import styles from './LibraryTab.module.css'

const TABS = [
  { id: 'all',       label: 'Tất cả' },
  { id: 'top',       label: 'Hiệu quả cao' },
  { id: 'evergreen', label: 'Nội dung bền vững' },
  { id: 'improve',   label: 'Cần cải thiện' },
]

export default function LibraryTab() {
  const { data } = useApp()
  const { posts } = data

  const [subTab, setSubTab]     = useState('all')
  const [selected, setSelected] = useState(null)
  const [filters, setFilters]   = useState({ topic: '', format: '', hasReward: '', search: '' })
  const [sortBy, setSortBy]     = useState('er_user')

  const filtered = useMemo(() => {
    let list = [...posts]

    // Sub-tab filter
    if (subTab === 'top')       list = list.filter(p => p.er_user >= 0.45)
    if (subTab === 'improve')   list = list.filter(p => p.er_user < 0.30)
    if (subTab === 'evergreen') list = list.filter(p => !p.has_reward && p.er_user >= 0.35)

    // Filters
    if (filters.topic)   list = list.filter(p => p.topic_group === filters.topic)
    if (filters.format)  list = list.filter(p => p.content_format === filters.format)
    if (filters.hasReward === 'yes') list = list.filter(p => p.has_reward)
    if (filters.hasReward === 'no')  list = list.filter(p => !p.has_reward)
    if (filters.search)  list = list.filter(p =>
      p.post_content?.toLowerCase().includes(filters.search.toLowerCase())
    )

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'er_user')    return b.er_user - a.er_user
      if (sortBy === 'ctr_user')   return b.ctr_user - a.ctr_user
      if (sortBy === 'view_users') return b.view_users - a.view_users
      if (sortBy === 'date')       return b.created_date.localeCompare(a.created_date)
      return 0
    })

    return list
  }, [posts, subTab, filters, sortBy])

  const topics  = [...new Set(posts.map(p => p.topic_group))].sort()
  const formats = [...new Set(posts.map(p => p.content_format))].sort()

  const subTabInsight = useMemo(() => {
    if (filtered.length === 0) return null
    const avgER  = filtered.reduce((s, p) => s + p.er_user, 0) / filtered.length
    const topFormat = (() => {
      const fc = {}; filtered.forEach(p => { fc[p.content_format] = (fc[p.content_format] || 0) + 1 })
      return Object.entries(fc).sort((a,b) => b[1]-a[1])[0]?.[0] ?? '—'
    })()
    const topTopic = (() => {
      const tc = {}; filtered.forEach(p => { tc[p.topic_group] = (tc[p.topic_group] || 0) + 1 })
      return Object.entries(tc).sort((a,b) => b[1]-a[1])[0]?.[0] ?? '—'
    })()
    const rewardPct = Math.round(filtered.filter(p => p.has_reward).length / filtered.length * 100)

    const FORMAT_VI = { poll:'Poll', educational_post:'Giáo dục', market_update:'Market update', qa:'Q&A', service_faq:'FAQ', minigame:'Minigame', confession_discussion:'Thảo luận', promo_info:'Ưu đãi' }

    if (subTab === 'top') return {
      summary: `${filtered.length} bài đạt ER ≥ 45% — ER trung bình: ${(avgER*100).toFixed(1)}%. Format chiếm đa số: ${FORMAT_VI[topFormat]??topFormat}. Chủ đề nổi bật: "${topTopic}". ${rewardPct > 50 ? `${rewardPct}% bài có thưởng — hiệu suất organic cần kiểm tra riêng.` : 'Phần lớn là organic — tín hiệu content thực sự tốt.'}`,
      nextAction: `Nhân rộng format ${FORMAT_VI[topFormat]??topFormat} cho chủ đề "${topTopic}". Phân tích hook và CTA của top 3 bài để tạo template chuẩn cho team.`,
    }
    if (subTab === 'evergreen') return {
      summary: `${filtered.length} bài organic bền vững (ER ≥ 35%, không có thưởng) — ER trung bình: ${(avgER*100).toFixed(1)}%. Đây là nội dung hoạt động tốt mà không cần kích thích thưởng. Format phổ biến nhất: ${FORMAT_VI[topFormat]??topFormat}.`,
      nextAction: `Tái sử dụng các bài này dưới dạng content series hoặc repurpose thành format khác (VD: từ educational_post → poll cùng topic). Đây là "kho content vàng" để lên lịch vào tuần ít trend.`,
    }
    if (subTab === 'improve') return {
      summary: `${filtered.length} bài có ER < 30% — ER trung bình: ${(avgER*100).toFixed(1)}%. Format hay xuất hiện: ${FORMAT_VI[topFormat]??topFormat}, chủ đề: "${topTopic}". ${rewardPct > 0 ? `${rewardPct}% có thưởng nhưng vẫn thấp — nội dung chưa đủ hấp dẫn ngay cả khi có kích thích.` : 'Toàn organic — cần review lại hook và CTA.'}`,
      nextAction: `Dừng đăng format ${FORMAT_VI[topFormat]??topFormat} cho chủ đề "${topTopic}" trong 2 tuần. Thử A/B: cùng topic nhưng đổi format sang poll hoặc confession_discussion. Xem lại timing (khung giờ) của các bài này trong heatmap.`,
    }
    return null
  }, [filtered, subTab])

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Library</h1>
        <span className={styles.count}>{filtered.length} / {posts.length} bài</span>
      </div>

      <div className={styles.subTabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.subTab} ${subTab === t.id ? styles.active : ''}`}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <LibraryFilters
        filters={filters} setFilters={setFilters}
        sortBy={sortBy} setSortBy={setSortBy}
        topics={topics} formats={formats}
      />

      {subTabInsight && (
        <div style={{ margin: '0 0 var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--pink-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--pink-100)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-700)', marginBottom: 6 }}>
            <strong style={{ color: 'var(--momo-pink)' }}>Tổng quan nhóm này:</strong> {subTabInsight.summary}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>
            <strong>Next action:</strong> {subTabInsight.nextAction}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>Không có bài nào phù hợp bộ lọc.</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(p => (
            <PostCard key={p.post_id} post={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      )}

      {selected && (
        <PostDetailModal post={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
