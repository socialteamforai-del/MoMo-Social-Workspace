import React from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import styles from './LibraryFilters.module.css'

const FORMAT_LABELS = {
  poll: 'Poll', educational_post: 'Giáo dục', market_update: 'Thị trường',
  qa: 'Q&A', service_faq: 'FAQ', minigame: 'Minigame',
  confession_discussion: 'Thảo luận', promo_info: 'Ưu đãi',
}

export default function LibraryFilters({ filters, setFilters, sortBy, setSortBy, topics, formats }) {
  const set = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  return (
    <div className={styles.bar}>
      <div className={styles.searchWrap}>
        <Search size={14} className={styles.searchIcon} />
        <input
          className={styles.search}
          placeholder="Tìm trong nội dung bài..."
          value={filters.search}
          onChange={e => set('search', e.target.value)}
        />
      </div>

      <select value={filters.topic} onChange={e => set('topic', e.target.value)} className={styles.select}>
        <option value="">Tất cả chủ đề</option>
        {topics.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <select value={filters.format} onChange={e => set('format', e.target.value)} className={styles.select}>
        <option value="">Tất cả định dạng</option>
        {formats.map(f => <option key={f} value={f}>{FORMAT_LABELS[f] ?? f}</option>)}
      </select>

      <select value={filters.hasReward} onChange={e => set('hasReward', e.target.value)} className={styles.select}>
        <option value="">Tất cả bài</option>
        <option value="no">Chỉ organic</option>
        <option value="yes">Chỉ có thưởng</option>
      </select>

      <div className={styles.sortWrap}>
        <ArrowUpDown size={13} className={styles.sortIcon} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={styles.select}>
          <option value="er_user">Sắp xếp: ER</option>
          <option value="ctr_user">Sắp xếp: CTR</option>
          <option value="view_users">Sắp xếp: Views</option>
          <option value="date">Sắp xếp: Ngày</option>
        </select>
      </div>
    </div>
  )
}
