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
and release versions, records empty compatibility entries, and skips all OCI and
Helm requests. These entries are included in the runtime catalog index. Removing
or adding a registry resets the previous manifest and compatibility history.

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

Install Node.js 24+, [GitHub CLI](https://cli.github.com/), and
[ORAS](https://oras.land/docs/installation), and [Helm](https://helm.sh/docs/intro/install/) 3.19+, then:

```sh
npm --prefix tools/update-extensions ci
npm --prefix tools/update-extensions test
gh auth login
git worktree add /tmp/extension-hub-pages pages
npm --prefix tools/update-extensions run update-extensions -- --output-dir /tmp/extension-hub-pages/extensions
git -C /tmp/extension-hub-pages diff
```

The script updates files only; the workflow handles the commit and push.
