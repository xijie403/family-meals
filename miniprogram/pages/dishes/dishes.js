const store = require('../../utils/store.js')
const upload = require('../../utils/upload.js')
const util = require('../../utils/util.js')
const config = require('../../config.js')

const CAT_MAP = {}
config.cats.forEach((c) => {
  CAT_MAP[c.key] = c.label
})

Page({
  data: {
    /** 左侧分类（只列真正有菜的分类），右侧按同一顺序分组展示 */
    sideCats: [],
    groups: [],
    /** 当前高亮的分类：滑动右侧列表时自动跟着切换 */
    spyKey: '',
    /** scroll-into-view 目标：点左侧分类时滚到对应分组 */
    mainTo: '',

    /** 搜索态的扁平结果（跨分类找菜） */
    list: [],
    kw: '',
    searching: false,
    hitCount: 0,

    all: [],
    total: 0,
    loading: true
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    const all = await store.loadDishes()
    this.setData({ all, total: all.length, loading: false })
    this.applyView()
  },

  /**
   * 构建视图。
   * · 常规态：按左侧分类顺序分组（早餐 / 大荤 / 小荤 / 蔬菜 / 汤 / 小吃），
   *   每组一个标题，滑动右侧时左侧高亮自动同步（和点菜页同一套左右联动）；
   * · 搜索态：有关键词时跨分类搜，扁平列出结果，并收起左侧分类栏
   *   （免得出现「明明有这道菜，却因为停在别的分类而搜不到」的困惑）。
   */
  applyView() {
    const { all, kw } = this.data
    const key = String(kw || '').trim().toLowerCase()

    const deco = (d) =>
      Object.assign({}, d, {
        _cat: CAT_MAP[d.cat] || '未分类',
        _ingCount: (d.ingredients || []).length
      })
    // 显示顺序：和点菜页共用一套（util.byDishOrder）——手动排过的按 sort，其余按录入时间
    const byTime = util.byDishOrder

    if (key) {
      const list = all
        .filter((d) => {
          const hitName = String(d.name || '').toLowerCase().indexOf(key) > -1
          const hitIng = (d.ingredients || []).some(
            (g) => String(g).toLowerCase().indexOf(key) > -1
          )
          return hitName || hitIng
        })
        .sort(byTime)
        .map(deco)

      this._secTops = []
      this.setData({
        list,
        groups: [],
        sideCats: [],
        searching: true,
        hitCount: list.length,
        total: all.length
      })
      return
    }

    const cats = config.catsUI.filter((c) => c.key !== 'all')
    const groups = cats
      .map((c) => ({
        key: c.key,
        label: c.label,
        icon: c.icon,
        iconOn: c.iconOn,
        list: all.filter((d) => d.cat === c.key).sort(byTime).map(deco)
      }))
      .filter((g) => g.list.length > 0)

    // 没填分类（或分类被删掉）的菜兜底成「未分类」一组，别让它们凭空消失
    const known = config.cats.map((c) => c.key)
    const others = all
      .filter((d) => known.indexOf(d.cat || '') === -1)
      .sort(byTime)
      .map(deco)
    if (others.length) {
      const allCat = config.catsUI.find((c) => c.key === 'all') || {}
      groups.push({
        key: 'other',
        label: '未分类',
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
        spyKey: keep ? this.data.spyKey : sideCats.length ? sideCats[0].key : '',
        mainTo: ''
      },
      () => this.measureSecs()
    )
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
    if (this._lockSpy) return
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
    if (!key) return
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

  onKw(e) {
    this.setData({ kw: e.detail.value })
    this.applyView()
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/dish-edit/dish-edit?id=${id}` })
  },

  /* ---------------- 手动调顺序：上移 / 置顶 ----------------
     只在「同一分类组内」挪动（跨分类挪没有意义：显示顺序本来就是按分类分组的）。
     做法：把这一组挪完后的完整顺序整体写成 sort = 0,1,2…，而不是只交换两个数字。
     原因：新加的菜没有 sort，只改相邻两个的话序号会和新菜打架；整组重编号永远自洽。 */

  /** 找到某道菜所在的分组 */
  groupOfDish(id) {
    return this.data.groups.find((g) => g.list.some((d) => d._id === id)) || null
  },

  /** 把一组的新顺序落库并刷新 */
  async applyOrder(list) {
    const patch = list.map((d, i) => ({ _id: d._id, sort: i }))
    wx.showLoading({ title: '调整中', mask: true })
    try {
      await store.setSort(patch)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '没保存成功，再试一次', icon: 'none' })
      return
    }
    wx.hideLoading()
    this.refresh()
  },

  /** 上移一位 */
  moveUp(e) {
    const id = e.currentTarget.dataset.id
    const g = this.groupOfDish(id)
    if (!g) return
    const i = g.list.findIndex((d) => d._id === id)
    if (i <= 0) return
    const next = g.list.slice()
    next[i - 1] = g.list[i]
    next[i] = g.list[i - 1]
    wx.vibrateShort({ type: 'light', fail: () => {} })
    this.applyOrder(next)
  },

  /** 置顶：直接挪到本组第一个 */
  moveTop(e) {
    const id = e.currentTarget.dataset.id
    const g = this.groupOfDish(id)
    if (!g) return
    const i = g.list.findIndex((d) => d._id === id)
    if (i <= 0) return
    const next = [g.list[i]].concat(g.list.filter((d) => d._id !== id))
    wx.vibrateShort({ type: 'light', fail: () => {} })
    this.applyOrder(next)
  },

  addOne() {
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit' })
  },

  /** 一次最多选 9 张，生成待完善卡片后逐个补名字 */
  async addBatch() {
    let paths = []
    try {
      paths = await upload.pick(9)
    } catch (e) {
      return
    }
    if (!paths.length) return
    const app = getApp()
    if (app) app.globalData.batchRaw = paths
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit?batch=1' })
  },

  async remove(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const r = await wx.showModal({
      title: `删除「${name}」`,
      content: '删掉后这道菜连带它的食材记录就没了，确定？'
    }).catch(() => ({ confirm: false }))
    if (!r || !r.confirm) return
    try {
      await store.removeDish(id)
      wx.showToast({ title: '已删除' })
      this.refresh()
    } catch (e2) {
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  }
})
