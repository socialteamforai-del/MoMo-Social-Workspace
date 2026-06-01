/**
 * calendarGen.js — Weekly calendar generation engine
 *
 * Priority tiers (in order):
 *   Phase 1 — Upcoming events  → 1 fixed slot per event (locked)
 *   Phase 2 — Trending topics  → 1 flexible slot for top active trend
 *   Phase 3 — Historical fill  → remaining slots scored from data
 *             When no events AND no trends: historical weights 50/25/25
 */

import {
  historicalPerformanceScore,
  userDemandScore,
  trendScore,
  buPriorityScore,
  timingFitScore,
  finalPriorityScore,
  confidenceLabel,
} from './scoring.js';

const DAYS_VI = {
  Monday: 'Thứ Hai', Tuesday: 'Thứ Ba', Wednesday: 'Thứ Tư',
  Thursday: 'Thứ Năm', Friday: 'Thứ Sáu', Saturday: 'Thứ Bảy', Sunday: 'Chủ Nhật',
};

// Weights when no events and no trends → pure historical
const HISTORICAL_ONLY_WEIGHTS = {
  historical_performance: 0.50,
  user_demand:            0.25,
  timing_fit:             0.25,
  trend:                  0.00,
  bu_priority:            0.00,
  cross_interest:         0.00,
};

export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function selectAlternateTopic(currentTopic, recentlyUsed, topicGroups, posts) {
  const notRecent = topicGroups.filter(t => !recentlyUsed.includes(t));
  const pool = notRecent.length > 0 ? notRecent : topicGroups.filter(t => t !== currentTopic);
  if (pool.length === 0) return currentTopic;
  const scored = pool.map(topic => {
    const matching = posts.filter(p => p.topic_group === topic);
    const avgER = matching.length
      ? matching.reduce((s, p) => s + p.er_user, 0) / matching.length
      : 0.3;
    return { topic, avgER };
  });
  scored.sort((a, b) => b.avgER - a.avgER);
  return scored[0].topic;
}

function getOptimalHour(day, topic, format, timingBenchmarks, defaultHour) {
  if (!timingBenchmarks?.length) return defaultHour;
  const exact = timingBenchmarks.find(b => b.topic_group === topic && b.content_format === format && b.best_day === day);
  if (exact) return exact.best_hour;
  const byFormat = timingBenchmarks.filter(b => b.content_format === format);
  if (byFormat.length) return byFormat.sort((a, b) => b.avg_er - a.avg_er)[0].best_hour;
  const byDay = timingBenchmarks.filter(b => b.best_day === day);
  if (byDay.length) return byDay.sort((a, b) => b.avg_er - a.avg_er)[0].best_hour;
  return defaultHour;
}

// Infer best format from event fields
function inferEventFormat(ev) {
  const m = (ev.mechanic || '').toLowerCase();
  if (m.includes('poll') || m.includes('bình chọn') || m.includes('vote')) return 'poll';
  if (m.includes('minigame') || m.includes('game') || m.includes('đố vui')) return 'minigame';
  if (ev.reward) return 'promo_info';
  return 'promo_info';
}

