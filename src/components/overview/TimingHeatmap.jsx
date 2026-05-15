import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './TimingHeatmap.module.css'

const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAYS_VI = { Monday:'T2', Tuesday:'T3', Wednesday:'T4', Thursday:'T5', Friday:'T6', Saturday:'T7' }
const HOURS   = [6, 9, 12, 15, 18]

export default function TimingHeatmap() {
  const { data } = useApp()
  const { posts } = data
  const [tooltip, setTooltip] = useState(null)

  const erSum   = {}
  const counts  = {}

  for (const p of posts) {
    // Snap to nearest display hour
    const snapped = HOURS.reduce((prev, h) => Math.abs(h - p.created_hour) < Math.abs(prev - p.created_hour) ? h : prev)
    if (Math.abs(snapped - p.created_hour) > 2) continue  // too far from display hour, skip
    const d = p.day_of_week
    if (!DAYS.includes(d)) continue
    const key = `${d}-${snapped}`
    erSum[key]  = (erSum[key]  || 0) + p.er_user
    counts[key] = (counts[key] || 0) + 1
  }

  const avgGrid = {}
  for (const key of Object.keys(erSum)) {
    avgGrid[key] = erSum[key] / counts[key]
  }

  const vals = Object.values(avgGrid).filter(v => counts[Object.keys(avgGrid)[Object.values(avgGrid).indexOf(v)]] >= 3)
  const maxVal = vals.length ? Math.max(...vals) : 1
  const minVal = vals.length ? Math.min(...vals) : 0

  const intensity = (val, cnt) => {
    if (!val || cnt < 3) return 0
    return (val - minVal) / (maxVal - minVal || 1)
  }

  const cellBg = (val, cnt) => {
    if (!val || cnt < 3) return 'var(--gray-100)'
    const t = intensity(val, cnt)
    if (t > 0.75) return 'var(--momo-pink)'
    if (t > 0.50) return 'var(--pink-300)'
    if (t > 0.25) return 'var(--pink-200)'
    return 'var(--pink-100)'
  }

  const cellText = (val, cnt) => {
    if (!val || cnt < 3) return 'var(--gray-300)'
    return intensity(val, cnt) > 0.6 ? 'white' : 'var(--gray-700)'
  }

  // Auto-summary: find best cell with >=3 posts
  let best = null
  for (const [key, er] of Object.entries(avgGrid)) {
    const cnt = counts[key] || 0
    if (cnt >= 3 && (!best || er > best.er)) {
      const [day, hour] = key.split('-')
      best = { day, hour: Number(hour), er, cnt, day_vi: DAYS_VI[day] }
    }
  }

  return (
    <div className={`${styles.card} card`}>
      <div className="section-banner section-banner-pink">
        <span>🕐 Thời điểm đăng bài — ER trung bình</span>
      </div>
      <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.hourHead} />
              {DAYS.map(d => (
                <th key={d} className={styles.dayHead}>{DAYS_VI[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(h => (
              <tr key={h}>
                <td className={styles.hourLabel}>{h}:00</td>
                {DAYS.map(d => {
                  const key = `${d}-${h}`
                  const val = avgGrid[key]
                  const cnt = counts[key] || 0
                  const tooFew = cnt < 3
                  const tipText = tooFew
                    ? `${d} ${h}:00 — Chưa đủ dữ liệu (${cnt} bài)`
                    : `ER trung bình: ${(val * 100).toFixed(1)}% | ${cnt} bài`

                  return (
                    <td key={d} className={styles.cellWrap}>
                      <div
                        className={styles.cell}
                        style={{
                          background: cellBg(val, cnt),
                          color: cellText(val, cnt),
                        }}
                        onMouseEnter={e => setTooltip({ text: tipText, x: e.clientX, y: e.clientY })}
                        onMouseMove={e  => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ top: tooltip.y + 14, left: tooltip.x + 10 }}
        >
          {tooltip.text}
        </div>
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem} style={{ background: 'var(--gray-100)' }} /> Chưa đủ dữ liệu
        <span className={styles.legendItem} style={{ background: 'var(--pink-100)' }} /> Thấp
        <span className={styles.legendItem} style={{ background: 'var(--pink-200)' }} />
        <span className={styles.legendItem} style={{ background: 'var(--pink-300)' }} />
        <span className={styles.legendItem} style={{ background: 'var(--momo-pink)' }} /> Cao nhất
      </div>

      {best && (
        <div className={styles.summary}>
          📌 Khung giờ hiệu quả nhất: <strong>{best.hour}:00 {best.day_vi}</strong>
          {' '}— ER trung bình <strong>{(best.er * 100).toFixed(1)}%</strong> ({best.cnt} bài)
        </div>
      )}
      </div>
    </div>
  )
}
