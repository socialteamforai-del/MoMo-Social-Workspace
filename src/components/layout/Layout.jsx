import React from 'react'
import Topbar from './Topbar.jsx'
import Sidebar from './Sidebar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import OverviewTab from '../overview/OverviewTab.jsx'
import LibraryTab from '../library/LibraryTab.jsx'
import PlannerTab from '../planner/PlannerTab.jsx'
import styles from './Layout.module.css'

function TabContent() {
  const { activeTab } = useApp()
  switch (activeTab) {
    case 'overview': return <OverviewTab />
    case 'planner':  return <PlannerTab />
    case 'library':  return <LibraryTab />
    default:         return <OverviewTab />
  }
}

export default function Layout() {
  return (
    <div className={styles.root}>
      <Topbar />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <TabContent />
        </main>
      </div>
    </div>
  )
}
