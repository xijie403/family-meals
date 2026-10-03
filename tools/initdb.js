#!/usr/bin/env node
/**
 * 初始化云数据库（只做一次性的事）
 * ------------------------------------------------------------------------
 * 建两个集合：
 *   dishes   菜品：{ name, cover, cat, ingredients:[], createdAt }
 *   orders   每日订单：{ date:'YYYY-MM-DD', dishes:[菜品id], updatedAt }
 *
 * 注意：菜谱和订单都是**你在小程序里自己增删改**的，日常不需要跑这个脚本。
 *      它只负责把两个空集合建出来，顺便（可选）塞几道示例菜让你先试流程。
 *
 * 用法：
 *   export TENCENTCLOUD_SECRETID=...
 *   export TENCENTCLOUD_SECRETKEY=...
 *   export CLOUD_ENV=cloud1-xxxxxxxx
 *   node tools/initdb.js            # 只建集合
 *   node tools/initdb.js --seed     # 建集合 + 塞 6 道示例菜（试完可以在小程序里删掉）
 *   node tools/initdb.js --dry      # 只看要做什么，不写
 *
 * ⚠️ 建完必须去云开发控制台改权限：
 *    两个集合都要设成「仅创建者可读写」。
 *    不能设「所有用户可读」——那样你自己写不进去；
 *    也不能设「所有用户可读，仅创建者可写」——别人能往库里灌数据。
 */

const fs = require('fs')
const path = require('path')
const cloudbase = require('@cloudbase/node-sdk')

const CLOUD_JSON = path.join(__dirname, 'cloud.json')
let ENV = process.env.CLOUD_ENV || ''
if (!ENV && fs.existsSync(CLOUD_JSON)) {
  try {
    ENV = JSON.parse(fs.readFileSync(CLOUD_JSON, 'utf8')).env || ''
  } catch (e) {}
}
const SECRET_ID = process.env.TENCENTCLOUD_SECRETID || ''
const SECRET_KEY = process.env.TENCENTCLOUD_SECRETKEY || ''

const DRY = process.argv.includes('--dry')
const SEED = process.argv.includes('--seed')

const DISHES = 'dishes'
const ORDERS = 'orders'

const SEED_DISHES = [
  { name: '红烧肉', cat: 'meat', ingredients: ['五花肉', '生抽', '冰糖', '生姜', '葱'] },
  { name: '番茄炒蛋', cat: 'meat', ingredients: ['番茄', '鸡蛋', '葱'] },
  { name: '清炒西兰花', cat: 'veg', ingredients: ['西兰花', '蒜'] },
  { name: '冬瓜排骨汤', cat: 'soup', ingredients: ['冬瓜', '排骨', '生姜'] },
  { name: '南瓜饼', cat: 'snack', ingredients: ['南瓜', '糯米粉', '白糖'] },
  { name: '小米南瓜粥', cat: 'breakfast', ingredients: ['小米', '南瓜'] }
]

function fail(msg) {
  console.error('\n[错误] ' + msg + '\n')
  process.exit(1)
}

async function main() {
  console.log('\n云端环境：' + (ENV || '(未设置)'))
  console.log('将创建集合：' + DISHES + '、' + ORDERS)
  if (SEED) console.log('额外塞入 ' + SEED_DISHES.length + ' 道示例菜')

  if (DRY) {
    console.log('\n--dry 模式，未写入。\n')
    return
  }
  if (!ENV) fail('缺少云环境 ID（tools/cloud.json 或环境变量 CLOUD_ENV）')
  if (!SECRET_ID || !SECRET_KEY) fail('缺少 TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY')

  const app = cloudbase.init({ env: ENV, secretId: SECRET_ID, secretKey: SECRET_KEY })
  const db = app.database()

  for (const name of [DISHES, ORDERS]) {
    try {
      await db.createCollection(name)
      console.log('已创建集合：' + name)
    } catch (e) {
      console.log('集合已存在，跳过：' + name)
    }
  }

  if (SEED) {
    // 先数一下，避免重复跑塞进去一堆重复的菜
    const exist = await db.collection(DISHES).count()
    if (exist.total > 0) {
      console.log('\n已有 ' + exist.total + ' 道菜，跳过示例数据（不覆盖你的菜谱）')
    } else {
      for (const d of SEED_DISHES) {
        await db.collection(DISHES).add({
          name: d.name,
          cover: '',
          cat: d.cat,
          ingredients: d.ingredients,
          createdAt: Date.now()
        })
        console.log('OK  示例菜：' + d.name)
      }
      const after = await db.collection(DISHES).count()
      console.log('回读校验：' + DISHES + ' 现有 ' + after.total + ' 条')
    }
  }

  console.log(
    '\n--------------- 接下来必做的一步 ---------------\n' +
      '云开发控制台 → 数据库 → 把 ' + DISHES + ' 和 ' + ORDERS + ' 两个集合\n' +
      '权限都改成「仅创建者可读写」。\n\n' +
      '然后把云环境 ID 填进 miniprogram/config.js 的 cloudEnv，\n' +
      '重编译小程序即可。没填也能用——会自动走手机本地存储。\n'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
