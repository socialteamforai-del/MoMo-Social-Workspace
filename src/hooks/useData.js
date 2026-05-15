import { useState, useEffect } from 'react'

import postsData          from '../data/posts.json'
import overallData        from '../data/overall.json'
import topPostsData       from '../data/top_posts.json'
import timingData         from '../data/timing_benchmark.json'
import buPriorityData     from '../data/bu_priority.json'
import marketTrendsData   from '../data/market_trends.json'

export function useData(pageId) {
  const [data, setData] = useState({
    posts: [],
    overall: [],
    topPosts: [],
    timingBenchmarks: [],
    buPriority: [],
    marketTrends: [],
  })
  const [loading, setLoading] = useState(true)
  const [errors, setErrors]   = useState([])

  useEffect(() => {
    const filterPage = (arr) =>
      pageId ? arr.filter((x) => !x.page_id || x.page_id === pageId) : arr

    setData({
      posts:             filterPage(postsData),
      overall:           filterPage(overallData),
      topPosts:          filterPage(topPostsData),
      timingBenchmarks:  filterPage(timingData),
      buPriority:        filterPage(buPriorityData),
      marketTrends:      filterPage(marketTrendsData),
    })
    setErrors([])
    setLoading(false)
  }, [pageId])

  return { data, loading, errors }
}
