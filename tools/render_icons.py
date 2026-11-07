import math
import os
import struct
import zlib

SIZE = 144
ICONS = os.path.join(os.path.dirname(__file__), '..', 'com.lyrion.lms.sdPlugin', 'icons')


def new_canvas():
    return [[(0, 0, 0, 0)] * SIZE for _ in range(SIZE)]


def set_px(img, x, y, c):
    if 0 <= x < SIZE and 0 <= y < SIZE:
        img[y][x] = c


def fill_rounded_rect(img, x0, y0, x1, y1, r, c):
    for y in range(y0, y1):
        for x in range(x0, x1):
            cx = min(max(x, x0 + r), x1 - 1 - r)
            cy = min(max(y, y0 + r), y1 - 1 - r)
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                set_px(img, x, y, c)


def fill_polygon(img, pts, c):
    def inside(x, y):
        n = len(pts)
        j = n - 1
        odd = False
        for i in range(n):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                odd = not odd
            j = i
        return odd
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(int(min(xs)), int(max(xs)) + 1):
            if inside(x + 0.5, y + 0.5):
                set_px(img, x, y, c)


def fill_circle(img, cx, cy, r, c):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                set_px(img, x, y, c)


def fill_ring(img, cx, cy, r, w, c):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if (r - w) ** 2 <= d2 <= r * r:
                set_px(img, x, y, c)


def fill_arc(img, cx, cy, r, w, a0, a1, c):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            d = math.hypot(x - cx, y - cy)
            if not (r - w <= d <= r):
                continue
            a = math.degrees(math.atan2(y - cy, x - cx))
            if a0 <= a <= a1:
                set_px(img, x, y, c)


def fill_rect(img, x0, y0, x1, y1, c):
    for y in range(y0, y1):
        for x in range(x0, x1):
            set_px(img, x, y, c)


WHITE = (255, 255, 255, 255)
BLUE = (31, 111, 235, 255)
RED = (218, 54, 51, 255)
GREEN = (45, 164, 78, 255)
PURPLE = (137, 87, 229, 255)
AMBER = (191, 135, 0, 255)
CYAN = (14, 116, 144, 255)


def bg(c):
    img = new_canvas()
    fill_rounded_rect(img, 0, 0, SIZE, SIZE, 24, c)
    return img


def icon_playpause():
    img = bg(BLUE)
    fill_polygon(img, [(56, 44), (56, 100), (100, 72)], WHITE)
    fill_rect(img, 104, 48, 112, 96, WHITE)
    fill_rect(img, 120, 48, 128, 96, WHITE)
    return img


def icon_stop():
    img = bg(RED)
    fill_rounded_rect(img, 48, 48, 96, 96, 6, WHITE)
    return img


def icon_next():
    img = bg(GREEN)
    fill_polygon(img, [(44, 44), (44, 100), (88, 72)], WHITE)
    fill_rect(img, 96, 44, 104, 100, WHITE)
    return img


def icon_previous():
    img = bg(GREEN)
    fill_rect(img, 40, 44, 48, 100, WHITE)
    fill_polygon(img, [(100, 44), (100, 100), (56, 72)], WHITE)
    return img


def speaker(img):
    fill_polygon(img, [(36, 60), (52, 60), (76, 40), (76, 104), (52, 84), (36, 84)], WHITE)


def icon_volumeup():
    img = bg(PURPLE)
    speaker(img)
    fill_arc(img, 88, 72, 18, 8, -60, 60, WHITE)
    fill_arc(img, 100, 72, 30, 8, -60, 60, WHITE)
    return img


def icon_volumedown():
    img = bg(PURPLE)
    speaker(img)
    fill_arc(img, 88, 72, 18, 8, -60, 60, WHITE)
    return img


def icon_volume():
    img = bg(PURPLE)
    speaker(img)
    fill_arc(img, 88, 72, 18, 8, -60, 60, WHITE)
    fill_rect(img, 60, 118, 84, 126, WHITE)
    return img


def icon_nowplaying():
    img = bg(BLUE)
    fill_rect(img, 56, 52, 64, 100, WHITE)
    fill_rect(img, 100, 46, 108, 94, WHITE)
    fill_polygon(img, [(56, 52), (108, 46), (108, 62), (56, 68)], WHITE)
    fill_circle(img, 50, 100, 12, WHITE)
    fill_circle(img, 94, 94, 12, WHITE)
    return img


def icon_player():
    img = bg(BLUE)
    fill_rounded_rect(img, 48, 36, 96, 112, 8, (0, 0, 0, 0))
    for y in range(36, 112):
        for x in range(48, 96):
            cx = min(max(x, 56), 88)
            cy = min(max(y, 44), 104)
            if (x - cx) ** 2 + (y - cy) ** 2 <= 64:
                if 48 <= x < 96 and 36 <= y < 112:
                    set_px(img, x, y, WHITE)
    fill_circle(img, 72, 88, 12, BLUE)
    fill_circle(img, 72, 54, 6, BLUE)
    return img


def icon_favorites():
    img = bg(AMBER)
    pts = []
    for i in range(10):
        a = -90 + i * 36
        r = 34 if i % 2 == 0 else 14
        pts.append((72 + r * math.cos(math.radians(a)), 74 + r * math.sin(math.radians(a))))
    fill_polygon(img, [(int(x), int(y)) for x, y in pts], WHITE)
    return img


def icon_cyclemedia():
    img = bg(CYAN)
    fill_arc(img, 72, 72, 28, 8, 150, 330, WHITE)
    fill_polygon(img, [(100, 32), (100, 56), (80, 48)], WHITE)
    fill_arc(img, 72, 72, 28, 8, -30, 150, WHITE)
    fill_polygon(img, [(44, 112), (44, 88), (64, 96)], WHITE)
    return img


def icon_media():
    img = bg(AMBER)
    fill_ring(img, 72, 72, 32, 8, WHITE)
    fill_circle(img, 72, 72, 8, WHITE)
    return img


def icon_plugin():
    img = bg(BLUE)
    fill_polygon(img, [(48, 40), (48, 104), (104, 72)], WHITE)
    return img


def write_png(img, path):
    raw = b''.join(b'\x00' + b''.join(struct.pack('4B', *px) for px in row) for row in img)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


ICONS_MAP = {
    'playpause': icon_playpause,
    'stop': icon_stop,
    'next': icon_next,
    'previous': icon_previous,
    'volumeup': icon_volumeup,
    'volumedown': icon_volumedown,
    'volume': icon_volume,
    'nowplaying': icon_nowplaying,
    'player': icon_player,
    'favorites': icon_favorites,
    'cyclemedia': icon_cyclemedia,
    'media': icon_media,
    'plugin': icon_plugin,
    'category': icon_plugin,
}

for name, fn in ICONS_MAP.items():
    write_png(fn(), os.path.join(ICONS, name + '.png'))
    print('rendered', name + '.png')
