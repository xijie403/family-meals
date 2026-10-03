/**
 * 全局配置
 * ------------------------------------------------------------------
 * · 想连云端：把 cloudEnv 填成你的云开发环境 ID（形如 cloud1-xxxxxxxx）
 * · cloudEnv 留空 = 本地模式，数据存在手机本机，不用配云也能把全部功能跑一遍
 *   （换设备不同步、重装会丢，适合先把流程试通）
 */

/**
 * 菜品分类。想增删直接改这个数组即可
 * meat = 大荤（整块/整只的肉，红烧肉、鸡腿、整条鱼）
 * semi = 小荤（肉丝肉片配素菜，青椒肉丝、花菜炒肉片）
 * 改名只改 label，key 别动（图标文件名和已有菜品数据都挂在 key 上）
 */
const cats = [
  { key: 'breakfast', label: '早餐' },
  { key: 'meat', label: '大荤' },
  { key: 'semi', label: '小荤' },
  { key: 'veg', label: '蔬菜' },
  { key: 'soup', label: '汤' },
  { key: 'snack', label: '小吃' }
]

/**
 * 分类 + 小图标路径，点菜页侧栏和菜谱页筛选条共用。
 * 'all' 是虚拟分类，代表「不筛选」；图标由 tools/gen-cats.py 生成，
 * 想换形状改那个脚本重跑即可，不要手改图片。
 */
const catsUI = [{ key: 'all', label: '全部' }].concat(cats).map((c) => ({
  key: c.key,
  label: c.label,
  icon: `/images/cat-${c.key}.png`,
  iconOn: `/images/cat-${c.key}-on.png`
}))

module.exports = {
  useCloud: true,

  /** 留空则自动走本地存储兜底 */
  cloudEnv: 'cloud1-d2g2gdc1y22d606d2',

  /** 首页封面文案。家庭名随意改成你家的叫法 */
  home: {
    name: '栖栖家的菜谱',
    slogan: '今天也要好好吃饭呀'
  },

  cats,

  catsUI,

  /** 上传图片压缩到的最长边（px）。50 道菜时务必压，否则列表会卡 */
  maxImageSide: 1080
}