// Per-page visual direction templates
const PAGE_VISUAL = {
  mama_tai_chinh: {
    poll:                  'Nền hồng pastel nhạt. Nhân vật MaMa cầm thẻ bình chọn, nét vẽ line-art hồng. Badge label màu hồng MoMo góc trên trái. Stripe trang trí hồng bên phải. CTA bar hồng đậm phía dưới. Không có chữ.',
    educational_post:      'Nền hồng pastel nhạt. Nhân vật MaMa tư thế giảng dạy/trình bày, có icon bóng đèn hoặc biểu đồ. Badge label teal (#00BFA5) góc trên trái. Stripe trang trí hồng bên phải. CTA bar hồng đậm phía dưới. Không có chữ.',
    market_update:         'Nền hồng pastel nhạt. Nhân vật MaMa nhìn vào biểu đồ tăng trên điện thoại, nét vẽ line-art hồng. Badge label hồng MoMo góc trên trái. Mini chart icon teal. CTA bar hồng đậm phía dưới. Không có chữ.',
    qa:                    'Nền hồng pastel nhạt. Nhân vật MaMa tư thế trả lời thân thiện, tay chỉ lên. Badge label hồng MoMo góc trên trái. Speech bubble nhỏ trang trí. CTA bar hồng đậm phía dưới. Không có chữ.',
    service_faq:           'Nền hồng pastel nhạt. Nhân vật MaMa đang chỉ vào màn hình điện thoại MoMo app. Badge label hồng MoMo góc trên trái. Stripe trang trí hồng bên phải. CTA bar hồng đậm phía dưới. Không có chữ.',
    minigame:              'Nền hồng pastel nhạt. Nhân vật MaMa tư thế vui mừng/ăn mừng, confetti xung quanh, hộp quà trang trí. Badge label vàng góc trên trái. CTA bar hồng đậm phía dưới. Không có chữ.',
    confession_discussion: 'Nền hồng pastel ấm. Nhân vật MaMa tư thế lắng nghe thân thiện. Speech bubble trang trí. Badge label hồng MoMo góc trên trái. Stripe trang trí hồng bên phải. CTA bar hồng đậm phía dưới. Không có chữ.',
    promo_info:            'Nền hồng pastel nhạt. Nhân vật MaMa tư thế phấn khích, đồng tiền vàng hoặc badge thưởng trang trí xung quanh. Badge label màu vàng (#F6C315) góc trên trái. Stripe hồng bên phải. CTA bar hồng đậm phía dưới. Không có chữ.',
  },
  heo_dat_momo: {
    minigame_quiz:    'Nền cam/vàng ấm pastel. Nhân vật Heo Đất tư thế vui nhộn cầm câu hỏi, confetti xung quanh. Badge label cam (#FF6B35) góc trên trái. CTA bar cam đậm phía dưới. Không có chữ.',
    gamified_reward:  'Nền cam ấm pastel. Nhân vật Heo Đất đang vẫy tay mời tham gia, trái tim và ngôi sao trang trí. Badge label vàng (#FFB800) góc trên trái. CTA bar cam đậm phía dưới. Không có chữ.',
    thanh_qua_du_an:  'Nền xanh lá nhạt ấm áp. Nhân vật Heo Đất tư thế tự hào giơ biểu ngữ thành quả. Số liệu nổi bật dạng infographic đơn giản. Badge label xanh lá (#4CAF50) góc trên trái. CTA bar xanh đậm phía dưới. Không có chữ.',
    donation_call:    'Nền trắng ấm/vàng nhạt. Nhân vật Heo Đất tư thế kêu gọi thân thiện, trái tim màu đỏ/cam trang trí. Badge label đỏ nhạt (#E53935) góc trên trái. CTA bar cam đậm phía dưới. Không có chữ.',
    event_comms:      'Nền vàng pastel nhạt. Nhân vật Heo Đất tư thế hào hứng thông báo sự kiện, confetti và cờ trang trí. Badge label vàng (#FFB800) góc trên trái. CTA bar cam đậm phía dưới. Không có chữ.',
    kindness_story:   'Nền pastel ấm (vàng nhạt hoặc cam nhạt). Nhân vật Heo Đất tư thế ấm áp ôm trái tim. Không có quá nhiều chi tiết, để cảm xúc là trọng tâm. Badge label cam nhạt góc trên trái. CTA bar cam đậm phía dưới. Không có chữ.',
    promo_info:       'Nền cam/vàng ấm pastel. Nhân vật Heo Đất tư thế phấn khích, đồng xu và hộp quà trang trí. Badge label vàng (#FFB800) góc trên trái. CTA bar cam đậm phía dưới. Không có chữ.',
    minigame:         'Nền cam/vàng ấm pastel. Nhân vật Heo Đất vui mừng, confetti xung quanh, hộp quà trang trí. Badge label vàng (#FFB800) góc trên trái. CTA bar cam đậm phía dưới. Không có chữ.',
    poll:             'Nền cam ấm pastel. Nhân vật Heo Đất cầm thẻ bình chọn vui nhộn. Badge label cam (#FF6B35) góc trên trái. CTA bar cam đậm phía dưới. Không có chữ.',
  },
}

function getVisual(pageId, format) {
  const map = PAGE_VISUAL[pageId] ?? PAGE_VISUAL['mama_tai_chinh'];
  return map[format] ?? map[Object.keys(map)[0]];
}

// Build content direction from event brief fields
function buildEventDirection(ev, format, pageConfig) {
  const pageId = pageConfig?.page_id ?? 'mama_tai_chinh';
  const name  = ev.event_name || 'Sự kiện sắp tới';
  const angleParts = [ev.mechanic, ev.reward].filter(Boolean);
  const hook  = ev.keyMessage
    ? ev.keyMessage.split(/[.!?]/)[0].trim()
    : `📣 ${name}`;

  return {
    hook,
    content_angle: angleParts.length ? angleParts.join(' · ') : `Giới thiệu ${name}`,
    angle_basis:   'Brief sự kiện từ InputPanel',
    cta:           ev.cta || 'Tham gia ngay trên MoMo! 👇',
    caption_direction: [
      `Đây là bài đăng cho sự kiện "${name}".`,
      ev.mechanic   && `Cơ chế: ${ev.mechanic}.`,
      ev.reward     && `Phần thưởng: ${ev.reward}.`,
      ev.stats      && `Số liệu nổi bật: ${ev.stats}.`,
      ev.keyMessage && `Key message: ${ev.keyMessage}.`,
      'Giọng thân thiện, CTA rõ ràng, không dùng dấu gạch ngang.',
    ].filter(Boolean).join(' '),
    visual_direction:  getVisual(pageId, format),
    similar_post_ref:  null,
    has_reward_note:   ev.reward ? ' (có reward — track ER organic riêng)' : '',
    basis: { performance: null, trend: null, trend_topic: null, trend_source: null, timing: null, bu: name },
  };
}

