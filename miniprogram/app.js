const config = require('./config.js')

App({
  onLaunch() {
    const ok = config.useCloud && config.cloudEnv && wx.cloud
    if (ok) {
      wx.cloud.init({
        env: config.cloudEnv,
        traceUser: true
      })
    } else {
      console.warn('[家庭点餐] 未配置云环境，走本地存储模式（不换机够用，重装会丢）')
    }
  },

  globalData: {
    env: config.cloudEnv,
    /** 是否真的在连云端 */
    useCloud: !!(config.useCloud && config.cloudEnv),
    config,
    /** 从「菜单」页跳「点菜」页时携带的目标日期（'YYYY-MM-DD' 或 ''） */
    targetDate: ''
  }
})
