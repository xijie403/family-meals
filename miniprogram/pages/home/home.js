const config = require('../../config.js')

Page({
  data: {
    homeName: config.home.name,
    slogan: config.home.slogan
  },

  /** 首页「开始进入点单」→ 跳到「点菜」页（switchTab 不能带参数） */
  start() {
    wx.switchTab({ url: '/pages/order/order' })
  }
})
