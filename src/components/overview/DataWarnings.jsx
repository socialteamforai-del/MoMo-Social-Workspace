import React from 'react'
import { AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './DataWarnings.module.css'

const ICONS = {
  anomaly: AlertTriangle,
  sample:  AlertCircle,
  coverage: Info,
}
const COLORS = {
  anomaly:  'yellow',
  sample:   'red',
  coverage: 'blue',
}

export default function DataWarnings() {
  const { dataWarnings } = useApp()
  if (!dataWarnings.length) return null

  return (
    <div className={styles.container}>
      {dataWarnings.map((w, i) => {
        const Icon = ICONS[w.type] ?? Info
        const color = COLORS[w.type] ?? 'gray'
        return (
          <div key={i} className={`${styles.item} ${styles[color]}`}>
            <Icon size={14} className={styles.icon} />
            <span>{w.message}</span>
          </div>
        )
      })}
    </div>
  )
}
