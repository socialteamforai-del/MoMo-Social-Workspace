const slots = [
  {
    page_id: 'heo_dat_momo',
    content_format: 'minigame_quiz',
    topic_group: 'Minigame & Đố vui rinh lộc',
    date: '2026-05-27',
    publish_hour: 12,
    direction: {
      hook: 'Đố vui tuần này về chủ đề thiên nhiên',
      cta: 'Bình luận đáp án + số may mắn để rinh 100K',
    },
  },
  {
    page_id: 'heo_dat_momo',
    content_format: 'thanh_qua_du_an',
    topic_group: 'Thành quả dự án quyên góp',
    date: '2026-05-28',
    publish_hour: 12,
    direction: {
      content_angle: 'Dự án hỗ trợ 50 học sinh tại Sơn La, huy động 80 triệu từ 20.000 lượt quyên góp',
    },
  },
  {
    page_id: 'heo_dat_momo',
    content_format: 'gamified_reward',
    topic_group: 'Gamified reward — thả tim nhận quà',
    date: '2026-05-29',
    publish_hour: 12,
    direction: {
      hook: 'Chào tháng 6, tặng quà mùa hè cho chủ trại',
      cta: 'Thả tim nhận mũ mùa hè',
    },
  },
]

for (const slot of slots) {
  const res = await fetch('http://localhost:3001/api/gen-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot, samplePosts: [] }),
  })
  console.log(`\n=== ${slot.content_format} ===`)
  for await (const chunk of res.body) {
    const lines = Buffer.from(chunk).toString().split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') break
      try {
        const { text, error } = JSON.parse(raw)
        if (error) { process.stdout.write(`[ERROR] ${error}`); break }
        if (text) process.stdout.write(text)
      } catch {}
    }
  }
}
console.log('\n')
