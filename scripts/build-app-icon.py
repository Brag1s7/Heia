#!/usr/bin/env python3
"""
Genererer app-ikon + launch screen-assets fra merkevarekilden.

    python3 scripts/build-app-icon.py            # bygger valgt variant (A)
    python3 scripts/build-app-icon.py --variant B
    python3 scripts/build-app-icon.py --android  # tar med mipmap-ene

Hvorfor et script og ikke bare PNG-er i repoet: ikonet er DERIVERT av den låste
designretningen (A v2 «Stadium Pop Hybrid»). Endrer `theme/tokens.ts` seg, skal
ikonet kunne følge etter uten at noen åpner et bilderedigeringsprogram.

Kilden er `assets/brand/heia-figur.png` — jubelfiguren trukket ut av
`Heia logoer/Logo_1.pdf` på farge (figuren er mint #02FFAB, ordmerket mørkt),
rasterisert i 3000 px med `sips`. Ordmerket er bevisst IKKE med i figurvariantene:
«Heia» er uleselig i 60 pt, som er størrelsen ikonet faktisk leses i.

⚠️ App Store Connect avviser ikoner med alfakanal — derfor konverteres alt til
RGB til slutt. Det gamle ikonet hadde alfa og ville stoppet en innsending.
"""
import argparse
import json
import pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
MARK = ROOT / "assets/brand/heia-figur.png"
APPICON = ROOT / "ios/Heia2/Images.xcassets/AppIcon.appiconset"
XCASSETS = ROOT / "ios/Heia2/Images.xcassets"
ANDROID_RES = ROOT / "android/app/src/main/res"

# Supersampling — hårstrekene i banesirkelen aliaserer stygt uten.
SS = 4

# --- Låste tokens, speilet fra src/theme/tokens.ts + StadiumSurface.tsx -------
MINT = (2, 255, 171)          # colors.heia
HEIA_DEEP = (8, 57, 46)       # colors.heiaDeep — tekst/merke på mintfylte flater
STADIUM_BASE = "#0B1912"      # StadiumSurface: linear start
STADIUM_END = "#143126"       # StadiumSurface: linear slutt (stop .78)
FLOOD_AMBER = "#FFC53D"       # colors.gold
FLOOD_MINT = "#02FFAB"

# iOS-ikonstørrelser. Nøkkel = filnavn, verdi = px.
IOS_SIZES = {40: "Icon-40", 58: "Icon-58", 60: "Icon-60", 80: "Icon-80",
             87: "Icon-87", 120: "Icon-120", 180: "Icon-180", 1024: "Icon-1024"}

ANDROID_SIZES = {"mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96,
                 "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192}

# Launch screen: merket tegnes i punkt, så @1x-størrelsen ER punktstørrelsen.
MARK_PT_WIDTH = 132
LAUNCH_BG = (1170, 2532)


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


def _stadium(w, h, flood_cy=(-0.20, -0.10), flood_ry=(1.00, 0.90)):
    """Stadionflaten, portert 1:1 fra StadiumSurface.tsx.

    base:  linear (62%,0) → (38%,100%), #0B1912 → #143126, stop på .78
    amber: radial cx 18%, ry/cy strekkes for høye flater så flomlyset blir
           liggende i toppen i stedet for å dekke halve skjermen
    mint:  radial cx 85%
    """
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    u, v = xx / (w - 1), yy / (h - 1)

    p0, p1 = np.array([0.62, 0.0]), np.array([0.38, 1.0])
    d = p1 - p0
    t = np.clip(((u - p0[0]) * d[0] + (v - p0[1]) * d[1]) / (d @ d), 0, 1)
    k = np.clip(t / 0.78, 0, 1)[..., None]
    img = np.array(hx(STADIUM_BASE)) * (1 - k) + np.array(hx(STADIUM_END)) * k

    def over(base, cx, cy, rx, ry, color, alpha, fade):
        r = np.sqrt(((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2)
        a = (np.clip(1 - r / fade, 0, 1) * alpha)[..., None]
        return base * (1 - a) + np.array(hx(color)) * a

    img = over(img, 0.18, flood_cy[0], 1.30, flood_ry[0], FLOOD_AMBER, 0.13, 0.52)
    img = over(img, 0.85, flood_cy[1], 1.20, flood_ry[1], FLOOD_MINT, 0.15, 0.55)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")


def _arcs(im):
    """Banesirkelen nede til høyre — samme proporsjoner som i appen (mål/343 pt).

    ⚠️ Ringen tegnes SOLID på et eget lag og komposittes én gang med riktig
    alfa. Tegner man den rett på flaten med `outline=MINT + (33,)`, blander
    PIL inn hver av de ~17 pikslene i strekbredden hver for seg — 0.13 lagt
    oppå seg selv 17 ganger blir ~0.90, og den «subtile» sirkelen lyser som
    en neonring.
    """
    w = im.width
    stroke = max(1, int(round(1.5 / 343 * w)))
    for diam, right, bottom, a in ((200, 70, 90, 0.13), (136, 38, 58, 0.09)):
        D = diam / 343 * w
        cx = w + right / 343 * w - D / 2
        cy = im.height + bottom / 343 * w - D / 2
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse(
            [cx - D / 2, cy - D / 2, cx + D / 2, cy + D / 2],
            outline=MINT + (255,), width=stroke)
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * a)))
        im.alpha_composite(layer)
    return im


