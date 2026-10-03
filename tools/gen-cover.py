#!/usr/bin/env python3
"""生成首页封面背景图：手写 SVG + Chrome headless → JPEG。

设计约束：
· 封面左侧要放文字（家庭名 / 日期 / 胶囊），所以插画主体压在右下角，
  左半边只留零星小装饰，不与文字抢位置
· 可爱感来自三点：圆润的碗 + 小表情（眼睛/腮红/微笑）+ 爱心形状的热气
· 不调图像模型：改配色改下面几个色值，改形状改 path，重跑一次即可
· 输出必须是 JPEG（同内容 PNG 约 372KB，JPEG 仅 42KB），主包体积极敏感
"""
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'miniprogram', 'images')
TMP = os.path.join(ROOT, '.tmp')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

W, H = 750, 460
SCALE = 2  # 输出 1500x920，视网膜屏不糊

# 心形 / 四角星：原点在中心的规范化 path，靠 translate + scale 复用
HEART = 'M0 4 C-5 -0.5 -7 -4.5 -3.6 -7 C-1.6 -8.2 0 -6.6 0 -5.2 ' \
        'C0 -6.6 1.6 -8.2 3.6 -7 C7 -4.5 5 -0.5 0 4 Z'
STAR = 'M0 -7 C0.9 -2.2 2.2 -0.9 7 0 C2.2 0.9 0.9 2.2 0 7 ' \
       'C-0.9 2.2 -2.2 0.9 -7 0 C-2.2 -0.9 -0.9 -2.2 0 -7 Z'


def shape(path, x, y, s, color, opacity):
    return ('<path d="%s" transform="translate(%d %d) scale(%s)" fill="%s" opacity="%s"/>'
            % (path, x, y, s, color, opacity))


decor = []
# 爱心热气：从碗口往上飘，三颗由大到小（实际视线是先看到最大的那颗）
decor.append(shape(HEART, 573, 256, 2.0, '#D85A30', 0.55))
decor.append(shape(HEART, 514, 302, 1.5, '#D85A30', 0.48))
decor.append(shape(HEART, 634, 300, 1.4, '#D85A30', 0.42))
# 四角星闪
decor.append(shape(STAR, 436, 212, 1.5, '#D85A30', 0.32))
decor.append(shape(STAR, 706, 240, 1.7, '#D85A30', 0.28))
decor.append(shape(STAR, 392, 146, 1.0, '#D85A30', 0.26))
# 左下角零星小心，填住文字下方的空白
decor.append(shape(HEART, 148, 424, 1.0, '#D85A30', 0.30))
decor.append(shape(HEART, 196, 440, 0.75, '#D85A30', 0.22))
DECOR = '\n  '.join(decor)

SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="#FFF9F1"/>
      <stop offset="48%" stop-color="#FDE8D4"/>
      <stop offset="100%" stop-color="#F8CFAA"/>
    </linearGradient>
    <radialGradient id="sun" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- 底色：整体上调暖度 -->
  <rect width="{W}" height="{H}" fill="url(#bg)"/>
  <!-- 右上角暖光 -->
  <circle cx="656" cy="76" r="150" fill="url(#sun)"/>

  <!-- 散落的柔和光斑 -->
  <circle cx="86" cy="372" r="66" fill="#C97A3D" opacity="0.06"/>
  <circle cx="204" cy="58" r="34" fill="#C97A3D" opacity="0.05"/>

  <!-- 装饰：爱心热气 + 星星 -->
  {DECOR}

  <!-- 碗下方的垫子，让碗有「坐在桌上」的感觉 -->
  <ellipse cx="573" cy="432" rx="162" ry="24" fill="#FFFFFF" opacity="0.45"/>

  <!-- 碗 -->
  <path d="M466 348 L680 348 C670 404 634 428 573 428 C512 428 476 404 466 348 Z"
        fill="#FFFFFF" opacity="0.94"/>
  <path d="M466 348 C520 364 626 364 680 348"
        fill="none" stroke="#E7B394" stroke-width="6" stroke-linecap="round"/>
  <path d="M548 428 L602 428" stroke="#E7B394" stroke-width="7" stroke-linecap="round"/>

  <!-- 碗上的小表情 -->
  <ellipse cx="549" cy="381" rx="6" ry="7.5" fill="#C86B45" opacity="0.85"/>
  <ellipse cx="601" cy="381" rx="6" ry="7.5" fill="#C86B45" opacity="0.85"/>
  <circle cx="524" cy="398" r="9" fill="#E8834A" opacity="0.22"/>
  <circle cx="626" cy="398" r="9" fill="#E8834A" opacity="0.22"/>
  <path d="M553 396 C563 407 589 407 599 396"
        fill="none" stroke="#C86B45" stroke-width="5.5" stroke-linecap="round" opacity="0.85"/>

  <!-- 底部柔和过渡，和下方白色卡片衔接 -->
  <path d="M0 410 C 140 372 262 442 402 423 C 542 404 652 450 750 418 L750 460 L0 460 Z"
        fill="#FFFFFF" opacity="0.55"/>
</svg>
'''


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    src = os.path.join(TMP, 'cover.svg')
    with open(src, 'w', encoding='utf-8') as f:
        f.write(SVG)
    png = os.path.join(TMP, 'cover.png')
    if os.path.exists(png):
        os.remove(png)
    cmd = [
        CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--force-device-scale-factor=%d' % SCALE,
        '--window-size=%d,%d' % (W, H),
        '--default-background-color=00000000',
        '--screenshot=' + png,
        'file://' + src,
    ]
    subprocess.run(cmd, check=True, capture_output=True)

    # 纯渐变图用 JPEG 比 PNG 小一个数量级（372KB → 42KB），主包体积极敏感
    jpg = os.path.join(OUT, 'cover.jpg')
    for old in (jpg, os.path.join(OUT, 'cover.png')):
        if os.path.exists(old):
            os.remove(old)
    subprocess.run(
        ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', png, '--out', jpg],
        check=True, capture_output=True,
    )
    os.remove(png)
    print('OK cover.jpg  %.0f KB' % (os.path.getsize(jpg) / 1024))


if __name__ == '__main__':
    main()
