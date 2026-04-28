# Școala de Fotbal Dan Matei — Design System
## Extracted from Official Brand Assets

---

## 🎨 Brand Colors (from Logo)

| Token | HEX | OKLCH | Usage |
|---|---|---|---|
| **Primary** | `#5ECBF2` | `oklch(0.75 0.12 230)` | Light cyan — shield border, jerseys, accents |
| **Primary Dark** | `#2A8AB5` | `oklch(0.60 0.12 230)` | Hover states, gradients |
| **Secondary** | `#1E4D5C` | `oklch(0.40 0.08 220)` | Navy teal — text, dark panels |
| **Secondary Dark** | `#0F2D38` | `oklch(0.25 0.06 220)` | Deep backgrounds |
| **Accent** | `#D4A843` | `oklch(0.75 0.14 85)` | Gold — star, laurels, CTAs |
| **Accent Light** | `#E8C876` | `oklch(0.82 0.12 85)` | Hover gold, highlights |
| **Background** | `#0A1628` | `oklch(0.12 0.04 250)` | Page background |
| **Surface** | `#111D33` | `oklch(0.17 0.05 250)` | Cards, panels |
| **Text** | `#F0F4F8` | `oklch(0.95 0.01 250)` | Primary text |
| **Muted** | `#8A9AAE` | `oklch(0.65 0.03 250)` | Secondary text |

### Color Psychology
- **Cyan** = Energy, youth, trust, sportiness
- **Navy Teal** = Professionalism, stability, depth
- **Gold** = Excellence, achievement, prestige

---

## 🔤 Typography

| Role | Font | Weight | Size (mobile → desktop) |
|---|---|---|---|
| **Display** | Oswald | 700 | `text-4xl` → `text-8xl` |
| **Heading** | Oswald | 600 | `text-2xl` → `text-5xl` |
| **Body** | Source Sans 3 | 400 | `text-sm` → `text-lg` |
| **Label** | Oswald | 500 | `text-xs` uppercase |
| **Caption** | Source Sans 3 | 400 | `text-xs` |

### Tracking Rules
- Headings: `tracking-[0.1em]` to `tracking-[0.2em]`
- Labels: `tracking-[0.15em]` uppercase
- Body: `tracking-normal`

---

## 📐 Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight gaps |
| `space-2` | 8px | Icon gaps |
| `space-3` | 12px | Component padding |
| `space-4` | 16px | Card padding |
| `space-6` | 24px | Section gaps |
| `space-8` | 32px | Component margins |
| `space-12` | 48px | Section padding |
| `space-16` | 64px | Hero padding |

---

## 🃏 Card System

```
Card: bg-surface, border-white/8, rounded-2xl
Hover: border-primary/40, -translate-y-1
Shadow: shadow-lg shadow-black/20
Padding: p-5 sm:p-8
```

---

## ✨ Animation Tokens

| Token | Duration | Easing |
|---|---|---|
| `ease-fast` | 150ms | `ease-out` |
| `ease-normal` | 300ms | `ease-in-out` |
| `ease-slow` | 500ms | `ease-in-out` |
| `ease-bounce` | 600ms | `spring` |

### Standard Animations
- **Fade In**: `opacity 0→1, translateY 20px→0, 600ms`
- **Scale In**: `scale 0.95→1, opacity 0→1, 400ms`
- **Hover Lift**: `translateY 0→-4px, 300ms`
- **Glow Pulse**: `scale 1→1.3→1, opacity 0.4→0.7→0.4, 3s loop`
- **Float**: `translateY 0→-12px→0, 4s loop`

---

## 🖼️ Asset Guidelines

### Logo Usage
- **Primary**: Full color on dark backgrounds
- **Secondary**: White version on images
- **Minimum size**: 32px height
- **Clear space**: 8px minimum around logo

### Photography
- **Team photos**: Natural lighting, outdoor fields
- **Jerseys**: Light cyan (#5ECBF2) with navy accents
- **Mood**: Energetic, youthful, professional

---

## 📱 Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| `sm` | 640px | 2-column grids, larger text |
| `md` | 768px | Side-by-side layouts |
| `lg` | 1024px | Full navigation, max-width containers |
| `xl` | 1280px | Large typography, wide layouts |

---

## ♿ Accessibility

- Minimum contrast ratio: 4.5:1 for text
- Focus rings: `ring-2 ring-primary ring-offset-2`
- Touch targets: Minimum 44px
- Animations: Respect `prefers-reduced-motion`
