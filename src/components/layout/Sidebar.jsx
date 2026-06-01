import React from 'react'
import { BarChart2, Calendar, BookOpen } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { id: 'planner',  label: 'Content Planner', icon: Calendar  },
  { id: 'overview', label: 'Performance', icon: BarChart2  },
  { id: 'library',  label: 'Library',     icon: BookOpen  },
]

export default function Sidebar() {
  const { activeTab, setActiveTab } = useApp()

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.navItem} ${activeTab === id ? styles.active : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={18} className={styles.icon} />
            <span className={styles.label}>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
