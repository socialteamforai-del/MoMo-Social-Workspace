/**
 * PostImageBuilder — 3 modes for creating post images
 *   upload:       user uploads a pre-built image
 *   frame-photo:  pick bg frame → upload a photo to layer inside
 *   frame-edit:   pick bg frame → pick element → edit badge/headline/cta
 *
 * Props:
 *   slot     — the calendar slot (for default text values + ids)
 *   pageId   — active page (for element library)
 *   onAdd(url) — called when a final image URL is ready to attach
 *   disabled — true when imageUrls already at max (3)
 */
import React, { useState, useRef, useCallback } from 'react'
import { Upload, ImagePlus, X, Check, Loader2 } from 'lucide-react'
import styles from './PostImageBuilder.module.css'

// ── Canvas helpers ────────────────────────────────────────────────────────────

function loadImg(src) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => res(img)
    img.onerror = () => rej(new Error(`Cannot load ${src}`))
    img.src = src
  })
}


async function captureFramePhoto(frameUrl, photoDataUrl) {
  const SIZE = 800
  const canvas = document.createElement('canvas')
  canvas.width = SIZE; canvas.height = SIZE
  const ctx = canvas.getContext('2d')

  // 1. Photo fills entire canvas (cover) — drawn first so frame overlays on top
  if (photoDataUrl) {
    const photo = await loadImg(photoDataUrl)
    const ratio = Math.max(SIZE / photo.width, SIZE / photo.height)
    const pw = photo.width * ratio, ph = photo.height * ratio
    const px = (SIZE - pw) / 2, py = (SIZE - ph) / 2
    ctx.drawImage(photo, px, py, pw, ph)
  }

  // 2. Frame overlay on top (transparent center, opaque border)
  const frame = await loadImg(frameUrl)
  ctx.drawImage(frame, 0, 0, SIZE, SIZE)

  return new Promise(res => canvas.toBlob(res, 'image/png'))
}


