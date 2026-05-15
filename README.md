# MoMo Social Feed Planning Workspace

Internal content planning tool for MoMo Social Feed page managers.

## Cấu trúc folder

```
momo-social-workspace/
├── CLAUDE_CODE_PROMPT.md    ← Prompt đầy đủ cho Claude Code
├── public/
│   └── data/                ← JSON data đã được pre-processed từ xlsx
│       ├── posts.json           (68 bài MaMa Tài Chính, tagged)
│       ├── overall.json         (795 rows aggregate metrics)
│       ├── top_posts.json       (top 500 posts by ER)
│       ├── timing_benchmark.json
│       ├── bu_priority.json     (template rỗng)
│       └── market_trends.json   (3 sample trends)
└── src/
    ├── tokens.css           ← MoMo design tokens (brand colors, spacing)
    ├── config/
    │   └── pages.js         ← Page config layer (reusable)
    └── utils/
        ├── scoring.js       ← Priority scoring engine
        └── calendarGen.js   ← Weekly calendar generator
```

## Cách dùng với Claude Code

1. Mở Claude Code
2. `cd` vào folder này
3. Paste toàn bộ nội dung `CLAUDE_CODE_PROMPT.md` vào Claude Code
4. Confirm → Claude Code sẽ init Vite và build theo phases

## Data sources

| File | Source | Rows | Mô tả |
|------|--------|------|-------|
| posts.json | Data_social_MMTC.xlsx (All_post) | 68 | Bài viết với metrics + auto-tag |
| overall.json | Data_social_MMTC.xlsx (Overall) | 795 | Page-level aggregate |
| top_posts.json | Data_social_MMTC.xlsx (Top post) | 500 | Top 500 by ER |
| timing_benchmark.json | Derived từ posts | 6 | Benchmark theo topic×format |
| bu_priority.json | Manual template | 1 | BU inputs (điền tay) |
| market_trends.json | Manual seed | 3 | Sample trends |

## Cập nhật data

Thay file xlsx mới → chạy lại script Python để regenerate JSON.
Script: `scripts/process_data.py` (Claude Code sẽ tạo trong Settings tab)
