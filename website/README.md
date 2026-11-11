# Gardener Extensions Hub

A searchable catalog of the Gardener extensions registered in the repository, with Gardener styling and a compact card layout.

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

Navigation uses hash routes so shared links and page refreshes work on GitHub Pages. Extension details use URLs such as `https://matthias-horne.github.io/extension-hub/#/extensions/gardener-extension-example`. The deployment build sets Vite's base path to `/extension-hub/` for assets; route paths live after the hash.

The details page has an Artifacts tab showing the manifest registry and the Helm charts referenced in the published `extension.yaml`: the extension chart and any admission charts for the runtime and virtual clusters. Each chart shows its deployment role and a copyable OCI reference. References support both `ref` and separate `repository` with `tag` or `digest` fields, following Gardener's precedence rules.

Inline search (or Command/Ctrl + K to focus it) finds extensions by name, owner, repository, tags, and description. Category filters show counts for the current search and work together with the search query. The sort control supports the catalog order and alphabetical order. Cards show the GitHub owner and avatar, live repository stars, category tags, an extension.yaml download, and a repository link. The extension.yaml button opens the registered definition; it can be downloaded with that filename, and Escape closes the viewer. The header links to this repository on GitHub.

## Design and assets

The catalog layout follows [Vicinae Extensions](https://www.vicinae.com/extensions), with charcoal surfaces, Inter typography, and green feature icons inspired by [gardener.cloud](https://gardener.cloud/). Logo and icon SVGs come from the official site's `/gardener-logo.svg` and `/highlights/` assets, with green fills adjusted to the reference screenshot. Inter is served locally from the official site's font asset.

Theme variables are defined in `src/index.css`; page, component, and responsive styles are in `src/App.css`.

## Extension data

The catalog imports `../extensions/*.yaml` at build time. Each entry requires `name`, `description`, and a GitHub `repository`, with optional `tags`. Add an entry to this directory to include it in the hub. The YAML viewer and download use the original registry file contents.

GitHub owner information and stars are fetched from the public repository API without credentials. Requests are reused across search and filter changes. If the API is unavailable or rate limited, stars show an unavailable marker and the repository owner and avatar still use the registered GitHub URL. The card download icon and YAML viewer both download the original registry definition as extension.yaml.
