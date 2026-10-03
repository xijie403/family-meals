# 排障手册

遇到奇怪问题时先翻这里。**结论都带证据**，不是猜的。

---

## 1. 底部 tabBar 图标显示成"破图"方块

**现象**：模拟器（或真机）底部 5 个 tab，**文字正常**（首页/点菜/菜单/统计/菜谱），但**图标位置是一个破损图片占位符**（iOS 风格的小方块）。

### 先排除这几项（都已确认没问题，别在这儿浪费时间）

| 检查项 | 结论 |
|---|---|
| 图标文件本身 | `miniprogram/images/tab-*.png` 都是标准 **81×81、8bit RGBA、非交错** PNG，内容正常（房子/饭碗/清单/柱状图/书本），单个 0.4~1.8KB，远低于 40KB 上限 |
| 路径写法 | `app.json` 用的是**绝对路径** `/images/tab-home.png`，写法正确 |
| 打包配置 | `packOptions.ignore` 只忽略了 `.tmp`，**没有**排除 images |
| 图片目录权限 | 正常，同目录的 `hero.png` 能正常显示 |

### 真正的原因（2026-10-03 实测确认）

这是**开发者工具的运行时故障，不是代码 bug**：

1. 模拟器的**项目代理初始化超时**（`initWithProxyFunc` 30 秒未完成）；
2. 此后模拟器通过内部接口 `__getprojectoriginfile__` 读取项目**原始文件**的请求**全部返回 403**，原因是 `ua-token-missing`（会话 token 没建立起来）；
3. **原生 tabBar 的图标是运行时从项目源文件实时读取的** → 读不到 → 破图；
4. 而页面里的 `<image src="/images/hero.png">` 是**编译进代码包**的，不走这条通道 → **同一个目录的图片，一个正常一个破图**，正是这个原因。

证据（开发者工具日志，路径见下）：

```
[ERROR] onProxyError /__getprojectoriginfile__ 403
[WARN]  [validateToken2] validate token fail { reason: 'ua-token-missing', hasUaToken: false }
[ERROR] [DGetProject] timeout detail { methodName: 'initWithProxyFunc', duration: 30006,
         projectpath: '/Users/.../family-meals', appid: 'wx7078638255f4c352' }
```

日志目录（macOS）：
```
~/Library/Application Support/微信开发者工具/<一长串hash>/WeappLog/logs/
```
用 `grep -a "getprojectoriginfile\|token-missing" *.log` 就能看到。

**触发时机**：当天 403 从 **13:26:30 开始爆发**，此前 13 小时的日志里一次都没有 —— 正好是「换 AppID 后重新打开项目」的时段。**首次打开新项目、切换 AppID、工具长时间运行**时容易遇到。

### 处方（按顺序试）

1. **完全退出开发者工具**（按 **⌘Q** 真正退出，不是关窗口），再重新启动 → 打开 `family-meals` → 按 **⌘B** 编译。
   这一步会重建模拟器会话，通常直接解决。
2. 还破的话：菜单 **工具 → 清缓存 → 清除全部缓存** → 重新编译。
3. 仍然破：切换一次项目（打开另一个项目再切回来），或重启电脑后再试。
4. 全都无效：改用**自定义 tabBar**（见下），这是**确定性方案**。

### 兜底方案：自定义 tabBar

如果原生 tabBar 的图标加载始终不可靠，可以改用官方支持的**自定义 tabBar**：

- `app.json` 的 `tabBar` 加 `"custom": true`（`list` 保留，用于页面路径与低版本兜底）；
- 新建组件 `miniprogram/custom-tab-bar/index.{js,json,wxml,wxss}`，自己用 `<view>` + `<image src="/images/tab-home.png">` 画底部栏；
- 每个 tab 页面在 `onShow` 里 `this.getTabBar().setData({ selected: n })` 同步选中态。

**为什么它能绕开**：`<image>` 引用的本地图片会被编译进代码包，不经过上面那条 403 的通道 —— 就像首页那张 `hero.png` 一样必然能显示。

> 代价：要动 4~5 个页面的 `onShow`，并自行处理底部安全区（iPhone 小黑条）。**确认第 1~3 步都无效再做。**

---

## 2. 云开发 / 上传按钮是灰的

项目挂在「小程序测试号」上时，这两个按钮永远是灰的（测试号无真实主体）。
解法：注册正式小程序（个人主体免费）换 AppID。详见 [cloud-storage-guide.md](./cloud-storage-guide.md)。

## 3. 页面白屏 / 数据不显示

一般是某处 `require` 漏了（如 `dishes.js` 漏引 `utils/util.js` 会导致 `util is not defined`，页面分组为空）。
先跑自检：
```bash
node tools/selfcheck.js
```
它会查语法、事件绑定、漏 require、危险 `overflow`、tabBar 路径等静态隐患。
