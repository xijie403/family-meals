/**
 * 小程序交付自检 —— 一条命令跑完所有「静态能查出来的」问题
 *
 *   node tools/selfcheck.js
 *
 * 查这些（都是 node --check 查不出来的）：
 *   1. 所有 .json 能否 parse
 *   2. 所有 .js 语法
 *   3. 页面 wxml / wxss / js / json 是否齐全，tabBar 图标是否存在
 *   4. WXML 里 bind/catch 绑定的函数在 js 里是否真的定义了
 *   5. WXML 花括号是否配平
 *   6. **「用了 util. / store. / config. 却没 require」** —— 会让整页静默空白
 *   7. wxss 里对 view 用了 overflow-x:auto / overflow:auto（会渲染出灰色滚动条）
 *
 * 历史教训见 ~/.workbuddy/skills/wechat-miniprogram-from-scratch/SKILL.md 第九·补·2 节。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'miniprogram')
let problems = 0
const bad = (msg) => {
  problems++
  console.log('  ❌ ' + msg)
}
const ok = (msg) => console.log('  ✅ ' + msg)

function walk(dir, ext, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, ext, out)
    else if (f.endsWith(ext)) out.push(p)
  }
  return out
}

const rel = (p) => path.relative(path.join(__dirname, '..'), p)

/* ---------------- 1. JSON ---------------- */
console.log('\n== 1. JSON 可解析 ==')
for (const f of walk(ROOT, '.json')) {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch (e) {
    bad(rel(f) + ' → ' + e.message)
  }
}
if (!problems) ok('全部正常')

/* ---------------- 2. 页面文件齐全 ---------------- */
console.log('\n== 2. 页面文件 / tabBar 图标齐全 ==')
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
const before = problems
for (const p of appJson.pages || []) {
  for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
    const f = path.join(ROOT, p + ext)
    if (!fs.existsSync(f)) bad('缺文件 ' + rel(f))
  }
}
for (const t of (appJson.tabBar && appJson.tabBar.list) || []) {
  for (const k of ['iconPath', 'selectedIconPath']) {
    if (!t[k]) continue
    // tabBar 图标必须用以 / 开头的绝对路径；相对路径如 images/x.png 在真机上会被忽略 → 破图
    if (!t[k].startsWith('/')) bad('tabBar ' + k + ' 必须用绝对路径(/ 开头)，当前为相对路径: ' + t[k] + '（真机会显示破图）')
    if (!fs.existsSync(path.join(ROOT, t[k]))) bad('缺图标 ' + t[k])
  }
}
if (problems === before) ok(appJson.pages.length + ' 个页面 + tabBar 图标都在')

/* ---------------- 3. JS 语法 ---------------- */
console.log('\n== 3. JS 语法 ==')
const before3 = problems
for (const f of walk(ROOT, '.js')) {
  try {
    new Function(fs.readFileSync(f, 'utf8'))
  } catch (e) {
    bad(rel(f) + ' → ' + e.message)
  }
}
if (problems === before3) ok('全部通过')

/* ---------------- 4 & 5. WXML 事件绑定 / 花括号 ---------------- */
console.log('\n== 4. WXML 事件绑定是否有对应函数 ==')
const before4 = problems
for (const wxml of walk(ROOT, '.wxml')) {
  const js = wxml.replace(/\.wxml$/, '.js')
  if (!fs.existsSync(js)) continue
  const w = fs.readFileSync(wxml, 'utf8')
  const j = fs.readFileSync(js, 'utf8')

  const names = new Set()
  for (const m of w.matchAll(/(?:bind|catch)(?:tap|longpress|input|focus|blur|scroll|change|confirm|load)="([A-Za-z0-9_]+)"/g)) {
    names.add(m[1])
  }
  const miss = [...names].filter((n) => !new RegExp('(^|[^A-Za-z0-9_])' + n + '\\s*\\(').test(j))
  if (miss.length) bad(rel(wxml) + ' 绑定了但 js 里没有: ' + miss.join(', '))

  const ob = (w.match(/{/g) || []).length
  const cb = (w.match(/}/g) || []).length
  if (ob !== cb) bad(rel(wxml) + ' 花括号不配平 ' + ob + '/' + cb)
}
if (problems === before4) ok('所有绑定都有函数，花括号都配平')

/* ---------------- 6. 模块引用（重点！） ---------------- */
console.log('\n== 5. 用了 xxx. 但没 require（会整页空白）==')
const before6 = problems
const MODS = [
  ['utils/util.js', 'util'],
  ['utils/store.js', 'store'],
  ['utils/upload.js', 'upload'],
  ['config.js', 'config']
]
for (const f of walk(ROOT, '.js')) {
  const s = fs.readFileSync(f, 'utf8')
  const lines = s.split('\n')
  for (const [file, name] of MODS) {
    const required = lines.some((l) => l.includes('require(') && l.includes(path.basename(file)))
    let uses = 0
    for (let i = 0; i < s.length; i++) {
      if (s.startsWith(name + '.', i)) {
        const prev = s[i - 1]
        if (prev === undefined || !/[A-Za-z0-9_$.]/.test(prev)) uses++
      }
    }
    if (uses && !required) bad(rel(f) + ' 用了 ' + uses + ' 次 ' + name + '.  → 缺 require(\'' + file + '\')')
  }
}
if (problems === before6) ok('全部模块引用都有对应的 require')

/* ---------------- 7. 危险 overflow ---------------- */
console.log('\n== 6. wxss 里会冒出滚动条的 overflow ==')
const before7 = problems
for (const f of walk(ROOT, '.wxss')) {
  // 先把 /* ... */ 注释整段抹掉（含跨行），否则注释里提到 overflow-x:auto 也会被误报
  const raw = fs.readFileSync(f, 'utf8')
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const lines = stripped.split('\n')
  let sel = ''
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) continue
    if (l.includes('{')) sel = l.split('{')[0].trim()
    if (/overflow(-x)?\s*:\s*(auto|scroll)/.test(l)) {
      bad(rel(f) + ':' + (i + 1) + '  ' + sel + ' 用了 ' + l.trim() + ' → 内容一超宽就会渲染出灰色滚动条')
    }
  }
}
if (problems === before7) ok('没有危险的 overflow')

/* ---------------- 汇总 ---------------- */
console.log('\n' + '─'.repeat(52))
if (problems) {
  console.log('发现 ' + problems + ' 个问题，上面带 ❌ 的都是。')
  process.exit(1)
}
console.log('全部通过 ✅')
