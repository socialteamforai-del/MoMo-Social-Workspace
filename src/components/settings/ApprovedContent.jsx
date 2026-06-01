import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, BookmarkCheck, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './ApprovedContent.module.css'

const FORMAT_VI = {
  poll: 'Poll', educational_post: 'Bài giáo dục', market_update: 'Cập nhật thị trường',
  qa: 'Hỏi & Đáp', service_faq: 'FAQ dịch vụ', minigame: 'Minigame',
  confession_discussion: 'Thảo luận', promo_info: 'Thông tin ưu đãi',
}

const SOURCE_LABELS = {
  generated_kept:   'Lưu nguyên bản',
  generated_edited: 'Chỉnh sửa & lưu',
}

export default function ApprovedContent() {
  const { pageConfig } = useApp()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [filter, setFilter]     = useState({ format: '', topic: '' })
  const [expanded, setExpanded] = useState({})

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/approved-content/${pageConfig.page_id}`)
      const json = await res.json()
      setItems(json.items ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [pageConfig.page_id])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/approved-content/${pageConfig.page_id}/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  // Unique filter options from current items
  const formats = [...new Set(items.map(i => i.content_format).filter(Boolean))]
  const topics  = [...new Set(items.map(i => i.topic_group).filter(Boolean))]

  const filtered = items.filter(item => {
    if (filter.format && item.content_format !== filter.format) return false
    if (filter.topic  && item.topic_group    !== filter.topic)  return false
    return true
  })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Caption đã duyệt — {pageConfig.page_name}</h2>
          <p className={styles.meta}>
            {items.length} caption · Được dùng để học style khi sinh nội dung mới
          </p>
        </div>
        <button
          className={`btn btn-ghost btn-sm ${loading ? styles.spinning : ''}`}
          onClick={fetchItems}
          disabled={loading}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {items.length > 0 && (
        <div className={styles.filters}>
          <select
            value={filter.format}
            onChange={e => setFilter(f => ({ ...f, format: e.target.value }))}
            className={styles.filterSelect}
          >
            <option value="">Tất cả format</option>
            {formats.map(f => <option key={f} value={f}>{FORMAT_VI[f] ?? f}</option>)}
          </select>
          <select
            value={filter.topic}
            onChange={e => setFilter(f => ({ ...f, topic: e.target.value }))}
            className={styles.filterSelect}
          >
            <option value="">Tất cả chủ đề</option>
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(filter.format || filter.topic) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilter({ format: '', topic: '' })}>
              Xóa bộ lọc
            </button>
          )}
          <span className={styles.count}>{filtered.length} / {items.length}</span>
        </div>
      )}

      {loading && <p className={styles.loading}>Đang tải…</p>}

      {!loading && items.length === 0 && !error && (
        <div className={styles.emptyState}>
          <BookmarkCheck size={32} style={{ color: 'var(--gray-300)', marginBottom: 8 }} />
          <p>Chưa có caption nào được lưu.</p>
          <p>Sau khi AI sinh caption, nhấn <strong>Lưu nguyên bản</strong> hoặc <strong>Chỉnh sửa &amp; Lưu</strong> trong Slot Detail.</p>
        </div>
      )}

      <div className={styles.list}>
        {filtered.map(item => (
          <div key={item.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardMeta}>
                {item.content_format && (
                  <span className="badge badge-blue">{FORMAT_VI[item.content_format] ?? item.content_format}</span>
                )}
                {item.topic_group && (
                  <span className={styles.topic}>{item.topic_group}</span>
                )}
                <span className={styles.sourceTag}>{SOURCE_LABELS[item.source] ?? item.source}</span>
              </div>
              <div className={styles.cardActions}>
                <span className={styles.date}>
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                  {item.slot_date && ` · đăng ${item.slot_date}`}
                </span>
                <button
                  className={`btn btn-ghost btn-sm ${styles.deleteBtn}`}
                  onClick={() => handleDelete(item.id)}
                  title="Xóa khỏi knowledge base"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div
              className={`${styles.caption} ${expanded[item.id] ? styles.expanded : ''}`}
              onClick={() => toggle(item.id)}
            >
              {item.caption}
            </div>
            {!expanded[item.id] && item.caption.length > 200 && (
              <button className={styles.showMore} onClick={() => toggle(item.id)}>
                Xem đầy đủ
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