def _centroid(mark):
    """Alfa-tyngdepunkt. Rammen lyver: armene sveiper opp-venstre mens beinet
    går ned-midt, så bbox-sentrering henger synlig skjevt."""
    a = np.array(mark.getchannel("A")).astype(np.float64)
    yy, xx = np.mgrid[0:mark.height, 0:mark.width]
    return (xx * a).sum() / a.sum() / mark.width, (yy * a).sum() / a.sum() / mark.height


def _tint(mark, color):
    out = Image.new("RGBA", mark.size, color + (0,))
    out.putalpha(mark.getchannel("A"))
    return out


def _place(canvas, mark, height_frac):
    n = canvas.width
    h = int(n * height_frac)
    w = int(mark.width * h / mark.height)
    m = mark.resize((w, h), Image.LANCZOS)
    cx, cy = _centroid(m)
    canvas.alpha_composite(m, (int(n / 2 - cx * w), int(n / 2 - cy * h)))
    return canvas


def _glow(canvas, mark, height_frac, passes=3, spread=0.05):
    """Den rasjonerte mint-glødet (shadows.glow i appen). Ett blur-lag drukner
    mot stadionflaten — derfor legges samme lag flere ganger."""
    n = canvas.width
    h = int(n * height_frac)
    w = int(mark.width * h / mark.height)
    m = mark.resize((w, h), Image.LANCZOS)
    cx, cy = _centroid(m)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.alpha_composite(_tint(m, MINT), (int(n / 2 - cx * w), int(n / 2 - cy * h)))
    layer = layer.filter(ImageFilter.GaussianBlur(n * spread))
    for _ in range(passes):
        canvas.alpha_composite(layer)
    return canvas


