import React, { useMemo, useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './PostCanvas.module.css'

// ── Badge labels & colors per format ─────────────────────────────────────────
const FORMAT_BADGE = {
  // MaMa Tài Chính
  poll:                  { label: 'Bình chọn',     color: '#A50064' },
  educational_post:      { label: 'Bạn có biết',   color: '#00897B' },
  market_update:         { label: 'Thị trường',    color: '#1565C0' },
  qa:                    { label: 'Q&A',            color: '#A50064' },
  service_faq:           { label: 'Hướng dẫn',     color: '#00897B' },
  minigame:              { label: 'Minigame',       color: '#E65100' },
  confession_discussion: { label: 'Chia sẻ',       color: '#6A1B9A' },
  promo_info:            { label: 'Ưu đãi',         color: '#F57F17' },
  // Heo Đất MoMo
  minigame_quiz:         { label: 'Đố vui',         color: '#E65100' },
  gamified_reward:       { label: 'Nhận quà',       color: '#A50064' },
  thanh_qua_du_an:       { label: 'Thành quả',      color: '#00897B' },
  donation_call:         { label: 'Quyên góp',      color: '#C62828' },
  event_comms:           { label: 'Sự kiện',        color: '#1565C0' },
  kindness_story:        { label: 'Câu chuyện',     color: '#6A1B9A' },
}

// ── Element pools per format — common (MaMa Tài Chính defaults) ───────────────
const FORMAT_ELEMENTS = {
  poll:                  ['1_9_0.png', '1_22_0.png', '1_2_0.png'],
  educational_post:      ['1_7_0.png', '1_10_0.png', '1_21_0.png'],
  market_update:         ['1_10_0.png', '1_21_0.png', '1_26_0.png'],
  qa:                    ['1_8_0.png',  '1_16_0.png', '1_6_0.png'],
  service_faq:           ['1_1_0.png',  '1_16_0.png', '1_19_0.png'],
  minigame:              ['1_15.png',   '1_5_0.png',  '1_18_0.png'],
  confession_discussion: ['1_20_0.png', '1_24.png',   '1_11_0.png'],
  promo_info:            ['1_4_0.png',  '1_18_0.png', '1_26_0.png'],
  // Heo Đất — will be overridden by page-specific files when uploaded
  minigame_quiz:         ['1_15.png',   '1_5_0.png',  '1_18_0.png'],
  gamified_reward:       ['1_4_0.png',  '1_18_0.png', '1_15.png'],
  thanh_qua_du_an:       ['1_21_0.png', '1_10_0.png', '1_7_0.png'],
  donation_call:         ['1_20_0.png', '1_24.png',   '1_11_0.png'],
  event_comms:           ['1_16_0.png', '1_1_0.png',  '1_19_0.png'],
  kindness_story:        ['1_2_1.png',  '1_20_0.png', '1_11_0.png'],
}

// Topic keyword → element filename (common pool)
const TOPIC_ELEMENTS = {
  'tiết kiệm':   '1_22_0.png',
  'heo đất':     '1_22_0.png',
  'gia đình':    '1_2_1.png',
  'con cái':     '1_2_1.png',
  'đầu tư':      '1_7_0.png',
  'chứng khoán': '1_21_0.png',
  'vn-index':    '1_10_0.png',
  'blue-chip':   '1_10_0.png',
  'momo':        '1_6_0.png',
  'hoàn tiền':   '1_13_0.png',
  'rút tiền':    '1_13_0.png',
  'vay':         '1_17_0.png',
  'tín dụng':    '1_17_0.png',
  'bảo hiểm':   '1_14.png',
  'chi tiêu':    '1_5_0.png',
  'minigame':    '1_15.png',
  'quyên góp':   '1_20_0.png',
  'từ thiện':    '1_2_1.png',
}

// Build the candidate element filename for a slot
function pickFilename(slot) {
  const topic  = (slot.topic_group || '').toLowerCase()
  const format = slot.content_format || ''

  for (const [kw, file] of Object.entries(TOPIC_ELEMENTS)) {
    if (topic.includes(kw)) return file
  }

  const pool = FORMAT_ELEMENTS[format] || ['1_7_0.png', '1_9_0.png', '1_10_0.png']
  const idx  = (slot.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length
  return pool[idx]
}

// Image component that tries page-specific path, falls back to common
function ElementImg({ pageId, filename, className }) {
  const [src, setSrc] = useState(`/elements/${pageId}/${filename}`)

  useEffect(() => {
    setSrc(`/elements/${pageId}/${filename}`)
  }, [pageId, filename])

  const handleError = () => {
    if (!src.includes('/common/')) setSrc(`/elements/common/${filename}`)
  }

  return <img src={src} alt="" className={className} onError={handleError} />
}

function BgDiv({ pageId, className, children }) {
  const [bgSrc, setBgSrc] = useState(`/elements/${pageId}/bg.png`)

  useEffect(() => {
    setBgSrc(`/elements/${pageId}/bg.png`)
  }, [pageId])

  const handleBgError = () => {
    if (!bgSrc.includes('/common/')) setBgSrc('/elements/common/bg.png')
  }

  return (
    <div className={className} style={{ backgroundImage: `url(${bgSrc})` }}>
      <img src={bgSrc} alt="" style={{ display: 'none' }} onError={handleBgError} />
      {children}
    </div>
  )
}

function makeShortTitle(hook = '', topic = '') {
  let t = hook.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s📌🔥💡📊📈📰🎮💸💬]+/gu, '').trim()
  const colonIdx = t.indexOf(':')
  if (colonIdx > 0 && colonIdx < 25) t = t.slice(colonIdx + 1).trim()
  const qIdx = t.indexOf('?')
  if (qIdx > 10) t = t.slice(0, qIdx + 1).trim()
  t = t
    .replace(/\s*(—|-)?\s*(MaMa|Heo|bạn có biết|con số thực tế|hãy cùng|cùng MaMa).*/i, '')
    .replace(/\s*👇.*$/, '')
    .trim()
  if (t.length > 42) {
    t = t.slice(0, 42)
    const last = t.lastIndexOf(' ')
    if (last > 28) t = t.slice(0, last)
    t += '…'
  }
  return t || topic
}

export default function PostCanvas({ slot }) {
  const { selectedPageId } = useApp()
  const pageId   = slot.page_id || selectedPageId || 'common'
  const badge    = FORMAT_BADGE[slot.content_format] || { label: slot.content_format, color: '#A50064' }
  const headline = makeShortTitle(slot.direction?.hook || '', slot.topic_group || '')
  const cta      = slot.direction?.cta || 'Khám phá ngay →'
  const filename = useMemo(() => pickFilename(slot), [slot.id, slot.content_format, slot.topic_group])

  return (
    <BgDiv pageId={pageId} className={styles.canvas}>

      {/* Badge + headline — top left */}
      <div className={styles.topLeft}>
        <span className={styles.badge} style={{ background: badge.color }}>
          {badge.label}
        </span>
        <p className={styles.headline}>{headline}</p>
      </div>

      {/* Center element */}
      <div className={styles.center}>
        <ElementImg pageId={pageId} filename={filename} className={styles.illustration} />
      </div>

      {/* CTA bar — bottom */}
      <div className={styles.ctaBar}>
        <span className={styles.ctaText}>{cta}</span>
      </div>

    </BgDiv>
  )
}
