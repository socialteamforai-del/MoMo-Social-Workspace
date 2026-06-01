import React, { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { PAGE_CONFIGS, DEFAULT_PAGE_ID } from '../config/pages.js'
import { useData } from '../hooks/useData.js'
import { detectDatasetWarnings } from '../utils/scoring.js'
import { getWeekStart } from '../utils/calendarGen.js'

const AppContext = createContext(null)

export function AppProvider({ children, pageId }) {
  const [selectedPageId, setSelectedPageId]   = useState(pageId ?? DEFAULT_PAGE_ID)
  const [activeTab, setActiveTab]             = useState('planner')
  const [selectedWeek, setSelectedWeek]       = useState(() => getWeekStart(new Date()))
  const [weeklySlots, setWeeklySlots]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmtc_weeklySlots') ?? '[]') } catch { return [] }
  })

  // Sync published slots from server on page change
  useEffect(() => {
    if (!pageId) return
    fetch(`/api/slots/${pageId}`)
      .then(r => r.json())
      .then(serverSlots => {
        if (!Array.isArray(serverSlots) || serverSlots.length === 0) return
        setWeeklySlots(prev => {
          const map = new Map(prev.map(s => [s.id, s]))
          serverSlots.forEach(s => {
            const local = map.get(s.id)
            // Server wins for published slots; keep local if not yet published on server
            if (!local || s.status === 'scheduled') map.set(s.id, { ...local, ...s })
          })
          return [...map.values()]
        })
      })
      .catch(() => {})
  }, [pageId])
  const [plannerInputs, setPlannerInputs]     = useState({
    numPosts: 7,
    mode: 'balanced',
    reserveReactive: true,
    buInputs: {},
  })
  const [plannerSubmitted, setPlannerSubmitted] = useState(false)
  const [submittedInputs, setSubmittedInputs]   = useState(null)

  // Data overrides
  const [overridePosts, setOverridePosts]     = useState(null)
  const [contentRows, setContentRows]         = useState(() => {
    try {
      const raw = localStorage.getItem('mmtc_contentRows')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })
  const [contentFileName, setContentFileName] = useState(() => {
    return localStorage.getItem('mmtc_contentFileName') ?? ''
  })
  const [dateFilter, setDateFilter]           = useState('all')  // '30' | '60' | '90' | 'all' | 'custom'
  const [customDateFrom, setCustomDateFrom]   = useState('')
  const [customDateTo, setCustomDateTo]       = useState('')
  const [extraTrends, setExtraTrends]         = useState([])

  useEffect(() => {
    try { localStorage.setItem('mmtc_weeklySlots', JSON.stringify(weeklySlots)) } catch {}
  }, [weeklySlots])

  useEffect(() => {
    try {
      if (contentRows) localStorage.setItem('mmtc_contentRows', JSON.stringify(contentRows))
      else localStorage.removeItem('mmtc_contentRows')
    } catch {}
  }, [contentRows])

  useEffect(() => {
    try { localStorage.setItem('mmtc_contentFileName', contentFileName) } catch {}
  }, [contentFileName])

  const pageConfig = PAGE_CONFIGS[selectedPageId] ?? PAGE_CONFIGS[DEFAULT_PAGE_ID]
  const { data: rawData, loading, errors } = useData(selectedPageId)

  // Apply post overrides + date filter
  const filteredPosts = useMemo(() => {
    const base = overridePosts ?? rawData.posts
    if (dateFilter === 'all') return base
    if (dateFilter === 'custom') {
      return base.filter(p =>
        (!customDateFrom || p.created_date >= customDateFrom) &&
        (!customDateTo   || p.created_date <= customDateTo)
      )
    }
    const days = Number(dateFilter)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return base.filter(p => p.created_date >= cutoffStr)
  }, [overridePosts, rawData.posts, dateFilter, customDateFrom, customDateTo])

  // Merge file trends with user-added extra trends
  const allTrends = useMemo(() => {
    const fileTrends = rawData.marketTrends || []
    // extraTrends (user-added) come first so calendarGen picks them over auto-fetched ones
    return [...extraTrends, ...fileTrends]
  }, [rawData.marketTrends, extraTrends])

  const data = useMemo(() => ({
    ...rawData,
    posts: filteredPosts,
    marketTrends: allTrends,
  }), [rawData, filteredPosts, allTrends])

  const dataWarnings = useMemo(() => {
    if (!filteredPosts.length) return []
    return detectDatasetWarnings(filteredPosts, pageConfig.topic_groups)
  }, [filteredPosts, pageConfig.topic_groups])

  const value = {
    selectedPageId, setSelectedPageId,
    pageConfig,
    data,
    loading,
    errors,
    activeTab, setActiveTab,
    selectedWeek, setSelectedWeek,
    weeklySlots, setWeeklySlots,
    plannerInputs, setPlannerInputs,
    dataWarnings,
    // Planner submit state
    plannerSubmitted, setPlannerSubmitted,
    submittedInputs, setSubmittedInputs,
    // Data source controls
    overridePosts, setOverridePosts,
    contentRows, setContentRows,
    contentFileName, setContentFileName,
    dateFilter, setDateFilter,
    customDateFrom, setCustomDateFrom,
    customDateTo, setCustomDateTo,
    extraTrends, setExtraTrends,
    rawPostsCount: rawData.posts.length,
    rawPosts: rawData.posts,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
