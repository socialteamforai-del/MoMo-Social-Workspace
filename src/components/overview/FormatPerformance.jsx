import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './FormatPerformance.module.css'

const FORMAT_LABELS = {
  poll:                 'Poll / Bình chọn',
  educational_post:     'Bài giáo dục',
  market_update:        'Cập nhật thị trường',
  qa:                   'Hỏi & Đáp',
  service_faq:          'FAQ dịch vụ',
  minigame:             'Minigame',
  confession_discussion:'Thảo luận / Tâm sự',
  promo_info:           'Thông tin ưu đãi',
}

export default function FormatPerformance() {
  const { data, pageConfig } = useApp()
  const { posts } = data
  const { benchmarks } = pageConfig

  const stats = {}
  for (const p of posts) {
    if (!stats[p.content_format]) stats[p.content_format] = { erSum: 0, ctrSum: 0, count: 0 }
    stats[p.content_format].erSum  += p.er_user
    stats[p.content_format].ctrSum += p.ctr_user
    stats[p.content_format].count  += 1
  }

  const rows = Object.entries(stats)
    .map(([fmt, { erSum, ctrSum, count }]) => ({
      fmt,
      label: FORMAT_LABELS[fmt] ?? fmt,
      count,
      avgER:  erSum  / count,
      avgCTR: ctrSum / count,
    }))
    .sort((a, b) => b.avgER - a.avgER)

  const erClass  = (er)  => er  >= benchmarks.er_good    ? styles.good : er  >= benchmarks.er_average ? styles.avg : styles.poor
  const ctrClass = (ctr) => ctr >= benchmarks.ctr_good   ? styles.good : ctr >= benchmarks.ctr_average ? styles.avg : styles.poor

  return (
    <div className={`${styles.card} card`}>
      <div className="section-banner section-banner-pink">
        <span>📋 Hiệu quả theo định dạng</span>
        <span style={{ marginLeft: 'auto', fontWeight: 400, opacity: 0.8, fontSize: 11 }}>{rows.length} định dạng</span>
      </div>
      <div style={{ padding: 'var(--space-4) var(--space-5)', overflowX: 'auto' }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Định dạng</th>
            <th className={styles.right}>Số bài</th>
            <th className={styles.right}>ER trung bình</th>
            <th className={styles.right}>CTR trung bình</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ fmt, label, count, avgER, avgCTR }) => (
            <tr key={fmt}>
              <td>
                <span className="badge badge-blue">{label}</span>
              </td>
              <td className={styles.right}>{count}</td>
              <td className={`${styles.right} ${erClass(avgER)}`}>
                {(avgER * 100).toFixed(2)}%
              </td>
              <td className={`${styles.right} ${ctrClass(avgCTR)}`}>
                {(avgCTR * 100).toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
