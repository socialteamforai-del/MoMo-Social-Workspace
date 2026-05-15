# MoMo Social Feed Planning Workspace — Claude Code Master Prompt

## Mục tiêu
Build một localhost React + Vite SPA: internal content planning workspace cho Social Feed page managers của MoMo.
Phase 1 page: MaMa Tài Chính. Architecture phải reusable cho nhiều page sau.

---

## Folder đã có sẵn — KHÔNG tạo lại, chỉ build tiếp

```
momo-social-workspace/
├── public/
│   └── data/                    ← ✅ JSON data files đã có sẵn
│       ├── posts.json           (68 bài, có topic_group, content_format, metrics)
│       ├── overall.json         (795 rows aggregate page metrics)
│       ├── top_posts.json       (top 500 posts by ER)
│       ├── timing_benchmark.json (6 topic×format combos, best_hour, best_day, avg_er)
│       ├── bu_priority.json     (BU input template)
│       └── market_trends.json   (3 sample trends)
├── src/
│   ├── tokens.css               ← ✅ MoMo design tokens (màu, spacing, typography)
│   ├── config/
│   │   └── pages.js             ← ✅ Page config (weekly_pillar_mix, scoring_weights, benchmarks)
│   └── utils/
│       ├── scoring.js           ← ✅ Scoring engine (historicalPerformanceScore, finalPriorityScore...)
│       └── calendarGen.js       ← ✅ Calendar generator (generateWeeklyCalendar, injectTrendPost)
```

## Việc cần làm: build các file còn lại theo phases bên dưới

---

