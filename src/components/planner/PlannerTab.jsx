import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import PlanningInputs from './PlanningInputs.jsx'
import SignalSummary from './SignalSummary.jsx'
import WeeklyBoard from './WeeklyBoard.jsx'
import SlotDetailDrawer from './SlotDetailDrawer.jsx'
import PostListPanel from './PostListPanel.jsx'
import styles from './PlannerTab.module.css'

export default function PlannerTab() {
  const { weeklySlots } = useApp()
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [showInputs, setShowInputs] = useState(true)

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Planner</h1>
        <button
          className={`btn btn-sm`}
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1.5px solid rgba(255,255,255,0.3)' }}
          onClick={() => setShowInputs(s => !s)}
        >
          {showInputs ? 'Ẩn cài đặt' : 'Cài đặt tuần'}
        </button>
      </div>

      {showInputs && <PlanningInputs />}

      <SignalSummary />

      <WeeklyBoard onSelectSlot={setSelectedSlot} />

      <PostListPanel onSelectSlot={setSelectedSlot} />

      {selectedSlot && (
        <SlotDetailDrawer
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </div>
  )
}
