import React, { useRef, useState } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import styles from './Settings.module.css'

const DATA_FILES = [
  { key: 'posts',            label: 'Posts',            file: 'posts.json',            desc: 'Dữ liệu bài viết với metrics' },
  { key: 'overall',          label: 'Overall',          file: 'overall.json',          desc: 'Aggregate page metrics' },
  { key: 'top_posts',        label: 'Top Posts',        file: 'top_posts.json',        desc: 'Top posts by ER' },
  { key: 'timing_benchmark', label: 'Timing Benchmark', file: 'timing_benchmark.json', desc: 'Best hour/day per topic×format' },
  { key: 'bu_priority',      label: 'BU Priority',      file: 'bu_priority.json',      desc: 'BU input template' },
  { key: 'market_trends',    label: 'Market Trends',    file: 'market_trends.json',    desc: 'Active trends' },
]

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
      <p className={styles.hint}>
        Upload file JSON mới để cập nhật dữ liệu. File phải đúng schema đang dùng.
        Tải lại trang để áp dụng.
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

      <p className={styles.note}>
        Lưu ý: app này chạy localhost, không có server. Upload chỉ validate format — để thay file thật, đặt file mới vào <code>public/data/</code>.
      </p>
    </div>
  )
}
