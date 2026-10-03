const store = require('../../utils/store.js')
const util = require('../../utils/util.js')
const config = require('../../config.js')

const CAT_MAP = {}
config.cats.forEach((c) => {
  CAT_MAP[c.key] = c.label
})

Page({
  data: {
    homeName: config.home.name,
    list: [],
    fltList: [],
    loading: true,
    totalDays: 0,
    totalDishes: 0,
    firstDay: '',
    lastDay: '',

    /** 时间筛选：all 全部 / past 过去 / soon 未来一周 / far 一周以后 */
    flt: 'all',
    fltCounts: { all: 0, past: 0, soon: 0, far: 0 }
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    wx.showNavigationBarLoading()
    let dishes = []
    let orders = []
    try {
      const res = await Promise.all([store.loadDishes(), store.loadAllOrders()])
      dishes = res[0]
      orders = res[1]
    } catch (e) {
      console.warn('[meals] 加载失败', e)
      wx.showToast({ title: '加载失败，重试一下', icon: 'none' })
    }

    const dishMap = {}
    dishes.forEach((d) => {
      dishMap[d._id] = d
    })

    // 只保留真正点过菜的日期；被清空的日子不再留下「空白卡」
    // 再按日期倒序：最新的一天排最上面
    const sorted = orders
      .filter((o) => (o.dishes || []).length > 0)
      .sort((a, b) => {
        if (a.date === b.date) return 0
        return a.date < b.date ? 1 : -1
      })

    let totalDishes = 0
    let firstDay = ''
    let lastDay = ''

    // 昨天/今天/明天…的边界值，先算好，后面判断属于过去还是未来
    const today = util.dateStr(0)
    const tomorrow = util.addDays(today, 1)
    const afterTomorrow = util.addDays(today, 2)
    const yesterday = util.addDays(today, -1)
    const beforeYesterday = util.addDays(today, -2)
    // 「未来一周」的右边界：今天起第 7 天（含），更远的日子归到「一周以后」
    const weekEnd = util.addDays(today, 7)

    const list = sorted.map((o, i) => {
      const ids = o.dishes || []
      totalDishes += ids.length
      if (i === 0) lastDay = o.date
      if (i === sorted.length - 1) firstDay = o.date

      const items = ids.map((id) => {
        const d = dishMap[id]
        if (d) {
          return { _id: id, name: d.name, cover: d.cover || '', cat: CAT_MAP[d.cat] || '', ok: true }
        }
        // 菜从菜谱里删了，名字就查不到了，给个占位
        return { _id: id, name: '（这道菜已从菜谱删除）', cover: '', cat: '', ok: false }
      })

      // 先判这一天是过去 / 今天 / 未来，标签和底部文案都由它派生。
      // （原来靠「有没有相对标签」来判断，但更早的日期会返回星期几，
      //   导致昨天/前天被当成了未来，文案写成了「去这一天点菜」。）
      let tone = 'past'
      let label = '过去'
      if (o.date === today) {
        tone = 'now'
        label = '今天'
      } else if (o.date > today) {
        tone = 'plan'
        label = o.date === tomorrow ? '明天' : o.date === afterTomorrow ? '后天' : '待吃'
      } else {
        tone = 'past'
        label = o.date === yesterday ? '昨天' : o.date === beforeYesterday ? '前天' : '过去'
      }

      // 底部入口文案：过去是「补记漏掉的」，今天是「再加点」，未来是「提前安排」
      let foot = '去这一天点菜'
      if (tone === 'past') foot = '这天漏了哪些？去补记'
      else if (tone === 'now') foot = '今天还想加点什么？'

      const desc = util.describe(o.date)

      // 过滤用的桶：过去 / 未来一周（含今天）/ 一周以后
      let bucket = 'soon'
      if (o.date < today) bucket = 'past'
      else if (o.date > weekEnd) bucket = 'far'

      return {
        date: o.date,
        md: desc.md,
        wd: desc.wd,
        tone,
        label,
        foot,
        bucket,
        diff: util.diffDays(o.date, today),
        count: ids.length,
        items
      }
    })

    const fltCounts = { all: list.length, past: 0, soon: 0, far: 0 }
    list.forEach((it) => {
      fltCounts[it.bucket] += 1
    })

    this.setData(
      {
        list,
        fltCounts,
        loading: false,
        totalDays: list.length,
        totalDishes,
        firstDay,
        lastDay
      },
      () => this.applyFlt()
    )
    wx.hideNavigationBarLoading()
  },

  /** 按时间筛选：全部 / 过去 / 未来一周 / 一周以后 */
  setFlt(e) {
    const flt = e.currentTarget.dataset.f
    if (!flt || flt === this.data.flt) return
    this.setData({ flt }, () => this.applyFlt())
  },

  applyFlt() {
    const { list, flt } = this.data
    const fltList = flt === 'all' ? list : list.filter((it) => it.bucket === flt)
    this.setData({ fltList })
  },

  goOrder() {
    wx.switchTab({ url: '/pages/order/order' })
  },

  /** 点某一天 → 跳到点菜页并定位到那天，可直接改/加/删 */
  goDay(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    const app = getApp()
    if (app && app.globalData) app.globalData.targetDate = date
    wx.switchTab({ url: '/pages/order/order' })
  },

  /**
   * 删掉这一天的整份菜单。
   * 必须二次确认（弹窗里点「删除」才真删），防止手滑把一整天记的菜清掉。
   */
  async delDay(e) {
    const date = e.currentTarget.dataset.date
    const md = e.currentTarget.dataset.md || date
    const count = e.currentTarget.dataset.count || 0
    if (!date) return

    const r = await wx
      .showModal({
        title: '删除这一天的菜单',
        content: `把 ${md} 的 ${count} 道菜全部删掉？删了就找不回来了。`,
        confirmText: '删除',
        confirmColor: '#E0591A'
      })
      .catch(() => ({ confirm: false }))
    if (!r || !r.confirm) return

    try {
      await store.removeOrder(date)
    } catch (e2) {
      wx.showToast({ title: '删除失败，再试一次', icon: 'none' })
      return
    }
    wx.showToast({ title: `${md}已删除`, icon: 'none' })
    this.refresh()
  }
})
