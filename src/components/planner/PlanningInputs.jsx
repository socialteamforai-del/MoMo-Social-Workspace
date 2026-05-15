import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './PlanningInputs.module.css'

export default function PlanningInputs() {
  const { plannerInputs, setPlannerInputs } = useApp()
  const { numPosts, mode, reserveReactive, buInputs } = plannerInputs

  const setBU = (key, val) =>
    setPlannerInputs(p => ({ ...p, buInputs: { ...p.buInputs, [key]: val } }))

  const set = (key, val) =>
    setPlannerInputs(p => ({ ...p, [key]: val }))

  return (
    <div className={`${styles.card} card`}>
      <div className={styles.grid}>
        <div className={styles.col}>
          <h4 className={styles.colTitle}>BU Inputs (tùy chọn)</h4>

          <div className={styles.field}>
            <label>Sự kiện / Chiến dịch</label>
            <input
              placeholder="VD: Ra mắt tính năng Đầu tư quỹ"
              value={buInputs.event_name || ''}
              onChange={e => setBU('event_name', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Chủ đề ưu tiên</label>
            <input
              placeholder="VD: Dự đoán giá cổ phiếu"
              value={buInputs.priority_topic || ''}
              onChange={e => setBU('priority_topic', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Trend đang hot</label>
            <input
              placeholder="VD: VN-Index vượt 1,300 điểm"
              value={buInputs.trending_topic || ''}
              onChange={e => setBU('trending_topic', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Ngày bắt buộc đăng</label>
            <input
              type="date"
              value={buInputs.must_publish_date || ''}
              onChange={e => setBU('must_publish_date', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>CTA</label>
            <input
              placeholder="VD: Bình luận dự đoán của bạn!"
              value={buInputs.cta || ''}
              onChange={e => setBU('cta', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Collab page đề xuất</label>
            <input
              placeholder="VD: Hóng hớt MoMo"
              value={buInputs.collab_page || ''}
              onChange={e => setBU('collab_page', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Góc collab</label>
            <input
              placeholder="VD: User MMTC hay mua vé phim"
              value={buInputs.collab_angle || ''}
              onChange={e => setBU('collab_angle', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Ghi chú thêm</label>
            <textarea
              rows={2}
              placeholder="Ghi chú cho team content..."
              value={buInputs.notes || ''}
              onChange={e => setBU('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div className={styles.col}>
          <h4 className={styles.colTitle}>Cài đặt tuần</h4>

          <div className={styles.field}>
            <label>Số bài trong tuần: <strong>{numPosts}</strong></label>
            <input
              type="range" min={3} max={7} value={numPosts}
              onChange={e => set('numPosts', Number(e.target.value))}
              className={styles.slider}
            />
            <div className={styles.sliderLabels}><span>3</span><span>7</span></div>
          </div>

          <div className={styles.field}>
            <label>Chế độ tạo lịch</label>
            <div className={styles.modeGroup}>
              {[
                { val: 'balanced',        label: 'Cân bằng' },
                { val: 'business-led',    label: 'Ưu tiên BU' },
                { val: 'performance-led', label: 'Ưu tiên hiệu suất' },
              ].map(m => (
                <button
                  key={m.val}
                  className={`${styles.modeBtn} ${mode === m.val ? styles.active : ''}`}
                  onClick={() => set('mode', m.val)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.toggleLabel}>
              <span>Giữ reactive slot</span>
              <button
                className={`${styles.toggle} ${reserveReactive ? styles.toggleOn : ''}`}
                onClick={() => set('reserveReactive', !reserveReactive)}
                role="switch"
                aria-checked={reserveReactive}
              >
                <span className={styles.toggleThumb} />
              </button>
            </label>
            <p className={styles.hint}>Giữ 1 slot cuối tuần để phản ứng với trend mới.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