def build_master(variant, size=1024):
    """1024-masteren. Alt annet skaleres ned fra denne."""
    n = size * SS
    mark = Image.open(MARK).convert("RGBA")

    if variant == "A":       # figur på stadionflate + banesirkel
        c = _arcs(_stadium(n, n))
        _place(c, mark, 0.64)
    elif variant == "B":     # figur på mint (invertert)
        c = Image.new("RGBA", (n, n), MINT + (255,))
        _place(c, _tint(mark, HEIA_DEEP), 0.64)
    elif variant == "C":     # figur på ren stadionflate med glød
        c = _stadium(n, n)
        _glow(c, mark, 0.64)
        _place(c, mark, 0.64)
    elif variant == "D":     # dagens ordmerke på stadionflaten
        c = _arcs(_stadium(n, n))
        lock = Image.open(ROOT / "src/assets/images/logo-icon.png").convert("RGBA")
        lock = lock.crop(lock.getchannel("A").getbbox())
        w = int(n * 0.80)
        h = int(lock.height * w / lock.width)
        c.alpha_composite(lock.resize((w, h), Image.LANCZOS), ((n - w) // 2, (n - h) // 2))
    else:
        raise SystemExit(f"Ukjent variant {variant!r} — velg A, B, C eller D.")

    # RGB, ikke RGBA: App Store Connect avviser alfakanal i ikoner.
    return c.convert("RGB").resize((size, size), Image.LANCZOS)


def write_app_icon(master):
    APPICON.mkdir(parents=True, exist_ok=True)
    for px, name in IOS_SIZES.items():
        master.resize((px, px), Image.LANCZOS).save(APPICON / f"{name}.png")

    # Contents.json beholdes på det eksplisitte størrelsesformatet prosjektet
    # allerede bruker — det bygger uendret, og sparer oss en pbxproj-runde.
    entries = [(20, 2, 40), (20, 3, 60), (29, 2, 58), (29, 3, 87),
               (40, 2, 80), (40, 3, 120), (60, 2, 120), (60, 3, 180)]
    images = [{"filename": f"{IOS_SIZES[px]}.png", "idiom": "iphone",
               "scale": f"{s}x", "size": f"{pt}x{pt}"} for pt, s, px in entries]
    images.append({"filename": "Icon-1024.png", "idiom": "ios-marketing",
                   "scale": "1x", "size": "1024x1024"})
    (APPICON / "Contents.json").write_text(
        json.dumps({"images": images, "info": {"author": "xcode", "version": 1}}, indent=2) + "\n")
    print(f"  ikon      → {len(IOS_SIZES)} PNG-er + Contents.json (RGB, ingen alfa)")


def write_launch():
    """Bakgrunn + merke som egne imagesets. Storyboards kan ikke tegne gradient,
    så flaten må inn som et bilde og strekkes med scaleAspectFill."""
    bg_dir = XCASSETS / "LaunchBackground.imageset"
    bg_dir.mkdir(parents=True, exist_ok=True)
    # Høy flate: flomlysene trekkes opp i toppen, ellers dekker de halve skjermen.
    bg = _arcs(_stadium(*LAUNCH_BG, flood_cy=(-0.10, -0.05), flood_ry=(0.55, 0.50)))
    bg.convert("RGB").save(bg_dir / "launch-bg.png")
    (bg_dir / "Contents.json").write_text(json.dumps({
        "images": [{"filename": "launch-bg.png", "idiom": "universal"}],
        "info": {"author": "xcode", "version": 1},
        # Glatt gradient tåler strekk til alle skjermformater.
        "properties": {"preserves-vector-representation": False},
    }, indent=2) + "\n")

    mark_dir = XCASSETS / "LaunchMark.imageset"
    mark_dir.mkdir(parents=True, exist_ok=True)
    mark = Image.open(MARK).convert("RGBA")
    ratio = mark.height / mark.width
    images = []
    for scale in (1, 2, 3):
        w = MARK_PT_WIDTH * scale
        h = int(round(w * ratio))
        name = f"launch-mark{'' if scale == 1 else f'@{scale}x'}.png"
        mark.resize((w, h), Image.LANCZOS).save(mark_dir / name)
        images.append({"filename": name, "idiom": "universal", "scale": f"{scale}x"})
    (mark_dir / "Contents.json").write_text(json.dumps(
        {"images": images, "info": {"author": "xcode", "version": 1}}, indent=2) + "\n")
    print(f"  launch    → LaunchBackground {LAUNCH_BG[0]}×{LAUNCH_BG[1]} + "
          f"LaunchMark {MARK_PT_WIDTH}×{int(round(MARK_PT_WIDTH * ratio))} pt @1x/@2x/@3x")


def write_android(master):
    if not ANDROID_RES.exists():
        print("  android   → hoppet over (finner ikke res/)")
        return
    for folder, px in ANDROID_SIZES.items():
        d = ANDROID_RES / folder
        if not d.exists():
            continue
        icon = master.resize((px, px), Image.LANCZOS)
        icon.save(d / "ic_launcher.png")
        # Round-varianten er samme bilde; Android maskerer den selv.
        icon.save(d / "ic_launcher_round.png")
    print(f"  android   → ic_launcher(+_round) i {len(ANDROID_SIZES)} tettheter")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--variant", default="A", choices=list("ABCD"),
                    help="A=figur på stadion (valgt), B=figur på mint, "
                         "C=figur med glød, D=ordmerket")
    ap.add_argument("--android", action="store_true", help="oppdater også mipmap-ene")
    ap.add_argument("--preview", metavar="PATH", help="skriv bare 1024-masteren hit")
    args = ap.parse_args()

    master = build_master(args.variant)
    if args.preview:
        master.save(args.preview)
        print(f"forhåndsvisning → {args.preview}")
        return

    print(f"Bygger variant {args.variant}:")
    write_app_icon(master)
    write_launch()
    if args.android:
        write_android(master)
    print("\nFerdig. Ikoner og storyboard bakes inn i binæren → krever rebuild "
          "(npm run ios). Metro-reload er ikke nok.")


if __name__ == "__main__":
    main()
