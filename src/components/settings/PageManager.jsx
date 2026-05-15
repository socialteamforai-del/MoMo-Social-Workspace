import React from 'react'
import { PAGE_CONFIGS } from '../../config/pages.js'
import { useApp } from '../../context/AppContext.jsx'
import styles from './Settings.module.css'

export default function PageManager() {
  const { selectedPageId, setSelectedPageId } = useApp()
  const pages = Object.values(PAGE_CONFIGS)

  return (
    <div className={`${styles.card} card`}>
      <h3 className={styles.sectionTitle}>Quản lý Page</h3>
      <p className={styles.hint}>Các Social Feed page đang được cấu hình trong workspace.</p>

      <div className={styles.pageList}>
        {pages.map(p => (
          <div
            key={p.page_id}
            className={`${styles.pageRow} ${selectedPageId === p.page_id ? styles.activeRow : ''}`}
          >
            <div className={styles.pageInfo}>
              <span className={styles.pageName}>{p.page_name}</span>
              <span className={styles.pageId}>{p.page_id}</span>
            </div>
            <div className={styles.pageActions}>
              <span className={`badge badge-${p.status === 'active' ? 'green' : 'gray'}`}>{p.status}</span>
              {selectedPageId !== p.page_id && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setSelectedPageId(p.page_id)}
                >
                  Chọn
                </button>
              )}
              {selectedPageId === p.page_id && (
                <span className="badge badge-pink">Đang chọn</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.addPageHint}>
        <p>Để thêm page mới, thêm config vào <code>src/config/pages.js</code> theo cấu trúc hiện có.</p>
      </div>
    </div>
  )
}
