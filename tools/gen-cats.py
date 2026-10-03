#!/usr/bin/env python3
"""生成「分类」卡通贴纸图标：彩色圆角底 + 食物剪影，96x96 PNG（48 逻辑点 @2x）。

设计（卡通化）：
· 48x48 画布，圆角方形底 3..45、圆角 14 —— 像一枚小贴纸
· 图形统一缩到中心约 28x28 区域（SCALE=0.62），四周留白 7，任何底图都不会顶边
· 两种状态：
    未选中 cat-*.png    → 该分类的「浅色底 + 饱和色图形」
    选中   cat-*-on.png → 该分类的「饱和色底 + 白色图形」
  这样选中态是实心彩色块，一眼就能看出选的是哪一类，比单色线稿可爱得多
· 每个分类一个糖果色（hue）和它的浅色（tint）

不调图像模型：改形状改下面的 ICONS，改配色改 CATS，重跑即可。
"""
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'miniprogram', 'images')
TMP = os.path.join(ROOT, '.tmp')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

SIZE = 48
SCALE = 2
GLYPH = 0.62  # 图形相对原 48 画布的缩放

# 心形（原点在中心，底尖朝下，约 10 宽 12 高）
HEART = 'M0 4 C-5 -0.5 -7 -4.5 -3.6 -7 C-1.6 -8.2 0 -6.6 0 -5.2 ' \
        'C0 -6.6 1.6 -8.2 3.6 -7 C7 -4.5 5 -0.5 0 4 Z'


def rrect(x, y, w, h, r):
    return (
        f'M{x + r} {y} L{x + w - r} {y} A{r} {r} 0 0 1 {x + w} {y + r} '
        f'L{x + w} {y + h - r} A{r} {r} 0 0 1 {x + w - r} {y + h} '
        f'L{x + r} {y + h} A{r} {r} 0 0 1 {x} {y + h - r} '
        f'L{x} {y + r} A{r} {r} 0 0 1 {x + r} {y} Z'
    )


def heart(x, y, s):
    return f'<path d="{HEART}" transform="translate({x} {y}) scale({s})" fill="#COL#"/>'


def sq(x, y, s, r=4.5):
    """实心圆角小方块，用于「全部」的四宫格"""
    return f'<path d="{rrect(x, y, s, s, r)}" fill="#COL#"/>'


# 每个图标返回若干行 svg：('s', path[, width])=描边；('f', html)=已带 fill 的元素
ICONS = {
    # 全部：四宫格（实心块，小尺寸下比线框清楚）
    'all': [
        ('f', sq(8, 8, 14)),
        ('f', sq(26, 8, 14)),
        ('f', sq(8, 26, 14)),
        ('f', sq(26, 26, 14)),
    ],
    # 早餐：一杯热饮
    'breakfast': [
        ('s', 'M12 19 L12 36 C12 39 14 41 17 41 L29 41 C32 41 34 39 34 36 L34 19 Z'),
        ('s', 'M12 19 L34 19'),
        ('s', 'M34 24 C40 24 40 33 34 33'),
        ('s', 'M21 13 C19 10 24 8 22 5'),
    ],
    # 大荤：一整条鱼。「大鱼大肉」——整条/整只的硬菜就是大荤。
    # 试过鸡腿、排骨、肉排、肉丸串，小尺寸下单色线稿分别会变成放大镜、礼帽、
    # 汉堡、糖葫芦；鱼是唯一一眼能认出来的荤菜剪影，别改。
    'meat': [
        ('s', 'M14 24 C20 15 33 15 39 24 C33 33 20 33 14 24 Z'),
        ('s', 'M14 24 L6 17 L8.5 24 L6 31 Z'),
        ('f', '<circle cx="34" cy="22" r="2.2" fill="#COL#"/>'),
    ],
    # 小荤：一块肉（实心）+ 一片菜叶（描边），左右并排 = 肉配菜。
    # 叶子线宽比默认细（3.5），否则会把叶子填成实心团、和肉块糊成一个圆点。
    'semi': [
        ('f', '<rect x="6" y="17" width="17" height="17" rx="6" fill="#COL#"/>'),
        ('s', 'M40 38 C40 38 32 32 32 25 C32 21 34.5 19 37 19.5 '
              'C39.5 20 41 22.5 41 25.5 C41 32 40 38 40 38 Z', 3.2),
    ],
    # 蔬菜：一片叶子
    'veg': [
        ('s', 'M24 43 C24 43 9 33 9 19 C9 12 15 7 24 7 C33 7 39 12 39 19 '
              'C39 33 24 43 24 43 Z'),
        ('s', 'M24 43 L24 21'),
        ('s', 'M24 28 L32 23'),
        ('s', 'M24 34 L17 30'),
    ],
    # 汤：碗 + 两颗爱心热气
    'soup': [
        ('s', 'M9 27 L39 27'),
        ('s', 'M11 27 C11 38 17 43 24 43 C31 43 37 38 37 27'),
        ('f', heart(16, 19, 0.85)),
        ('f', heart(31, 16, 0.65)),
    ],
    # 小吃：一只包子
    'snack': [
        ('s', 'M9 33 C9 21 15 15 24 15 C33 15 39 21 39 33 Z'),
        ('s', 'M9 33 L39 33'),
        ('s', 'M16 33 L19 25'),
        ('s', 'M24 33 L24 23'),
        ('s', 'M32 33 L29 25'),
    ],
}

