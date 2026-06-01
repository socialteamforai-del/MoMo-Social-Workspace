// PAGE CONFIG LAYER — add new pages here without touching engine logic
// ─────────────────────────────────────────────────────────────────────
// FIXED (engine-level, never change per BU):
//   ALL_MEASURES, base dimensions, post_type filter, timezone → server.js
//
// PER-BU (add/tune per page here):
//   mcp_page_id   — numeric Facebook page_id used as MCP filter (stable, no Unicode issue)
//   page_name     — display name & client-side label only
//   benchmarks    — ER/CTR thresholds for good/average/poor coloring
//   scoring_weights — content scoring algorithm weights
//   topic_groups / content_formats / weekly_pillar_mix — editorial calendar
//   default_publish_hour — default posting time
//   trend_config  — news sources & keywords for trending engine
//   data_files    — per-BU data paths (each BU should have its own folder)
// ─────────────────────────────────────────────────────────────────────

export const PAGE_CONFIGS = {
  mama_tai_chinh: {
    page_id: 'mama_tai_chinh',
    mcp_page_id: '107054369709322',   // Facebook page ID — used as MCP filter key
    oa_id: 9813269,                   // MoMo CMS oaId — used by /api/publish
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
    communities: [
      { id: 111111111111111, name: 'Cộng Đồng Đầu Tư' },
      { id: 222222222222222, name: 'Cộng Đồng Tài Chính' },
      { id: 333333333333333, name: 'Cộng Đồng Bảo Hiểm' },
    ],
    data_files: {
      posts:            '/data/mama_tai_chinh/posts.json',
      overall:          '/data/mama_tai_chinh/overall.json',
      top_posts:        '/data/mama_tai_chinh/top_posts.json',
      timing_benchmark: '/data/mama_tai_chinh/timing_benchmark.json',
      bu_priority:      '/data/mama_tai_chinh/bu_priority.json',
      market_trends:    '/data/mama_tai_chinh/market_trends.json',
    },

    // ── Trending engine config ──────────────────────────────────────────
    trend_config: {
      // Keywords: if ANY appear in title → item is finance-relevant
      domain_keywords: [
        // Chứng khoán / đầu tư
        'chứng khoán','vnindex','vn-index','vn index','hose','hnx','upcom',
        'cổ phiếu','cổ tức','nhà đầu tư','margin','thanh khoản','quỹ đầu tư',
        'etf','nav','danh mục','bluechip','penny stock','ipo',
        // Ngân hàng / tín dụng
        'ngân hàng','lãi suất','tín dụng','vay','thấu chi','thẻ tín dụng',
        'tiết kiệm','nhnn','sbv','nợ xấu','room tín dụng','vietcombank',
        'bidv','vietinbank','techcombank','mbbank','vpbank','acb',
        // Bảo hiểm & Crypto
        'bảo hiểm','crypto','bitcoin','ethereum','btc','eth','blockchain',
        'tiền số','tiền ảo','defi','nft','stablecoin','usdt',
        // Tỷ giá / vĩ mô
        'tỷ giá','ngoại tệ','forex','usd','eur','đô la','vàng','giá vàng',
        'sjc','pnj','lạm phát','cpi','gdp','tăng trưởng kinh tế','fed',
        // Tài chính cá nhân
        'thuế','tài chính cá nhân','quản lý tài chính','chi tiêu','ngân sách',
        'tích lũy','kế hoạch tài chính',
        // MoMo / fintech
        'momo','ví momo','thanh toán','chuyển tiền','ví điện tử','fintech',
        'zalopay','vnpay','open banking','qr code',
        // Bất động sản
        'bất động sản','nhà đất','căn hộ','chung cư','vay mua nhà',
        // Trái phiếu
        'trái phiếu','trái phiếu doanh nghiệp','trái phiếu chính phủ','quỹ mở',
      ],
      // Sources always included regardless of keyword match
      priority_sources: [
        'CafeF','VnEconomy','Vietstock','Tinnhanhchungkhoan',
        'Dân Trí Tài Chính','Báo Đầu Tư','Nhịp Cầu Đầu Tư',
        'VnExpress Kinh Doanh','Tuổi Trẻ Kinh Tế',
        'r/chungkhoan','r/VietNamTrading',
      ],
      rss_sources: [
        { name: 'CafeF',              url: 'https://cafef.vn/rss/home.rss' },
        { name: 'VnEconomy',          url: 'https://vneconomy.vn/rss/home.rss' },
        { name: 'Vietstock',          url: 'https://vietstock.vn/rss/home.rss' },
        { name: 'Tinnhanhchungkhoan', url: 'https://tinnhanhchungkhoan.vn/rss/thi-truong.rss' },
        { name: 'Dân Trí Tài Chính',  url: 'https://dantri.com.vn/kinh-doanh.rss' },
        { name: 'Báo Đầu Tư',         url: 'https://baodautu.vn/rss/home.rss' },
        { name: 'Nhịp Cầu Đầu Tư',    url: 'https://nhipcaudautu.vn/rss/home.rss' },
        { name: 'VnExpress Kinh Doanh',url: 'https://vnexpress.net/rss/kinh-doanh.rss' },
        { name: 'Tuổi Trẻ Kinh Tế',   url: 'https://tuoitre.vn/rss/kinh-te.rss' },
      ],
      reddit_subs: [
        { name: 'r/chungkhoan',     url: 'https://www.reddit.com/r/chungkhoan/hot.json?limit=10' },
        { name: 'r/VietNamTrading', url: 'https://www.reddit.com/r/VietNamTrading/hot.json?limit=10' },
      ],
      google_trends_geo: 'VN',
    },
  },

  heo_dat_momo: {
    page_id: 'heo_dat_momo',
    mcp_page_id: '107059573304974',   // Facebook page ID — used as MCP filter key
    oa_id: 9813269,                   // MoMo CMS oaId — used by /api/publish
    page_name: 'Heo Đất MoMo',
    status: 'active',
    // Audience thực tế của Facebook page — khác với audience của app feature Heo Đất
    audience: 'Cộng đồng chủ trại MoMo, người dùng quan tâm từ thiện & hoạt động cộng đồng, 18–35 tuổi, thích gamification và làm việc tốt theo cách vui vẻ',
    // topic_groups cập nhật từ phân tích 112 bài thực tế (Mar–May 2026)
    // Bỏ: topics của app feature (tiết kiệm, quỹ dự phòng, chi tiêu) — không phản ánh nội dung page
    topic_groups: [
      'Minigame & Đố vui rinh lộc',
      'Gamified reward — thả tim nhận quà',
      'Thành quả dự án quyên góp',
      'Kêu gọi quyên góp chiến dịch',
      'Event comms — Trường học Heo Đất & sự kiện cộng đồng',
      'Kindness story — câu chuyện & milestone cộng đồng',
    ],
    content_formats: [
      'minigame_quiz',       // Đố vui, giải đố, nhìn hình đoán chữ — ER cao nhất (avg 24%)
      'gamified_reward',     // Thả tim / bình luận ảnh nhận quà — engagement volume cao
      'thanh_qua_du_an',     // Báo cáo kết quả dự án — cần số liệu cụ thể
      'donation_call',       // Kêu gọi quyên góp chiến dịch đang chạy
      'event_comms',         // Thông báo sự kiện cộng đồng
      'kindness_story',      // Câu chuyện cảm xúc, milestone
    ],
    objectives: ['engagement', 'community_building', 'donation_activation', 'awareness'],
    weekly_pillar_mix: {
      // Pattern dựa trên data thực: minigame ~2x/tuần, thành quả ~3x/tuần, gamified ~1–2x/tuần
      Monday:    { format: 'donation_call',    topic: 'Kêu gọi quyên góp chiến dịch',              slot_type: 'flexible' },
      Tuesday:   { format: 'minigame_quiz',    topic: 'Minigame & Đố vui rinh lộc',                slot_type: 'flexible' },
      Wednesday: { format: 'thanh_qua_du_an',  topic: 'Thành quả dự án quyên góp',                 slot_type: 'flexible' },
      Thursday:  { format: 'gamified_reward',  topic: 'Gamified reward — thả tim nhận quà',        slot_type: 'flexible' },
      Friday:    { format: 'minigame_quiz',    topic: 'Minigame & Đố vui rinh lộc',                slot_type: 'flexible' },
      Saturday:  { format: 'thanh_qua_du_an',  topic: 'Thành quả dự án quyên góp',                 slot_type: 'reactive' },
      Sunday:    { format: 'kindness_story',   topic: 'Kindness story — câu chuyện & milestone cộng đồng', slot_type: 'flexible' },
    },
    default_publish_hour: 12,
    scoring_weights: {
      historical_performance: 0.35,  // Tăng lên — data thực tế rõ format nào work
      user_demand:            0.20,
      trend:                  0.10,  // Giảm xuống — trend ít liên quan với nội dung charity/community
      bu_priority:            0.20,
      timing_fit:             0.10,
      cross_interest:         0.05,
    },
    // Benchmarks cập nhật từ data thực tế (avg ER 15.2%, top minigame 68%)
    benchmarks: {
      er_good:     0.20,  // Từ data: avg 15.2%, good = top 30%
      er_average:  0.12,
      er_poor:     0.07,
      ctr_good:    0.05,
      ctr_average: 0.025,
    },
    communities: [
      { id: 444444444444444, name: 'Cộng Đồng Đầu Tư' },
      { id: 555555555555555, name: 'Cộng Đồng Tài Chính' },
      { id: 666666666666666, name: 'Cộng Đồng Bảo Hiểm' },
    ],
    data_files: {
      posts:            '/data/heo_dat_momo/posts.json',
      overall:          '/data/heo_dat_momo/overall.json',
      top_posts:        '/data/heo_dat_momo/top_posts.json',
      timing_benchmark: '/data/heo_dat_momo/timing_benchmark.json',
      bu_priority:      '/data/heo_dat_momo/bu_priority.json',
      market_trends:    '/data/heo_dat_momo/market_trends.json',
    },

    trend_config: {
      // Keywords cập nhật theo nội dung thực tế page: charity, cộng đồng, sự kiện xã hội
      domain_keywords: [
        // Từ thiện / quyên góp
        'từ thiện','quyên góp','thiện nguyện','nhân ái','hảo tâm',
        'học bổng','trẻ em nghèo','hoàn cảnh khó khăn','hỗ trợ giáo dục',
        'trái tim momo','ví nhân ái','góp xu',
        // Cộng đồng / sự kiện xã hội
        'cộng đồng','tình nguyện','hoạt động xã hội','sự kiện từ thiện',
        'chung tay','sẻ chia','lan tỏa yêu thương','hành trình tử tế',
        // Trẻ em / giáo dục / y tế
        'trẻ em','học sinh nghèo','vùng sâu vùng xa','trường học','học bổng',
        'bệnh viện','thiết bị y tế','trẻ sơ sinh','dinh dưỡng',
        // Sự kiện cộng đồng MoMo
        'heo đất','heo đi bộ','trường học heo đất','momo','ví momo',
        'chủ trại','heo vàng','túi thần tài',
        // Trend mạng xã hội có thể gắn vào bài gamified
        'trend','viral','thách thức','challenge','minigame',
        'tháng mới','ngày lễ','mùa hè','tết','sinh nhật',
      ],
      priority_sources: [
        'VnExpress Xã Hội','Tuổi Trẻ','Dân Trí','Thanh Niên',
        'Vietnam+','Nhân Dân',
      ],
      rss_sources: [
        { name: 'VnExpress Xã Hội',  url: 'https://vnexpress.net/rss/xa-hoi.rss' },
        { name: 'Tuổi Trẻ Xã Hội',  url: 'https://tuoitre.vn/rss/xa-hoi.rss' },
        { name: 'Dân Trí Xã Hội',    url: 'https://dantri.com.vn/xa-hoi.rss' },
        { name: 'Thanh Niên',         url: 'https://thanhnien.vn/rss/home.rss' },
      ],
      reddit_subs: [],
      google_trends_geo: 'VN',
    },
  },
}

export const DEFAULT_PAGE_ID = 'mama_tai_chinh'
