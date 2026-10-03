const config = require('../config.js')

/**
 * 数据入口：云端优先，失败时自动回退本地存储
 * ------------------------------------------------------------------
 * 未配云环境（config.cloudEnv 为空）时全程走本地存储，不配云也能把流程跑通。
 * 两个集合：
 *   dishes  { _id, name, cover, cat, ingredients:[], createdAt }
 *   orders  { _id, date:'YYYY-MM-DD', dishes:[dishId], updatedAt }
 * 单人使用，所以订单以「日期」为唯一键：改单就是覆盖同一条。
 */

const KEY_DISHES = 'fm_dishes'
const KEY_ORDERS = 'fm_orders'

const COL_DISH = 'dishes'
const COL_ORDER = 'orders'

function cloudOn() {
  const app = getApp()
  return !!(config.useCloud && config.cloudEnv && app && app.globalData && app.globalData.useCloud)
}

function db() {
  return wx.cloud.database()
}

function genId() {
  return `${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

function readLocal(key) {
  try {
    return wx.getStorageSync(key) || []
  } catch (e) {
    console.warn('[store] 本地读取失败', e)
    return []
  }
}

function writeLocal(key, list) {
  try {
    wx.setStorageSync(key, list)
  } catch (e) {
    console.warn('[store] 本地写入失败', e)
  }
}

/* ---------------- 菜谱 ---------------- */

async function loadDishes() {
  if (!cloudOn()) return readLocal(KEY_DISHES).slice().sort(byRecent)
  try {
    const res = await db().collection(COL_DISH).limit(100).get()
    return res.data.slice().sort(byRecent)
  } catch (e) {
    console.warn('[store] 云端读菜谱失败，回退本地', e)
    return readLocal(KEY_DISHES).slice().sort(byRecent)
  }
}

function byRecent(a, b) {
  return (b.createdAt || 0) - (a.createdAt || 0)
}

async function addDish(dish) {
  const rec = {
    name: dish.name,
    cover: dish.cover || '',
    cat: dish.cat || '',
    ingredients: dish.ingredients || [],
    createdAt: Date.now()
  }
  if (!cloudOn()) {
    const list = readLocal(KEY_DISHES)
    rec._id = genId()
    list.push(rec)
    writeLocal(KEY_DISHES, list)
    return rec._id
  }
  try {
    const res = await db().collection(COL_DISH).add({ data: rec })
    return res._id
  } catch (e) {
    console.warn('[store] 云端写菜谱失败，落本地', e)
    const list = readLocal(KEY_DISHES)
    rec._id = genId()
    list.push(rec)
    writeLocal(KEY_DISHES, list)
    return rec._id
  }
}

async function updateDish(id, patch) {
  if (!cloudOn()) {
    const list = readLocal(KEY_DISHES)
    const i = list.findIndex((d) => d._id === id)
    if (i > -1) {
      list[i] = Object.assign({}, list[i], patch)
      writeLocal(KEY_DISHES, list)
    }
    return
  }
  try {
    await db().collection(COL_DISH).doc(id).update({ data: patch })
  } catch (e) {
    console.warn('[store] 云端更新失败', e)
    throw e
  }
}

async function removeDish(id) {
  if (!cloudOn()) {
    writeLocal(KEY_DISHES, readLocal(KEY_DISHES).filter((d) => d._id !== id))
    return
  }
  try {
    await db().collection(COL_DISH).doc(id).remove()
  } catch (e) {
    console.warn('[store] 云端删除失败', e)
    throw e
  }
}

/**
 * 批量写「手动排序号」。
 * items = [{ _id, sort }]，一次把一组的顺序整体落库（0,1,2…）。
 * 为什么要整组重写：sort 只存数字，只改相邻两个的话，
 * 新加的菜（没有 sort）插进来会让序号对不上；整组重编号永远自洽。
 */
async function setSort(items) {
  const list = (items || []).filter((it) => it && it._id)
  if (!list.length) return

  if (!cloudOn()) {
    const all = readLocal(KEY_DISHES)
    const map = {}
    list.forEach((it) => {
      map[it._id] = it.sort
    })
    all.forEach((d) => {
      if (map[d._id] !== undefined) d.sort = map[d._id]
    })
    writeLocal(KEY_DISHES, all)
    return
  }

  try {
    // 小程序端没有多文档批量 update，逐条写；一次最多几十道，够快
    await Promise.all(
      list.map((it) => db().collection(COL_DISH).doc(it._id).update({ data: { sort: it.sort } }))
    )
  } catch (e) {
    console.warn('[store] 云端排序失败', e)
    throw e
  }
}

/* ---------------- 每日订单 ---------------- */

const EMPTY_ORDER = { date: '', dishes: [] }

/** 取某一天的订单，没有就返回空壳 */
async function loadOrder(date) {
  if (!cloudOn()) {
    const one = readLocal(KEY_ORDERS).find((o) => o.date === date)
    return one ? Object.assign({}, EMPTY_ORDER, one) : Object.assign({}, EMPTY_ORDER, { date })
  }
  try {
    const res = await db().collection(COL_ORDER).where({ date }).limit(1).get()
    if (res.data && res.data.length) {
      return Object.assign({}, EMPTY_ORDER, res.data[0])
    }
    return Object.assign({}, EMPTY_ORDER, { date })
  } catch (e) {
    console.warn('[store] 云端读订单失败，回退本地', e)
    const one = readLocal(KEY_ORDERS).find((o) => o.date === date)
    return one ? Object.assign({}, EMPTY_ORDER, one) : Object.assign({}, EMPTY_ORDER, { date })
  }
}

/** 以日期为键做新增或覆盖 */
async function saveOrder(order) {
  const rec = {
    date: order.date,
    dishes: order.dishes || [],
    updatedAt: Date.now()
  }

  if (!cloudOn()) {
    const list = readLocal(KEY_ORDERS)
    const i = list.findIndex((o) => o.date === rec.date)
    if (i > -1) {
      rec._id = list[i]._id
      list[i] = Object.assign({}, list[i], rec)
    } else {
      rec._id = genId()
      list.push(rec)
    }
    writeLocal(KEY_ORDERS, list)
    return
  }

  try {
    const exist = await db().collection(COL_ORDER).where({ date: rec.date }).limit(1).get()
    if (exist.data && exist.data.length) {
      await db().collection(COL_ORDER).doc(exist.data[0]._id).update({ data: rec })
    } else {
      await db().collection(COL_ORDER).add({ data: rec })
    }
  } catch (e) {
    console.warn('[store] 云端写订单失败，落本地', e)
    const list = readLocal(KEY_ORDERS)
    const i = list.findIndex((o) => o.date === rec.date)
    if (i > -1) list[i] = Object.assign({}, list[i], rec)
    else list.push(Object.assign({ _id: genId() }, rec))
    writeLocal(KEY_ORDERS, list)
  }
}

/**
 * 删掉某一天的订单（整条记录删掉，不只是清空）。
 * 菜单页的「删除这一天」用它。
 */
async function removeOrder(date) {
  if (!cloudOn()) {
    writeLocal(KEY_ORDERS, readLocal(KEY_ORDERS).filter((o) => o.date !== date))
    return
  }
  try {
    const res = await db().collection(COL_ORDER).where({ date }).get()
    await Promise.all((res.data || []).map((o) => db().collection(COL_ORDER).doc(o._id).remove()))
  } catch (e) {
    console.warn('[store] 云端删订单失败，落本地', e)
    writeLocal(KEY_ORDERS, readLocal(KEY_ORDERS).filter((o) => o.date !== date))
    throw e
  }
}

/**
 * 取全部历史订单（给统计页用）
 * 小程序端 get() 一次上限 100 条，所以分批 skip 拉完为止。
 */
async function loadAllOrders() {
  if (!cloudOn()) return readLocal(KEY_ORDERS)
  const out = []
  let skip = 0
  const size = 100
  for (let i = 0; i < 20; i++) {
    const res = await db().collection(COL_ORDER).orderBy('date', 'desc').skip(skip).limit(size).get()
    out.push(...(res.data || []))
    if (!res.data || res.data.length < size) break
    skip += size
  }
  return out
}

/**
 * 取最近 N 天的订单。用途：
 *   1. 点菜页「常吃」排序
 *   2. 日期条上标记哪几天已经点过
 * 小程序端一次最多 100 条，所以这里封顶 100，够用两年以上。
 */
async function recentOrders(days) {
  const n = Math.min((days || 30) * 2, 100)
  if (!cloudOn()) {
    const from = Date.now() - (days || 30) * 86400000
    return readLocal(KEY_ORDERS).filter((o) => (o.updatedAt || 0) > from)
  }
  try {
    const res = await db().collection(COL_ORDER).orderBy('date', 'desc').limit(n).get()
    return res.data || []
  } catch (e) {
    console.warn('[store] 云端读历史订单失败', e)
    return []
  }
}

module.exports = {
  cloudOn,
  loadDishes,
  addDish,
  updateDish,
  removeDish,
  setSort,
  loadOrder,
  saveOrder,
  removeOrder,
  loadAllOrders,
  recentOrders,
  COL_DISH,
  COL_ORDER
}
