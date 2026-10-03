const config = require('../config.js')

/**
 * 图片：先按最长边 1080 缩放，再上传
 * ------------------------------------------------------------------
 * 相册原图动辄 4–8MB，50 道菜就是几百兆，列表必卡。
 * 压到长边 1080 + jpg 0.85 后单张约 150–300KB，肉眼无损。
 */

/** 一次最多选 9 张（微信接口上限） */
async function pick(count) {
  const res = await wx.chooseMedia({
    count: Math.min(count || 9, 9),
    mediaType: ['image'],
    sizeType: ['compressed'],
    sourceType: ['album', 'camera']
  })
  return res.tempFiles.map((f) => f.tempFilePath)
}

async function compress(src) {
  try {
    return await scale(src, config.maxImageSide)
  } catch (e) {
    console.warn('[img] canvas 缩放失败，退回系统压缩', e)
    try {
      const r = await wx.compressImage({ src, quality: 70 })
      return r.tempFilePath
    } catch (e2) {
      console.warn('[img] 系统压缩也失败，用原图', e2)
      return src
    }
  }
}

/** 用离屏 canvas 缩放到指定最长边 */
function scale(src, maxSide) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src,
      success(info) {
        const long = Math.max(info.width, info.height)
        const ratio = Math.min(1, maxSide / long)
        const w = Math.round(info.width * ratio)
        const h = Math.round(info.height * ratio)

        const canvas = wx.createOffscreenCanvas({ type: '2d', width: w, height: h })
        const ctx = canvas.getContext('2d')
        const img = canvas.createImage()

        img.onload = () => {
          ctx.clearRect(0, 0, w, h)
          ctx.drawImage(img, 0, 0, w, h)
          wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width: w,
            height: h,
            destWidth: w,
            destHeight: h,
            fileType: 'jpg',
            quality: 0.85,
            success: (r) => resolve(r.tempFilePath),
            fail: reject
          })
        }
        img.onerror = reject
        img.src = src
      },
      fail: reject
    })
  })
}

/** 本地模式下把临时图存进小程序私有目录，否则重启 App 图就丢了 */
function persist(src) {
  try {
    const name = `dish_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`
    const dest = `${wx.env.USER_DATA_PATH}/${name}`
    wx.getFileSystemManager().saveFileSync(src, dest)
    return dest
  } catch (e) {
    console.warn('[img] 本地持久化失败', e)
    return src
  }
}

/**
 * 上传一张图，返回可直接塞进 <image src> 的地址
 * 云端返回 cloud://fileID，本地模式返回本机持久化路径
 */
async function upload(src) {
  const small = await compress(src)
  const app = getApp()
  if (app && app.globalData && app.globalData.useCloud) {
    try {
      const name = `dishes/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`
      const r = await wx.cloud.uploadFile({ cloudPath: name, filePath: small })
      return r.fileID
    } catch (e) {
      console.warn('[img] 云端上传失败，落本地', e)
      return persist(small)
    }
  }
  return persist(small)
}

module.exports = { pick, compress, upload, persist }