function finalizeHours(slots) {
  const byDate = {};
  for (const s of slots) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }
  for (const daySlots of Object.values(byDate)) {
    if (daySlots.length <= 1) continue;
    daySlots.sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0) || b.priority_score - a.priority_score);
    const HOUR_OPTIONS = [8, 11, 14, 17, 20];
    const usedHours = new Set(daySlots.map(s => s.publish_hour));
    const available = [daySlots[0].publish_hour, ...HOUR_OPTIONS.filter(h => !usedHours.has(h))];
    daySlots.forEach((s, i) => { if (available[i] !== undefined) s.publish_hour = available[i]; });
  }
  return slots.sort((a, b) => a.date.localeCompare(b.date) || a.publish_hour - b.publish_hour);
}

export function generateWeeklyCalendar(pageConfig, inputs, data) {
  const { weekStart, numPosts = 7, mode = 'balanced', buInputs = [] } = inputs;
  const { posts = [], timingBenchmarks = [], trends = [] } = data;

  const days        = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const pillar      = pageConfig.weekly_pillar_mix;
  const weights     = pageConfig.scoring_weights;
  const benchmarks  = pageConfig.benchmarks;
  const allFormats  = pageConfig.content_formats ?? ['educational_post', 'poll', 'market_update', 'qa', 'minigame'];

  const weekStartDate = weekStart instanceof Date ? weekStart : new Date(weekStart);
  const weekDates = {};
  days.forEach((day, i) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    weekDates[day] = formatDate(d);
  });
  const dateToDay = Object.fromEntries(Object.entries(weekDates).map(([d, dt]) => [dt, d]));

  // Active trends
  const today = new Date();
  const activeTrends = trends.filter(t => {
    if (t.status !== 'active') return false;
    const exp = new Date(t.trend_date);
    exp.setDate(exp.getDate() + (t.expiry_window_days || 7));
    return today <= exp;
  });

  // Detect what signals exist
  const eventsWithDate   = buInputs.filter(e => e.event_name && e.must_publish_date && dateToDay[e.must_publish_date]);
  const eventsWithoutDate= buInputs.filter(e => e.event_name && !(e.must_publish_date && dateToDay[e.must_publish_date]));
  const hasEvents        = buInputs.some(e => e.event_name);
  const hasTrends        = activeTrends.length > 0;
  const isHistoricalOnly = !hasEvents && !hasTrends;

  const effectiveWeights = isHistoricalOnly ? HISTORICAL_ONLY_WEIGHTS : { ...weights };

  const slots        = [];
  const usedTopics   = [];
  const usedCombos   = new Set();  // "topic:format" — no exact repeat per week
  const slotsOnDate  = {};         // date → count

  const push = (slot) => {
    slots.push(slot);
    slotsOnDate[slot.date] = (slotsOnDate[slot.date] || 0) + 1;
  };

  // ── Phase 1: Upcoming events → FIXED slots ──────────────────────────────────

  // Events with specific date in current week
  for (const ev of eventsWithDate) {
    const day    = dateToDay[ev.must_publish_date];
    const date   = ev.must_publish_date;
    const format = inferEventFormat(ev);
    const topic  = pillar[day]?.topic || pageConfig.topic_groups[0];
    const hour   = getOptimalHour(day, topic, format, timingBenchmarks, pageConfig.default_publish_hour);

    push({
      id:             `${pageConfig.page_id}_${date}_event_${slots.length}`,
      page_id:        pageConfig.page_id,
      date, day_of_week: day, day_vi: DAYS_VI[day],
      publish_hour:   hour,
      slot_type:      'fixed',
      status:         'draft',
      topic_group:    topic,
      content_format: format,
      objective:      'engagement',
      priority_score: 1.0,
      confidence:     { label: 'Cao', color: 'green' },
      score_components: { historical: 0.7, userDemand: 0.5, trend: 0, buPriority: 1.0, timingFit: 0.8 },
      direction:      buildEventDirection(ev, format, pageConfig),
      bu_campaign:    ev.event_name,
      locked:         true,
      fallback_idea:  null,
      notes:          `📌 Sự kiện: ${ev.event_name}`,
    });
    usedTopics.push(topic);
    usedCombos.add(`${topic}:${format}`);
  }

  // Events without a date → assign to first available FUTURE day (today or later)
  const todayDateStr = formatDate(new Date())
  for (const ev of eventsWithoutDate) {
    // Prefer today/future days with no slots yet; fall back to any today/future day
    const day = days.find(d => weekDates[d] >= todayDateStr && (slotsOnDate[weekDates[d]] || 0) === 0)
             || days.find(d => weekDates[d] >= todayDateStr)
             || days[days.length - 1]  // last day of week as absolute fallback
    const date = weekDates[day];
    const format = inferEventFormat(ev);
    const topic  = pillar[day]?.topic || pageConfig.topic_groups[0];
    const hour   = getOptimalHour(day, topic, format, timingBenchmarks, pageConfig.default_publish_hour);

    push({
      id:             `${pageConfig.page_id}_${date}_event_flex_${slots.length}`,
      page_id:        pageConfig.page_id,
      date, day_of_week: day, day_vi: DAYS_VI[day],
      publish_hour:   hour,
      slot_type:      'flexible',   // flexible — user can drag to preferred day
      status:         'draft',
      topic_group:    topic,
      content_format: format,
      objective:      'engagement',
      priority_score: 0.95,
      confidence:     { label: 'Cao', color: 'green' },
      score_components: { historical: 0.7, userDemand: 0.5, trend: 0, buPriority: 1.0, timingFit: 0.5 },
      direction:      buildEventDirection(ev, format, pageConfig),
      bu_campaign:    ev.event_name,
      locked:         false,        // not locked — user can drag to choose exact day
      fallback_idea:  null,
      notes:          `📌 Sự kiện: ${ev.event_name} (kéo để chọn ngày phù hợp)`,
    });
    usedTopics.push(topic);
    usedCombos.add(`${topic}:${format}`);
  }

  // ── Phase 2: Trending topic → 1 flexible slot ─────────────────────────────

  if (hasTrends) {
    const topTrend = [...activeTrends].sort((a, b) => (b.trend_strength || 0) - (a.trend_strength || 0))[0];
    // Pick the day with fewest slots so far
    const trendDay = [...days].sort((a, b) => (slotsOnDate[weekDates[a]] || 0) - (slotsOnDate[weekDates[b]] || 0))[0];
    const date     = weekDates[trendDay];
    const format   = topTrend.recommended_format || 'educational_post';
    const topic    = topTrend.trend_topic || pageConfig.topic_groups[0];
    const hour     = getOptimalHour(trendDay, topic, format, timingBenchmarks, pageConfig.default_publish_hour);

    const scoreComponents = {
      historical: historicalPerformanceScore(topic, format, posts, benchmarks),
      userDemand: userDemandScore(topic, posts),
      trend:      1.0,
      buPriority: 0,
      timingFit:  timingFitScore(trendDay, hour, topic, format, timingBenchmarks),
    };
    const priority = Math.max(finalPriorityScore(scoreComponents, weights), 0.80);

    push({
      id:             `${pageConfig.page_id}_${date}_trend_${slots.length}`,
      page_id:        pageConfig.page_id,
      date, day_of_week: trendDay, day_vi: DAYS_VI[trendDay],
      publish_hour:   hour,
      slot_type:      'flexible',
      status:         'draft',
      topic_group:    topic,
      content_format: format,
      objective:      'engagement',
      priority_score: priority,
      confidence:     { label: 'Cao', color: 'green' },
      score_components: scoreComponents,
      direction: {
        hook:              `🔥 Đang viral: ${topTrend.trend_topic}`,
        content_angle:     topTrend.recommended_angle || `Khai thác xu hướng "${topTrend.trend_topic}" gắn với MoMo`,
        angle_basis:       `Trend ${topTrend.trend_type}: "${topTrend.trend_topic}"`,
        cta:               'Bạn nghĩ sao? Comment ngay! 💬',
        caption_direction: 'Nhanh, gọn, bắt kịp xu hướng. Kết nối với MoMo/tài chính cá nhân nếu phù hợp.',
        visual_direction:  getVisual(pageConfig.page_id, format),
        similar_post_ref:  null,
        has_reward_note:   '',
        basis: { trend: topTrend.trend_topic, trend_topic: topTrend.trend_topic, trend_source: topTrend.source ?? null, performance: null, timing: null, bu: null },
      },
      bu_campaign:    null,
      locked:         false,
      fallback_idea:  null,
      notes:          `🔥 Trend: ${topTrend.trend_topic}`,
    });
    usedTopics.push(topic);
    usedCombos.add(`${topic}:${format}`);
  }

  // ── Phase 3: Historical fill (remaining numPosts) ─────────────────────────

  const needed    = numPosts - slots.length;
  if (needed > 0) {
    const base  = Math.floor(needed / days.length);
    const extra = needed % days.length;
    const slotsPerDay = days.map((_, i) => base + (i < extra ? 1 : 0));

    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day   = days[dayIdx];
      const count = slotsPerDay[dayIdx];
      if (count === 0) continue;
      if (weekDates[day] < todayDateStr) continue;  // skip past days

      for (let postIdx = 0; postIdx < count; postIdx++) {
        const date = weekDates[day];
        const pillarDef = pillar[day] || {
          format:    day === 'Sunday' ? 'minigame' : 'educational_post',
          topic:     pageConfig.topic_groups[0],
          slot_type: 'flexible',
        };

        // Format: pillar default for first post; rotate for extras on same day
        let format = pillarDef.format;
        if ((slotsOnDate[date] || 0) > 0) {
          const usedFormatsToday = slots.filter(s => s.date === date).map(s => s.content_format);
          const remaining = allFormats.filter(f => !usedFormatsToday.includes(f));
          format = remaining[0] ?? allFormats.find(f => f !== pillarDef.format) ?? pillarDef.format;
        }

        // Topic anti-repeat (by recency + weekly frequency)
        let topic = pillarDef.topic;
        const recentTwo = usedTopics.slice(-2);
        const weekCount = usedTopics.filter(t => t === topic).length;
        if (recentTwo.includes(topic) || weekCount >= 2) {
          topic = selectAlternateTopic(topic, recentTwo, pageConfig.topic_groups, posts);
        }

        // Combo anti-repeat: avoid same topic+format pair used earlier this week
        if (usedCombos.has(`${topic}:${format}`)) {
          const altFormat = allFormats.find(f => f !== format && !usedCombos.has(`${topic}:${f}`));
          if (altFormat) {
            format = altFormat;
          } else {
            // All formats for this topic used — try a different topic
            const altTopic = selectAlternateTopic(topic, usedTopics.slice(-3), pageConfig.topic_groups, posts);
            if (altTopic !== topic) topic = altTopic;
            // Pick first non-used combo format for the new topic
            const altFmt = allFormats.find(f => !usedCombos.has(`${topic}:${f}`)) ?? format;
            format = altFmt;
          }
        }

        usedTopics.push(topic);
        usedCombos.add(`${topic}:${format}`);

        const hour = getOptimalHour(day, topic, format, timingBenchmarks, pageConfig.default_publish_hour);

        const scoreComponents = {
          historical: historicalPerformanceScore(topic, format, posts, benchmarks),
          userDemand: userDemandScore(topic, posts),
          trend:      trendScore(topic, format, trends),
          buPriority: buPriorityScore(topic, format, buInputs),
          timingFit:  timingFitScore(day, hour, topic, format, timingBenchmarks),
        };

        // Apply mode overrides on top of effective weights
        let modeWeights = { ...effectiveWeights };
        if (!isHistoricalOnly) {
          if (mode === 'business-led') {
            modeWeights.bu_priority            = 0.35;
            modeWeights.historical_performance = 0.20;
          } else if (mode === 'performance-led') {
            modeWeights.historical_performance = 0.45;
            modeWeights.bu_priority            = 0.05;
          }
        }

        const priority   = finalPriorityScore(scoreComponents, modeWeights);
        const confidence = confidenceLabel(priority);
        const direction  = generateContentDirection(topic, format, activeTrends, [], scoreComponents, posts, timingBenchmarks, pageConfig);

        push({
          id:             `${pageConfig.page_id}_${date}_${format}_h${postIdx}`,
          page_id:        pageConfig.page_id,
          date, day_of_week: day, day_vi: DAYS_VI[day],
          publish_hour:   hour,
          slot_type:      pillarDef.slot_type || 'flexible',
          status:         'draft',
          topic_group:    topic,
          content_format: format,
          objective:      inferObjective(format, topic),
          priority_score: priority,
          confidence,
          score_components: scoreComponents,
          direction,
          bu_campaign:    null,
          locked:         false,
          fallback_idea:  generateFallback(topic, format, pageConfig),
          notes:          '',
        });
      }
    }
  }

  return finalizeHours(slots);
}

