# Gardener Extensions Hub

A curated grid of Gardener extensions, styled to match the Gardener homepage.

## Getting started

```bash
cd website
bun install
bun run dev
```

```bash
bun run build
bun run lint
```

The page uses React, TypeScript, Vite, and CSS. Dark mode is the default; the theme switch saves your preference locally. The layout uses three columns on desktop, two on tablet, and one on mobile.

The header search (or Command/Ctrl + K) finds extensions by name, category, and description. Cards open an overview with a link to Gardener extension documentation. Search and overview dialogs support Escape and keyboard focus.

## Design and assets

The visual reference is [gardener.cloud](https://gardener.cloud/): charcoal surfaces, Inter typography, a gradient headline, a glowing Gardener mark, and green feature icons. Logo and icon SVGs come from the official site's `/gardener-logo.svg` and `/highlights/` assets, with green fills adjusted to the reference screenshot. Inter is served locally from the official site's font asset.

Theme variables are defined in `src/index.css`; page, component, and responsive styles are in `src/App.css`.
