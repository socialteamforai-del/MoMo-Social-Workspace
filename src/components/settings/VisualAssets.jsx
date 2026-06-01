import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Trash2, ImageIcon, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './VisualAssets.module.css'

const FOLDERS = [
  { id: 'common',        label: 'Chung (fallback)' },
  { id: 'mama_tai_chinh', label: 'MaMa Tài Chính' },
  { id: 'heo_dat_momo',   label: 'Heo Đất MoMo' },
]

async function fetchFiles(folderId) {
  const res = await fetch(`/api/elements/${folderId}`)
  const json = await res.json()
  return json.files ?? []
}

async function deleteFile(folderId, filename) {
  const res = await fetch(`/api/elements/${folderId}/${encodeURIComponent(filename)}`, { method: 'DELETE' })
  return res.ok
}

async function uploadFile(folderId, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const res = await fetch('/api/upload-element', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: folderId, filename: file.name, data: e.target.result }),
        })
        const json = await res.json()
        if (!res.ok || json.error) reject(new Error(json.error ?? 'Upload thất bại'))
        else resolve(json)
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Không đọc được file'))
    reader.readAsDataURL(file)
  })
}

export default function VisualAssets() {
  const { selectedPageId } = useApp()
  const [activeFolder, setActiveFolder]   = useState(selectedPageId ?? 'mama_tai_chinh')
  const [files, setFiles]                 = useState([])
  const [loading, setLoading]             = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [uploadStatus, setUploadStatus]   = useState(null) // { ok, msg }
  const [deletingFile, setDeletingFile]   = useState(null)
  const [dragOver, setDragOver]           = useState(false)
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setFiles(await fetchFiles(activeFolder)) }
    catch { setFiles([]) }
    finally { setLoading(false) }
  }, [activeFolder])

  useEffect(() => { load() }, [load])

  const isReadOnly = activeFolder === 'common'

  const handleFiles = async (fileList) => {
    const imgs = Array.from(fileList).filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return
    setUploading(true)
    setUploadStatus(null)
    try {
      await Promise.all(imgs.map(f => uploadFile(activeFolder, f)))
      setUploadStatus({ ok: true, msg: `Đã upload ${imgs.length} file` })
      load()
    } catch (err) {
      setUploadStatus({ ok: false, msg: err.message })
    } finally { setUploading(false) }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!isReadOnly) handleFiles(e.dataTransfer.files)
  }

  const handleDelete = async (filename) => {
    setDeletingFile(filename)
    try {
      await deleteFile(activeFolder, filename)
      setFiles(prev => prev.filter(f => f.name !== filename))
    } catch {}
    finally { setDeletingFile(null) }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.title}>Visual Assets</h2>
        <p className={styles.desc}>
          Upload hình ảnh cho từng page. File trong folder <strong>page</strong> sẽ override file cùng tên trong folder Chung.
        </p>
      </div>

      {/* Folder tabs */}
      <div className={styles.tabs}>
        {FOLDERS.map(f => (
          <button
            key={f.id}
            className={`${styles.tab} ${activeFolder === f.id ? styles.tabActive : ''}`}
            onClick={() => { setActiveFolder(f.id); setUploadStatus(null) }}
          >
            {f.label}
            {f.id === 'common' && <span className={styles.tabBadge}>read-only</span>}
          </button>
        ))}
      </div>

      {/* Upload zone — only for page-specific folders */}
      {!isReadOnly && (
        <div
          className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />
          {uploading ? (
            <><Loader2 size={18} className={styles.spin} /> Đang upload…</>
          ) : (
            <><Upload size={18} /> Kéo thả hoặc click để upload PNG/JPG</>
          )}
        </div>
      )}

      {uploadStatus && (
        <div className={`${styles.status} ${uploadStatus.ok ? styles.statusOk : styles.statusErr}`}>
          {uploadStatus.ok
            ? <><CheckCircle size={13} /> {uploadStatus.msg}</>
            : <><AlertCircle size={13} /> {uploadStatus.msg}</>}
        </div>
      )}

      {isReadOnly && (
        <div className={styles.readonlyNote}>
          <AlertCircle size={13} /> Folder Chung được quản lý thủ công qua file system. Dùng folder page để override.
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className={styles.loadingRow}><Loader2 size={16} className={styles.spin} /> Đang tải…</div>
      ) : files.length === 0 ? (
        <div className={styles.empty}>
          <ImageIcon size={32} className={styles.emptyIcon} />
          <p>{isReadOnly ? 'Không tìm thấy file trong folder common' : 'Chưa có file — upload để bắt đầu'}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {files.map(f => (
            <div key={f.name} className={styles.card}>
              <img src={f.url} alt={f.name} className={styles.thumb} />
              <div className={styles.cardName}>{f.name}</div>
              {!isReadOnly && (
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(f.name)}
                  disabled={deletingFile === f.name}
                  title="Xóa file này"
                >
                  {deletingFile === f.name
                    ? <Loader2 size={12} className={styles.spin} />
                    : <Trash2 size={12} />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