## Tech Stack
- **React 18 + Vite** (SPA, localhost)
- **CSS Modules** cho component styles, import tokens.css globally
- **Lucide React** cho icons
- **No backend, no DB** — fetch từ /data/*.json tại startup
- **React Context** cho global state (selectedPage, data, weeklySlots)

---

## MoMo Brand Guideline — BẮT BUỘC áp dụng

Design tokens đã có trong `src/tokens.css`. Dùng CSS variables, không hardcode màu.

### Màu chính
- Primary action: `var(--momo-pink)` = #A50064
- Background: `var(--gray-50)` = #F9F9F9
- Card: white + `var(--shadow-card)`
- Active nav: border-left 3px `--momo-pink` + bg `--pink-50`

### Typography
- Font: `'Be Vietnam Pro'` (thêm vào Google Fonts link trong index.html)
- Heading: bold, tight
- Label/badge: 11–12px, semibold

### Component style
- Card radius: `var(--radius-md)` = 12px
- Button: `var(--radius-sm)` = 8px
- Badge: `var(--radius-full)`, dùng `.badge .badge-{color}` từ tokens.css
- Sidebar width: `var(--sidebar-width)` = 220px
- Topbar height: `var(--topbar-height)` = 56px

### Tone
- Professional + warm, Vietnamese-first
- Không dùng cold enterprise style
- Labels UI dùng tiếng Việt

---

## Data Schema (đọc từ /data/*.json)

### posts.json — mỗi item:
```json
{
  "post_id": "string",
  "created_date": "YYYY-MM-DD",
  "created_hour": 15,
  "day_of_week": "Monday",
  "post_content": "string (full text)",
  "view_users": 19351,
  "view_count": 10313,
  "like_users": 1304,
  "comment_users": 161,
  "share_users": 4,
  "er_user": 0.626809,
  "ctr_user": 0.038034,
  "topic_group": "Dự đoán giá cổ phiếu",
  "content_format": "poll",
  "objective": "engagement",
  "has_reward": true,
  "is_boosted": false,
  "view_anomaly": false,
  "page_id": "mama_tai_chinh"
}
```

### timing_benchmark.json — mỗi item:
```json
{
  "topic_group": "Dự đoán giá cổ phiếu",
  "content_format": "poll",
  "best_hour": 15,
  "best_day": "Monday",
  "avg_er": 0.5721,
  "avg_ctr": 0.041,
  "avg_view_users": 18500,
  "sample_size": 22
}
```

### market_trends.json — mỗi item:
```json
{
  "trend_date": "2026-04-21",
  "trend_topic": "VN-Index vượt 1,300 điểm",
  "trend_type": "short-term",
  "trend_strength": 0.9,
  "expiry_window_days": 5,
  "recommended_format": "poll",
  "recommended_angle": "Dự đoán xu hướng tuần tới",
  "status": "active",
  "page_id": "mama_tai_chinh"
}
```

---

## App Structure

### Layout
```
┌─────────────────────────────────────────────┐
│ Topbar: [MoMo logo] [Page selector] [alerts]│ h=56px
├──────────┬──────────────────────────────────┤
│ Sidebar  │ Main content area                │
│ 220px    │                                  │
│ - Tổng   │                                  │
│   quan   │                                  │
│ - Lập    │                                  │
│   lịch   │                                  │
│ - Kho    │                                  │
│   nội    │                                  │
│   dung   │                                  │
│ - Cài    │                                  │
│   đặt    │                                  │
└──────────┴──────────────────────────────────┘
```

### Tabs (Vietnamese labels)
1. **Tổng quan** — Overview
2. **Lập lịch** — Planner
3. **Kho nội dung** — Library
4. **Cài đặt** — Settings

---

## Phase 1: Scaffold + Tổng quan tab

### Files cần tạo:
```
src/
├── main.jsx
├── App.jsx
├── index.css               (import tokens.css + Google Fonts)
├── context/
│   └── AppContext.jsx       (selectedPage, data loading, weeklySlots state)
├── hooks/
│   └── useData.js           (fetch + parse all JSON files)
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx
│   │   ├── Topbar.jsx
│   │   └── Layout.jsx
│   └── overview/
│       ├── OverviewTab.jsx        (main container)
│       ├── KPICards.jsx           (4 metric cards: ER, CTR, view_users, posts count)
│       ├── TopicBreakdown.jsx     (topic distribution, bar chart)
│       ├── FormatPerformance.jsx  (format avg ER + CTR table)
│       ├── TimingHeatmap.jsx      (hour × day_of_week engagement heatmap)
│       ├── TopPosts.jsx           (top 5 posts by ER, with anomaly flag)
│       └── DataWarnings.jsx       (anomaly + sample warnings)
```

### KPI Cards (Tổng quan):
- Avg ER (er_user) — so với benchmark er_good=0.45
- Avg CTR (ctr_user) — so với benchmark ctr_good=0.08
- Tổng bài đã đăng (posts.json count)
- Tổng view_users (sum)

**Mỗi card phải có:**
- Label + giá trị + delta so benchmark
- Tooltip định nghĩa metric rõ ràng
- Màu: xanh nếu đạt, vàng nếu trung bình, đỏ nếu kém

### Analytics rules (QUAN TRỌNG):
- Nếu post có `view_anomaly: true` → hiển thị icon cảnh báo màu vàng
- Nếu post có `has_reward: true` → badge "Có thưởng" — KHÔNG mix với organic ER
- Top posts explanation phải ghi rõ: "ER cao có thể do: [reward/timing/content]"
- Nếu sample_size < 10 → "Cỡ mẫu nhỏ" warning

---

## Phase 2: Kho nội dung (Library) tab

### Files cần tạo:
```
src/components/library/
├── LibraryTab.jsx
├── PostCard.jsx            (compact card: title preview, topic badge, format badge, ER, CTR)
├── PostDetailModal.jsx     (full content + metrics + tags + warnings)
├── LibraryFilters.jsx      (filter by topic, format, has_reward, date range)
└── LibrarySort.jsx         (sort by ER, CTR, date, view_users)
```

### Logic:
- Default sort: er_user DESC
- Tách tab trong Library: "Hiệu quả cao" | "Evergreen" | "Cần cải thiện"
- Hiệu quả cao: er_user >= 0.45
- Cần cải thiện: er_user < 0.30
- Evergreen: has_reward=false AND er_user >= 0.35

---

## Phase 3: Lập lịch (Planner) tab

### Files cần tạo:
```
src/components/planner/
├── PlannerTab.jsx           (main container với 4 sub-sections)
├── PlanningInputs.jsx       (BU inputs form + week settings + generation mode)
├── SignalSummary.jsx        (top topics, timing opportunities, trend alerts)
├── WeeklyBoard.jsx          (scheduler board: cols=days, compact cards)
├── SlotCard.jsx             (compact: title, time, format badge, slot_type badge, status)
├── SlotDetailDrawer.jsx     (right drawer, full details)
└── RefreshPanel.jsx         (trend refresh suggestions)
```

### WeeklyBoard layout:
```
        Thứ Hai  Thứ Ba  Thứ Tư  Thứ Năm  Thứ Sáu  Thứ Bảy
06:00
...
15:00   [Card]   [Card]  [Card]  [Card]   [Card]   [Card]
```

### SlotCard (compact):
- Short title (topic_group ngắn)
- Publish time (HH:mm)
- Format badge (`.badge-blue` hoặc `.badge-pink` theo format)
- Slot type badge: fixed=pink, flexible=gray, reactive=teal
- Status indicator (draft/scheduled/published)

### SlotDetailDrawer sections:
A. **Lịch đăng**: date, hour, slot_type, status
B. **Chiến lược**: topic, format, objective, audience, BU campaign
C. **Hướng nội dung**: hook, content_angle, CTA, caption_direction, visual_direction
D. **Lý do đề xuất**: score_components breakdown + confidence badge
E. **Tính linh hoạt**: locked/replaceable, fallback_idea, notes
F. **Hành động**: Chỉnh sửa | Tạo lại slot | Di chuyển | Nhân bản | Khoá | Đánh dấu đã đăng | Xoá

### Toolbar actions (trên WeeklyBoard):
- Week picker (prev/next/today)
- "Tạo lịch tuần" → gọi `generateWeeklyCalendar()` từ `src/utils/calendarGen.js`
- "Làm mới slot trống" → regenerate chỉ flexible/reactive slots
- "Chèn trend" → gọi `injectTrendPost()` với trend được chọn
- "Tạo mới" → mở SlotDetailDrawer rỗng

### PlanningInputs form fields:
**BU inputs (optional):**
- Sự kiện / chiến dịch
- Chủ đề ưu tiên
- Trend đang hot
- Ngày bắt buộc đăng (date picker)
- CTA

**Cài đặt tuần:**
- Tuần (week picker)
- Số bài (slider 3–7, default 6)
- Chế độ: Cân bằng | Ưu tiên BU | Ưu tiên hiệu suất
- Giữ reactive slot: toggle (default ON)

---

## Phase 4: Cài đặt (Settings) tab

### Files cần tạo:
```
src/components/settings/
├── SettingsTab.jsx
├── DataUpload.jsx           (upload new xlsx/json, replace current data)
├── TaxonomyEditor.jsx       (view/edit topic_groups, formats, objectives)
├── BenchmarkConfig.jsx      (edit er_good, er_average, ctr_good thresholds)
└── PageManager.jsx          (show current page, stub for adding new pages)
```

---

## Global State (AppContext)

```js
{
  selectedPageId: 'mama_tai_chinh',
  pageConfig: { ...from pages.js },
  data: {
    posts: [],
    overall: [],
    topPosts: [],
    timingBenchmarks: [],
    buPriority: [],
    marketTrends: [],
  },
  loading: false,
  errors: [],
  // Planner state
  selectedWeek: Date,         // Monday of current week
  weeklySlots: [],            // CalendarSlot[]
  plannerInputs: {
    numPosts: 6,
    mode: 'balanced',
    reserveReactive: true,
    buInputs: {},
  },
  dataWarnings: [],           // from detectDatasetWarnings()
}
```

---

## Scoring Engine (đã viết sẵn trong src/utils/scoring.js)

Functions export sẵn:
- `historicalPerformanceScore(topicGroup, contentFormat, posts, benchmarks)`
- `userDemandScore(topicGroup, posts)`
- `trendScore(topicGroup, contentFormat, trends)`
- `buPriorityScore(topicGroup, contentFormat, buInputs)`
- `timingFitScore(dayOfWeek, hour, topicGroup, contentFormat, timingBenchmarks)`
- `finalPriorityScore(components, weights)` — weights từ pageConfig
- `confidenceLabel(score)` → `{ label: 'Cao'|'Trung bình'|'Thấp', color }`
- `detectDatasetWarnings(posts, topicGroups)` → warnings array

## Calendar Generator (đã viết sẵn trong src/utils/calendarGen.js)

Functions export sẵn:
- `generateWeeklyCalendar(pageConfig, inputs, data)` → CalendarSlot[]
- `injectTrendPost(slots, trend, pageConfig)` → updated slots
- `getWeekStart(date)` → Date (Monday)
- `formatDate(date)` → 'YYYY-MM-DD'

---

## Rules không được phá vỡ

1. **Không hardcode page config** — mọi thứ đọc từ `src/config/pages.js`
2. **Không mix reward posts với organic** trong ER benchmark mà không note rõ
3. **Mọi metric phải có tooltip definition** bằng tiếng Việt
4. **Data warnings phải hiển thị** khi có anomaly, small sample, hoặc coverage gap
5. **BU input là optional** — nếu rỗng, planner vẫn generate được full week
6. **Chỉ refresh flexible/reactive slots** — không bao giờ auto-replace fixed slots
7. **Vietnamese-first UI** — tất cả labels, buttons, placeholders bằng tiếng Việt
8. **Dùng CSS variables** từ tokens.css — không hardcode màu hex trong component CSS

---

## Bắt đầu từ Phase 1

**Khi nhận prompt này, hãy:**
1. Trả lời: danh sách file sẽ tạo trong Phase 1
2. Tech stack confirmation (Vite command để init)
3. Hỏi: có muốn bắt đầu code ngay không?

**Sau khi confirm:**
- Init Vite project: `npm create vite@latest . -- --template react`
- Cài thêm: `npm install lucide-react`
- Implement theo từng file, phase by phase
- Sau mỗi phase: báo cáo ngắn gọn những gì đã build, file nào đã tạo
