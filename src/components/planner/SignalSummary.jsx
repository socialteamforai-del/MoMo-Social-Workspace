import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './SignalSummary.module.css'

export default function SignalSummary() {
  const { data, submittedInputs, plannerInputs, extraTrends, plannerSubmitted } = useApp()
  const { posts, timingBenchmarks } = data
  const [expanded, setExpanded] = useState(false)

  if (!plannerSubmitted || !submittedInputs) return null

  const { events = [] } = submittedInputs
  const filledEvents = events.filter(e => e.name?.trim() || e.date)
  const activeTrendsLive = extraTrends.filter(t => t.status !== 'dead')

  const topicStats = {}
  for (const p of posts) {
    if (!topicStats[p.topic_group]) topicStats[p.topic_group] = { sum: 0, count: 0 }
    topicStats[p.topic_group].sum   += p.er_user
    topicStats[p.topic_group].count += 1
  }
  const topTopics = Object.entries(topicStats)
    .map(([topic, { sum, count }]) => ({ topic, avgER: sum / count, count }))
    .sort((a, b) => b.avgER - a.avgER)
    .slice(0, 3)

  const bestSlot = [...timingBenchmarks].sort((a, b) => b.avg_er - a.avg_er)[0]
  const activeTrends = activeTrendsLive

  return (
    <div className={styles.signalContainer}>
      <button className={styles.signalTrigger} onClick={() => setExpanded(v => !v)}>
        <span className={styles.signalLabel}>Tín hiệu đầu vào</span>
        <div className={styles.signalStats}>
          <span className={styles.signalStat}>{posts.length} bài lịch sử</span>
          {filledEvents.length > 0 && <span className={styles.signalStat}>{filledEvents.length} sự kiện</span>}
          {activeTrends.length > 0 && <span className={styles.signalStat}>{activeTrends.length} xu hướng</span>}
          {topTopics[0] && (
            <span className={styles.signalStatKey}>
              Top: {topTopics[0].topic} · {(topTopics[0].avgER * 100).toFixed(0)}% ER
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp size={13} className={styles.signalChevron} />
          : <ChevronDown size={13} className={styles.signalChevron} />}
      </button>

      {expanded && (
        <div className={styles.signalDetail}>

          <div className={styles.signalSection}>
            <span className={styles.signalSectionLabel}>Lịch sử</span>
            <div className={styles.signalRows}>
              {topTopics.map((t, i) => (
                <div key={t.topic} className={styles.signalRow}>
                  {i === 0 && <span className={styles.signalRank}>1</span>}
                  <span className={styles.signalName}>{t.topic}</span>
                  <span className={styles.signalVal}>{(t.avgER * 100).toFixed(1)}% ER · {t.count} bài</span>
                </div>
              ))}
              {bestSlot && (
                <div className={styles.signalRow}>
                  <span className={styles.signalName}>Giờ tốt nhất</span>
                  <span className={styles.signalVal}>{bestSlot.best_day} {bestSlot.best_hour}:00 — {(bestSlot.avg_er * 100).toFixed(1)}% ER</span>
                </div>
              )}
            </div>
          </div>

          {filledEvents.length > 0 && (
            <div className={styles.signalSection}>
              <span className={styles.signalSectionLabel}>Sự kiện</span>
              <div className={styles.signalRows}>
                {filledEvents.map(e => (
                  <div key={e.id} className={styles.signalRow}>
                    <span className={styles.signalName}>{e.name || '—'}</span>
                    {e.date && <span className={styles.signalVal}>{e.date}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTrends.length > 0 && (
            <div className={styles.signalSection}>
              <span className={styles.signalSectionLabel}>Xu hướng</span>
              <div className={styles.signalRows}>
                {activeTrends.map((t, i) => (
                  <div key={t.id ?? i} className={styles.signalRow}>
                    <span className={styles.signalName}>{t.trend_topic ?? t.name}</span>
                    {(t.recommended_angle ?? t.angle) && (
                      <span className={styles.signalVal}>{t.recommended_angle ?? t.angle}</span>
                    )}
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
