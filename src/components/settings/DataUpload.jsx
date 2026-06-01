import React, { useRef, useState } from 'react'
import { Upload, CheckCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { PAGE_CONFIGS } from '../../config/pages.js'
import styles from './Settings.module.css'

const DATA_FILES = [
  { key: 'posts',            label: 'Posts',            file: 'posts.json',            desc: 'Dữ liệu bài viết với metrics' },
  { key: 'overall',          label: 'Overall',          file: 'overall.json',          desc: 'Aggregate page metrics' },
  { key: 'top_posts',        label: 'Top Posts',        file: 'top_posts.json',        desc: 'Top posts by ER' },
  { key: 'timing_benchmark', label: 'Timing Benchmark', file: 'timing_benchmark.json', desc: 'Best hour/day per topic×format' },
  { key: 'bu_priority',      label: 'BU Priority',      file: 'bu_priority.json',      desc: 'BU input template' },
  { key: 'market_trends',    label: 'Market Trends',    file: 'market_trends.json',    desc: 'Active trends' },
]

const PAGE_LIST = Object.values(PAGE_CONFIGS).filter(p => p.status === 'active')

function SyncSection() {
  const { selectedPageId } = useApp()
  const [syncPageId, setSyncPageId] = useState(selectedPageId)
  const [days, setDays]             = useState(90)
  const [state, setState]           = useState('idle') // idle | loading | done | error
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState('')

  const handleSync = async () => {
    setState('loading')
    setResult(null)
    setError('')

    const endDate   = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

    try {
      const res = await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: syncPageId, startDate, endDate }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `Lỗi ${res.status}`)
      setResult(json)
      setState('done')
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  return (
    <div className={syncStyles.syncCard}>
      <div className={syncStyles.syncHeader}>
        <RefreshCw size={15} />
        <span className={syncStyles.syncTitle}>Đồng bộ dữ liệu từ MCP</span>
      </div>
      <p className={syncStyles.syncDesc}>
        Pull engagement + content từ MCP, merge theo post_id và lưu vào <code>public/data/{'{pageId}'}/*.json</code>.
        Không cần upload file thủ công.
      </p>

      <div className={syncStyles.syncControls}>
        <div className={syncStyles.syncField}>
          <label className={syncStyles.syncLabel}>Trang</label>
          <select
            className={syncStyles.syncSelect}
            value={syncPageId}
            onChange={e => setSyncPageId(e.target.value)}
            disabled={state === 'loading'}
          >
            {PAGE_LIST.map(p => (
              <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
            ))}
          </select>
        </div>
        <div className={syncStyles.syncField}>
          <label className={syncStyles.syncLabel}>Khoảng thời gian</label>
          <select
            className={syncStyles.syncSelect}
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            disabled={state === 'loading'}
          >
            <option value={30}>30 ngày gần nhất</option>
            <option value={60}>60 ngày gần nhất</option>
            <option value={90}>90 ngày gần nhất</option>
            <option value={180}>180 ngày gần nhất</option>
          </select>
        </div>
        <button
          className={syncStyles.syncBtn}
          onClick={handleSync}
          disabled={state === 'loading'}
        >
          {state === 'loading'
            ? <><Loader2 size={13} className={syncStyles.spin} /> Đang đồng bộ...</>
            : <><RefreshCw size={13} /> Đồng bộ ngay</>
          }
        </button>
      </div>

      {state === 'done' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className={syncStyles.syncSuccess}>
            <CheckCircle size={13} />
            Xong — {result.postCount} bài đã lưu vào <code>public/data/{result.pageId}/</code>. Tải lại trang để áp dụng.
          </div>
          {!result.hasContentData && (
            <div className={syncStyles.syncError}>
              <AlertCircle size={13} />
              Chưa có content metadata (topic_group, content_format) cho trang này trong MCP.
              Engagement data đã lưu nhưng planner sẽ không có topic/format breakdown cho đến khi data team label bài.
            </div>
          )}
        </div>
      )}
      {state === 'error' && (
        <div className={syncStyles.syncError}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
    </div>
  )
}

// Inline styles object for SyncSection (avoids adding a separate CSS module)
const syncStyles = {
  syncCard: {
    border: '1px solid #E5E7EB',
    borderRadius: 10,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: '#F9FAFB',
  },
  syncHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontWeight: 700,
    fontSize: 14,
    color: '#111',
  },
  syncTitle: { fontWeight: 700 },
  syncDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 1.55,
    margin: 0,
  },
  syncControls: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  syncField: { display: 'flex', flexDirection: 'column', gap: 4 },
  syncLabel: { fontSize: 11, fontWeight: 600, color: '#374151' },
  syncSelect: {
    fontSize: 13,
    border: '1px solid #D1D5DB',
    borderRadius: 6,
    padding: '5px 10px',
    background: 'white',
    cursor: 'pointer',
  },
  syncBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: 'white',
    background: '#A50064',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  spin: { animation: 'spin 1s linear infinite' },
  syncSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#065F46',
    background: '#D1FAE5',
    border: '1px solid #6EE7B7',
    borderRadius: 6,
    padding: '7px 12px',
  },
  syncError: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#B91C1C',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 6,
    padding: '7px 12px',
  },
}

export default function DataUpload() {
  const [status, setStatus] = useState({})

  const handleFile = (key, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        JSON.parse(e.target.result)
        setStatus(s => ({ ...s, [key]: { ok: true, name: file.name } }))
      } catch {
        setStatus(s => ({ ...s, [key]: { ok: false, name: file.name } }))
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className={`${styles.card} card`}>
      <h3 className={styles.sectionTitle}>Cập nhật dữ liệu</h3>

      <SyncSection />

      <div className={styles.section}>
        <span className={styles.subTitle}>Hoặc upload file thủ công</span>
        <p className={styles.hint}>
          File phải đúng schema. Đặt file vào <code>public/data/{'<pageId>'}/*.json</code> và tải lại trang.
        </p>

        <div className={styles.uploadList}>
          {DATA_FILES.map(({ key, label, file, desc }) => (
            <div key={key} className={styles.uploadRow}>
              <div className={styles.uploadMeta}>
                <span className={styles.uploadLabel}>{label}</span>
                <span className={styles.uploadDesc}>{desc} · <code>{file}</code></span>
              </div>
              <div className={styles.uploadAction}>
                {status[key] && (
                  status[key].ok
                    ? <span className={styles.uploadOk}><CheckCircle size={13} /> {status[key].name}</span>
                    : <span className={styles.uploadErr}><AlertCircle size={13} /> JSON không hợp lệ</span>
                )}
                <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                  <Upload size={13} /> Chọn file
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={e => handleFile(key, e.target.files[0])}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
