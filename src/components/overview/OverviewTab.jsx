import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Database } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import DataSourceSelector from './DataSourceSelector.jsx'
import DataWarnings from './DataWarnings.jsx'
import KPICards from './KPICards.jsx'
import TopicBreakdown from './TopicBreakdown.jsx'
import FormatPerformance from './FormatPerformance.jsx'
import TimingHeatmap from './TimingHeatmap.jsx'
import TopPosts from './TopPosts.jsx'
import MomoDataTab from '../momodata/MomoDataTab.jsx'
import styles from './OverviewTab.module.css'

export default function OverviewTab() {
  const { loading, data } = useApp()
  const [dataOpen, setDataOpen] = useState(false)

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
        <h1 className={styles.pageTitle}>Overview</h1>
        <span className={styles.postCount}>{data.posts.length} bài đang phân tích</span>
      </div>

      {/* ── Collapsible data input section ── */}
      <div className={styles.dataSection}>
        <button
          className={styles.dataSectionToggle}
          onClick={() => setDataOpen(v => !v)}
        >
          <Database size={14} />
          <span>Dữ liệu đầu vào</span>
          {dataOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {!dataOpen && (
            <span className={styles.dataSectionHint}>
              {data.posts.length} bài · click để mở rộng
            </span>
          )}
        </button>

        {dataOpen && (
          <div className={styles.dataSectionBody}>
            <DataSourceSelector />
            <div className={styles.dataDivider} />
            <MomoDataTab />
          </div>
        )}
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
