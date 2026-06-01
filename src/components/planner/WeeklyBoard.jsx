import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
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

export default function WeeklyBoard({ onSelectSlot, onGenerate }) {
  const {
    selectedWeek, setSelectedWeek,
    weeklySlots, setWeeklySlots,
    pageConfig, data, plannerInputs,
    plannerSubmitted, submittedInputs,
  } = useApp()

  const [draggingId, setDraggingId]   = useState(null)
  const [dragOverKey, setDragOverKey] = useState(null)

  const handleCardClick = (slot) => {
    if (draggingId) return
    onSelectSlot(slot)
  }

  const prevWeek = () => setSelectedWeek(d => addDays(d, -7))
  const nextWeek = () => setSelectedWeek(d => addDays(d, 7))
  const toToday  = () => setSelectedWeek(getWeekStart(new Date()))

  // Map confirmed events from submittedInputs to calendarGen buInputs format
  const buInputsArr = (submittedInputs?.events ?? [])
    .filter(e => e.name?.trim() || e.date)
    .map(e => ({
      event_name:        e.name?.trim() || '',
      must_publish_date: e.date || null,
      cta:               e.cta        || '',
      mechanic:          e.mechanic   || '',
      reward:            e.reward     || '',
      keyMessage:        e.keyMessage || '',
      stats:             e.stats      || '',
    }))

  // Merge helper: add generated slots only where no existing slot occupies the same date+hour.
  // Always preserve existing slots (past, saved, draft with content, scheduled, locked).
  const mergeSlots = (existing, generated) => {
    const occupiedKeys = new Set(existing.map(s => `${s.date}|${s.publish_hour}`))
    const toAdd = generated.filter(s =>
      s.date >= todayStr &&                          // only future/today
      !occupiedKeys.has(`${s.date}|${s.publish_hour}`) // don't overwrite existing
    )
    return [...existing, ...toAdd].sort((a, b) =>
      a.date.localeCompare(b.date) || a.publish_hour - b.publish_hour
    )
  }

  const generate = () => {
    if (!plannerSubmitted) return
    const generated = generateWeeklyCalendar(pageConfig, {
      weekStart: selectedWeek,
      numPosts: plannerInputs.numPosts,
      mode: plannerInputs.mode,
      buInputs: buInputsArr,
    }, { posts: data.posts, timingBenchmarks: data.timingBenchmarks, trends: data.marketTrends })
    setWeeklySlots(prev => mergeSlots(prev, generated))
  }

  const refreshFlexible = () => {
    setWeeklySlots(prev => {
      const keep = prev.filter(s => s.locked || s.slot_type === 'fixed' || s.status !== 'draft' || s.caption?.trim())
      const fresh = generateWeeklyCalendar(pageConfig, {
        weekStart: selectedWeek, numPosts: plannerInputs.numPosts, mode: plannerInputs.mode, buInputs: [],
      }, { posts: data.posts, timingBenchmarks: data.timingBenchmarks, trends: data.marketTrends })
        .filter(s => s.slot_type !== 'fixed')
      return mergeSlots(keep, fresh)
    })
  }

  const injectTrend = () => {
    const trend = data.marketTrends.find(t => t.status === 'active')
    if (!trend || !weeklySlots.length) return
    setWeeklySlots(prev => injectTrendPost(prev, trend, pageConfig))
  }

  // Drag handlers
  const handleDrop = (day, hour) => {
    if (!draggingId) return
    const draggedSlot = weeklySlots.find(s => s.id === draggingId)
    if (draggedSlot?.locked) { setDraggingId(null); setDragOverKey(null); return }
    setWeeklySlots(prev => prev.map(s =>
      s.id === draggingId
        ? { ...s, day_of_week: day, publish_hour: hour, date: dayDates[day].date }
        : s
    ))
    setDraggingId(null)
    setDragOverKey(null)
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
  const todayStr = formatDate(new Date())
  const dayDates = {}
  DAYS.forEach((day, i) => {
    const d = addDays(selectedWeek, i)
    const dateStr = formatDate(d)
    dayDates[day] = {
      date:    dateStr,
      day:     d.getDate(),
      month:   d.getMonth() + 1,
      isToday: dateStr === todayStr,
      isPast:  dateStr < todayStr,
    }
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
<button className="btn btn-ghost btn-sm" onClick={() => {
              const firstFuture = DAYS.find(d => !dayDates[d].isPast) || DAYS[0]
              onSelectSlot({ isNew: true, prefill: { day_of_week: firstFuture, date: dayDates[firstFuture].date, publish_hour: 12 } })
            }}>
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
              {DAYS.map(day => {
                const { day: d, month: m, isToday, isPast } = dayDates[day]
                return (
                  <th key={day} className={`${styles.dayHead} ${isToday ? styles.dayHeadToday : ''} ${isPast ? styles.dayHeadPast : ''}`}>
                    <span className={styles.dayName}>{DAYS_VI[day]}</span>
                    <span className={`${styles.dayDate} ${isToday ? styles.dayDateToday : ''}`}>{d}/{m}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td className={styles.hourCell}>{hour}:00</td>
                {DAYS.map(day => {
                  const key    = `${day}-${hour}`
                  const slots  = slotMap[key] || []
                  const isOver = dragOverKey === key
                  const isPast = dayDates[day].isPast

                  return (
                    <td
                      key={day}
                      className={`${styles.slotCell} ${isOver ? styles.slotCellOver : ''} ${isPast && slots.length === 0 ? styles.slotCellPast : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOverKey(key) }}
                      onDragLeave={() => setDragOverKey(null)}
                      onDrop={() => handleDrop(day, hour)}
                    >
                      {slots.map(slot => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          onClick={() => handleCardClick(slot)}
                          dragging={draggingId === slot.id}
                          onDragStart={() => setDraggingId(slot.id)}
                          onDragEnd={() => { setDraggingId(null); setDragOverKey(null) }}
                        />
                      ))}
                      {slots.length === 0 && !isPast && (
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

      {weeklySlots.length === 0 && plannerSubmitted && (
        <div className={styles.empty}>
          Chưa có lịch. Nhấn <strong>"Tạo lịch tuần"</strong> để bắt đầu.
        </div>
      )}
    </div>
  )
}
