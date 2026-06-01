// User whitelist — internal tool only (not internet-facing)
// page_ids: list of page_id values from pages.js this user can access
// To add user: append entry here. To add page: add to pages.js + add page_id here.
export const USERS = [
  {
    id:           'my_doan',
    email:        'my.doan1@mservice.com.vn',
    display_name: 'My Doan',
    password:     'my123',
    page_ids:     ['mama_tai_chinh', 'heo_dat_momo'],
    avatar:       'MD',
  },
  {
    id:           'mama_tc_team',
    email:        'mama.tc@mservice.com.vn',
    display_name: 'MaMa TC Team',
    password:     'mama2026',
    page_ids:     ['mama_tai_chinh'],
    avatar:       'MT',
  },
  {
    id:           'heo_dat_team',
    email:        'heodat@mservice.com.vn',
    display_name: 'Heo Đất Team',
    password:     'heodat2026',
    page_ids:     ['heo_dat_momo'],
    avatar:       'HD',
  },

  // ── Heo Đất MoMo — team members ──────────────────────────────────────
  {
    id:           'chau_tran',
    email:        'chau.tran6@mservice.com.vn',
    display_name: 'Châu Trần',
    password:     'Donation123@',
    page_ids:     ['heo_dat_momo'],
    avatar:       'CT',
  },
  {
    id:           'ha_tran',
    email:        'ha.tran6@mservice.com.vn',
    display_name: 'Hà Trần',
    password:     'Donation123@',
    page_ids:     ['heo_dat_momo'],
    avatar:       'HT',
  },
  {
    id:           'vi_vo',
    email:        'vi.vo1@mservice.com.vn',
    display_name: 'Vi Vò',
    password:     'Donation123@',
    page_ids:     ['heo_dat_momo'],
    avatar:       'VV',
  },
]

export function authenticate(email, password) {
  const user = USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user) return null
  if (user.password !== password) return null
  return user
}

export function findUser(id) {
  return USERS.find(u => u.id === id) ?? null
}