// ── Content direction helpers ─────────────────────────────────────────────────

function inferObjective(format, topic) {
  if (['poll', 'minigame'].includes(format)) return 'engagement';
  if (format === 'market_update') return 'education';
  if (topic.startsWith('Hỏi')) return 'service_adoption';
  return 'education';
}

const TOPIC_CONTENT = {
  'Dự đoán giá cổ phiếu': {
    poll:           { hook: '📊 DỰ ĐOÁN HÔM NAY: Giá cổ phiếu VN30 sẽ TĂNG, GIẢM hay KHÔNG ĐỔI sau phiên chiều?', angle: 'Dự đoán biến động cổ phiếu blue-chip trong phiên hôm nay — kêu gọi cộng đồng bình chọn và nhận thưởng kết quả đúng' },
    market_update:  { hook: '📈 Cập nhật phiên sáng: VN-Index và top cổ phiếu được giao dịch nhiều nhất hôm nay', angle: 'Điểm nhanh 2–3 cổ phiếu có thanh khoản cao hoặc biến động đáng chú ý — giúp nhà đầu tư cá nhân ra quyết định kịp thời' },
    educational_post:{ hook: 'Bạn có biết: Chỉ cần đọc 3 chỉ số này mỗi sáng, bạn đã nắm được "nhịp" thị trường hôm nay?', angle: 'Hướng dẫn đọc nhanh P/E, KLGD, và xu hướng MA20 — 3 chỉ số tối thiểu cho nhà đầu tư cá nhân mới' },
    qa:             { hook: 'Nhiều bạn hỏi MaMa: "Nên giữ hay bán cổ phiếu khi thị trường biến động mạnh?" — đây là góc nhìn từ dữ liệu!', angle: 'Trả lời câu hỏi phổ biến nhất về thời điểm giữ/bán cổ phiếu dựa trên dữ liệu lịch sử VN-Index' },
  },
  'Phân tích thị trường chứng khoán': {
    market_update:  { hook: '🔍 Tuần này thị trường chứng khoán Việt Nam có gì đáng chú ý? MaMa tóm tắt trong 60 giây!', angle: 'Tóm tắt tuần: điểm số VN-Index, top tăng/giảm, và 1 yếu tố vĩ mô quan trọng cần theo dõi tuần sau' },
    poll:           { hook: 'Theo bạn, VN-Index tuần tới sẽ về mốc nào? 1,200 — 1,250 — 1,300 hay vượt 1,300? 📊', angle: 'Poll dự đoán xu hướng VN-Index tuần tới — tổng hợp góc nhìn cộng đồng và đối chiếu với phân tích kỹ thuật' },
    educational_post:{ hook: 'Thị trường xanh hay đỏ không quan trọng bằng... bạn có đang hiểu đúng tín hiệu không?', angle: 'Giải thích 3 sai lầm phân tích phổ biến nhất của nhà đầu tư cá nhân khi đọc bảng giá chứng khoán' },
    confession_discussion: { hook: '💬 "Tôi đã bán tháo VIC lúc thị trường giảm mạnh và hối hận ngay sau đó..." — bạn có từng như vậy không?', angle: 'Chia sẻ trải nghiệm tâm lý khi thị trường biến động — kêu gọi cộng đồng thảo luận về cách kiểm soát cảm xúc đầu tư' },
  },
  'Giáo dục tài chính & chi tiêu': {
    educational_post:{ hook: 'Người Việt trung bình tiết kiệm được bao nhiêu % thu nhập? Con số thực tế sẽ khiến bạn bất ngờ 👇', angle: 'So sánh tỷ lệ tiết kiệm thực tế vs khuyến nghị (20% quy tắc 50/30/20) — gợi ý 1 thói quen nhỏ tạo thay đổi lớn' },
    poll:           { hook: 'Mỗi tháng bạn tiết kiệm được bao nhiêu % thu nhập? Chọn đáp án thật nhất nhé! 💰', angle: 'Poll khảo sát thói quen tiết kiệm của cộng đồng — chia sẻ kết quả và so sánh với benchmark tài chính cá nhân' },
    confession_discussion: { hook: '💬 "Tháng này tôi tiêu hết lương trước ngày 20 mà không hiểu tiền đi đâu..." — ai đồng cảnh ngộ?', angle: 'Thảo luận về các "lỗ hổng" chi tiêu vô thức — kêu gọi chia sẻ mẹo kiểm soát chi tiêu đã thực sự hiệu quả' },
    qa:             { hook: 'MaMa trả lời: "Với mức lương 10 triệu, tôi nên bắt đầu đầu tư từ đâu?" 💡', angle: 'Lộ trình tài chính cho người mới đi làm: ưu tiên quỹ khẩn cấp trước, sau đó mới đến đầu tư — số liệu cụ thể' },
  },
  'Minigame nhận thưởng': {
    minigame:       { hook: '🎮 MINIGAME HÔM NAY: Dự đoán đúng giá đóng cửa VN-Index — nhận ngay [phần thưởng]!', angle: 'Game dự đoán điểm số VN-Index cuối phiên — công bố kết quả và trao thưởng trong vòng 24h, tạo thói quen theo dõi thị trường' },
    poll:           { hook: '🏆 Thử thách tài chính tuần này: Bạn biết gì về [chủ đề tài chính hot]? Bình chọn để thử sức!', angle: 'Mini-quiz tài chính dưới dạng poll — câu hỏi có độ khó vừa phải, reveal đáp án kèm giải thích ngắn gọn' },
  },
  'Vay tiền và điểm tín dụng MoMo': {
    service_faq:    { hook: 'Điểm tín dụng MoMo của bạn đang ở mức nào — và nó ảnh hưởng thế nào đến hạn mức vay?', angle: 'Giải thích rõ cách tính điểm tín dụng MoMo, ngưỡng điểm tốt/trung bình/kém, và 3 cách cải thiện điểm trong 30 ngày' },
    educational_post:{ hook: 'Bạn có biết: điểm tín dụng MoMo có thể tăng chỉ nhờ 1 thói quen đơn giản mỗi tháng?', angle: 'Hướng dẫn cụ thể tăng điểm tín dụng MoMo: thanh toán đúng hạn, sử dụng tính năng đều đặn, và liên kết tài khoản ngân hàng' },
    qa:             { hook: 'Q: "Tôi bị từ chối vay MoMo dù thu nhập ổn định — lý do là gì?" A: MaMa giải thích ngay!', angle: 'Top 5 lý do bị từ chối vay tiền MoMo và cách khắc phục từng lý do — thông tin thực tế, không mang tính quảng cáo' },
  },
  'Hỏi tư vấn tài chính': {
    qa:             { hook: 'Nhiều bạn hỏi MaMa tuần này: "Nên mua vàng hay gửi tiết kiệm khi lãi suất đang thay đổi?" 💡', angle: 'So sánh thực tế vàng vs tiết kiệm ngân hàng trong 12 tháng qua — số liệu cụ thể, không thiên vị sản phẩm nào' },
    educational_post:{ hook: '3 câu hỏi tài chính MaMa nhận nhiều nhất tuần này — và câu trả lời bạn cần biết', angle: 'Tổng hợp 3 câu hỏi tài chính phổ biến nhất từ cộng đồng tuần qua — trả lời ngắn gọn, có số liệu thực tế' },
    confession_discussion: { hook: '💬 "Tôi không biết bắt đầu đầu tư từ đâu dù đã đi làm 3 năm..." — bạn có từng bí như vậy?', angle: 'Thảo luận về rào cản tâm lý khi bắt đầu đầu tư — kêu gọi cộng đồng chia sẻ bước đầu tiên họ đã làm' },
  },
  'Hỏi hoàn tiền và ưu đãi': {
    service_faq:    { hook: 'Mẹo nhỏ: Bạn đang bỏ sót hoàn tiền MoMo mỗi tháng mà không biết — đây là cách lấy lại!', angle: 'Hướng dẫn từng bước kích hoạt và tối đa hoàn tiền MoMo: dùng đúng tính năng, đúng đối tác, đúng thời điểm' },
    qa:             { hook: 'Q: "Hoàn tiền MoMo tính thế nào? Tại sao có lần được hoàn có lần không?" A: Giải thích rõ!', angle: 'Giải thích cơ chế hoàn tiền MoMo theo từng loại giao dịch — kèm ví dụ số tiền cụ thể để dễ hiểu' },
    promo_info:     { hook: '💸 Ưu đãi hoàn tiền đang hot tuần này trên MoMo — đừng bỏ lỡ!', angle: 'Tổng hợp ưu đãi hoàn tiền nổi bật đang chạy — highlight mức hoàn cao nhất và điều kiện áp dụng cụ thể' },
  },
  'Hỏi rút tiền và đổi điểm': {
    service_faq:    { hook: 'Cách rút tiền MoMo nhanh nhất và KHÔNG mất phí — bạn đã biết chưa?', angle: 'So sánh các kênh rút tiền MoMo: ngân hàng, ATM, ví điện tử — phí, tốc độ, và giới hạn rút từng kênh' },
    qa:             { hook: 'Q: "Điểm thưởng MoMo đổi được gì? Có đáng tích điểm không?" — MaMa giải đáp!', angle: 'Hướng dẫn đổi điểm MoMo hiệu quả nhất: quy đổi ra tiền mặt vs voucher — tính toán giá trị thực từng lựa chọn' },
    educational_post:{ hook: 'Bạn đang có điểm MoMo nhưng chưa đổi? Đây là lúc nên đổi để được lợi nhất!', angle: 'Thời điểm vàng đổi điểm MoMo — so sánh giá trị quy đổi theo từng danh mục và tip tối ưu điểm thưởng' },
  },
  'Chia sẻ tin tức VN-Index & blue-chip': {
    market_update:  { hook: '📰 Tin nhanh: VN-Index hôm nay và 2 cổ phiếu blue-chip đáng theo dõi nhất phiên chiều', angle: 'Cập nhật ngắn gọn diễn biến VN-Index và highlight 2 cổ phiếu blue-chip có thanh khoản/biến động đáng chú ý trong ngày' },
    educational_post:{ hook: 'Blue-chip là gì và tại sao nhà đầu tư dài hạn luôn ưu tiên nhóm này? MaMa giải thích!', angle: 'Định nghĩa blue-chip theo tiêu chí thực tế thị trường Việt Nam — so sánh hiệu suất VN30 vs VN-Index 3 năm gần đây' },
  },
};

