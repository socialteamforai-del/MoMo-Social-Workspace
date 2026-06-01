import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronUp, Info, BookmarkCheck } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './CharacterProfile.module.css'

const FORMAT_VI = {
  poll: 'Poll', educational_post: 'Bài giáo dục', market_update: 'Cập nhật thị trường',
  qa: 'Hỏi & Đáp', service_faq: 'FAQ dịch vụ', minigame: 'Minigame',
  confession_discussion: 'Thảo luận', promo_info: 'Thông tin ưu đãi',
}

const SECTIONS = [
  { id: 'voice',      label: 'Giọng nói & Nhân cách' },
  { id: 'frameworks', label: 'Framework viết bài' },
  { id: 'formats',    label: 'Pattern theo format' },
  { id: 'angles',     label: 'Top angles (organic)' },
  { id: 'visual',     label: 'Hướng thiết kế hình' },
  { id: 'triggers',   label: 'Signals tương tác' },
]

export default function CharacterProfile() {
  const { pageConfig, data } = useApp()
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [building, setBuilding]   = useState(false)
  const [error, setError]         = useState('')
  const [activeSection, setActive]= useState('voice')
  const [expanded, setExpanded]   = useState({})

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/character/${pageConfig.page_id}`)
      if (!res.ok) {
        if (res.status === 404) { setProfile(null); setError('') }
        else throw new Error((await res.json()).error)
        return
      }
      setProfile(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [pageConfig.page_id])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const rebuild = async () => {
    setBuilding(true)
    setError('')
    try {
      const res = await fetch('/api/build-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pageConfig.page_id, posts: data.posts }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setProfile(json.profile)
    } catch (e) {
      setError(e.message)
    } finally {
      setBuilding(false)
    }
  }

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }))

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Character Profile — {pageConfig.page_name}</h2>
          {profile && (
            <p className={styles.meta}>
              Xây dựng: {new Date(profile.built_at).toLocaleDateString('vi-VN')}
              {profile.organic_posts_analyzed != null && (
                <> · {profile.organic_posts_analyzed} bài organic / {profile.total_posts_analyzed} tổng</>
              )}
              {profile.recency_weighted && <> · ⚡ Recency-weighted</>}
              {profile.approved_content_count > 0 && (
                <> · <BookmarkCheck size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {profile.approved_content_count} caption đã duyệt</>
              )}
            </p>
          )}
        </div>
        <button
          className={`btn btn-primary btn-sm ${building ? styles.spinning : ''}`}
          onClick={rebuild}
          disabled={building}
          title="Phân tích lại từ data hiện tại"
        >
          <RefreshCw size={13} />
          {building ? 'Đang phân tích…' : 'Rebuild từ data'}
        </button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {loading && <p className={styles.loading}>Đang tải profile…</p>}

      {!loading && !profile && !error && (
        <div className={styles.emptyState}>
          <p>Chưa có Character Profile cho trang này.</p>
          <p>Nhấn <strong>Rebuild từ data</strong> để phân tích {data.posts.length} bài đăng hiện có và tạo profile.</p>
        </div>
      )}

      {profile && (
        <div className={styles.layout}>
          {/* Nav */}
          <nav className={styles.nav}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`${styles.navItem} ${activeSection === s.id ? styles.active : ''}`}
                onClick={() => setActive(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className={styles.content}>

            {/* ── Voice ── */}
            {activeSection === 'voice' && profile.voice && (
              <div className={styles.section}>
                <Field label="Nhân cách">
                  <p className={styles.text}>{profile.voice.persona}</p>
                </Field>
                <Field label="Tone">
                  <p className={styles.text}>{profile.voice.tone}</p>
                </Field>
                <Field label="Cách xưng hô">
                  <p className={styles.text}>{profile.voice.address_style}</p>
                </Field>
                {profile.voice.emoji_style && (
                  <Field label="Emoji style">
                    <p className={styles.text}>{profile.voice.emoji_style}</p>
                  </Field>
                )}
                {profile.voice.vocabulary && (
                  <>
                    <Field label="Từ hay dùng">
                      <div className={styles.chips}>
                        {profile.voice.vocabulary.preferred?.map(w => (
                          <span key={w} className={`${styles.chip} ${styles.chipGreen}`}>{w}</span>
                        ))}
                      </div>
                    </Field>
                    <Field label="Từ cần tránh">
                      <div className={styles.chips}>
                        {profile.voice.vocabulary.avoid?.map(w => (
                          <span key={w} className={`${styles.chip} ${styles.chipRed}`}>{w}</span>
                        ))}
                      </div>
                    </Field>
                  </>
                )}
                {profile.voice.signature && (
                  <Field label="Signature mặc định">
                    <p className={styles.signature}>{profile.voice.signature}</p>
                  </Field>
                )}
              </div>
            )}

            {/* ── Frameworks ── */}
            {activeSection === 'frameworks' && (
              <div className={styles.section}>
                {profile.storytelling?.primary_framework && (
                  <Field label="Framework chính">
                    <p className={styles.frameworkMain}>{profile.storytelling.primary_framework}</p>
                  </Field>
                )}
                {profile.storytelling?.structure_principles?.length > 0 && (
                  <Field label="Nguyên tắc cấu trúc">
                    <ul className={styles.list}>
                      {profile.storytelling.structure_principles.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </Field>
                )}
                {profile.frameworks && (
                  <Field label="Các framework khác">
                    {Object.entries(profile.frameworks).filter(([k]) => k !== 'primary').map(([name, desc]) => (
                      <div key={name} className={styles.frameworkCard}>
                        <span className={styles.frameworkName}>{name}</span>
                        <p className={styles.frameworkDesc}>{desc}</p>
                      </div>
                    ))}
                  </Field>
                )}
              </div>
            )}

            {/* ── Format Patterns ── */}
            {activeSection === 'formats' && (
              <div className={styles.section}>
                {profile.format_patterns && Object.entries(profile.format_patterns).map(([fmt, pat]) => (
                  <div key={fmt} className={styles.formatCard}>
                    <button className={styles.formatHeader} onClick={() => toggle(fmt)}>
                      <span className={`badge badge-blue ${styles.fmtBadge}`}>{FORMAT_VI[fmt] ?? fmt}</span>
                      {profile.format_analysis?.[fmt] && (
                        <span className={styles.fmtMeta}>
                          ER avg {(profile.format_analysis[fmt].avg_er * 100).toFixed(1)}%
                          · {profile.format_analysis[fmt].sample_size} bài
                          · ~{profile.format_analysis[fmt].avg_length_chars} ký tự
                        </span>
                      )}
                      {expanded[fmt] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expanded[fmt] && (
                      <div className={styles.formatBody}>
                        <SmallField label="Opener pattern">
                          <code className={styles.code}>{pat.opener}</code>
                        </SmallField>
                        <SmallField label="Cấu trúc">
                          <p className={styles.text}>{pat.structure}</p>
                        </SmallField>
                        {pat.emoji_anchors?.length > 0 && (
                          <SmallField label="Emoji anchors">
                            <span className={styles.emojiRow}>{pat.emoji_anchors.join('  ')}</span>
                          </SmallField>
                        )}
                        <SmallField label="CTA điển hình">
                          <p className={styles.ctaText}>{pat.cta_pattern}</p>
                        </SmallField>
                        <SmallField label="ChatGPT image prompt">
                          <p className={styles.imagePrompt}>{pat.chatgpt_image_prompt}</p>
                        </SmallField>
                        {/* Top openers from data + approved */}
                        {profile.format_analysis?.[fmt]?.top_openers?.length > 0 && (
                          <SmallField label="Bài mở đầu tốt nhất">
                            {profile.format_analysis[fmt].top_openers.map((o, i) => (
                              <div key={i} className={styles.openerCard}>
                                {o.is_approved ? (
                                  <span className={styles.openerEr} style={{ color: 'var(--momo-pink)' }}>
                                    <BookmarkCheck size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                                    Đã duyệt
                                  </span>
                                ) : (
                                  <span className={styles.openerEr}>
                                    ER {o.er != null ? `${(o.er * 100).toFixed(1)}%` : '—'}
                                    {o.has_reward ? ' (reward)' : ''}
                                  </span>
                                )}
                                <p className={styles.openerText}>"{o.preview}…"</p>
                              </div>
                            ))}
                          </SmallField>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!profile.format_patterns || Object.keys(profile.format_patterns).length === 0) && (
                  <p className={styles.empty}>Chưa có format patterns. Chạy Rebuild để tạo từ data.</p>
                )}
              </div>
            )}

            {/* ── Top Angles ── */}
            {activeSection === 'angles' && (
              <div className={styles.section}>
                <div className={styles.angleNote}>
                  <Info size={12} />
                  <span>Chỉ tính bài organic (không reward). ER có recency weight. <BookmarkCheck size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> = có caption đã duyệt.</span>
                </div>
                {profile.top_angles_organic?.length > 0 ? (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Chủ đề × Format</th>
                        <th>Avg ER</th>
                        <th>Best ER</th>
                        <th>Mẫu</th>
                        <th>N</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.top_angles_organic.map((a, i) => (
                        <tr key={i} style={a.has_approved ? { background: 'var(--pink-50)' } : undefined}>
                          <td>
                            <span className={styles.angleTopic}>
                              {a.has_approved && (
                                <BookmarkCheck size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: 'var(--momo-pink)' }} />
                              )}
                              {a.topic}
                            </span>
                            <span className={`badge badge-blue ${styles.angleFmt}`}>{FORMAT_VI[a.format] ?? a.format}</span>
                          </td>
                          <td className={styles.erCell} style={{ color: a.avg_er >= 0.45 ? 'var(--green)' : a.avg_er >= 0.30 ? '#9A7000' : 'var(--red)' }}>
                            {(a.avg_er * 100).toFixed(1)}%
                          </td>
                          <td className={styles.erCell}>{(a.best_er * 100).toFixed(1)}%</td>
                          <td className={styles.previewCell} title={a.approved_preview ?? a.best_post_preview}>
                            {(a.approved_preview ?? a.best_post_preview)?.substring(0, 80)}…
                          </td>
                          <td className={styles.nCell}>{a.sample_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className={styles.empty}>Chưa có dữ liệu angle. Chạy Rebuild để phân tích từ posts hiện tại.</p>
                )}
              </div>
            )}

            {/* ── Visual Design ── */}
            {activeSection === 'visual' && profile.visual_design && (
              <div className={styles.section}>
                {profile.visual_design.brand_colors && (
                  <Field label="Brand colors">
                    <div className={styles.colorGrid}>
                      {Object.entries(profile.visual_design.brand_colors).map(([name, hex]) => (
                        <div key={name} className={styles.colorChip}>
                          <div className={styles.colorSwatch} style={{ background: hex }} />
                          <span className={styles.colorName}>{name}</span>
                          <span className={styles.colorHex}>{hex}</span>
                        </div>
                      ))}
                    </div>
                  </Field>
                )}
                {profile.visual_design.typography && (
                  <Field label="Typography">
                    {Object.entries(profile.visual_design.typography).map(([k, v]) => (
                      <div key={k} className={styles.typoRow}>
                        <span className={styles.typoKey}>{k}</span>
                        <span className={styles.typoVal}>{v}</span>
                      </div>
                    ))}
                  </Field>
                )}
                {profile.visual_design.image_direction && (
                  <>
                    <Field label="Nên dùng">
                      <ul className={styles.list}>
                        {profile.visual_design.image_direction.prefer?.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </Field>
                    <Field label="Tránh">
                      <ul className={`${styles.list} ${styles.listRed}`}>
                        {profile.visual_design.image_direction.avoid?.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </Field>
                    <Field label="ChatGPT general prompt">
                      <p className={styles.imagePrompt}>{profile.visual_design.image_direction.chatgpt_general_direction}</p>
                    </Field>
                  </>
                )}
              </div>
            )}

            {/* ── Engagement Triggers ── */}
            {activeSection === 'triggers' && (
              <div className={styles.section}>
                {profile.engagement_triggers && (
                  <>
                    {profile.engagement_triggers.window_days && (
                      <div className={styles.angleNote} style={{ marginBottom: 'var(--space-3)' }}>
                        <Info size={12} />
                        <span>Phân tích {profile.engagement_triggers.window_days} ngày gần nhất để tăng độ chính xác.</span>
                      </div>
                    )}
                    {profile.engagement_triggers.high_er_organic_count != null && (
                      <div className={styles.triggerStats}>
                        <Stat label="Bài organic ER cao" value={profile.engagement_triggers.high_er_organic_count} />
                        <Stat label="Có emoji opener" value={`${profile.engagement_triggers.emoji_in_opener_pct ?? '—'}%`} />
                        <Stat label="Có con số" value={`${profile.engagement_triggers.number_in_content_pct ?? '—'}%`} />
                        <Stat label="Có câu hỏi" value={`${profile.engagement_triggers.question_present_pct ?? '—'}%`} />
                      </div>
                    )}
                    {profile.engagement_triggers.high_er_signals?.length > 0 && (
                      <Field label="Signals tương tác cao">
                        <ul className={styles.list}>
                          {profile.engagement_triggers.high_er_signals.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </Field>
                    )}
                    {profile.engagement_triggers.low_er_patterns?.length > 0 && (
                      <Field label="Patterns ER thấp (cần tránh)">
                        <ul className={`${styles.list} ${styles.listRed}`}>
                          {profile.engagement_triggers.low_er_patterns.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </Field>
                    )}
                    {profile.engagement_triggers.format_er_ranking?.length > 0 && (
                      <Field label="Format ranking by ER">
                        {profile.engagement_triggers.format_er_ranking.map((f, i) => (
                          <div key={i} className={styles.rankRow}>
                            <span className={`badge badge-blue`}>{FORMAT_VI[f.format] ?? f.format}</span>
                            <span className={styles.rankNote}>{f.note}</span>
                          </div>
                        ))}
                      </Field>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.fieldBody}>{children}</div>
    </div>
  )
}

function SmallField({ label, children }) {
  return (
    <div className={styles.smallField}>
      <label className={styles.smallLabel}>{label}</label>
      {children}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statVal}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
