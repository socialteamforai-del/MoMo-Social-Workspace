import React, { useState, useRef, useEffect } from 'react'
import { Bell, Settings, X, LogOut, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import SettingsTab from '../settings/SettingsTab.jsx'
import styles from './Topbar.module.css'

const PAGE_COLORS = {
  mama_tai_chinh: '#A50064',
  heo_dat_momo:   '#E85D04',
}

export default function Topbar() {
  const { dataWarnings, pageConfig } = useApp()
  const { currentUser, activePageId, allowedPages, selectPage, logout } = useAuth()
  const [showSettings, setShowSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const panelRef   = useRef(null)
  const userMenuRef = useRef(null)

  const pageColor = PAGE_COLORS[activePageId] ?? 'var(--momo-pink)'
  const initials  = currentUser?.display_name?.split(' ').map(w => w[0]).slice(-2).join('') ?? 'U'

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current    && !panelRef.current.contains(e.target))    setShowSettings(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <span className={styles.logoMomo}>MoMo</span>
          <span className={styles.logoSub}>Social Content Planner</span>
        </div>

        <div className={styles.divider} />

        {/* Page badge */}
        <div className={styles.pageBadge}>
          <span className={styles.pageAvatarDot} style={{ background: pageColor }} />
          <span className={styles.pageLabel}>{pageConfig.page_name}</span>
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

        {/* Avatar + user menu */}
        <div className={styles.avatarWrap} ref={userMenuRef}>
          <button
            className={styles.avatar}
            style={{ background: pageColor }}
            onClick={() => setShowUserMenu(v => !v)}
            title={currentUser?.display_name}
          >
            {initials}
          </button>

          {showUserMenu && (
            <div className={styles.userMenu}>
              <div className={styles.userMenuHeader}>
                <span className={styles.userName}>{currentUser?.display_name}</span>
                <span className={styles.userEmail}>{currentUser?.email}</span>
              </div>

              {/* Switch page (only if user has multiple pages) */}
              {allowedPages.length > 1 && (
                <div className={styles.userMenuSection}>
                  <span className={styles.userMenuSectionLabel}>Chuyển page</span>
                  {allowedPages.map(pg => (
                    <button
                      key={pg.page_id}
                      className={`${styles.pageSwitch} ${pg.page_id === activePageId ? styles.pageSwitchActive : ''}`}
                      onClick={() => { selectPage(pg.page_id); setShowUserMenu(false) }}
                      style={pg.page_id === activePageId ? { color: PAGE_COLORS[pg.page_id] ?? 'var(--momo-pink)' } : undefined}
                    >
                      <span
                        className={styles.pageSwitchDot}
                        style={{ background: PAGE_COLORS[pg.page_id] ?? '#888' }}
                      />
                      {pg.page_name}
                      {pg.page_id === activePageId && <span className={styles.activeCheck}>✓</span>}
                    </button>
                  ))}
                </div>
              )}

              <button className={styles.logoutBtn} onClick={logout}>
                <LogOut size={13} /> Đăng xuất
              </button>
            </div>
          )}
        </div>
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
