#!/usr/bin/env python3
"""生成 tabBar 图标：手写 SVG + Chrome headless 截图 → 81x81 PNG。

为什么不调图像生成模型：小尺寸图标类素材手写 SVG 更快、零积分，
改配色只需改 stroke 颜色一行。
"""
import os
import subprocess
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'miniprogram', 'images')
TMP = os.path.join(ROOT, '.tmp')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

GREY = '#9C8E7C'
ORANGE = '#FF7A33'
STROKE = 5.6  # 卡通风：线条比原先 5 略粗，小尺寸下更饱满圆润

# 每个图标是若干条 path，线条居中在 81x81 画布上，四周留白约 13px
ICONS = {
    'order': [
        # 碗口 + 碗身
        'M13 43 L68 43',
        'M16 43 C16 60 25 68 40.5 68 C56 68 65 60 65 43',
        # 一双筷子
        'M53 13 L35 40',
        'M62 18 L44 45',
    ],
    'stats': [
        # 四根高低不同的柱子 + 基线
        'M22 60 L22 42',
        'M36 60 L36 26',
        'M50 60 L50 48',
        'M64 60 L64 34',
        'M14 68 L68 68',
    ],
    'book': [
        # 摊开的书
        'M14 21 C24 15 32 17 40 21 C48 17 56 15 66 21 L66 66 C56 61 48 63 40 66 C32 63 24 61 14 66 Z',
        # 书脊
        'M40 21 L40 66',
    ],
    'menu': [
        # 三行列表：代表「已点菜单」列表
        'M20 27 L61 27',
        'M20 42 L61 42',
        'M20 57 L61 57',
    ],
    'home': [
        # 屋顶
        'M16 38 L40.5 18 L65 38',
        # 屋身
        'M22 38 L22 64 L59 64 L59 38',
        # 门
        'M35 64 L35 48 L46 48 L46 64',
    ],
}


def svg_for(paths, color):
    body = '\n'.join(
        '    <path d="%s" fill="none" stroke="%s" stroke-width="%s" '
        'stroke-linecap="round" stroke-linejoin="round"/>' % (p, color, STROKE)
        for p in paths
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81">\n'
        '%s\n</svg>\n' % body
    )


def render(svg_text, name, out_png):
    src = os.path.join(TMP, name + '.svg')
    with open(src, 'w', encoding='utf-8') as f:
        f.write(svg_text)
    if os.path.exists(out_png):
        os.remove(out_png)
    cmd = [
        CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--force-device-scale-factor=1', '--window-size=81,81',
        '--default-background-color=00000000',
        '--screenshot=' + out_png,
        'file://' + src,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    for key, paths in ICONS.items():
        render(svg_for(paths, GREY), key, os.path.join(OUT, 'tab-%s.png' % key))
        render(svg_for(paths, ORANGE), key + '-on', os.path.join(OUT, 'tab-%s-on.png' % key))
        print('OK tab-%s' % key)
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == '__main__':
    main()
