import math
from PIL import Image, ImageDraw

W = H = 1024
img = Image.new('RGB', (W, H))          # RGB (no alpha) — App Store requires no transparency
draw = ImageDraw.Draw(img)

# vertical navy gradient (matches the app theme)
top, bot = (29, 62, 99), (9, 15, 23)
for y in range(H):
    t = y / (H - 1)
    draw.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bot[i]-top[i]) * t) for i in range(3)))

cx, cy = 430, 522
gold = (255, 179, 0)
# "call" sound waves radiating to the right of the ball
for R in (360, 432, 504):
    draw.arc([cx-R, cy-R, cx+R, cy+R], -50, 50, fill=gold, width=24)

# baseball
r = 300
draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(253, 253, 253))

red = (198, 40, 40)
def quad(p0, p1, p2, n=90):
    out = []
    for i in range(n+1):
        t = i/n
        out.append(((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0],
                    (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1]))
    return out

for seam in (quad((342,272),(228,522),(342,772)), quad((518,272),(632,522),(518,772))):
    draw.line(seam, fill=red, width=12, joint='curve')
    for i in range(6, len(seam)-6, 7):           # stitch ticks
        x, y = seam[i]
        x0, y0 = seam[i-3]; x2, y2 = seam[i+3]
        dx, dy = x2-x0, y2-y0
        L = math.hypot(dx, dy) or 1
        ux, uy = -dy/L, dx/L
        draw.line([(x-ux*20, y-uy*20), (x+ux*20, y+uy*20)], fill=red, width=6)

img.save('/tmp/pitchcall_icon.png')
print('icon written', img.size, img.mode)
