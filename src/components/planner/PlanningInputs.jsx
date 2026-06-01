import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './PlanningInputs.module.css'

export default function PlanningInputs() {
  const { plannerInputs, setPlannerInputs } = useApp()
  const set = (val) => setPlannerInputs(p => ({ ...p, numPosts: Math.max(1, Math.min(24, Number(val) || 1)) }))

  return (
    <div className={styles.numPostsRow}>
      <label className={styles.numPostsLabel}>Số bài đăng trong tuần</label>
      <div className={styles.numPostsControl}>
        <button className={styles.numBtn} onClick={() => set(plannerInputs.numPosts - 1)}>−</button>
        <input
          type="number" min={3} max={14}
          value={plannerInputs.numPosts}
          onChange={e => set(e.target.value)}
          className={styles.numInput}
        />
        <button className={styles.numBtn} onClick={() => set(plannerInputs.numPosts + 1)}>+</button>
      </div>
      <span className={styles.numPostsHint}>bài · tối thiểu 1, tối đa 24</span>
    </div>
  )
}
