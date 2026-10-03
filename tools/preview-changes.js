/* ============================================================
   改动预览页生成器
   ------------------------------------------------------------
   用法：node tools/preview-changes.js
   产出：preview-changes.html（项目根，双击用浏览器打开即可看，不需要开发者工具）

   原理：直接读 miniprogram 下真实的 .wxss，把 rpx 当 px（750 逻辑宽下 1rpx = 1px），
        在 750px 宽的画布里按真实 DOM 结构摆出来 —— 所以排版和真机一致，
        但**DOM 是手写的**（不是解析 wxml），改页面结构时这里也要跟着改。
   注意：WXSS 的变量挂在 `page` 选择器上，HTML 里没有 page 元素，
        必须把 `page {` 换成 `:root {`，否则 var(--bg) 之类全部失效、颜色会不对。
   ============================================================ */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'miniprogram')
const OUT = path.join(__dirname, '..', 'preview-changes.html')

const css = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/(\d+(?:\.\d+)?)rpx/g, '$1px')
const appCss = () => css('app.wxss').replace(/^page\s*\{/m, ':root {')

/* ---------------- ① 日期条：今天 = 10月3日，默认选中明天 10月4日 ---------------- */
const stripDays = [
  ['周三', 30, 'past', 1], ['10月', 1, 'past', 0], ['昨天', 2, 'past', 0],
  ['今天', 3, 'today', 0], ['明天', 4, 'on', 1], ['后天', 5, '', 0],
  ['周日', 6, '', 0], ['周一', 7, '', 0], ['周二', 8, '', 0], ['9月', 9, '', 0]
]
const strip = `
  <div class="days-wrap">
    <div class="days-box">
      <div class="days">${stripDays
        .map(
          ([t, n, extra, dot]) =>
            `<div class="day ${extra === 'on' ? 'on' : ''} ${extra === 'past' ? 'past' : ''} ${extra === 'today' ? 'today' : ''}">` +
            `<div class="day-tag">${t}</div><div class="day-num">${n}</div><div class="day-dot ${dot ? 'has' : ''}"></div></div>`
        )
        .join('')}</div>
      <div class="days-fade"></div>
    </div>
    <div class="pick more">更多</div>
  </div>`

/* ---------------- ② 日历：2026 年 10 月（1 号周四 → 前置 4 个空格） ---------------- */
const calCells = (() => {
  const out = []
  for (let i = 0; i < 4; i++) out.push('<div class="cal-c blank"><div class="cal-n"></div></div>')
  for (let d = 1; d <= 31; d++) {
    out.push(
      `<div class="cal-c ${d === 4 ? 'sel' : ''} ${d === 3 ? 'today' : ''} ${d < 3 ? 'past' : ''}">` +
        `<div class="cal-n">${d}</div>${d === 1 || d === 4 ? '<div class="cal-dot"></div>' : ''}</div>`
    )
  }
  return out.join('')
})()
const calendar = `
  <div class="sheet-mask on"></div>
  <div class="cal up">
    <div class="cal-hd"><div class="cal-nav">‹</div><div class="cal-title">2026年10月</div><div class="cal-nav">›</div></div>
    <div class="cal-wds">${['日', '一', '二', '三', '四', '五', '六'].map((w) => `<div class="cal-wd">${w}</div>`).join('')}</div>
    <div class="cal-grid">${calCells}</div>
    <div class="cal-ft"><div class="cal-today">回到今天</div></div>
  </div>`

/* ---------------- ③ 已点菜单弹层（底部已经没有「确定」） ---------------- */
const mrow = (n, cat, seq) => `
  <div class="mrow">
    <div class="mseq">${seq}</div>
    <div class="mthumb mph"></div>
    <div class="mmain"><div class="mname">${n}</div><div class="msub">${cat}</div></div>
    <div class="mdel">×</div>
  </div>`
const sheet = `
  <div class="sheet-mask on"></div>
  <div class="sheet up">
    <div class="sheet-hd">
      <div class="sheet-hd-l">
        <div class="sheet-ttl">10月4日 的菜单</div>
        <div class="sheet-sub">明天 · 共 4 道 · 选完自动保存</div>
      </div>
      <div class="sheet-clear">清空</div>
      <div class="sheet-x">✕</div>
    </div>
    <div class="sheet-body">
      ${mrow('蛋饼', '早餐', 1)}${mrow('卤牛肉', '大荤', 2)}${mrow('红烧鲈鱼', '大荤', 3)}${mrow('清炒西兰花', '蔬菜', 4)}
      <div class="mpad"></div>
    </div>
  </div>`

const frame = (label, inner, h) => `
  <div class="frame-wrap">
    <div class="frame-tag">${label}</div>
    <div class="frame" style="height:${h}px">${inner}</div>
  </div>`

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>家庭点餐 · 改动预览</title>
<style>${appCss()}
* { box-sizing: border-box; }
body { margin: 0; background: #EFE7DE; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
.head { padding: 24px 26px 6px; max-width: 1500px; }
.head h1 { font-size: 22px; margin: 0 0 8px; color: #3D3229; }
.head p { font-size: 14px; line-height: 1.8; color: #6B5947; margin: 6px 0; }
.head code { background: #fff; padding: 1px 6px; border-radius: 6px; }
.frames { display: flex; flex-wrap: wrap; gap: 26px; padding: 20px 26px 40px; align-items: flex-start; }
.frame-wrap > .frame-tag { font: 700 15px/1.5 -apple-system, "PingFang SC", sans-serif; color: #6B5947; margin-bottom: 8px; }
.frame { position: relative; width: 750px; overflow: hidden; background: var(--bg); color: var(--ink); font-size: 30px; line-height: 1.6; }
.frame .sheet, .frame .sheet-mask, .frame .bar-wrap, .frame .days-fade, .frame .cal { position: absolute; }
.frame .bar-wrap { padding-bottom: 18px; }
.frame .days { overflow: hidden; }
</style>
<style>${css('pages/order/order.wxss')}</style>
<style>.frame .hd { padding-bottom: 4px; }</style>
</head>
<body>
<div class="head">
  <h1>家庭点餐 · 点菜页这轮改动</h1>
  <p>这一页直接读项目里真实的 <code>.wxss</code> 渲染，<code>rpx</code> 按 1:1 换算、宽度固定 750 逻辑像素，
     所以排版和真机一致。真机观感仍以你手机为准。</p>
  <p>四处：① 日期条默认完整显示 6 天（含「后天」）＋「更多」和日期格对齐　② 「回到今天」搬进日历底部　
     ③ 已点菜单弹层底部不再有「确定」，清空挪到右上角　④ 底部入口只剩「看菜单」</p>
</div>
<div class="frames">
${frame('① 日期条：默认 6 天全部完整，右边「更多」同高同圆角', `
  <div class="hd"><div class="hd-row"><div class="hd-l">
    <div class="hd-title"><span class="hd-emo">🍚</span>今天想吃点啥</div>
    <div class="hd-sub">明天想吃啥？先安排上～ 🍀</div>
  </div><div class="hd-search"><span>搜菜</span></div></div></div>
  ${strip}
`, 300)}

${frame('② 点「更多」开的日历：「回到今天」在底部', calendar, 660)}

${frame('③ 已点菜单弹层：没有「确定」了，清空在右上角', sheet, 640)}

${frame('④ 底部入口：只剩「看菜单 ›」', `
  <div style="position:absolute;left:0;right:0;bottom:0" class="bar-wrap">
    <div class="bar solid"><text>已点 4 道</text><text>看菜单 ›</text></div>
  </div>
`, 200)}
</div>
</body></html>`

fs.writeFileSync(OUT, html)
console.log('已生成 ' + OUT)
