#!/usr/bin/env python3
"""生成首页卡通吉祥物 hero.png：一个开心的饭碗（透明背景）。
手写 SVG + Chrome headless → 透明 PNG。改配色改色值，改形状改 path，重跑即可。
"""
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'miniprogram', 'images')
TMP = os.path.join(ROOT, '.tmp')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

W = H = 420
SCALE = 2  # 输出 840x840

# 心形 / 四角星：原点在中心的规范化 path
HEART = 'M0 4 C-5 -0.5 -7 -4.5 -3.6 -7 C-1.6 -8.2 0 -6.6 0 -5.2 ' \
        'C0 -6.6 1.6 -8.2 3.6 -7 C7 -4.5 5 -0.5 0 4 Z'
STAR = 'M0 -7 C0.9 -2.2 2.2 -0.9 7 0 C2.2 0.9 0.9 2.2 0 7 ' \
       'C-0.9 2.2 -2.2 0.9 -7 0 C-2.2 -0.9 -0.9 -2.2 0 -7 Z'

LINE = '#E9A87E'   # 碗的描边（暖橙）
DARK = '#5A4632'   # 五官

SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <!-- 左小手 / 右小手 -->
  <circle cx="92" cy="258" r="21" fill="#FFE2C6" stroke="{LINE}" stroke-width="7"/>
  <circle cx="328" cy="258" r="21" fill="#FFE2C6" stroke="{LINE}" stroke-width="7"/>

  <!-- 筷子 -->
  <path d="M296 108 L352 190" stroke="#C8873F" stroke-width="10" stroke-linecap="round"/>
  <path d="M322 96 L378 178" stroke="#C8873F" stroke-width="10" stroke-linecap="round"/>

  <!-- 碗身 -->
  <path d="M118 216 L302 216 C292 316 248 354 210 354 C172 354 128 316 118 216 Z"
        fill="#FFFFFF" stroke="{LINE}" stroke-width="9" stroke-linejoin="round"/>
  <!-- 碗口沿 -->
  <path d="M118 216 C160 232 260 232 302 216" fill="none" stroke="{LINE}" stroke-width="9" stroke-linecap="round"/>
  <!-- 碗脚 -->
  <path d="M180 354 L240 354" stroke="{LINE}" stroke-width="11" stroke-linecap="round"/>

  <!-- 眼睛 -->
  <circle cx="176" cy="262" r="13" fill="{DARK}"/>
  <circle cx="244" cy="262" r="13" fill="{DARK}"/>
  <circle cx="181" cy="256" r="4.5" fill="#FFFFFF"/>
  <circle cx="249" cy="256" r="4.5" fill="#FFFFFF"/>
  <!-- 腮红 -->
  <circle cx="149" cy="286" r="15" fill="#FFB4A0" opacity="0.78"/>
  <circle cx="271" cy="286" r="15" fill="#FFB4A0" opacity="0.78"/>
  <!-- 微笑 -->
  <path d="M188 286 C199 303 221 303 232 286" fill="none" stroke="{DARK}" stroke-width="7" stroke-linecap="round"/>

  <!-- 热气爱心 -->
  <path d="{HEART}" transform="translate(210 118) scale(2.5)" fill="#F0865A" opacity="0.9"/>
  <path d="{HEART}" transform="translate(158 150) scale(1.5)" fill="#F0865A" opacity="0.6"/>
  <path d="{HEART}" transform="translate(260 152) scale(1.4)" fill="#F0865A" opacity="0.6"/>

  <!-- 星星 -->
  <path d="{STAR}" transform="translate(122 152) scale(1.9)" fill="#FFCE3A"/>
  <path d="{STAR}" transform="translate(304 140) scale(1.4)" fill="#FFCE3A"/>
  <path d="{STAR}" transform="translate(96 306) scale(1.2)" fill="#FFCE3A" opacity="0.9"/>
  <path d="{STAR}" transform="translate(330 296) scale(1.5)" fill="#FFCE3A" opacity="0.9"/>
</svg>
'''


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    src = os.path.join(TMP, 'hero.svg')
    with open(src, 'w', encoding='utf-8') as f:
        f.write(SVG)

    png = os.path.join(OUT, 'hero.png')
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
    print('OK hero.png  %.0f KB' % (os.path.getsize(png) / 1024))


if __name__ == '__main__':
    main()
