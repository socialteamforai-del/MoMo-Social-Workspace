// PAGE CONFIG LAYER — add new pages here without touching engine logic
export const PAGE_CONFIGS = {
  mama_tai_chinh: {
    page_id: 'mama_tai_chinh',
    page_name: 'MaMa Tài Chính',
    status: 'active',
    audience: 'Nhà đầu tư cá nhân, người quan tâm tài chính cá nhân, 22–45 tuổi',
    topic_groups: [
      'Dự đoán giá cổ phiếu',
      'Phân tích thị trường chứng khoán',
      'Chia sẻ tin tức VN-Index & blue-chip',
      'Minigame nhận thưởng',
      'Giáo dục tài chính & chi tiêu',
      'Vay tiền và điểm tín dụng MoMo',
      'Hỏi tư vấn tài chính',
      'Hỏi hoàn tiền và ưu đãi',
      'Hỏi rút tiền và đổi điểm',
    ],
    content_formats: [
      'poll', 'educational_post', 'market_update',
      'qa', 'service_faq', 'minigame', 'confession_discussion', 'promo_info',
    ],
    objectives: ['engagement', 'education', 'discussion', 'traffic', 'service_adoption', 'awareness'],
    // Default weekly pillar mix
    weekly_pillar_mix: {
      Monday:    { format: 'market_update',      topic: 'Dự đoán giá cổ phiếu',              slot_type: 'flexible' },
      Tuesday:   { format: 'educational_post',   topic: 'Giáo dục tài chính & chi tiêu',     slot_type: 'flexible' },
      Wednesday: { format: 'poll',               topic: 'Dự đoán giá cổ phiếu',              slot_type: 'flexible' },
      Thursday:  { format: 'market_update',      topic: 'Phân tích thị trường chứng khoán',  slot_type: 'flexible' },
      Friday:    { format: 'qa',                 topic: 'Hỏi tư vấn tài chính',              slot_type: 'flexible' },
      Saturday:  { format: 'educational_post',   topic: 'Giáo dục tài chính & chi tiêu',     slot_type: 'reactive' },
      Sunday:    { format: 'minigame',           topic: 'Minigame nhận thưởng',               slot_type: 'flexible' },
    },
    default_publish_hour: 15,
    scoring_weights: {
      historical_performance: 0.30,
      user_demand:            0.20,
      trend:                  0.20,
      bu_priority:            0.15,
      timing_fit:             0.10,
      cross_interest:         0.05,
    },
    benchmarks: {
      er_good:    0.45,
      er_average: 0.30,
      er_poor:    0.20,
      ctr_good:   0.08,
      ctr_average:0.04,
    },
    data_files: {
      posts:            '/data/posts.json',
      overall:          '/data/overall.json',
      top_posts:        '/data/top_posts.json',
      timing_benchmark: '/data/timing_benchmark.json',
      bu_priority:      '/data/bu_priority.json',
      market_trends:    '/data/market_trends.json',
    },
  },
  // Add new pages here:
  // hong_hot_momo: { ... }
};

export const DEFAULT_PAGE_ID = 'mama_tai_chinh';
