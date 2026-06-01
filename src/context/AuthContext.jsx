import React, { createContext, useContext, useState, useCallback } from 'react'
import { authenticate, findUser } from '../config/users.js'
import { PAGE_CONFIGS, DEFAULT_PAGE_ID } from '../config/pages.js'

const AuthContext = createContext(null)
const SESSION_KEY = 'mmtc_session'

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { userId, pageId } = JSON.parse(raw)
    const user = findUser(userId)
    if (!user) return null
    // Validate saved pageId is still allowed for this user
    const pid = user.page_ids.includes(pageId) ? pageId : user.page_ids[0]
    return { user, pageId: pid }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const saved = readSession()
  const [currentUser, setCurrentUser] = useState(saved?.user ?? null)
  const [activePageId, setActivePageId] = useState(saved?.pageId ?? null)

  // login step 1: validate email+password → returns user (but doesn't set activePageId yet if >1 page)
  const login = useCallback((email, password) => {
    const user = authenticate(email, password)
    if (!user) return null
    setCurrentUser(user)
    // If only one page, auto-select and save session
    if (user.page_ids.length === 1) {
      const pid = user.page_ids[0]
      setActivePageId(pid)
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, pageId: pid }))
    }
    return user
  }, [])

  // login step 2 (only called when user has multiple pages)
  const selectPage = useCallback((pageId) => {
    if (!currentUser?.page_ids.includes(pageId)) return
    setActivePageId(pageId)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: currentUser.id, pageId }))
  }, [currentUser])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setCurrentUser(null)
    setActivePageId(null)
  }, [])

  // Resolve allowed page configs for current user
  const allowedPages = currentUser
    ? currentUser.page_ids.map(id => PAGE_CONFIGS[id]).filter(Boolean)
    : []

  const activePageConfig = activePageId
    ? PAGE_CONFIGS[activePageId] ?? null
    : null

  return (
    <AuthContext.Provider value={{
      currentUser,
      activePageId,
      activePageConfig,
      allowedPages,
      login,
      selectPage,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
