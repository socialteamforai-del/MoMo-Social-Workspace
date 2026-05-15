import React, { useState, useRef, useEffect } from 'react'
import { Bell, ChevronDown, Settings, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { PAGE_CONFIGS } from '../../config/pages.js'
import SettingsTab from '../settings/SettingsTab.jsx'
import styles from './Topbar.module.css'

export default function Topbar() {
  const { selectedPageId, setSelectedPageId, dataWarnings } = useApp()
  const pages = Object.values(PAGE_CONFIGS)
  const [showSettings, setShowSettings] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowSettings(false)
    }
    if (showSettings) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings])

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <span className={styles.logoMomo}>MoMo</span>
          <span className={styles.logoSub}>Social Workspace</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.pageSelector}>
          <select
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            className={styles.pageSelect}
          >
            {pages.map((p) => (
              <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
            ))}
          </select>
          <ChevronDown size={14} className={styles.chevron} />
        </div>
      </div>

      <div className={styles.right}>
        {dataWarnings.length > 0 && (
          <button className={styles.alertBtn} title={`${dataWarnings.length} cảnh báo dữ liệu`}>
            <Bell size={16} />
            <span className={styles.badge}>{dataWarnings.length}</span>
          </button>
        )}

        <button
          className={`${styles.iconBtn} ${showSettings ? styles.iconBtnActive : ''}`}
          onClick={() => setShowSettings(v => !v)}
          title="Settings"
        >
          <Settings size={16} />
        </button>

        <div className={styles.avatar}>SM</div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className={styles.settingsOverlay}>
          <div className={styles.settingsPanel} ref={panelRef}>
            <div className={styles.settingsPanelHeader}>
              <span>Settings</span>
              <button className={styles.settingsClose} onClick={() => setShowSettings(false)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.settingsPanelBody}>
              <SettingsTab />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
