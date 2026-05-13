"""
generate-icons.py — Produce PWA app icons from logo-official.jpg.

The brand identity is dark navy + cyan crest. The plain JPEG logo on a white
square is the school's emblem; we composite it onto a dark radial gradient
that matches the site background so the app icon looks polished on the
phone home-screen.

Outputs (written to client/public/icons/):
  icon-192.png             — PWA "any" purpose
  icon-512.png             — PWA "any" purpose
  icon-maskable-512.png    — PWA "maskable" purpose (extra 20% safe-zone padding)
  apple-touch-icon.png     — 180x180 for iOS home-screen
  favicon-32.png           — small tab favicon

The icon-maskable variant uses a smaller logo (60% of canvas) so OS launchers
that crop into a circle, squircle, or rounded square never clip the crest.
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_LOGO = ROOT / "client" / "public" / "logo-official.jpg"
OUT_DIR = ROOT / "client" / "public" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def radial_backdrop(size: int) -> Image.Image:
    """Build a dark navy → cyan-tinted radial gradient backdrop."""
    img = Image.new("RGB", (size, size), (8, 9, 24))
    px = img.load()
    # Inner brighter cyan-tinted color, outer near-black navy.
    cx, cy = size / 2, size * 0.4  # bias glow slightly upward
    max_dist = size * 0.75
    inner = (20, 32, 64)   # cyan-tinted near-center
    outer = (6, 7, 18)     # near-black at edge
    for y in range(size):
        for x in range(size):
            dx = (x - cx) / max_dist
            dy = (y - cy) / max_dist
            d = min(1.0, (dx * dx + dy * dy) ** 0.5)
            r = int(inner[0] * (1 - d) + outer[0] * d)
            g = int(inner[1] * (1 - d) + outer[1] * d)
            b = int(inner[2] * (1 - d) + outer[2] * d)
            px[x, y] = (r, g, b)
    return img


def cyan_glow(size: int) -> Image.Image:
    """Soft cyan halo that sits behind the logo for brand pop."""
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    cx, cy = size // 2, size // 2
    # Layered radial blobs of progressively smaller alpha.
    for i, (radius_frac, alpha) in enumerate([
        (0.55, 30),
        (0.42, 50),
        (0.32, 80),
    ]):
        r = int(size * radius_frac)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(94, 203, 242, alpha),
        )
    return glow.filter(ImageFilter.GaussianBlur(radius=size * 0.06))


def round_logo_alpha(logo: Image.Image) -> Image.Image:
    """Convert the white-background JPEG logo into a circular RGBA cutout.
    The crest art is already centered in the source; we mask everything
    outside a centered circle so the dark backdrop shows through cleanly."""
    logo = logo.convert("RGBA")
    w, h = logo.size
    side = min(w, h)
    # Crop to centered square first.
    left = (w - side) // 2
    top = (h - side) // 2
    logo = logo.crop((left, top, left + side, top + side))
    # Now apply a circular mask.
    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, side, side), fill=255)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(logo, (0, 0), mask)
    return out


def compose(canvas_size: int, logo_fraction: float) -> Image.Image:
    bg = radial_backdrop(canvas_size).convert("RGBA")
    bg.alpha_composite(cyan_glow(canvas_size))
    logo = round_logo_alpha(Image.open(SRC_LOGO))
    target = int(canvas_size * logo_fraction)
    logo = logo.resize((target, target), Image.LANCZOS)
    pos = ((canvas_size - target) // 2, (canvas_size - target) // 2)
    bg.alpha_composite(logo, pos)
    return bg.convert("RGB")


def save(img: Image.Image, name: str) -> None:
    path = OUT_DIR / name
    img.save(path, "PNG", optimize=True)
    print(f"  wrote {path.relative_to(ROOT)}  ({path.stat().st_size // 1024} KB)")


def main() -> None:
    print(f"Source: {SRC_LOGO.relative_to(ROOT)}")
    # Logo at 0.72 of canvas for normal "any" icons — leaves a comfortable
    # halo but the crest still reads clearly at 192px on a phone home-screen.
    icon_any = compose(1024, 0.72)
    save(icon_any.resize((512, 512), Image.LANCZOS), "icon-512.png")
    save(icon_any.resize((192, 192), Image.LANCZOS), "icon-192.png")
    save(icon_any.resize((180, 180), Image.LANCZOS), "apple-touch-icon.png")
    save(icon_any.resize((32, 32), Image.LANCZOS), "favicon-32.png")

    # Maskable needs 20% safe zone — Android/Chromium crop into circles or
    # squircles, so we shrink the logo to 0.58 of the canvas.
    icon_mask = compose(1024, 0.58)
    save(icon_mask.resize((512, 512), Image.LANCZOS), "icon-maskable-512.png")

    print("Done.")


if __name__ == "__main__":
    main()
