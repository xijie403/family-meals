#!/usr/bin/env python3
"""生成小程序账号头像 miniapp-avatar.png（144x144）。
手写 SVG + Chrome headless → PNG。风格与小程序一致：暖橙渐变底 + 开心饭碗吉祥物。
"""
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
TMP = os.path.join(ROOT, '.tmp')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

W = H = 144
SCALE = 1  # 输出 144x144

LINE = '#E88B4E'   # 碗的描边（暖橙）
DARK = '#5A4632'   # 五官
GRAIN = '#FFD9A8'  # 米饭浅色

SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFB24D"/>
      <stop offset="1" stop-color="#FF6B2C"/>
    </linearGradient>
  </defs>

  <!-- 满铺暖橙底（裁成圆形也好看，方形也好看） -->
  <rect x="0" y="0" width="{W}" height="{H}" fill="url(#g)"/>

  <!-- 筷子 -->
  <path d="M101 80 L123 56" stroke="#C8873F" stroke-width="4" stroke-linecap="round"/>
  <path d="M109 82 L130 58" stroke="#C8873F" stroke-width="4" stroke-linecap="round"/>

  <!-- 米饭小山 -->
  <path d="M52 80 Q72 58 92 80 Z" fill="{GRAIN}"/>
  <path d="M60 78 Q72 66 84 78" fill="#FFFFFF" opacity="0.55"/>

  <!-- 碗身 -->
  <path d="M42 80 C46 112 58 122 72 122 C86 122 98 112 102 80 Z"
        fill="#FFFFFF" stroke="{LINE}" stroke-width="5" stroke-linejoin="round"/>
  <!-- 碗口沿 -->
  <ellipse cx="72" cy="80" rx="30" ry="9" fill="#FFFFFF" stroke="{LINE}" stroke-width="5"/>

  <!-- 眼睛 -->
  <circle cx="60" cy="98" r="4" fill="{DARK}"/>
  <circle cx="84" cy="98" r="4" fill="{DARK}"/>
  <circle cx="61.5" cy="96.5" r="1.4" fill="#FFFFFF"/>
  <circle cx="85.5" cy="96.5" r="1.4" fill="#FFFFFF"/>
  <!-- 腮红 -->
  <circle cx="50" cy="104" r="5" fill="#FFB4A0" opacity="0.75"/>
  <circle cx="94" cy="104" r="5" fill="#FFB4A0" opacity="0.75"/>
  <!-- 微笑 -->
  <path d="M61 104 Q72 113 83 104" fill="none" stroke="{DARK}" stroke-width="3" stroke-linecap="round"/>

  <!-- 热气小点 -->
  <circle cx="66" cy="52" r="2.2" fill="#FFFFFF" opacity="0.85"/>
  <circle cx="78" cy="46" r="1.8" fill="#FFFFFF" opacity="0.7"/>
  <circle cx="72" cy="40" r="1.5" fill="#FFFFFF" opacity="0.6"/>
</svg>
'''


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    src = os.path.join(TMP, 'avatar.svg')
    with open(src, 'w', encoding='utf-8') as f:
        f.write(SVG)

    png = os.path.join(OUT, 'miniapp-avatar.png')
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
    size = os.path.getsize(png)
    print('OK miniapp-avatar.png  %dx%d  %.1f KB' % (W, H, size / 1024))


if __name__ == '__main__':
    main()
