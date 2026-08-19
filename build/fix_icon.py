from PIL import Image, ImageDraw
import struct, io

SRC = r'E:/DeepSeek/rebuild/build/whale_only.png'   # 透明鲸鱼素材
OUT_PNG = r'E:/DeepSeek/rebuild/build/icon.png'
OUT_ICO = r'E:/DeepSeek/rebuild/build/icon.ico'

whale = Image.open(SRC).convert('RGBA')
print('whale素材', whale.size)

def make(size, radius_ratio=0.20, whale_ratio=0.72, bg=(255, 255, 255, 255)):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    r = max(1, int(size * radius_ratio))
    # 白色圆角矩形背景（四个角圆弧，角外透明）
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg)
    # 放大黑鲸鱼居中
    th = int(size * whale_ratio)
    tw = int(whale.width * th / whale.height)
    scaled = whale.resize((tw, th), Image.LANCZOS)
    ox = (size - tw) // 2
    oy = (size - th) // 2
    canvas.alpha_composite(scaled, (ox, oy))
    return canvas

sizes = [16, 24, 32, 48, 64, 128, 256]
frames = {s: make(s) for s in sizes}

# 保存透明背景 PNG（256）
frames[256].save(OUT_PNG)
print('saved', OUT_PNG)

# 手写多帧 ICO（PNG 帧，Windows 全认）
bufs = []
for s in sizes:
    b = io.BytesIO()
    frames[s].save(b, format='PNG')
    bufs.append(b.getvalue())

offset = 6 + 16 * len(sizes)
header = struct.pack('<HHH', 0, 1, len(sizes))
entries = b''
data_blob = b''
for s, raw in zip(sizes, bufs):
    wb = 0 if s == 256 else s
    entries += struct.pack('<BBBBHHII', wb, wb, 0, 0, 1, 32, len(raw), offset + len(data_blob))
    data_blob += raw
with open(OUT_ICO, 'wb') as f:
    f.write(header + entries + data_blob)

with open(OUT_ICO, 'rb') as f:
    raw = f.read()
count = struct.unpack('<HHH', raw[:6])[2]
print('saved', OUT_ICO, '目录项(帧)数=', count)
