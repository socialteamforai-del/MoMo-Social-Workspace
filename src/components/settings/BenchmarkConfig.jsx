import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './Settings.module.css'

export default function BenchmarkConfig() {
  const { pageConfig } = useApp()
  const [vals, setVals] = useState({ ...pageConfig.benchmarks })
  const [saved, setSaved] = useState(false)

  const set = (key, val) => {
    setVals(v => ({ ...v, [key]: parseFloat(val) || 0 }))
    setSaved(false)
  }

  const save = () => {
    // In production: persist to context/storage. Here just show confirmation.
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const FIELDS = [
    { key: 'er_good',    label: 'ER tốt (≥)',       hint: 'Ngưỡng ER được coi là tốt' },
    { key: 'er_average', label: 'ER trung bình (≥)', hint: 'Ngưỡng ER trung bình' },
    { key: 'er_poor',    label: 'ER kém (<)',        hint: 'Dưới ngưỡng này là kém' },
    { key: 'ctr_good',   label: 'CTR tốt (≥)',      hint: 'Ngưỡng CTR tốt' },
    { key: 'ctr_average',label: 'CTR trung bình (≥)',hint: 'Ngưỡng CTR trung bình' },
  ]

  return (
    <div className={`${styles.card} card`}>
      <h3 className={styles.sectionTitle}>Ngưỡng benchmark</h3>
      <p className={styles.hint}>Các ngưỡng này ảnh hưởng đến màu sắc KPI cards và classification bài viết.</p>

      <div className={styles.fieldList}>
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className={styles.field}>
            <div className={styles.fieldMeta}>
              <label className={styles.label}>{label}</label>
              <span className={styles.fieldHint}>{hint}</span>
            </div>
            <div className={styles.inputWrap}>
              <input
                type="number"
                step="0.01" min="0" max="1"
                value={vals[key]}
                onChange={e => set(key, e.target.value)}
                className={styles.numInput}
              />
              <span className={styles.pct}>{(vals[key] * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <button className="btn btn-primary btn-sm" onClick={save}>
          {saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
        </button>
        <span className={styles.note}>Lưu ý: thay đổi chỉ có hiệu lực trong phiên hiện tại.</span>
      </div>
    </div>
  )
}
