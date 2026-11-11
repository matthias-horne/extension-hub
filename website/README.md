# Gardener Extensions Hub

A curated grid of Gardener extensions, with Gardener styling and a compact, searchable catalog.

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

Inline search (or Command/Ctrl + K to focus it) finds extensions by name, category, and description. Category filters show counts for the current search and work together with the search query. The sort control supports the catalog order and alphabetical order. Cards open an overview with a link to Gardener extension documentation; Escape closes the overview. The header links to this repository on GitHub.

## Design and assets

The catalog layout follows [Vicinae Extensions](https://www.vicinae.com/extensions), with charcoal surfaces, Inter typography, and green feature icons inspired by [gardener.cloud](https://gardener.cloud/). Logo and icon SVGs come from the official site's `/gardener-logo.svg` and `/highlights/` assets, with green fills adjusted to the reference screenshot. Inter is served locally from the official site's font asset.

Theme variables are defined in `src/index.css`; page, component, and responsive styles are in `src/App.css`.
