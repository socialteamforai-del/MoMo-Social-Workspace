/**
 * scoring.js — Priority scoring engine for content planning
 * All weights come from page config (scoring_weights), not hardcoded here.
 */

export function normalize(value, min, max) {
  if (max === min) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * Signal 1: Historical performance — tách organic vs reward để không bị inflate.
 */
export function historicalPerformanceScore(topicGroup, contentFormat, posts, benchmarks) {
  const matching = posts.filter(
    p => p.topic_group === topicGroup && p.content_format === contentFormat
  );
  if (matching.length === 0) return 0.4;

  // Ưu tiên organic posts nếu đủ mẫu (>=3)
  const organicPosts = matching.filter(p => !p.has_reward);
  const evalPosts = organicPosts.length >= 3 ? organicPosts : matching;
  const usedReward = organicPosts.length < 3 && matching.length > organicPosts.length;

  const avgER  = evalPosts.reduce((s, p) => s + p.er_user,  0) / evalPosts.length;
  const avgCTR = evalPosts.reduce((s, p) => s + p.ctr_user, 0) / evalPosts.length;

  const erScore  = avgER  >= benchmarks.er_good    ? 1.0
                 : avgER  >= benchmarks.er_average  ? 0.65
                 : avgER  >= benchmarks.er_poor     ? 0.35
                 : 0.1;
  const ctrScore = avgCTR >= benchmarks.ctr_good    ? 1.0
                 : avgCTR >= benchmarks.ctr_average  ? 0.6
                 : 0.2;

  const score = Math.round((erScore * 0.65 + ctrScore * 0.35) * 100) / 100;
  return score;
}

/**
 * Signal 2: User demand — tính cả bp_comment_count (brand page comments) như signal demand cao.
 */
export function userDemandScore(topicGroup, posts) {
  const matching = posts.filter(p => p.topic_group === topicGroup);
  if (matching.length === 0 || posts.length === 0) return 0.4;

  const commentRatio = p => p.view_users > 0 ? p.comment_users / p.view_users : 0;
  const bpRatio      = p => p.view_users > 0 ? (p.bp_comment_count || 0) / p.view_users : 0;

  const topicCommentAvg = matching.reduce((s, p) => s + commentRatio(p), 0) / matching.length;
  const topicBpAvg      = matching.reduce((s, p) => s + bpRatio(p),      0) / matching.length;
  const globalCommentAvg = posts.reduce((s, p) => s + commentRatio(p), 0) / posts.length;

  const commentScore = globalCommentAvg > 0 ? Math.min(1, topicCommentAvg / globalCommentAvg) : 0.5;
  // bp_comment rất nhỏ, scale up (x100)
  const bpScore = topicBpAvg > 0.001 ? Math.min(1, topicBpAvg * 100) : 0;

  return Math.round((commentScore * 0.7 + bpScore * 0.3) * 100) / 100;
}

/**
 * Signal 3: Trend score — tự động expire theo trend_date + expiry_window_days.
 */
export function trendScore(topicGroup, contentFormat, trends) {
  const today = new Date();

  const active = trends.filter(t => {
    if (t.status !== 'active') return false;
    // Auto-expire check
    const trendDate  = new Date(t.trend_date);
    const expiryDate = new Date(trendDate);
    expiryDate.setDate(expiryDate.getDate() + (t.expiry_window_days || 7));
    return today <= expiryDate;
  });

  if (active.length === 0) return 0.0;

  let maxScore = 0;
  for (const t of active) {
    const topicMatch = topicGroup.toLowerCase().split(/\s+/).some(
      word => word.length > 3 && t.trend_topic.toLowerCase().includes(word)
    );
    const formatMatch = t.recommended_format === contentFormat;
    if (!topicMatch && !formatMatch) continue;

    const decay = t.trend_type === 'short-term' ? 1.0 : 0.75;
    const score = t.trend_strength * decay * (topicMatch ? 0.7 : 0.3) * (formatMatch ? 1.0 : 0.6);
    maxScore = Math.max(maxScore, score);
  }
  return Math.min(1, Math.round(maxScore * 100) / 100);
}

/**
 * Signal 4: BU priority score.
 */
export function buPriorityScore(topicGroup, contentFormat, buInputs) {
  if (!buInputs || buInputs.length === 0) return 0.0;

  let score = 0;
  for (const bu of buInputs) {
    if (bu.priority_topic && topicGroup.includes(bu.priority_topic)) score = Math.max(score, 0.9);
    if (bu.trending_topic && topicGroup.includes(bu.trending_topic)) score = Math.max(score, 0.7);
    if (bu.collab_page) score = Math.max(score, 0.5); // collab = mild priority boost
  }
  return score;
}

/**
 * Signal 5: Timing fit.
 */
export function timingFitScore(dayOfWeek, hour, topicGroup, contentFormat, timingBenchmarks) {
  const bench = timingBenchmarks.find(
    b => b.topic_group === topicGroup && b.content_format === contentFormat
  );
  if (!bench) return 0.5;

  const dayMatch  = bench.best_day === dayOfWeek ? 1.0 : 0.4;
  const hourDiff  = Math.abs(hour - bench.best_hour);
  const hourScore = hourDiff === 0 ? 1.0 : hourDiff <= 2 ? 0.7 : hourDiff <= 4 ? 0.4 : 0.2;

  return Math.round((dayMatch * 0.5 + hourScore * 0.5) * 100) / 100;
}

export function finalPriorityScore(components, weights) {
  const score = (
    (components.historical   || 0) * weights.historical_performance +
    (components.userDemand   || 0) * weights.user_demand +
    (components.trend        || 0) * weights.trend +
    (components.buPriority   || 0) * weights.bu_priority +
    (components.timingFit    || 0) * weights.timing_fit +
    (components.crossInterest|| 0) * weights.cross_interest
  );
  return Math.round(score * 100) / 100;
}

export function confidenceLabel(score) {
  if (score >= 0.75) return { label: 'Cao',        color: 'green'  };
  if (score >= 0.50) return { label: 'Trung bình', color: 'yellow' };
  return                    { label: 'Thấp',       color: 'red'    };
}

export function detectWarnings(post) {
  const warnings = [];
  if (post.view_users > post.view_count) {
    warnings.push({ type: 'anomaly', message: 'view_users > view_count — dữ liệu bất thường' });
  }
  return warnings;
}

export function detectDatasetWarnings(posts, topicGroups) {
  const warnings = [];
  const anomalies = posts.filter(p => p.view_anomaly).length;
  if (anomalies > 0) {
    warnings.push({ type: 'anomaly', message: `${anomalies} bài có view_anomaly — ER có thể không chính xác` });
  }
  const counts = {};
  for (const p of posts) counts[p.topic_group] = (counts[p.topic_group] || 0) + 1;
  const uncategorized = counts['Giáo dục tài chính & chi tiêu'] || 0;
  if (posts.length > 0 && uncategorized / posts.length > 0.3) {
    warnings.push({ type: 'coverage', message: `${Math.round(uncategorized / posts.length * 100)}% bài tập trung vào 1 topic — phân bổ chưa đều` });
  }
  if (posts.length < 10) {
    warnings.push({ type: 'sample', message: `Chỉ có ${posts.length} bài — cỡ mẫu nhỏ, số liệu chưa đủ tin cậy` });
  }
  return warnings;
}
