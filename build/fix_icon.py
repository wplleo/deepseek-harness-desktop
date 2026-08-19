from PIL import Image
import os

SRC = r"E:\DeepSeek\rebuild\build\icon.png"
BACKUP = r"E:\DeepSeek\rebuild\build\icon.src.png"
OUT_PNG = r"E:\DeepSeek\rebuild\build\icon.png"
OUT_ICO = r"E:\DeepSeek\rebuild\build\icon.ico"

WHITE_TH = 245      # 背景白阈值
ALPHA_TH = 10       # 已透明像素忽略
FILL_RATIO = 0.78   # 鲸鱼占画布比例（去背后放大）


def is_background_white(r, g, b, a):
    return a > ALPHA_TH and r > WHITE_TH and g > WHITE_TH and b > WHITE_TH


def remove_background_white(im: Image.Image):
    """把最大的连续白色区域当成背景去掉，保留鲸鱼内部的白色块。"""
    w, h = im.size
    px = list(im.get_flattened_data())
    visited = [False] * (w * h)

    def neighbors(idx):
        x = idx % w
        y = idx // w
        if x > 0:
            yield idx - 1
        if x < w - 1:
            yield idx + 1
        if y > 0:
            yield idx - w
        if y < h - 1:
            yield idx + w

    components = []
    for start in range(w * h):
        if visited[start]:
            continue
        r, g, b, a = px[start]
        if not is_background_white(r, g, b, a):
            visited[start] = True
            continue
        # BFS 这个白色连通块
        comp = []
        stack = [start]
        visited[start] = True
        while stack:
            idx = stack.pop()
            comp.append(idx)
            for nb in neighbors(idx):
                if not visited[nb]:
                    nr, ng, nb_, na = px[nb]
                    if is_background_white(nr, ng, nb_, na):
                        visited[nb] = True
                        stack.append(nb)
                    else:
                        visited[nb] = True
        components.append(comp)

    if not components:
        return im

    # 最大的白色块是背景
    bg = max(components, key=len)
    for idx in bg:
        px[idx] = (255, 255, 255, 0)

    im.putdata(px)
    return im


def main():
    if not os.path.exists(BACKUP):
        Image.open(SRC).save(BACKUP)

    im = Image.open(SRC).convert("RGBA")
    im = remove_background_white(im)

    # 裁切到鲸鱼内容
    bbox = im.getbbox()
    if bbox:
        whale = im.crop(bbox)
    else:
        whale = im

    # 生成 256x256 主图：透明底，鲸鱼放大居中
    canvas_size = 256
    whale_w, whale_h = whale.size
    target = int(canvas_size * FILL_RATIO)
    scale = min(target / whale_w, target / whale_h)
    new_w, new_h = int(whale_w * scale), int(whale_h * scale)
    scaled = whale.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 0))
    canvas.paste(scaled, ((canvas_size - new_w) // 2, (canvas_size - new_h) // 2), scaled)

    # 覆盖 icon.png
    canvas.save(OUT_PNG)

    # 生成 ICO（多尺寸 PNG 帧，透明底）
    sizes = [16, 24, 32, 48, 64, 128, 256]
    frames = []
    for s in sizes:
        frame = canvas.resize((s, s), Image.LANCZOS)
        frames.append(frame)

    # Pillow 对 ICO 的 sizes 参数支持有限，手动拼 PNG-in-ICO
    import struct
    frame_data = []
    for frame in frames:
        from io import BytesIO
        buf = BytesIO()
        frame.save(buf, format="PNG")
        data = buf.getvalue()
        frame_data.append(data)

    num = len(sizes)
    header = struct.pack("<HHH", 0, 1, num)
    entries = b""
    offset = 6 + 16 * num
    for i, s in enumerate(sizes):
        data = frame_data[i]
        # ICO 目录里宽高是字节，0 表示 256
        wb = s if s < 256 else 0
        entries += struct.pack("<BBBBHHII", wb, wb, 0, 0, 1, 32, len(data), offset)
        offset += len(data)

    with open(OUT_ICO, "wb") as f:
        f.write(header)
        f.write(entries)
        for data in frame_data:
            f.write(data)

    print(f"Saved {OUT_PNG} ({canvas_size}x{canvas_size}), {OUT_ICO} ({num} frames)")


if __name__ == "__main__":
    main()
