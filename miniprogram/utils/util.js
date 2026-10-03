/** 日期工具：全部用本地时区，格式固定 YYYY-MM-DD */

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** offset=0 今天，1 明天，-1 昨天 */
function dateStr(offset) {
  const d = new Date()
  d.setDate(d.getDate() + (offset || 0))
  return fmt(d)
}

function fmt(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 'YYYY-MM-DD' 往前/后挪 delta 天 */
function addDays(str, delta) {
  const p = String(str).split('-').map(Number)
  const d = new Date(p[0], p[1] - 1, p[2])
  d.setDate(d.getDate() + delta)
  return fmt(d)
}

/** '2026-10-03' → { md:'10月3日', wd:'周六', full:'10月3日 周六' } */
function describe(str) {
  const parts = (str || '').split('-')
  if (parts.length !== 3) return { md: '', wd: '', full: '' }
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  const md = `${Number(parts[1])}月${Number(parts[2])}日`
  const wd = WD[d.getDay()]
  return { md, wd, full: `${md} ${wd}` }
}

/** 本周一的 YYYY-MM-DD（周一为一周起点） */
function weekStart() {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  return fmt(d)
}

/** 相对今天的口语化标签，日期条上用 */
function relTag(str) {
  const t = dateStr(0)
  if (str === t) return '今天'
  if (str === addDays(t, 1)) return '明天'
  if (str === addDays(t, 2)) return '后天'
  if (str === addDays(t, -1)) return '昨天'
  if (str === addDays(t, -2)) return '前天'
  return describe(str).wd
}

/** '2026-10-03' → 日号数字 3 */
function dayNum(str) {
  return Number(String(str).split('-')[2]) || 0
}

/** '2026-11-01' → 11，用于日期条跨月时把「1」标注成「11月」 */
function monthNum(str) {
  return Number(String(str).split('-')[1]) || 0
}

/** 日期条上那一小行标签：跨月的 1 号显示月份，其余显示 今天/明天/周三 */
function chipTag(str) {
  if (dayNum(str) === 1) return `${monthNum(str)}月`
  return relTag(str)
}

/** 本月 1 号的 YYYY-MM-DD */
function monthStart() {
  const d = new Date()
  return fmt(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** 两个 YYYY-MM-DD 相差多少天（a 减 b）：未来为正、过去为负。用 UTC 算，避开时区误差 */
function diffDays(a, b) {
  const pa = String(a).split('-').map(Number)
  const pb = String(b).split('-').map(Number)
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2])
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2])
  return Math.round((da - db) / 86400000)
}

/**
 * 菜品显示顺序 —— 点菜页和菜谱页共用同一套，别再各写一份（两页顺序必须一模一样）。
 * · 都手动排过序（有 sort）→ 按 sort 升序
 * · 都没排过序      → 按录入时间倒序（新加的菜在最前）
 * · 一个有一个没有  → 没排序的（刚加进来的菜）排前面，好让人一眼看见
 * 注意：顺序只跟「录入时间 / 手动排序号」有关，跟点没点过这道菜无关。
 */
function byDishOrder(a, b) {
  const ha = typeof a.sort === 'number'
  const hb = typeof b.sort === 'number'
  if (ha && hb) return a.sort - b.sort
  if (!ha && !hb) return (b.createdAt || 0) - (a.createdAt || 0)
  return ha ? 1 : -1
}

module.exports = {
  dateStr,
  addDays,
  describe,
  weekStart,
  monthStart,
  relTag,
  dayNum,
  monthNum,
  chipTag,
  diffDays,
  byDishOrder
}
