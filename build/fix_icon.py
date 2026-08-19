from PIL import Image, ImageDraw
import struct, io

SRC = r'E:/DeepSeek/rebuild/build/whale_only.png'   # 透明底鲸鱼(黑)
OUT_PNG = r'E:/DeepSeek/rebuild/build/icon.png'
OUT_ICO = r'E:/DeepSeek/rebuild/build/icon.ico'

# 深蓝圆角方块 + 白色鲸鱼(消除白底在深色桌面的黑边观感)
BG = (30, 58, 95, 255)     # 深蓝 #1E3A5F
RADIUS = 0.20
WHALE_RATIO = 0.80         # 鲸鱼占画布宽度比(放大)

def make_frame(size):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # 圆角方块
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size-1, size-1], radius=int(size*RADIUS), fill=255)
    block = Image.new('RGBA', (size, size), BG)
    canvas.paste(block, (0, 0), mask)
    # 鲸鱼:用源图 alpha 作遮罩,填白色
    whale = Image.open(SRC).convert('RGBA')
    ww = int(size * WHALE_RATIO)
    wh = int(ww * whale.size[1] / whale.size[0])
    whale = whale.resize((ww, wh), Image.LANCZOS)
    wmask = whale.split()[3]
    white_whale = Image.new('RGBA', (ww, wh), (255, 255, 255, 255))
    layer = Image.new('RGBA', (ww, wh), (0, 0, 0, 0))
    layer.paste(white_whale, (0, 0), wmask)
    ox, oy = (size-ww)//2, (size-wh)//2
    canvas.alpha_composite(layer, (ox, oy))
    return canvas

sizes = [16, 24, 32, 48, 64, 128, 256]
frames = {s: make_frame(s) for s in sizes}
frames[256].save(OUT_PNG)

# 手写多帧 ICO(PNG 帧,Windows/electron-builder 均认)
bufs = []
for s in sizes:
    b = io.BytesIO(); frames[s].save(b, format='PNG'); bufs.append(b.getvalue())
offset = 6 + 16 * len(sizes)
header = struct.pack('<HHH', 0, 1, len(sizes))
entries = b''; data = b''
for s, raw in zip(sizes, bufs):
    wb = 0 if s == 256 else s
    entries += struct.pack('<BBBBHHII', wb, wb, 0, 0, 1, 32, len(raw), offset + len(data))
    data += raw
with open(OUT_ICO, 'wb') as f:
    f.write(header + entries + data)
print('generated', OUT_ICO, 'frames=', sizes)