const FORMAT_CTA_MAMA = {
  poll:                  'Bình chọn ngay bên dưới! 👇',
  minigame:              'Tham gia ngay — phần thưởng chờ bạn! 🎁',
  qa:                    'Còn câu hỏi khác? Comment cho MaMa biết nhé!',
  market_update:         'Theo dõi MaMa Tài Chính để không bỏ lỡ cập nhật thị trường! 📈',
  educational_post:      'Bạn thấy tip này hữu ích không? Tag bạn bè cùng đọc nhé! 🙌',
  service_faq:           'Thử ngay trên app MoMo và cho MaMa biết kết quả nhé!',
  confession_discussion: 'Chia sẻ trải nghiệm của bạn bên dưới — MaMa đọc tất cả! 💬',
  promo_info:            'Áp dụng ngay trên MoMo trước khi hết hạn! ⏰',
};

const FORMAT_CTA_HEO = {
  minigame_quiz:    'Tham gia ngay và rinh lộc về nhà! 🎁',
  gamified_reward:  'Thả tim ngay để nhận quà! ❤️',
  thanh_qua_du_an:  'Cùng Heo lan tỏa kết quả tốt đẹp này nhé! 🌱',
  donation_call:    'Góp chút yêu thương cùng tụi mình nào! 💛',
  event_comms:      'Đăng ký tham gia ngay — chỗ có hạn! 🐷',
  kindness_story:   'Cảm ơn tụi mình đã cùng nhau làm điều tốt! 💚',
  promo_info:       'Tham gia ngay trên MoMo! 👇',
  poll:             'Bình chọn ngay bên dưới! 👇',
  minigame:         'Tham gia ngay — phần thưởng chờ bạn! 🎁',
};

