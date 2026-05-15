import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './TopicBreakdown.module.css'

export default function TopicBreakdown() {
  const { data, pageConfig } = useApp()
  const { posts } = data
  const { benchmarks } = pageConfig

  const counts = {}
  const erSums = {}
  for (const p of posts) {
    counts[p.topic_group] = (counts[p.topic_group] || 0) + 1
    erSums[p.topic_group] = (erSums[p.topic_group] || 0) + p.er_user
  }

  const topics = Object.entries(counts)
    .map(([topic, count]) => ({
      topic,
      count,
      avgER: erSums[topic] / count,
    }))
    .sort((a, b) => b.count - a.count)

  const maxCount = topics[0]?.count || 1

  const erColor = (er) => {
    if (er >= benchmarks.er_good)    return 'var(--green)'
    if (er >= benchmarks.er_average) return 'var(--yellow)'
    return 'var(--red)'
  }

  const shortTopic = (s) => s.length > 28 ? s.slice(0, 26) + '…' : s

  return (
    <div className={`${styles.card} card`}>
      <div className="section-banner section-banner-pink">
        <span>📊 Phân bổ chủ đề</span>
        <span style={{ marginLeft: 'auto', fontWeight: 400, opacity: 0.8, fontSize: 11 }}>{topics.length} chủ đề</span>
      </div>
      <div className={styles.inner}>
      <div className={styles.list}>
        {topics.map(({ topic, count, avgER }) => (
          <div key={topic} className={styles.row}>
            <div className={styles.topicName} title={topic}>{shortTopic(topic)}</div>
            <div className={styles.barWrap}>
              <div
                className={styles.bar}
                style={{ width: `${(count / maxCount) * 100}%`, background: erColor(avgER) }}
              />
            </div>
            <div className={styles.meta}>
              <span className={styles.count}>{count} bài</span>
              <span className={styles.er} style={{ color: erColor(avgER) }}>
                ER {(avgER * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        Màu thanh: <span style={{ color: 'var(--green)' }}>■</span> Tốt &nbsp;
        <span style={{ color: 'var(--yellow)' }}>■</span> Trung bình &nbsp;
        <span style={{ color: 'var(--red)' }}>■</span> Cần cải thiện
      </p>
      </div>
    </div>
  )
}
