import { useState, useEffect } from 'react'
import { PAGE_CONFIGS, DEFAULT_PAGE_ID } from '../config/pages.js'

// In-memory cache — avoids re-fetching on tab switch within the same session
const urlCache = new Map()

async function fetchJson(url) {
  if (urlCache.has(url)) return urlCache.get(url)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    const json = await res.json()
    urlCache.set(url, json)
    return json
  } catch {
    urlCache.set(url, [])
    return []
  }
}

const FALLBACK_FILES = {
  posts:            '/data/mama_tai_chinh/posts.json',
  overall:          '/data/mama_tai_chinh/overall.json',
  top_posts:        '/data/mama_tai_chinh/top_posts.json',
  timing_benchmark: '/data/mama_tai_chinh/timing_benchmark.json',
  bu_priority:      '/data/mama_tai_chinh/bu_priority.json',
  market_trends:    '/data/mama_tai_chinh/market_trends.json',
}

export function useData(pageId) {
  const [data, setData] = useState({
    posts: [], overall: [], topPosts: [],
    timingBenchmarks: [], buPriority: [], marketTrends: [],
  })
  const [loading, setLoading] = useState(true)
  const [errors, setErrors]   = useState([])

  useEffect(() => {
    const cfg   = PAGE_CONFIGS[pageId] ?? PAGE_CONFIGS[DEFAULT_PAGE_ID]
    const files = { ...FALLBACK_FILES, ...(cfg.data_files ?? {}) }

    setLoading(true)
    setErrors([])

    Promise.all([
      fetchJson(files.posts),
      fetchJson(files.overall),
      fetchJson(files.top_posts),
      fetchJson(files.timing_benchmark),
      fetchJson(files.bu_priority),
      fetchJson(files.market_trends),
    ]).then(([posts, overall, topPosts, timingBenchmarks, buPriority, marketTrends]) => {
      setData({ posts, overall, topPosts, timingBenchmarks, buPriority, marketTrends })
      setLoading(false)
    })
  }, [pageId])

  return { data, loading, errors }
}