function blobToDataUrl(blob) {
  return new Promise(res => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.readAsDataURL(blob)
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilePicker({ files, selected, onSelect, size = 60 }) {
  return (
    <div className={styles.filePicker}>
      {files.map(f => (
        <button
          key={f.url}
          className={`${styles.filePickerItem} ${selected === f.url ? styles.filePickerItemActive : ''}`}
          style={{ width: size, height: size }}
          onClick={() => onSelect(f.url)}
          title={f.name}
        >
          <img src={f.url} alt={f.name} className={styles.filePickerImg} />
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PostImageBuilder({ slot, pageId, onAdd, disabled }) {
  const [mode, setMode] = useState('upload')

  // Asset library
  const [bgFiles, setBgFiles] = useState([])
  const [loadingAssets, setLoadingAssets] = useState(false)

  // frame-photo state
  const [selectedBg,  setSelectedBg]  = useState(null)
  const [photoData,   setPhotoData]   = useState(null) // dataURL of user-uploaded photo
  const [photoName,   setPhotoName]   = useState('')


  // shared
  const [capturing,   setCapturing]   = useState(false)
  const [uploadBusy,  setUploadBusy]  = useState(false)
  const [dragOver,    setDragOver]    = useState(false)
  const fileInputRef  = useRef(null)
  const photoInputRef = useRef(null)


  // Load asset library when switching to template modes
  const loadAssets = useCallback(async () => {
    if (bgFiles.length > 0) return
    setLoadingAssets(true)
    try {
      const [pageRes, commonRes] = await Promise.all([
        fetch(`/api/elements/${pageId}`).then(r => r.json()).catch(() => ({ files: [] })),
        fetch('/api/elements/common').then(r => r.json()).catch(() => ({ files: [] })),
      ])
      const byName = new Map()
      ;(commonRes.files || []).forEach(f => byName.set(f.name, f))
      ;(pageRes.files  || []).forEach(f => byName.set(f.name, f)) // page overrides common
      const all = [...byName.values()]
      const bgs = all.filter(f => /^bg/i.test(f.name))
      setBgFiles(bgs)
      if (bgs.length > 0 && !selectedBg) setSelectedBg(bgs[0].url)
    } finally { setLoadingAssets(false) }
  }, [pageId, bgFiles.length, selectedBg])

  const handleModeChange = (m) => {
    setMode(m)
    if (m !== 'upload') loadAssets()
  }

  // Upload pre-built image
  const handleDirectUpload = async (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return
    setUploadBusy(true)
    try {
      await Promise.all(imgs.slice(0, 3).map(file => new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const resp = await fetch('/api/upload-post-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageId, slotId: slot.id, filename: file.name, data: e.target.result }),
            })
            const json = await resp.json()
            if (json.error) rej(new Error(json.error))
            else { onAdd(json.url); res() }
          } catch (err) { rej(err) }
        }
        reader.readAsDataURL(file)
      })))
    } catch (err) { console.error('[upload]', err.message) }
    finally { setUploadBusy(false) }
  }

  // Photo upload for frame-photo mode
  const handlePhotoSelect = (files) => {
    const f = files[0]
    if (!f || !f.type.startsWith('image/')) return
    setPhotoName(f.name)
    const reader = new FileReader()
    reader.onload = e => setPhotoData(e.target.result)
    reader.readAsDataURL(f)
  }

  // Capture + upload (template modes)
  const handleCapture = async () => {
    if (!selectedBg) return
    setCapturing(true)
    try {
      let blob
      blob = await captureFramePhoto(selectedBg, photoData)
      const dataUrl = await blobToDataUrl(blob)
      const resp = await fetch('/api/upload-post-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, slotId: slot.id, filename: `template_${Date.now()}.png`, data: dataUrl }),
      })
      const json = await resp.json()
      if (!json.error) onAdd(json.url)
    } catch (err) { console.error('[capture]', err.message) }
    finally { setCapturing(false) }
  }

  if (disabled) return null

  return (
    <div className={styles.wrap}>
      {/* Mode tabs */}
      <div className={styles.modeTabs}>
        <button className={`${styles.modeTab} ${mode === 'upload' ? styles.modeTabActive : ''}`} onClick={() => handleModeChange('upload')}>
          <Upload size={13} /> Upload sẵn
        </button>
        <button className={`${styles.modeTab} ${mode === 'frame-photo' ? styles.modeTabActive : ''}`} onClick={() => handleModeChange('frame-photo')}>
          <ImagePlus size={13} /> Frame + ảnh
        </button>
      </div>

      {/* ── Mode: Upload sẵn ── */}
      {mode === 'upload' && (
        <div
          className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleDirectUpload(e.dataTransfer.files) }}
        >
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { handleDirectUpload(e.target.files); e.target.value = '' }} />
          {uploadBusy
            ? <><Loader2 size={14} className={styles.spin} /> Đang upload…</>
            : <><Upload size={14} /> Kéo thả hoặc click để upload</>}
        </div>
      )}

      {/* ── Mode: Frame + Photo ── */}
      {mode === 'frame-photo' && (
        <div className={styles.templatePanel}>
          {loadingAssets ? (
            <div className={styles.loadingRow}><Loader2 size={14} className={styles.spin} /> Đang tải assets…</div>
          ) : (
            <>
              <div className={styles.section}>
                <label className={styles.sectionLabel}>Chọn nền</label>
                <FilePicker files={bgFiles} selected={selectedBg} onSelect={setSelectedBg} size={64} />
              </div>

              <div className={styles.twoCol}>
                <div className={styles.section}>
                  <label className={styles.sectionLabel}>Upload ảnh của bạn</label>
                  <div className={styles.photoZone} onClick={() => photoInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handlePhotoSelect(e.dataTransfer.files) }}>
                    <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { handlePhotoSelect(e.target.files); e.target.value = '' }} />
                    {photoData
                      ? <img src={photoData} alt="preview" className={styles.photoPreview} />
                      : <><ImagePlus size={16} /><span>Chọn ảnh</span></>}
                  </div>
                  {photoData && (
                    <button className={styles.clearBtn} onClick={() => { setPhotoData(null); setPhotoName('') }}>
                      <X size={11} /> Xóa ảnh
                    </button>
                  )}
                </div>

                <div className={styles.section}>
                  <label className={styles.sectionLabel}>Preview</label>
                  <div
                    className={styles.preview}
                    style={{
                      backgroundImage: photoData ? `url(${photoData})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Frame overlay on top of photo */}
                    {selectedBg && <img src={selectedBg} alt="" className={styles.previewFrame} />}
                    {!photoData && !selectedBg && <span className={styles.previewEmpty}>Chọn ảnh & nền</span>}
                    {!photoData && selectedBg && <span className={styles.previewEmpty}>Chọn ảnh</span>}
                  </div>
                </div>
              </div>

              <button className={styles.captureBtn} onClick={handleCapture}
                disabled={capturing || !selectedBg}>
                {capturing ? <><Loader2 size={13} className={styles.spin} /> Đang tạo…</> : <><Check size={13} /> Thêm vào bài</>}
              </button>
            </>
          )}
        </div>
      )}

    </div>
  )
}
