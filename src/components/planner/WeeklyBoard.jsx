import React from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Plus, Zap, Calendar } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { generateWeeklyCalendar, injectTrendPost, getWeekStart, formatDate } from '../../utils/calendarGen.js'
import SlotCard from './SlotCard.jsx'
import styles from './WeeklyBoard.module.css'

const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAYS_VI = { Monday:'T2', Tuesday:'T3', Wednesday:'T4', Thursday:'T5', Friday:'T6', Saturday:'T7', Sunday:'CN' }
const HOURS   = [8, 11, 14, 17, 20]

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function weekLabel(weekStart) {
  const end = addDays(weekStart, 6)
  const fmt  = d => `${d.getDate()}/${d.getMonth() + 1}`
  return `${fmt(weekStart)} – ${fmt(end)}/${end.getFullYear()}`
}

export default function WeeklyBoard({ onSelectSlot }) {
  const {
    selectedWeek, setSelectedWeek,
    weeklySlots, setWeeklySlots,
    pageConfig, data, plannerInputs,
  } = useApp()

  const prevWeek = () => setSelectedWeek(d => addDays(d, -7))
  const nextWeek = () => setSelectedWeek(d => addDays(d, 7))
  const toToday  = () => setSelectedWeek(getWeekStart(new Date()))

  const buInputsArr = plannerInputs.buInputs?.event_name ? [plannerInputs.buInputs] : []

  const generate = () => {
    const slots = generateWeeklyCalendar(pageConfig, {
      weekStart: selectedWeek,
      numPosts: plannerInputs.numPosts,
      mode: plannerInputs.mode,
      buInputs: buInputsArr,
    }, { posts: data.posts, timingBenchmarks: data.timingBenchmarks, trends: data.marketTrends })
    setWeeklySlots(slots)
  }

  const refreshFlexible = () => {
    setWeeklySlots(prev => {
      const fixed = prev.filter(s => s.slot_type === 'fixed')
      const fresh = generateWeeklyCalendar(pageConfig, {
        weekStart: selectedWeek, numPosts: plannerInputs.numPosts, mode: plannerInputs.mode, buInputs: [],
      }, { posts: data.posts, timingBenchmarks: data.timingBenchmarks, trends: data.marketTrends })
        .filter(s => s.slot_type !== 'fixed')
      return [...fixed, ...fresh].sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  const injectTrend = () => {
    const trend = data.marketTrends.find(t => t.status === 'active')
    if (!trend || !weeklySlots.length) return
    setWeeklySlots(prev => injectTrendPost(prev, trend, pageConfig))
  }

  // Build lookup: day+hour → slots[]
  const slotMap = {}
  for (const slot of weeklySlots) {
    const h = HOURS.reduce((prev, h) => Math.abs(h - slot.publish_hour) < Math.abs(prev - slot.publish_hour) ? h : prev)
    const key = `${slot.day_of_week}-${h}`
    if (!slotMap[key]) slotMap[key] = []
    slotMap[key].push(slot)
  }

  // Build day dates for header
  const dayDates = {}
  DAYS.forEach((day, i) => {
    const d = addDays(selectedWeek, i)
    dayDates[day] = { date: formatDate(d), day: d.getDate(), month: d.getMonth() + 1 }
  })

  return (
    <div className={`${styles.wrap} card`}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.weekNav}>
          <button className="btn btn-ghost btn-sm" onClick={prevWeek}><ChevronLeft size={15} /></button>
          <span className={styles.weekLabel}>{weekLabel(selectedWeek)}</span>
          <button className="btn btn-ghost btn-sm" onClick={nextWeek}><ChevronRight size={15} /></button>
          <button className="btn btn-ghost btn-sm" onClick={toToday}>Hôm nay</button>
        </div>

        <div className={styles.actions}>
          <button className="btn btn-primary btn-sm" onClick={generate}>
            <Calendar size={14} /> Tạo lịch tuần
          </button>
          <button className="btn btn-outline btn-sm" onClick={refreshFlexible} disabled={!weeklySlots.length}>
            <RefreshCw size={14} /> Làm mới flexible
          </button>
          <button className="btn btn-outline btn-sm" onClick={injectTrend} disabled={!weeklySlots.length}>
            <Zap size={14} /> Chèn trend
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onSelectSlot({ isNew: true })}>
            <Plus size={14} /> Tạo mới
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className={styles.gridWrapper}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.cornerCell} />
              {DAYS.map(day => (
                <th key={day} className={styles.dayHead}>
                  <span className={styles.dayName}>{DAYS_VI[day]}</span>
                  <span className={styles.dayDate}>{dayDates[day].day}/{dayDates[day].month}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td className={styles.hourCell}>{hour}:00</td>
                {DAYS.map(day => {
                  const key    = `${day}-${hour}`
                  const slots  = slotMap[key] || []
                  const isGen  = weeklySlots.length > 0

                  return (
                    <td key={day} className={styles.slotCell}>
                      {slots.map(slot => (
                        <SlotCard key={slot.id} slot={slot} onClick={() => onSelectSlot(slot)} />
                      ))}
                      {slots.length === 0 && (
                        <button
                          className={styles.addBtn}
                          onClick={() => onSelectSlot({ isNew: true, prefill: { day_of_week: day, publish_hour: hour, date: dayDates[day].date } })}
                        >
                          <Plus size={11} /> Thêm
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {weeklySlots.length === 0 && (
        <div className={styles.empty}>
          Chưa có lịch. Nhấn <strong>"Tạo lịch tuần"</strong> để bắt đầu.
        </div>
      )}
    </div>
  )
}
