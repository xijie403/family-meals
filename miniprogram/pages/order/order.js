const store = require('../../utils/store.js')
const util = require('../../utils/util.js')
const config = require('../../config.js')

const CAT_MAP = {}
config.cats.forEach((c) => {
  CAT_MAP[c.key] = c.label
})

const STRIP_LEN = 15 // 日期条显示的天数（今天往前 3 天 + 往后 11 天）
const STRIP_BACK = 3 // 日期条最左边留几天（补记用）

Page({
  data: {
    topTip: '',
    date: '',
    rel: '',
    desc: { md: '', wd: '', full: '' },
    days: [],
    scrollTo: '',

    /** 左侧分类（只列真正有菜的分类），右侧按同一顺序分组展示 */
    sideCats: [],
    groups: [],
    /** 当前高亮的分类 key：滑动右侧菜品时自动跟着切换 */
    spyKey: '',
    /** scroll-into-view 目标：点左侧分类时滚到对应分组 */
    mainTo: '',
    /** 已点菜的顺序号 { 菜品id: 第几道 }。只更新这一个字段，
     *  避免每点一次菜就把整个菜品列表 setData 一遍（菜多了会卡） */
    seq: {},

    /** 搜索态用的扁平结果（跨分类找菜） */
    list: [],
    picked: [],
    total: 0,
    loading: true,
    minDate: '',
    maxDate: '',
    /** 哪些天已经点过菜 { 日期: 道数 }：日期条的小圆点和日历里的小圆点共用 */
    marks: {},

    /** 日历弹层（日期条右侧的「更多」） */
    cal: false,
    calY: 0,
    calM: 0,
    calTitle: '',
    calCells: [],

    /** 搜索：菜多了以后靠它按名字/食材直接找 */
    searchOpen: false,
    focusSearch: false,
    kw: '',
    searching: false,
    hitCount: 0,

    /** 底部「已点菜单」弹层 */
    sheet: false,
    menu: [],
    barText: '',
    barHint: ''
  },

  onLoad() {
    this._stripFirst = true // 首次进页面要把日期条滚到「今天」附近
    this.setData({
      date: util.dateStr(1),
      minDate: util.dateStr(-365),
      maxDate: util.dateStr(365)
    })
  },

  onShow() {
    // 切 tab 回来时把弹层收掉，否则还停在「已点菜单」或日历上；
    // focusSearch 一并复位，避免切回来时输入框自动弹键盘
    this.setData({ sheet: false, cal: false, focusSearch: false })

    // 从「菜单」页点某一天跳过来：带上目标日期直接定位到那天
    const app = getApp()
    if (app && app.globalData && app.globalData.targetDate) {
      const d = app.globalData.targetDate
      app.globalData.targetDate = ''
      // 跳过来的那天一定要在日期条上看得见（forceStrip 让日期条滚过去）
      this._forceStrip = true
      this.setData({ date: d, loading: true }, () => this.refresh())
      return
    }

    // 从菜谱页改动后返回需要重新拉取
    if (this.data.date) this.refresh()
  },

  /** 顶部文案：跟着所选日期走（说给小朋友听的话） */
  tipFor(date) {
    const today = util.dateStr(0)
    if (date === today) return '今天想吃点啥？点两下就选好啦 🥳'
    if (date === util.dateStr(1)) return '明天想吃啥？先安排上～ 🍀'
    if (date < today) return '这天吃了啥？补记一下呀 ✏️'
    return '提前给这天挑点好吃的 ✨'
  },

  async refresh() {
    const date = this.data.date
    wx.showNavigationBarLoading()

    let all = []
    let order = { dishes: [] }
    let recent = []
    try {
      const res = await Promise.all([store.loadDishes(), store.loadOrder(date), store.recentOrders(90)])
      all = res[0]
      order = res[1]
      recent = res[2]
    } catch (e) {
      console.warn('[order] 加载失败', e)
      wx.showToast({ title: '加载失败，重试一下', icon: 'none' })
    }

    const picked = (order.dishes || []).filter((id) => all.some((d) => d._id === id))

    // 历史订单只用来标记「哪些天已经点过」（日期条上的小圆点）。
    // 注意：不再统计「常吃次数」——以前拿它给菜品排序，结果每点一道菜
    // 整张列表就跟着重排，看着像卡片自己往上跳，已经去掉。
    const marked = {}
    recent.forEach((o) => {
      const ids = o.dishes || []
      if (o.date && ids.length) marked[o.date] = ids.length
    })
    // 当前这天以页面实时状态为准，避免刚改动但历史还是旧值
    if (picked.length) marked[date] = picked.length
    else delete marked[date]

    this._scrollTop = 0
    const days = this.buildDays(date, marked)
    this.setData({
      topTip: this.tipFor(date),
      rel: util.relTag(date),
      desc: util.describe(date),
      all,
      picked,
      loading: false,
      days,
      marks: marked,
      scrollTo: this.scrollTarget,
      mainTo: ''
    })
    this.applyView()
    wx.hideNavigationBarLoading()
  },

  /** 日期条：今天前三后十一，选中日期在范围外就以它为中心重排 */
  buildDays(date, marked) {
    const today = util.dateStr(0)
    const earliest = util.addDays(today, -STRIP_BACK)
    const latest = util.addDays(earliest, STRIP_LEN - 1)
    // 选中日期落在默认窗口外 → 以它为中心重排；否则永远是「今天前 3 天」开头，
    // 这样「一周后想回头改前几天」时前面的日子一直在条上，不会走丢。
    const recentered = date < earliest || date > latest
    const start = recentered ? util.addDays(date, -STRIP_BACK) : earliest

    const days = []
    let idx = 0
    for (let i = 0; i < STRIP_LEN; i++) {
      const d = util.addDays(start, i)
      if (d === date) idx = i
      days.push({
        date: d,
        tag: util.chipTag(d),
        num: util.dayNum(d),
        isToday: d === today,
        past: d < today,
        _n: marked[d] || 0
      })
    }

    /* 什么时候需要滚日期条：换窗口了 / 刚进页面 / 从日历或菜单页跳过来的时候。
       点在条上已经看得见的某天**不滚**——否则条子会在手指底下跳一下。 */
    const needScroll = recentered || this._stripFirst || this._forceStrip
    this.scrollTarget = needScroll ? 'c' + Math.max(0, idx - 1) : ''
    this._stripFirst = false
    this._forceStrip = false
    return days
  },

  /**
   * 构建菜品视图。
   * · 正常态：按左侧分类顺序分组（早餐 / 大荤 / 小荤 / 蔬菜 / 汤 / 小吃），
   *   每组一个标题，滑动右侧时左侧高亮自动同步（左右联动）；
   * · 搜索态：有关键词时跨分类搜，扁平列出结果，并收起左侧分类栏
   *   （免得出现「明明有这道菜，却因为停在别的分类而搜不到」的困惑）。
   * 组内顺序：和「菜谱」页共用一套（util.byDishOrder）——手动排过序的按 sort，
   *   其余按录入时间倒序。顺序与「点没点过这道菜」无关，勾选/取消都不会让卡片挪位置。
   */
  applyView() {
    const { all, picked, kw } = this.data
    const key = String(kw || '').trim().toLowerCase()

    const deco = (d) =>
      Object.assign({}, d, {
        _cat: CAT_MAP[d.cat] || ''
      })
    const byOrder = util.byDishOrder

    // 顺序号单独存成 map，点菜时只更新它，不动整张列表
    const seq = {}
    picked.forEach((id, i) => {
      seq[id] = i + 1
    })

    if (key) {
      const list = all
        .filter((d) => {
          const hitName = String(d.name || '').toLowerCase().indexOf(key) > -1
          const hitIng = (d.ingredients || []).some(
            (g) => String(g).toLowerCase().indexOf(key) > -1
          )
          return hitName || hitIng
        })
        .sort(byOrder)
        .map(deco)

      this._secTops = []
      this.setData({
        list,
        groups: [],
        sideCats: [],
        searching: true,
        hitCount: list.length,
        total: all.length,
        seq
      })
      this.buildMenu()
      return
    }

    const cats = config.catsUI.filter((c) => c.key !== 'all')
    const groups = cats
      .map((c) => ({
        key: c.key,
        label: c.label,
        icon: c.icon,
        iconOn: c.iconOn,
        list: all.filter((d) => d.cat === c.key).sort(byOrder).map(deco)
      }))
      .filter((g) => g.list.length > 0)

    // 菜谱里没填分类（或分类被删掉）的菜兜底成「其他」一组，别让它们凭空消失
    const known = config.cats.map((c) => c.key)
    const others = all
      .filter((d) => known.indexOf(d.cat || '') === -1)
      .sort(byOrder)
      .map(deco)
    if (others.length) {
      // 注意：cats 上面已经把 'all' 过滤掉了，图标要从原始 catsUI 里取
      const allCat = config.catsUI.find((c) => c.key === 'all') || {}
      groups.push({
        key: 'other',
        label: '其他',
        icon: allCat.icon || '',
        iconOn: allCat.iconOn || allCat.icon || '',
        list: others
      })
    }

    const sideCats = groups.map((g) => ({
      key: g.key,
      label: g.label,
      icon: g.icon,
      iconOn: g.iconOn
    }))
    const keep = sideCats.some((c) => c.key === this.data.spyKey)
    this.setData(
      {
        list: [],
        groups,
        sideCats,
        searching: false,
        hitCount: 0,
        total: all.length,
        seq,
        spyKey: keep ? this.data.spyKey : sideCats.length ? sideCats[0].key : '',
        mainTo: ''
      },
      () => this.measureSecs()
    )
    this.buildMenu()
  },

  /* ---------------- 左右联动（滑动右侧 → 左侧高亮跟着走） ---------------- */

  /** 量出每个分组相对滚动内容顶部的偏移，供滑动时判断当前在哪一组 */
  measureSecs(retry) {
    const q = wx.createSelectorQuery().in(this)
    q.select('.main').boundingClientRect()
    q.selectAll('.sec').boundingClientRect()
    q.exec((res) => {
      const main = res && res[0]
      const secs = (res && res[1]) || []
      if (!main || !secs.length) {
        // 首次渲染可能还没量到节点，稍后再量一次
        if (!retry) setTimeout(() => this.measureSecs(true), 150)
        return
      }
      const st = this._scrollTop || 0
      const groups = this.data.groups
      this._secTops = secs
        .map((s, i) => ({
          key: groups[i] ? groups[i].key : '',
          top: Math.max(0, Math.round(s.top - main.top + st))
        }))
        .filter((x) => x.key)
    })
  },

  onMainScroll(e) {
    this._scrollTop = e.detail.scrollTop
    // 点左侧分类后正在程序化滚动，这段时间别让 scroll 事件把高亮抢回去
    if (this._lockSpy || this.data.searching) return
    const tops = this._secTops
    if (!tops || !tops.length) return
    let active = tops[0].key
    for (let i = 0; i < tops.length; i++) {
      if (this._scrollTop + 8 >= tops[i].top) active = tops[i].key
    }
    if (active !== this.data.spyKey) this.setData({ spyKey: active })
  },

  /** 点左侧分类：滚到对应分组（不是筛选，滑到哪就高亮到哪） */
  pickCat(e) {
    const key = e.currentTarget.dataset.cat || ''
    if (!key || this.data.searching) return
    if (!this.data.sideCats.some((c) => c.key === key)) return

    this._lockSpy = true
    clearTimeout(this._lockTimer)
    this._lockTimer = setTimeout(() => {
      this._lockSpy = false
      clearTimeout(this._toTimer)
      this._toTimer = setTimeout(() => this.setData({ mainTo: '' }), 40)
    }, 440)

    const target = 'sec-' + key
    if (this.data.mainTo === target) {
      // 重复点同一个分类：先清空再设，才能再次触发滚动
      this.setData({ spyKey: key, mainTo: '' }, () => this.setData({ mainTo: target }))
    } else {
      this.setData({ spyKey: key, mainTo: target })
    }
  },

  /* ---------------- 搜索 ---------------- */

  /** 头部右上角那个「搜菜」按钮：再点一次就收起来 */
  toggleSearch() {
    if (this.data.searchOpen) {
      this.closeSearch()
      return
    }
    this.setData({ searchOpen: true })
    // 输入框节点要先渲染出来，focus 才会生效
    setTimeout(() => this.setData({ focusSearch: true }), 80)
  },

  closeSearch() {
    this.setData({ searchOpen: false, focusSearch: false, kw: '' })
    this.applyView()
  },

  onKw(e) {
    this.setData({ kw: e.detail.value })
    this.applyView()
  },

  /** 清掉关键词但留在搜索态，方便接着搜下一个 */
  clearKw() {
    this.setData({ kw: '', focusSearch: true })
    this.applyView()
  },

  /** 已点菜单：按点选先后编号，给底部弹层用 */
  buildMenu() {
    const { all, picked } = this.data
    const map = {}
    all.forEach((d) => {
      map[d._id] = d
    })
    const menu = picked.map((id, i) => {
      const d = map[id] || { _id: id, name: '（这道菜已从菜谱删除）' }
      return Object.assign({}, d, { _seq: i + 1, _cat: CAT_MAP[d.cat] || '' })
    })
    const n = picked.length
    this.setData({
      menu,
      barText: n ? `已点 ${n} 道` : '还没点菜',
      // 没有「确定」这一步：点一下就已经自动存好，这里只是「看一眼点了啥」
      barHint: n ? '看菜单' : '先挑几道'
    })
  },

  pickDate(e) {
    const date = e.currentTarget.dataset.d
    if (!date || date === this.data.date) return
    this.setData({ date, loading: true })
    this.refresh()
  },

  /**
   * 跳到某一天（日历选日期 / 日历底部「回到今天」都走这里）。
   * 先清 scrollTo、再在 refresh 里设目标：前后值一样时 scroll-into-view
   * 不会重新触发，日期条会赖在原地不滚过去。
   */
  goDate(d) {
    if (!d || d === this.data.date) return
    this._forceStrip = true
    this.setData({ date: d, loading: true, scrollTo: '' }, () => this.refresh())
  },

  /* ---------------- 日历弹层（日期条最右侧的「更多」） ----------------
     日期条只是「常用几天」的快捷方式；要看更远的日期就点「更多」开日历。
     日历可以前后翻月，范围跟原来一样：今天前后各一年。 */

  openCal() {
    this.calTo(this.data.date)
    this.setData({ cal: true })
  },

  closeCal() {
    this.setData({ cal: false })
  },

  /** 把日历翻到某一天所在的月份，并重画格子 */
  calTo(date) {
    const p = String(date || util.dateStr(0)).split('-').map(Number)
    const y = p[0] || new Date().getFullYear()
    const m = p[1] || new Date().getMonth() + 1
    this.setData({
      calY: y,
      calM: m,
      calTitle: `${y}年${m}月`,
      calCells: this.buildCal(y, m)
    })
  },

  calPrev() {
    const m = this.data.calM - 1
    this.calTo(`${m < 1 ? this.data.calY - 1 : this.data.calY}-${m < 1 ? 12 : m}-1`)
  },

  calNext() {
    const m = this.data.calM + 1
    this.calTo(`${m > 12 ? this.data.calY + 1 : this.data.calY}-${m > 12 ? 1 : m}-1`)
  },

  /** 日历里点某一天：选中并关掉弹层 */
  calPick(e) {
    const d = e.currentTarget.dataset.d
    if (!d || d < this.data.minDate || d > this.data.maxDate) return
    this.setData({ cal: false })
    this.goDate(d)
  },

  calToday() {
    this.setData({ cal: false })
    this.goDate(util.dateStr(0))
  },

  /** 画一个月的日历格子：前置补白 + 当月每天 + 补到整周 */
  buildCal(y, m) {
    const pad = (n) => String(n).padStart(2, '0')
    const today = util.dateStr(0)
    const total = new Date(y, m, 0).getDate() // 当月天数
    const lead = new Date(y, m - 1, 1).getDay() // 1 号是周几（0=周日）

    const cells = []
    for (let i = 0; i < lead; i++) cells.push({ blank: true, k: `b${i}` })
    for (let d = 1; d <= total; d++) {
      const ds = `${y}-${pad(m)}-${pad(d)}`
      cells.push({
        k: ds,
        d: ds,
        num: d,
        sel: ds === this.data.date,
        today: ds === today,
        past: ds < today,
        has: (this.data.marks[ds] || 0) > 0,
        off: ds < this.data.minDate || ds > this.data.maxDate
      })
    }
    while (cells.length % 7 !== 0) cells.push({ blank: true, k: `e${cells.length}` })
    return cells
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id
    const picked = this.data.picked.slice()
    const i = picked.indexOf(id)
    if (i > -1) picked.splice(i, 1)
    else picked.push(id)
    this.setData({ picked })
    wx.vibrateShort({ type: 'light', fail: () => {} })
    this.syncSeq()
    this.buildMenu()
    this.syncDot()
    this.persistLater()
  },

  /** 只更新顺序号 map：点一次菜不用把整张菜品列表重渲染一遍 */
  syncSeq() {
    const seq = {}
    this.data.picked.forEach((id, i) => {
      seq[id] = i + 1
    })
    this.setData({ seq })
  },

  /** 日期条上的小圆点跟随当前选择实时变化 */
  syncDot() {
    const { days, date, picked } = this.data
    if (!days.length) return
    const next = days.map((d) => Object.assign({}, d, { _n: d.date === date ? picked.length : d._n }))
    this.setData({ days: next })
  },

  /** 切走时立刻落库，避免 350ms 节流窗口里丢改动 */
  onHide() {
    clearTimeout(this._timer)
    if (this.data.date) this.persist()
  },

  persistLater() {
    clearTimeout(this._timer)
    this._timer = setTimeout(() => this.persist(), 350)
  },

  async persist() {
    const { date, picked } = this.data
    await store.saveOrder({ date, dishes: picked })
  },

  /* ---------------- 已点菜单弹层 ---------------- */

  openSheet() {
    if (!this.data.total) return
    this.setData({ sheet: true })
  },

  closeSheet() {
    this.setData({ sheet: false })
  },

  /** 在菜单里去掉一道，等同于点菜页再点一次取消 */
  removeOne(e) {
    const id = e.currentTarget.dataset.id
    const picked = this.data.picked.filter((x) => x !== id)
    this.setData({ picked })
    wx.vibrateShort({ type: 'light', fail: () => {} })
    this.syncSeq()
    this.buildMenu()
    this.syncDot()
    this.persistLater()
  },

  /**
   * 清空这一天。
   * 注：这里**没有** confirmMenu 了 —— 弹层里不再有「确定」按钮。
   * 每次点菜都走 persistLater() 350ms 防抖自动落库（onHide 里兜底立刻落库），
   * 所以「点一下 = 已经记下」，不需要用户再确认一次。
   */
  async clearPick() {
    const r = await wx
      .showModal({
        title: '清空这一天',
        content: `把 ${this.data.desc.md} 选的 ${this.data.picked.length} 道菜全部取消？`
      })
      .catch(() => ({ confirm: false }))
    if (!r || !r.confirm) return
    clearTimeout(this._timer)
    this.setData({ picked: [], sheet: false })
    this.syncSeq()
    this.buildMenu()
    this.syncDot()
    await this.persist()
    wx.showToast({ title: '已清空' })
  },

  goDishes() {
    wx.switchTab({ url: '/pages/dishes/dishes' })
  }
})
