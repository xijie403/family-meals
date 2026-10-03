const store = require('../../utils/store.js')
const upload = require('../../utils/upload.js')
const config = require('../../config.js')

Page({
  data: {
    id: '',
    isEdit: false,
    name: '',
    cover: '',
    cat: '',
    cats: [],
    ingText: '',
    mode: 'single',
    batchIdx: 0,
    batchTotal: 0,
    autoFocus: false,
    saving: false
  },

  batchPaths: [],

  onLoad(q) {
    // 编辑页的分类选择器也要图标，但不显示「全部」这个虚拟分类
    this.setData({ cats: config.catsUI.filter((c) => c.key !== 'all') })

    if (q && q.batch === '1') {
      const app = getApp()
      this.batchPaths = (app && app.globalData.batchRaw) || []
      if (!this.batchPaths.length) {
        wx.navigateBack()
        return
      }
      this.setData({
        mode: 'batch',
        autoFocus: true,
        batchIdx: 0,
        batchTotal: this.batchPaths.length,
        cover: this.batchPaths[0]
      })
      wx.setNavigationBarTitle({ title: `补名字 1/${this.batchPaths.length}` })
      return
    }

    if (q && q.id) {
      this.setData({ id: q.id, isEdit: true })
      wx.setNavigationBarTitle({ title: '编辑菜品' })
      this.load(q.id)
    } else {
      wx.setNavigationBarTitle({ title: '添加菜品' })
    }
  },

  async load(id) {
    const list = await store.loadDishes()
    const d = list.find((x) => x._id === id)
    if (!d) {
      wx.showToast({ title: '没找到这道菜', icon: 'none' })
      return
    }
    this.setData({
      name: d.name || '',
      cover: d.cover || '',
      cat: d.cat || '',
      ingText: (d.ingredients || []).join('、')
    })
  },

  async chooseImg() {
    let paths = []
    try {
      paths = await upload.pick(1)
    } catch (e) {
      return
    }
    if (paths && paths[0]) this.setData({ cover: paths[0] })
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },

  onIng(e) {
    this.setData({ ingText: e.detail.value })
  },

  pickCat(e) {
    const cat = e.currentTarget.dataset.cat || ''
    this.setData({ cat: cat === this.data.cat ? '' : cat })
  },

  /** 键盘右下角「完成」= 保存。批量模式下就是「存这张 + 跳下一张」，手不用离开键盘 */
  onConfirm() {
    this.save()
  },

  /**
   * 让输入框重新获得焦点。
   * 注意：focus 属性从 true → true 不会触发重新聚焦，必须先置 false 再置 true，
   * 否则批量录入时每存好一张都得手动点一次输入框。
   */
  focusName() {
    this.setData({ autoFocus: false })
    setTimeout(() => this.setData({ autoFocus: true }), 60)
  },

  /** 把「五花肉、生抽、冰糖」拆成数组，支持中英文逗号顿号和空格 */
  parseIng(text) {
    return String(text || '')
      .split(/[,，、;；\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  },

  async save() {
    if (this.data.saving) return
    const name = String(this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '先给它起个菜名', icon: 'none' })
      return
    }
    if (!this.data.cover) {
      wx.showToast({ title: '还没选图片', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中', mask: true })

    try {
      let cover = this.data.cover
      if (cover.indexOf('cloud:') !== 0) cover = await upload.upload(cover)
      const ingredients = this.parseIng(this.data.ingText)

      if (this.data.id) {
        await store.updateDish(this.data.id, {
          name,
          cover,
          cat: this.data.cat,
          ingredients
        })
        wx.hideLoading()
        wx.showToast({ title: '已更新' })
        setTimeout(() => wx.navigateBack(), 600)
        return
      }

      await store.addDish({ name, cover, cat: this.data.cat, ingredients })

      if (this.data.mode === 'batch') {
        const next = this.data.batchIdx + 1
        const total = this.batchPaths.length
        wx.hideLoading()
        if (next < total) {
          this.setData({
            cover: this.batchPaths[next],
            name: '',
            ingText: '',
            batchIdx: next,
            saving: false
          })
          wx.setNavigationBarTitle({ title: `补名字 ${next + 1}/${total}` })
          wx.showToast({ title: `已存 ${next}/${total}` })
          this.focusName()
        } else {
          wx.showToast({ title: `${total} 道菜已入库` })
          setTimeout(() => wx.navigateBack(), 800)
        }
        return
      }

      wx.hideLoading()
      wx.showToast({ title: '已保存' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      console.warn('[edit] 保存失败', e)
      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({ title: '保存失败，再试一次', icon: 'none' })
    }
  },

  async remove() {
    const r = await wx.showModal({
      title: `删除「${this.data.name}」`,
      content: '连它的食材记录一起删掉，确定？'
    }).catch(() => ({ confirm: false }))
    if (!r || !r.confirm) return
    try {
      await store.removeDish(this.data.id)
      wx.showToast({ title: '已删除' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },

  skipBatch() {
    wx.showModal({
      title: '放弃剩下的图',
      content: '还没起名字的菜不会被保存。',
      success: (r) => {
        if (r.confirm) wx.navigateBack()
      }
    })
  }
})