function generateContentDirection(topic, format, activeTrends, buInputs, scores, posts = [], timingBenchmarks = [], pageConfig = null) {
  const pageId = pageConfig?.page_id ?? 'mama_tai_chinh';
  const isHeo  = pageId === 'heo_dat_momo';

  const similarPosts = (posts || [])
    .filter(p => p.topic_group === topic && p.content_format === format)
    .sort((a, b) => b.er_user - a.er_user)
    .slice(0, 3);

  const allReward = similarPosts.length > 0 && similarPosts.every(p => p.has_reward);
  const hasRewardNote = allReward ? ' (lưu ý: top bài cùng format đều có reward — ER organic chưa được đo)' : '';

  const topicMap = TOPIC_CONTENT[topic] || {};
  const specific  = topicMap[format] || topicMap[Object.keys(topicMap)[0]];
  const defaultHook = specific?.hook || `${topic}: góc nhìn ${format} cho cộng đồng`;

  const FORMAT_CTA = isHeo ? FORMAT_CTA_HEO : FORMAT_CTA_MAMA;

  const activeTrend = activeTrends.find(t =>
    t.recommended_format === format ||
    topic.toLowerCase().includes((t.trend_topic || '').toLowerCase().split(' ')[0])
  );

  let content_angle = '';
  let angle_basis   = '';
  let hook          = defaultHook;

  if (activeTrend) {
    content_angle = activeTrend.recommended_angle;
    angle_basis   = `Trend "${activeTrend.trend_topic}" (${activeTrend.trend_type})`;
    hook = `🔥 ${activeTrend.trend_topic} — ${defaultHook}`;
  } else {
    content_angle = specific?.angle || `Góc content tối ưu cho ${topic} dạng ${format}`;
    angle_basis   = 'Angle dựa trên topic taxonomy + dữ liệu lịch sử';
  }

  const topPost = similarPosts[0] || null;
  const similar_post_ref = topPost ? {
    post_id:    topPost.post_id,
    er:         topPost.er_user,
    has_reward: topPost.has_reward,
    preview:    (topPost.post_content || '').substring(0, 100) + '...',
    note:       `Bài tương tự đạt ER ${(topPost.er_user * 100).toFixed(1)}%${topPost.has_reward ? ' (có reward)' : ' (organic)'}`,
  } : null;

  return {
    hook,
    content_angle,
    angle_basis,
    cta:               FORMAT_CTA[format] || 'Bình luận suy nghĩ của bạn bên dưới nhé! 💬',
    caption_direction: `Giọng văn: thân thiện, gần gũi, không quá formal. Độ dài: ${format === 'poll' ? '80–120' : '100–150'} chữ. Cấu trúc: Hook → Context ngắn → CTA rõ ràng. Kết thúc bằng câu hỏi mở.`,
    visual_direction:  getVisual(pageId, format),
    has_reward_note:   hasRewardNote,
    similar_post_ref,
    basis: {
      performance:  scores.historical > 0.6 ? `Format "${format}" đạt ER tốt lịch sử${hasRewardNote}` : 'Format theo pillar mix mặc định',
      trend:        activeTrend ? `Trend: "${activeTrend.trend_topic}"` : null,
      trend_topic:  activeTrend ? activeTrend.trend_topic : null,
      trend_source: activeTrend ? (activeTrend.source ?? null) : null,
      timing:       scores.timingFit > 0.7 ? 'Đúng khung giờ tối ưu theo benchmark' : null,
      bu:           null,
    },
  };
}

