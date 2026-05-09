# Hyperframes — Build-time video assets

This directory holds [HeyGen Hyperframes](https://github.com/heygen-com/hyperframes) compositions used to render mobile assets at build time (e.g., the onboarding hero video).

## Compositions

- `onboarding-hero/` — Animated 1080×1920 portrait video used by `app/onboarding/index.tsx`. Renders to `apps/mobile/assets/onboarding-hero.mp4`.

## Render

```bash
# From apps/mobile/
pnpm render:hero

# Or directly:
cd hyperframes/onboarding-hero
pnpm dlx hyperframes render . --output ../../assets/onboarding-hero.mp4 --quality high
```

## Preview locally

```bash
cd hyperframes/onboarding-hero
pnpm dlx hyperframes preview
```

Then open the studio URL printed in the console.

## Add a new composition

```bash
cd apps/mobile/hyperframes
pnpm dlx hyperframes init my-composition
```

Edit `my-composition/index.html`, then add an npm script in `apps/mobile/package.json` that calls `hyperframes render` against it.
