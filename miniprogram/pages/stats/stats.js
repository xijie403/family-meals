const store = require('../../utils/store.js')
const util = require('../../utils/util.js')
const config = require('../../config.js')

const CAT_MAP = {}
config.cats.forEach((c) => {
  CAT_MAP[c.key] = c.label
})

/** 统计一段时间里点了多少道菜、点了几天 */
function summarize(orders, from) {
  const picked = from ? orders.filter((o) => o.date >= from) : orders
  let dishes = 0
  picked.forEach((o) => {
    dishes += (o.dishes || []).length
  })
  return { dishes: dishes, days: picked.length }
}

Page({
  data: {
    range: 'month',
    weekDays: {},
    week: { dishes: 0, days: 0 },
    month: { dishes: 0, days: 0 },
    all: { dishes: 0, days: 0 },
    avgPerWeek: 0,
    rank: [],
    /** 排名口径：normal 正餐（除早餐外全部）/ breakfast 早餐 */
    meal: 'normal',
    rankNormal: [],
    rankBreakfast: [],
    groups: [],
    loading: true
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    let dishes = []
    let orders = []
    try {
      const res = await Promise.all([store.loadDishes(), store.loadAllOrders()])
      dishes = res[0]
      orders = res[1]
    } catch (e) {
      console.warn('[stats] 加载失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    this.setData({ dishes, orders, loading: false }, () => this.compute())
  },

  setRange(e) {
    this.setData({ range: e.currentTarget.dataset.r }, () => this.compute())
  },

  /** 排名口径切换：正餐 / 早餐 */
  setMeal(e) {
    const meal = e.currentTarget.dataset.m
    if (!meal || meal === this.data.meal) return
    this.setData({
      meal,
      rank: meal === 'breakfast' ? this.data.rankBreakfast : this.data.rankNormal
    })
  },

  compute() {
    const { dishes, orders, range } = this.data
    const dishMap = {}
    dishes.forEach((d) => {
      dishMap[d._id] = d
    })

    const weekFrom = util.weekStart()
    const monthFrom = util.monthStart()

    this.setData({
      week: summarize(orders, weekFrom),
      month: summarize(orders, monthFrom),
      all: summarize(orders, null)
    })

    const from = range === 'week' ? weekFrom : range === 'month' ? monthFrom : null
    const picked = from ? orders.filter((o) => o.date >= from) : orders

    /** 每个菜被点了几次 */
    const freq = {}
    picked.forEach((o) => {
      ;(o.dishes || []).forEach((id) => {
        freq[id] = (freq[id] || 0) + 1
      })
    })

    const keys = Object.keys(freq)

    // 全部菜的排名，带上分类 key，后面按「正餐 / 早餐」拆开
    const rankAll = keys
      .map((id) => ({
        id: id,
        name: dishMap[id] ? dishMap[id].name : '（已删除的菜）',
        cover: dishMap[id] ? dishMap[id].cover : '',
        catKey: dishMap[id] ? dishMap[id].cat || '' : '',
        cat: dishMap[id] ? CAT_MAP[dishMap[id].cat] || '未分类' : '',
        count: freq[id]
      }))
      .sort((a, b) => b.count - a.count)

    // 早餐的品种比正餐少很多，混在一起排会被正餐淹没 → 拆成两套排名。
    // 除「早餐」外全部算正餐；两套各按自己的最大值算占比条，条形长度才可比。
    const withPct = (arr) => {
      const max = arr.length ? arr[0].count : 1
      return arr.map((x) => Object.assign({}, x, { pct: Math.round((x.count / max) * 100) }))
    }
    const rankNormal = withPct(rankAll.filter((r) => r.catKey !== 'breakfast'))
    const rankBreakfast = withPct(rankAll.filter((r) => r.catKey === 'breakfast'))

    /** 按分类分组：每个分类下有哪些菜、各被点了几次
     *  （如「早餐」下面：小馄饨 3 次、面条 2 次），方便一眼看出这类吃得杂不杂 */
    const catOf = {}
    keys.forEach((id) => {
      if (dishMap[id]) catOf[id] = dishMap[id].cat || ''
    })

    const groupOf = (key, label, icon, match) => {
      const items = keys
        .filter((id) => dishMap[id] && match(id))
        .map((id) => ({
          id: id,
          name: dishMap[id].name,
          cover: dishMap[id].cover || '',
          count: freq[id]
        }))
        .sort((a, b) => b.count - a.count)
      const total = items.reduce((s, x) => s + x.count, 0)
      const max = items.length ? items[0].count : 1
      return {
        key: key,
        label: label,
        icon: icon,
        total: total,
        items: items.map((x) => Object.assign({}, x, { pct: Math.round((x.count / max) * 100) }))
      }
    }

    const known = config.cats.map((c) => c.key)
    const groups = config.catsUI
      .filter((c) => c.key !== 'all')
      .map((c) => groupOf(c.key, c.label, c.icon, (id) => (catOf[id] || '') === c.key))
      .filter((g) => g.total > 0)

    // 菜谱里没选分类（或分类被删掉）的菜兜底成一组，别让它们凭空消失
    const others = groupOf('other', '未分类', '', (id) => known.indexOf(catOf[id] || '') === -1)
    if (others.total) groups.push(others)

    const rank = this.data.meal === 'breakfast' ? rankBreakfast : rankNormal
    this.setData({ rank, rankNormal, rankBreakfast, groups, rangeDays: picked.length })
  }
})
