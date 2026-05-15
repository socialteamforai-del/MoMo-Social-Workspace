import React, { useState } from 'react'
import { TrendingUp, TrendingDown, MousePointerClick, Eye, FileText, Info, Minus } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './KPICards.module.css'

function getStatus(value, good, avg) {
  if (value >= good) return 'good'
  if (value >= avg)  return 'avg'
  return 'poor'
}

const STATUS_LABEL = { good: 'Đạt chuẩn', avg: 'Trung bình', poor: 'Cần cải thiện' }
const STATUS_DOT   = { good: '●', avg: '●', poor: '●' }

function KPICard({ icon: Icon, label, value, formatted, benchmarkVal, benchmarkLabel, status, tooltip, deltaLabel, isRaw }) {
  const [showTip, setShowTip] = useState(false)

  const fillPct = benchmarkVal && !isRaw
    ? Math.min((value / benchmarkVal) * 100, 110)
    : null

  const cappedFill = fillPct ? Math.min(fillPct, 100) : null

  return (
    <div className={`${styles.card} card`}>
      <div className={`${styles.accentBar} ${styles[status]}`} />
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={`${styles.iconCircle} ${styles[status]}`}>
            <Icon size={18} />
          </div>
          <button
            className={styles.infoBtn}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <Info size={13} />
            {showTip && <div className={styles.tooltip}>{tooltip}</div>}
          </button>
        </div>

        <div>
          <div className={styles.valueRow}>
            <div className={styles.value}>{formatted}</div>
            {fillPct !== null && (
              <span className={`${styles.trendChip} ${fillPct >= 100 ? styles.trendUp : fillPct >= 70 ? styles.trendFlat : styles.trendDown}`}>
                {fillPct >= 100 ? <TrendingUp size={10} /> : fillPct < 70 ? <TrendingDown size={10} /> : <Minus size={10} />}
                {fillPct >= 100 ? '+' : ''}{Math.round(fillPct - 100)}%
              </span>
            )}
          </div>
          <div className={styles.label}>{label}</div>
        </div>

        {cappedFill !== null && (
          <div className={styles.benchmarkRow}>
            <div className={styles.benchmarkLabel}>
              <span>vs. benchmark {benchmarkLabel}</span>
              <span>{Math.round(fillPct)}%</span>
            </div>
            <div className={styles.benchmarkBar}>
              <div
                className={`${styles.benchmarkFill} ${styles[status]}`}
                style={{ width: `${cappedFill}%` }}
              />
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <span className={`${styles.statusBadge} ${styles[status]}`}>
            {STATUS_DOT[status]} {STATUS_LABEL[status]}
          </span>
          {deltaLabel && <span className={styles.delta}>{deltaLabel}</span>}
        </div>
      </div>
    </div>
  )
}

export default function KPICards() {
  const { data, pageConfig } = useApp()
  const { posts } = data
  const { benchmarks } = pageConfig

  const organicPosts = posts.filter((p) => !p.has_reward)
  const allPosts     = posts

  // ER tính trên toàn bộ danh sách; organic là thông tin phụ
  const avgER = allPosts.length
    ? allPosts.reduce((s, p) => s + p.er_user, 0) / allPosts.length
    : 0
  const avgERorganic = organicPosts.length
    ? organicPosts.reduce((s, p) => s + p.er_user, 0) / organicPosts.length
    : null
  const avgCTR = allPosts.length
    ? allPosts.reduce((s, p) => s + p.ctr_user, 0) / allPosts.length
    : 0
  const totalViews = allPosts.reduce((s, p) => s + (p.view_users || 0), 0)
  const totalPosts = allPosts.length

  const erStatus  = getStatus(avgER,  benchmarks.er_good,  benchmarks.er_average)
  const ctrStatus = getStatus(avgCTR, benchmarks.ctr_good, benchmarks.ctr_average)

  const fmt    = (n, d = 2) => (n * 100).toFixed(d) + '%'
  const fmtNum = (n) => n >= 1000000
    ? (n / 1000000).toFixed(1) + 'M'
    : n >= 1000 ? (n / 1000).toFixed(1) + 'K'
    : n.toLocaleString('vi-VN')

  return (
    <div>
    <div className={styles.benchmarkNote}>
      Benchmark: ER tốt ≥{(benchmarks.er_good*100).toFixed(0)}% · ER tb ≥{(benchmarks.er_average*100).toFixed(0)}% · CTR tốt ≥{(benchmarks.ctr_good*100).toFixed(0)}%
      {' '}<span className={styles.benchmarkSrc}>(nguồn: Settings → Ngưỡng benchmark · page: {pageConfig.page_name})</span>
    </div>
    <div className={styles.grid}>
      <KPICard
        icon={TrendingUp}
        label="Tỉ lệ tương tác (ER) · Tất cả bài"
        value={avgER}
        formatted={fmt(avgER)}
        benchmarkVal={benchmarks.er_good}
        benchmarkLabel={fmt(benchmarks.er_good, 0)}
        status={erStatus}
        tooltip={`ER: tổng người dùng tương tác / người xem — tính trên toàn bộ ${allPosts.length} bài. Benchmark tốt: ≥${fmt(benchmarks.er_good, 0)}.`}
        deltaLabel={avgERorganic !== null && organicPosts.length < allPosts.length
          ? `Organic (${organicPosts.length} bài): ${fmt(avgERorganic)}`
          : `${allPosts.length} bài`}
      />
      <KPICard
        icon={MousePointerClick}
        label="Tỉ lệ click (CTR)"
        value={avgCTR}
        formatted={fmt(avgCTR)}
        benchmarkVal={benchmarks.ctr_good}
        benchmarkLabel={fmt(benchmarks.ctr_good, 0)}
        status={ctrStatus}
        tooltip={`CTR: số người click / người xem. Benchmark tốt: ≥${fmt(benchmarks.ctr_good, 0)}.`}
        deltaLabel={`Benchmark: ${fmt(benchmarks.ctr_good, 0)}`}
      />
      <KPICard
        icon={FileText}
        label="Tổng bài đã đăng"
        value={totalPosts}
        formatted={fmtNum(totalPosts)}
        status="neutral"
        isRaw
        tooltip="Tổng số bài viết đã đăng trong khoảng dữ liệu hiện tại."
        deltaLabel={organicPosts.length < totalPosts ? `${totalPosts - organicPosts.length} bài có thưởng` : 'Tất cả organic'}
      />
      <KPICard
        icon={Eye}
        label="Tổng lượt xem"
        value={totalViews}
        formatted={fmtNum(totalViews)}
        status="neutral"
        isRaw
        tooltip="Tổng số người dùng duy nhất đã xem bài (view_users). Không tính lượt xem lặp (view_count)."
        deltaLabel={`TB: ${fmtNum(Math.round(totalViews / (totalPosts || 1)))} / bài`}
      />
    </div>
    </div>
  )
}