function generateFallback(topic, format, pageConfig) {
  const alt = pageConfig.content_formats.filter(f => f !== format)[0] || 'educational_post';
  return {
    topic_group:    topic,
    content_format: alt,
    note:           `Nếu không có nội dung cho ${format}, thay bằng ${alt} cùng topic`,
  };
}

export function injectTrendPost(slots, trend, pageConfig) {
  const reactiveSlot = slots.find(s => s.slot_type === 'reactive' && s.status === 'draft');
  if (!reactiveSlot) return slots;
  return slots.map(s => {
    if (s.id !== reactiveSlot.id) return s;
    return {
      ...s,
      topic_group:    trend.trend_topic,
      content_format: trend.recommended_format,
      slot_type:      'flexible',
      direction: {
        hook:              `🔥 Trend đang hot: ${trend.trend_topic}`,
        content_angle:     trend.recommended_angle,
        angle_basis:       `Trend inject: ${trend.trend_topic}`,
        cta:               'Bạn nghĩ sao? Chia sẻ ngay!',
        caption_direction: 'Nhanh, gọn, bắt kịp xu hướng. Liên kết với MoMo/MaMa nếu phù hợp.',
        visual_direction:  getVisual(pageConfig?.page_id ?? 'mama_tai_chinh', trend.recommended_format),
        similar_post_ref:  null,
        has_reward_note:   '',
        basis: { trend: trend.trend_topic, trend_topic: trend.trend_topic, trend_source: trend.source ?? null, performance: null, timing: null, bu: null },
      },
      notes: `Injected trend: ${trend.trend_topic}`,
    };
  });
}
