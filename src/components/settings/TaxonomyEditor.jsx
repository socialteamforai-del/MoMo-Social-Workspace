import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './Settings.module.css'

export default function TaxonomyEditor() {
  const { pageConfig } = useApp()

  return (
    <div className={`${styles.card} card`}>
      <h3 className={styles.sectionTitle}>Taxonomy — {pageConfig.page_name}</h3>
      <p className={styles.hint}>Danh sách chủ đề, định dạng và mục tiêu đang cấu hình cho page này.</p>

      <div className={styles.section}>
        <h4 className={styles.subTitle}>Chủ đề (topic_groups)</h4>
        <div className={styles.tagList}>
          {pageConfig.topic_groups.map(t => (
            <span key={t} className="badge badge-blue">{t}</span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.subTitle}>Định dạng nội dung</h4>
        <div className={styles.tagList}>
          {pageConfig.content_formats.map(f => (
            <span key={f} className="badge badge-pink">{f}</span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.subTitle}>Mục tiêu</h4>
        <div className={styles.tagList}>
          {pageConfig.objectives.map(o => (
            <span key={o} className="badge badge-gray">{o}</span>
          ))}
        </div>
      </div>

      <p className={styles.editNote}>
        Để chỉnh sửa taxonomy, cập nhật trực tiếp trong <code>src/config/pages.js</code>.
      </p>
    </div>
  )
}
