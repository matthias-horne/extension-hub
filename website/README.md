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

Navigation uses hash routes so shared links and page refreshes work on GitHub Pages. Extension details use URLs such as `https://matthias-horne.github.io/extension-hub/#/extensions/gardener-extension-example`. Selecting a details tab or compatibility version updates query parameters inside the hash, for example `#/extensions/gardener-extension-example?tab=compatibility&version=v1.2.3`. Shared links, refreshes, and browser Back/Forward restore those selections; missing or unknown selections fall back to Overview and the current version (or the first available compatibility version). The deployment build sets Vite's base path to `/extension-hub/` for assets; route paths live after the hash.

The details page has an Artifacts tab showing the manifest registry and the Helm charts referenced in the published `extension.yaml`: the extension chart and any admission charts for the runtime and virtual clusters. Each chart shows its deployment role and a copyable OCI reference. References support both `ref` and separate `repository` with `tag` or `digest` fields, following Gardener's precedence rules.

The tab also lists copyable container image references from the extension’s `values`, `runtimeClusterValues`, and shared admission `values`. It recognizes direct image strings and image mappings with `ref` or `repository` plus `tag` or `digest`, including nested components and `images` collections. Identical references appear once with all deployment roles. Incomplete image mappings and unresolved Helm templates are omitted; this list reflects configured Helm values rather than a rendered workload inventory.

Inline search (or Command/Ctrl + K to focus it) finds extensions by name, owner, repository, tags, and description. Category filters show counts for the current search and work together with the search query. The grid defaults to Most popular. The custom sort dropdown supports alphabetical order, Most popular (descending GitHub stars), and Newest (descending `addedAt`, the timestamp when the updater first creates the extension's aggregated manifest in the `pages` branch). Existing aggregates without a date receive one on their next successful update. Missing stars count as zero; missing dates sort last, and ties use alphabetical order. Cards show the GitHub owner and avatar, cached repository stars, category tags, and a repository link. When an Extension resource is available, the extension.yaml button opens the manifest and the download icon saves it with that filename. Escape closes the viewer. The header links to this repository on GitHub.

README previews support GitHub Markdown alerts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]`) with distinct labels, icons, and border colors in both light and dark mode. Alert bodies support the same Markdown formatting and repository-relative links and images as the rest of the README.

## Design and assets

The catalog layout follows [Vicinae Extensions](https://www.vicinae.com/extensions), with charcoal surfaces, Inter typography, and green feature icons inspired by [gardener.cloud](https://gardener.cloud/). Logo and icon SVGs come from the official site's `/gardener-logo.svg` and `/highlights/` assets, with green fills adjusted to the reference screenshot. Inter is served locally from the official site's font asset.

Theme variables are defined in `src/index.css`; page, component, and responsive styles are in `src/App.css`.

## Extension data

Registrations live in `../extensions/*.yaml`. Each entry requires `name`, `description`, and a GitHub `repository`, with optional `tags`, `manifestRegistry`, and `icon` (an absolute HTTP(S) image URL). Add an entry to this directory to include it in the hub. The updater publishes aggregated YAML files and an `index.json` on the `pages` branch; the website fetches them at runtime. `VITE_EXTENSIONS_URL` can override the data directory URL.

Cards and detail pages choose icons in this order: the registration's `icon`, the
repository's custom social preview cached as `github.socialPreviewUrl`, the
GitHub owner's avatar, and the local Gardener logo. GitHub-generated repository
previews are skipped. When owner metadata is missing, the avatar URL is derived
from the registered repository owner. Failed image loads advance through the
remaining sources, stopping at the Gardener logo. Images fit within the existing
icon dimensions without cropping.

GitHub metadata and README content are cached by the updater. If metadata is missing, stars show an unavailable marker and the repository owner and avatar use the registered GitHub URL. The YAML viewer and download use only the aggregate's optional `extension` resource. Unavailable documentation, manifests, and compatibility information show prominent yellow notices in their respective tabs. Manifest and compatibility notices link maintainers to the [contribution guide](https://github.com/matthias-horne/extension-hub#how-to-contribute-my-extension-as-a-maintainer); compatibility notices apply to the selected version, including releases with empty compatibility data. Missing artifacts show explanatory messages. Manifest preview and download controls are unavailable when there is no Extension resource.

Extensions without a manifest registry are shown by default. To hide them, set the build-time environment variable to the literal string `false`:

```bash
VITE_SHOW_EXTENSIONS_WITHOUT_REGISTRY=false bun run build
```

Set it to `true` (or leave it unset) to include all extensions. You can also copy `.env.example` to `.env.local` and set the value there. The filter applies to search, category counts, and detail routes, and requires rebuilding to change. GitHub Pages builds read the Actions repository variable `VITE_SHOW_EXTENSIONS_WITHOUT_REGISTRY`, defaulting to `true`.
