/**
 * calendarGen.js — Weekly calendar generation engine
 * Config-driven. Never hardcoded for MaMa only.
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

export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Signal 6: pick an alternate topic not in recentlyUsed, ranked by historical ER
function selectAlternateTopic(currentTopic, recentlyUsed, topicGroups, posts) {
  // Prefer topics not used recently at all
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

// Pick best publish hour for a topic+format from timingBenchmarks
function getOptimalHour(day, topic, format, timingBenchmarks, defaultHour) {
  if (!timingBenchmarks?.length) return defaultHour;
  // Exact match first
  const exact = timingBenchmarks.find(b => b.topic_group === topic && b.content_format === format && b.best_day === day);
  if (exact) return exact.best_hour;
  // Format match
  const byFormat = timingBenchmarks.filter(b => b.content_format === format);
  if (byFormat.length) return byFormat.sort((a, b) => b.avg_er - a.avg_er)[0].best_hour;
  // Day match
  const byDay = timingBenchmarks.filter(b => b.best_day === day);
  if (byDay.length) return byDay.sort((a, b) => b.avg_er - a.avg_er)[0].best_hour;
  return defaultHour;
}

export function generateWeeklyCalendar(pageConfig, inputs, data) {
  const { weekStart, numPosts = 7, mode = 'balanced', buInputs = [] } = inputs;
  const { posts = [], timingBenchmarks = [], trends = [] } = data;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const pillar = pageConfig.weekly_pillar_mix;
  const weights = pageConfig.scoring_weights;
  const benchmarks = pageConfig.benchmarks;

  const weekStartDate = weekStart instanceof Date ? weekStart : new Date(weekStart);
  const weekDates = {};
  days.forEach((day, i) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    weekDates[day] = formatDate(d);
  });

  const activeDays = days.slice(0, Math.min(numPosts, days.length));

  const slots = [];
  const usedTopics = []; // Signal 6: anti-repeat tracker

  for (const day of activeDays) {
    const pillarDef = pillar[day] || {
      format: day === 'Sunday' ? 'minigame' : 'educational_post',
      topic: pageConfig.topic_groups[0],
      slot_type: 'flexible',
    };

    const date = weekDates[day];
    const buLock = buInputs.find(b => b.must_publish_date === date);
    const slotType = buLock ? 'fixed' : pillarDef.slot_type;
    const format = pillarDef.format;
    const hour = getOptimalHour(day, pillarDef.topic, format, timingBenchmarks, pageConfig.default_publish_hour);

    // Signal 6: anti-repeat — avoid same topic in last 2 slots OR used ≥2x this week
    let topic = buLock ? (buLock.priority_topic || pillarDef.topic) : pillarDef.topic;
    if (!buLock) {
      const recentTwo = usedTopics.slice(-2);
      const weekCount = usedTopics.filter(t => t === topic).length;
      if (recentTwo.includes(topic) || weekCount >= 1) {
        topic = selectAlternateTopic(topic, recentTwo, pageConfig.topic_groups, posts);
      }
    }
    usedTopics.push(topic);

    const scoreComponents = {
      historical: historicalPerformanceScore(topic, format, posts, benchmarks),
      userDemand: userDemandScore(topic, posts),
      trend:      trendScore(topic, format, trends),
      buPriority: buPriorityScore(topic, format, buInputs),
      timingFit:  timingFitScore(day, hour, topic, format, timingBenchmarks),
    };

    let effectiveWeights = { ...weights };
    if (mode === 'business-led') {
      effectiveWeights.bu_priority = 0.35;
      effectiveWeights.historical_performance = 0.20;
    } else if (mode === 'performance-led') {
      effectiveWeights.historical_performance = 0.45;
      effectiveWeights.bu_priority = 0.05;
    }

    const priority   = finalPriorityScore(scoreComponents, effectiveWeights);
    const confidence = confidenceLabel(priority);
    const direction  = generateContentDirection(topic, format, trends, buInputs, scoreComponents, posts, timingBenchmarks);

    slots.push({
      id: `${pageConfig.page_id}_${date}_${format}`,
      page_id: pageConfig.page_id,
      date,
      day_of_week: day,
      day_vi: DAYS_VI[day],
      publish_hour: hour,
      slot_type: slotType,
      status: 'draft',
      topic_group: topic,
      content_format: format,
      objective: inferObjective(format, topic),
      priority_score: priority,
      confidence,
      score_components: scoreComponents,
      direction,
      bu_campaign: buLock?.event_name || null,
      locked: slotType === 'fixed',
      fallback_idea: generateFallback(topic, format, pageConfig),
      notes: '',
    });
  }

  // Reassign hours: highest priority_score gets the best hour slot for that day if there's a conflict
  const byDate = {};
  for (const s of slots) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }
  for (const [, daySlots] of Object.entries(byDate)) {
    if (daySlots.length <= 1) continue;
    // Sort by priority: fixed first, then by score desc
    daySlots.sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0) || b.priority_score - a.priority_score);
    // Available hours: distinct hours already assigned + standard spread
    const HOUR_OPTIONS = [8, 11, 14, 17, 20];
    const usedHours = new Set(daySlots.map(s => s.publish_hour));
    const available = [daySlots[0].publish_hour, ...HOUR_OPTIONS.filter(h => !usedHours.has(h))];
    daySlots.forEach((s, i) => { if (available[i] !== undefined) s.publish_hour = available[i]; });
  }

  return slots.sort((a, b) => a.date.localeCompare(b.date) || a.publish_hour - b.publish_hour);
}

function inferObjective(format, topic) {
  if (['poll', 'minigame'].includes(format)) return 'engagement';
  if (format === 'market_update') return 'education';
  if (topic.startsWith('Hỏi')) return 'service_adoption';
  return 'education';
}

// Specific hook + angle per topic × format
const TOPIC_CONTENT = {
  'Dự đoán giá cổ phiếu': {
    poll:           { hook: '📊 DỰ ĐOÁN HÔM NAY: Giá cổ phiếu VN30 sẽ TĂNG, GIẢM hay KHÔNG ĐỔI sau phiên chiều?', angle: 'Dự đoán biến động cổ phiếu blue-chip (MBB, VIC, VHM...) trong phiên giao dịch hôm nay — kêu gọi cộng đồng bình chọn và nhận thưởng kết quả đúng' },
    market_update:  { hook: '📈 Cập nhật phiên sáng: VN-Index và top cổ phiếu được giao dịch nhiều nhất hôm nay', angle: 'Điểm nhanh 2–3 cổ phiếu có thanh khoản cao hoặc biến động đáng chú ý — giúp nhà đầu tư cá nhân ra quyết định kịp thời' },
    educational_post:{ hook: 'Bạn có biết: Chỉ cần đọc 3 chỉ số này mỗi sáng, bạn đã nắm được "nhịp" thị trường hôm nay?', angle: 'Hướng dẫn đọc nhanh P/E, KLGD, và xu hướng MA20 — 3 chỉ số tối thiểu cho nhà đầu tư cá nhân mới' },
    qa:             { hook: 'Nhiều bạn hỏi MaMa: "Nên giữ hay bán cổ phiếu khi thị trường biến động mạnh?" — đây là góc nhìn từ dữ liệu!', angle: 'Trả lời câu hỏi phổ biến nhất về thời điểm giữ/bán cổ phiếu dựa trên dữ liệu lịch sử VN-Index' },
  },
  'Phân tích thị trường chứng khoán': {
    market_update:  { hook: '🔍 Tuần này thị trường chứng khoán Việt Nam có gì đáng chú ý? MaMa tóm tắt trong 60 giây!', angle: 'Tóm tắt tuần: điểm số VN-Index, top tăng/giảm, và 1 yếu tố vĩ mô quan trọng nhà đầu tư cần theo dõi tuần sau' },
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

function generateContentDirection(topic, format, trends, buInputs, scores, posts = [], timingBenchmarks = []) {
  // Learn from top similar posts
  const similarPosts = (posts || [])
    .filter(p => p.topic_group === topic && p.content_format === format)
    .sort((a, b) => b.er_user - a.er_user)
    .slice(0, 3);

  const allReward = similarPosts.length > 0 && similarPosts.every(p => p.has_reward);
  const hasRewardNote = allReward
    ? ' (lưu ý: top bài cùng format đều có reward — ER organic chưa được đo)'
    : '';

  // Pick specific hook + angle from topic×format map
  const topicMap = TOPIC_CONTENT[topic] || {};
  const specific  = topicMap[format] || topicMap[Object.keys(topicMap)[0]];

  const defaultHook = specific?.hook || `${topic}: góc nhìn ${format} cho cộng đồng MaMa Tài Chính`;

  // CTA by format
  const FORMAT_CTA = {
    poll:                  'Bình chọn ngay bên dưới! 👇',
    minigame:              'Tham gia ngay — phần thưởng chờ bạn! 🎁',
    qa:                    'Còn câu hỏi khác? Comment cho MaMa biết nhé!',
    market_update:         'Theo dõi MaMa Tài Chính để không bỏ lỡ cập nhật thị trường! 📈',
    educational_post:      'Bạn thấy tip này hữu ích không? Tag bạn bè cùng đọc nhé! 🙌',
    service_faq:           'Thử ngay trên app MoMo và cho MaMa biết kết quả nhé!',
    confession_discussion: 'Chia sẻ trải nghiệm của bạn bên dưới — MaMa đọc tất cả! 💬',
    promo_info:            'Áp dụng ngay trên MoMo trước khi hết hạn! ⏰',
  };

  // Visual by format
  const VISUAL = {
    poll:                  'Layout poll 2–3 lựa chọn. Background hồng nhạt (#FFEFF4). Font bold cho câu hỏi chính. Thêm icon biểu cảm cho mỗi lựa chọn.',
    educational_post:      'Infographic dọc. 1 số liệu thật to làm điểm nhấn (VD: "67%"). Icon tài chính MoMo. Chú thích nguồn nhỏ bên dưới.',
    market_update:         'Mini chart/bảng giá nhúng. Màu xanh lá (tăng) / đỏ (giảm). Logo MaMa Tài Chính góc phải. Timestamp rõ ràng.',
    qa:                    'Format Q&A: câu hỏi màu hồng MoMo, câu trả lời nền trắng/xám nhạt. Chia block rõ ràng. Dễ đọc trên mobile.',
    minigame:              'Màu sắc tươi sáng, vui mắt. Badge phần thưởng nổi bật. Countdown timer nếu có. Hướng dẫn tham gia ngắn gọn 3 bước.',
    service_faq:           'Screenshot app MoMo thật + mũi tên annotation. Nền trắng sạch. Step-by-step rõ ràng.',
    confession_discussion: 'Card quote style. Text in nghiêng cho confession. Nền màu ấm. Không dùng ảnh người thật.',
    promo_info:            'Số tiền hoàn/ưu đãi thật TO và nổi bật. Màu vàng (#F6C315) tạo urgency. CTA button màu hồng MoMo. Deadline rõ ràng.',
  };

  const today = new Date();
  const activeTrend = (trends || []).find(t => {
    if (t.status !== 'active') return false;
    const exp = new Date(t.trend_date);
    exp.setDate(exp.getDate() + (t.expiry_window_days || 7));
    if (today > exp) return false;
    return t.recommended_format === format ||
      topic.toLowerCase().includes((t.trend_topic || '').toLowerCase().split(' ')[0]);
  });

  const buInput = buInputs[0] || {};
  let content_angle = '';
  let angle_basis = '';
  let hook = defaultHook;

  if (buInput.collab_page && buInput.collab_angle) {
    content_angle = `Collab với ${buInput.collab_page}: ${buInput.collab_angle}`;
    angle_basis   = `BU đề xuất collab với ${buInput.collab_page}`;
    hook = `🤝 ${buInput.collab_page} × MaMa Tài Chính: ${buInput.collab_angle}`;
  } else if (activeTrend) {
    content_angle = activeTrend.recommended_angle;
    angle_basis   = `Trend "${activeTrend.trend_topic}" (${activeTrend.trend_type})`;
    hook = `🔥 ${activeTrend.trend_topic} — ${defaultHook}`;
  } else if (buInput.priority_topic) {
    content_angle = specific?.angle || `Tập trung vào: ${buInput.priority_topic}`;
    angle_basis   = `BU priority: ${buInput.priority_topic}`;
  } else {
    content_angle = specific?.angle || `Góc content tối ưu cho ${topic} dạng ${format}`;
    angle_basis   = 'Angle dựa trên topic taxonomy + dữ liệu lịch sử';
  }

  const cta = buInput.cta || FORMAT_CTA[format] || 'Bình luận suy nghĩ của bạn bên dưới nhé! 💬';

  const rewardNote = buInput.event_name ? ` Đề cập đến chiến dịch "${buInput.event_name}".` : '';
  const caption_direction =
    `Giọng văn: thân thiện, gần gũi, không quá formal. ` +
    `Độ dài: ${format === 'poll' ? '80–120' : '100–150'} chữ. ` +
    `Cấu trúc: Hook → Context ngắn (1–2 câu) → CTA rõ ràng.${rewardNote} ` +
    `Kết thúc bằng câu hỏi mở để kích thích comment.`;

  const visual_direction = VISUAL[format] || VISUAL['educational_post'];

  // Similar post reference
  const topPost = similarPosts[0] || null;
  const similar_post_ref = topPost ? {
    post_id: topPost.post_id,
    er: topPost.er_user,
    has_reward: topPost.has_reward,
    preview: (topPost.post_content || '').substring(0, 100) + '...',
    note: `Bài tương tự đạt ER ${(topPost.er_user * 100).toFixed(1)}%${topPost.has_reward ? ' (có reward)' : ' (organic)'}`,
  } : null;

  return {
    hook,
    content_angle,
    angle_basis,
    cta,
    caption_direction,
    visual_direction,
    has_reward_note: hasRewardNote,
    similar_post_ref,
    basis: {
      performance: scores.historical > 0.6
        ? `Format "${format}" đạt ER tốt lịch sử${hasRewardNote}`
        : 'Format theo pillar mix mặc định',
      trend:       activeTrend ? `Trend: "${activeTrend.trend_topic}" (còn ${activeTrend.expiry_window_days} ngày)` : null,
      trend_topic: activeTrend ? activeTrend.trend_topic : null,
      trend_source: activeTrend ? (activeTrend.source ?? null) : null,
      timing: scores.timingFit > 0.7 ? 'Đúng khung giờ tối ưu theo benchmark' : null,
      bu:     buInput.event_name ? `BU campaign: ${buInput.event_name}` : null,
    },
  };
}

function generateFallback(topic, format, pageConfig) {
  const alt = pageConfig.content_formats.filter(f => f !== format)[0] || 'educational_post';
  return {
    topic_group: topic,
    content_format: alt,
    note: `Nếu không có nội dung cho ${format}, thay bằng ${alt} cùng topic`,
  };
}

export function injectTrendPost(slots, trend, pageConfig) {
  const reactiveSlot = slots.find(s => s.slot_type === 'reactive' && s.status === 'draft');
  if (!reactiveSlot) return slots;

  return slots.map(s => {
    if (s.id !== reactiveSlot.id) return s;
    return {
      ...s,
      topic_group: trend.trend_topic,
      content_format: trend.recommended_format,
      slot_type: 'flexible',
      direction: {
        hook: `🔥 Trend đang hot: ${trend.trend_topic}`,
        content_angle: trend.recommended_angle,
        angle_basis: `Trend inject: ${trend.trend_topic}`,
        cta: 'Bạn nghĩ sao? Chia sẻ ngay!',
        caption_direction: `Nhanh, gọn, bắt kịp xu hướng. Liên kết với MoMo/MaMa nếu phù hợp.`,
        visual_direction: `Dùng màu nổi bật, icon trend. Thêm emoji phù hợp.`,
        similar_post_ref: null,
        has_reward_note: '',
        basis: { trend: trend.trend_topic, trend_topic: trend.trend_topic, trend_source: trend.source ?? null, performance: null, timing: null, bu: null },
      },
      notes: `Injected trend: ${trend.trend_topic}`,
    };
  });
}
