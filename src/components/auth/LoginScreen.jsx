import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { PAGE_CONFIGS } from '../../config/pages.js'
import styles from './LoginScreen.module.css'

const PAGE_COLORS = {
  mama_tai_chinh: '#A50064',
  heo_dat_momo:   '#E85D04',
}

// Step 1: Email + Password
function CredentialForm({ onSuccess }) {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 280))
    const user = login(email, password)
    if (!user) {
      setError('Email hoặc mật khẩu không đúng.')
      setPassword('')
    } else {
      onSuccess(user)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">Email nội bộ</label>
        <input
          id="email"
          type="email"
          className={styles.input}
          placeholder="ten@mservice.com.vn"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          autoComplete="email"
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="pw">Mật khẩu</label>
        <input
          id="pw"
          type="password"
          className={styles.input}
          placeholder="Nhập mật khẩu…"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          autoComplete="current-password"
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={!email || !password || loading}
      >
        {loading ? 'Đang xác thực…' : 'Đăng nhập'}
      </button>
    </form>
  )
}

// Step 2: Page picker (only when user has >1 page)
function PagePicker({ user }) {
  const { selectPage } = useAuth()

  return (
    <div className={styles.form}>
      <p className={styles.pickerHello}>
        Xin chào, <strong>{user.display_name}</strong>!<br />
        <span style={{ fontWeight: 400, color: 'var(--gray-500, #6b7280)' }}>
          Bạn có quyền truy cập {user.page_ids.length} page. Chọn page để tiếp tục:
        </span>
      </p>

      <div className={styles.pageList}>
        {user.page_ids.map(pid => {
          const cfg   = PAGE_CONFIGS[pid]
          const color = PAGE_COLORS[pid] ?? '#A50064'
          if (!cfg) return null
          return (
            <button
              key={pid}
              type="button"
              className={styles.pageOption}
              onClick={() => selectPage(pid)}
              style={{ '--page-color': color }}
            >
              <span className={styles.pageAvatar} style={{ background: color }}>
                {cfg.page_name.substring(0, 2).toUpperCase()}
              </span>
              <div className={styles.pageInfo}>
                <span className={styles.pageName}>{cfg.page_name}</span>
                <span className={styles.pageAudience}>{cfg.audience?.substring(0, 50)}…</span>
              </div>
              <span className={styles.pageArrow}>→</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function LoginScreen() {
  const { currentUser } = useAuth()
  // currentUser set but activePageId not yet (multi-page) → show page picker
  const [loggedInUser, setLoggedInUser] = useState(currentUser)

  const needsPagePick = loggedInUser && loggedInUser.page_ids.length > 1

  return (
    <div className={styles.bg}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoArea}>
          <div className={styles.logoMark}>
            <span>M</span>
          </div>
          <div>
            <div className={styles.logoTitle}>MoMo Social Workspace</div>
            <div className={styles.logoSub}>Công cụ lập kế hoạch nội dung nội bộ</div>
          </div>
        </div>

        {needsPagePick
          ? <PagePicker user={loggedInUser} />
          : <CredentialForm onSuccess={user => {
              setLoggedInUser(user)
            }} />
        }
      </div>
    </div>
  )
}
