import React, { useState } from 'react'
import BenchmarkConfig from './BenchmarkConfig.jsx'
import TaxonomyEditor from './TaxonomyEditor.jsx'
import PageManager from './PageManager.jsx'
import DataUpload from './DataUpload.jsx'
import styles from './SettingsTab.module.css'

const SECTIONS = [
  { id: 'benchmarks', label: 'Ngưỡng benchmark' },
  { id: 'taxonomy',   label: 'Taxonomy' },
  { id: 'pages',      label: 'Quản lý page' },
  { id: 'data',       label: 'Cập nhật dữ liệu' },
]

export default function SettingsTab() {
  const [active, setActive] = useState('benchmarks')

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.layout}>
        <nav className={styles.nav}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`${styles.navItem} ${active === s.id ? styles.active : ''}`}
              onClick={() => setActive(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {active === 'benchmarks' && <BenchmarkConfig />}
          {active === 'taxonomy'   && <TaxonomyEditor />}
          {active === 'pages'      && <PageManager />}
          {active === 'data'       && <DataUpload />}
        </div>
      </div>
    </div>
  )
}
