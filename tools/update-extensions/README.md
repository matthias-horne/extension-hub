# update-extensions

This script scrapes the [registered extensions](../../extensions/) and generates the metadata used in the website for displaying the extension cards.

When an extension is first aggregated, it stores `addedAt` as an ISO timestamp
using the current time of the update that first creates its aggregated manifest
in the `pages` branch. Later updates preserve the timestamp, including release,
repository, and registry changes. Existing aggregates without this field receive
the current update's timestamp once. A failed update does not persist a timestamp;
the first successful retry records it. Git history is not required.

Each registration requires a name, description, and GitHub repository. The OCI
`manifestRegistry` is optional. Without it, the updater fetches repository metadata
and release versions, records empty published compatibility entries, runs the
Gardener API compatibility check, and skips all OCI and Helm requests. These
entries are included in the runtime catalog index. Removing or adding a registry
resets the previous manifest and compatibility histories.

On every update, the updater runs [api-compatibility-indicator](../api-compatibility-indicator/)
for each extension's latest published release, using its exact GitHub tag as the
Go module version. Extensions without releases are checked with `@latest` and
stored under the `latest` key. The `extension-with-gardener` check runs for every
extension; `extension-with-helm` also runs when the latest Extension resource
references an extension Helm chart. Each command has a ten-minute timeout.

The full JSON ranges (`version`, `from`, `to`, `breaking_on_lower`, and
`breaking_on_higher`) are stored in `apiCompatibility.<release>.gardener` and
`apiCompatibility.<release>.kubernetes` in the aggregated YAML. Older release
results are retained as new releases are checked. The current release is checked
again even if unchanged, so new dependency versions can change its range. These
API estimates are separate from the maintainer's `compatibility` requirements
and test results. Unsupported extensions, unavailable dependencies, invalid
output, and timeouts log warnings without blocking repository and artifact
updates. A failed check retains its previous result for the same release; without
a previous result, that check is omitted and retried on the next update.

The GitHub Actions workflow builds the indicator once and shares Go's module
and build caches across all extension checks. It restores the most recent cache
and saves a new cache after each run, including failed updates, so dependencies
downloaded during checks are reused on subsequent runs.

Registrations may also specify `icon` as an absolute HTTP(S) image URL. It is
preserved in the aggregate and takes priority over automatically discovered
artwork. The updater queries GitHub's GraphQL API for `openGraphImageUrl` and
`usesCustomOpenGraphImage`, caching configured social previews as
`github.socialPreviewUrl`. GitHub-generated previews are stored as null so the
website can use the owner avatar instead. Unavailable or invalid preview
metadata logs a warning and stores null without blocking the rest of the update.

For the latest published release, it fetches the default Helm values from the OCI
chart references in the Extension resource (using `ref`, or `repository` with
`tag` or `digest`). It integrates the runtime admission chart's defaults into
`spec.deployment.admission.values`, which Gardener applies to both admission
deployments. The extension chart's defaults populate both
`spec.deployment.extension.values` (ControllerDeployment in the virtual garden)
and `spec.deployment.extension.runtimeClusterValues` (runtime garden deployment).
Existing manifest values override chart defaults recursively; lists, scalars,
and explicit null values replace defaults. Each update starts from the published
Extension resource so defaults removed in a newer chart are removed as well.
If a chart cannot be fetched or its values are invalid, the existing aggregate
is retained and the update reports a failure.

## Local use

Install Node.js 24+, Go (the version in the indicator's `go.mod` or newer),
[GitHub CLI](https://cli.github.com/), [ORAS](https://oras.land/docs/installation),
and [Helm](https://helm.sh/docs/intro/install/) 3.19+, then:

```sh
npm --prefix tools/update-extensions ci
npm --prefix tools/update-extensions test
go -C tools/api-compatibility-indicator build -o /tmp/api-compatibility-indicator .
go install github.com/yannh/kubeconform/cmd/kubeconform@v0.7.0
gh auth login
git worktree add /tmp/extension-hub-pages pages
npm --prefix tools/update-extensions run update-extensions -- --output-dir /tmp/extension-hub-pages/extensions --api-compatibility-indicator /tmp/api-compatibility-indicator
git -C /tmp/extension-hub-pages diff
```

Ensure `$(go env GOPATH)/bin` is on `PATH` for kubeconform. The indicator binary
defaults to `api-compatibility-indicator` on `PATH`; use the flag above to select
a different path. Local runs use the same Go module and build caches as other Go
commands (customizable with `GOMODCACHE` and `GOCACHE`).

The script updates files only; the workflow handles the commit and push.
