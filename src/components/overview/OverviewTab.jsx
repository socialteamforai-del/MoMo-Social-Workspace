import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import DataWarnings from './DataWarnings.jsx'
import KPICards from './KPICards.jsx'
import TopicBreakdown from './TopicBreakdown.jsx'
import FormatPerformance from './FormatPerformance.jsx'
import TimingHeatmap from './TimingHeatmap.jsx'
import TopPosts from './TopPosts.jsx'
import styles from './OverviewTab.module.css'

export default function OverviewTab() {
  const { loading, data } = useApp()

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Đang tải dữ liệu…</span>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Social Performance</h1>
        <span className={styles.postCount}>{data.posts.length} bài đang phân tích</span>
      </div>

      <DataWarnings />
      <KPICards />

      <div className={styles.row2}>
        <TopicBreakdown />
        <FormatPerformance />
      </div>

      <TimingHeatmap />
      <TopPosts />
    </div>
  )
}