# 每个分类一枚贴纸：hue=饱和色（选中底/未选中图形），tint=浅色（未选中底）
CATS = {
    'all':       {'hue': '#FF7A33', 'tint': '#FFE6D6'},
    'breakfast': {'hue': '#FFAE1A', 'tint': '#FFF0CC'},
    'meat':      {'hue': '#F0574A', 'tint': '#FBDCD7'},
    'semi':      {'hue': '#E45C8A', 'tint': '#FBDCE7'},
    'veg':       {'hue': '#4FB85F', 'tint': '#DCF3E0'},
    'soup':      {'hue': '#4FA8E8', 'tint': '#DBEBFA'},
    'snack':     {'hue': '#9E7BE0', 'tint': '#E8E0FA'},
}


def glyph(items, color):
    """图形本体：整体绕中心缩放 GLYPH，避免顶到贴纸边。"""
    body = []
    for item in items:
        kind, p = item[0], item[1]
        if kind == 's':
            w = (item[2] if len(item) > 2 else 5) * GLYPH
            body.append(
                '<path d="%s" fill="none" stroke="%s" stroke-width="%.2f" '
                'stroke-linecap="round" stroke-linejoin="round"/>' % (p, color, w)
            )
        else:
            body.append(p.replace('#COL#', color))
    return (
        '<g transform="translate(%d %d) scale(%s) translate(-%d -%d)">%s</g>'
        % (SIZE // 2, SIZE // 2, GLYPH, SIZE // 2, SIZE // 2, '\n'.join(body))
    )


def svg_for(key, on):
    c = CATS[key]
    bg = c['hue'] if on else c['tint']
    fg = '#FFFFFF' if on else c['hue']
    badge = '<path d="%s" fill="%s"/>' % (rrect(3, 3, 42, 42, 14), bg)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %d %d">\n%s\n%s\n</svg>\n'
        % (SIZE, SIZE, SIZE, SIZE, badge, glyph(ICONS[key], fg))
    )


def render(svg_text, name, out_png):
    src = os.path.join(TMP, name + '.svg')
    with open(src, 'w', encoding='utf-8') as f:
        f.write(svg_text)
    if os.path.exists(out_png):
        os.remove(out_png)
    cmd = [
        CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--force-device-scale-factor=%d' % SCALE,
        '--window-size=%d,%d' % (SIZE, SIZE),
        '--default-background-color=00000000',
        '--screenshot=' + out_png,
        'file://' + src,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    for key in ICONS:
        render(svg_for(key, False), 'cat-' + key,
               os.path.join(OUT, 'cat-%s.png' % key))
        render(svg_for(key, True), 'cat-' + key + '-on',
               os.path.join(OUT, 'cat-%s-on.png' % key))
        print('OK cat-%s' % key)


if __name__ == '__main__':
    main()
