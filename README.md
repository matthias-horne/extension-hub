# Gardener Extension Hub

This repository is a hub for aggregating [Gardener Extensions](https://gardener.cloud/docs/gardener/extensions/).

## How to contribute my extension as a maintainer?

Please open an issue to present your extension and reference a pull request that adds your extension.

Register an extension by opening a pull request that adds a YAML file to
`extensions/`. See [the example registration](extensions/gardener-extension-example.yaml):

```yaml
name: Example Extension
description: A minimal Gardener extension example that does nothing
tags:
  - example
repository: https://github.com/matthias-horne/gardener-extension-example
manifestRegistry: ghcr.io/matthias-horne/manifests/gardener-extension-example
```

`repository` must identify a public GitHub repository. `manifestRegistry` must
identify a public OCI repository without a scheme or tag.

## Daily manifest updates

The [update workflow](.github/workflows/update-extensions.yaml) runs daily at
03:23 UTC, when registrations change on `main`, and through **Run workflow** in
GitHub Actions. It reads registrations from the default branch and commits
changed aggregated manifests to `pages`, retaining the site files there.
The workflow needs permission to push to `pages`; branch rules must allow
`github-actions[bot]` to do so.

After publishing manifests, the update workflow calls the
[deploy workflow](.github/workflows/deploy.yml) to build the website and publish
it to `pages`, preserving `extensions/`. This also runs when no manifests change
or when successful updates are published despite another extension failing.
Website changes on `main` and manual deploy runs also rebuild the site. Both
workflows serialize their writes to `pages`. Configure GitHub Pages to deploy
from the root of the `pages` branch.

For each extension the updater:

1. Lists all published GitHub releases, with pagination, including prereleases
   and excluding drafts. The most recently **published** release supplies the
   aggregated `version` and `resources`.
2. Fetches the OCI artifact at `<manifestRegistry>:<release-tag>` for each
   release missing from the aggregate's compatibility history. Release tags
   must also be valid OCI tags.
3. Copies `builtWith`, `testedWith`, and `supportedKubernetesVersions` from each
   release manifest into `compatibility[<release-tag>]`. A release without these
   fields gets an empty entry so it is still tracked as fetched.
4. Writes `pages:extensions/<registration-filename>` using the registration's
   name, description, tags, repository, and registry, with release data added.
   See [the aggregate example](aggregated-manifest-example.yaml) for the shape.

## Extension Manifest Artifact

An extension's compatibility is usually defined by a matrix of:

- Gardener version and configuration
- Kubernetes version
- External dependencies version(s)

Each release artifact must contain `manifest.yaml` (or a single layer with YAML
media type), with `version` matching its release tag and a `resources` list of
objects containing `kind` and `type`. For example:

```yaml
version: v0.0.2
resources:
  - kind: Worker
    type: example
builtWith:
  gardener/gardener: v1.153.0
testedWith:
  gardener/gardener: v1.154.1
  kubernetesVersions:
    - '1.36'
    - '1.30'
```

Quote Kubernetes versions to preserve values such as `1.30` when parsing YAML.
Publish the manifest alongside the GitHub release, for example with:

```sh
oras push ghcr.io/example/manifests/extension:v0.0.2 \
  --artifact-type application/yaml manifest.yaml:application/yaml
```

Fetched release manifests are treated as immutable. Compatibility history is
preserved even if a GitHub release is deleted. Changing an extension's repository
or registry rebuilds its history. Registration metadata changes are applied even
without a new release. Extensions without published releases are skipped.

If a release or artifact cannot be read or validated, that extension's aggregate
is kept intact and retried on the next run. Other extensions can still update.
The workflow reports failures in its logs and job summary and commits successful
updates. Runs without changes do not create commits.

## Local use

Install Node.js 24+, [GitHub CLI](https://cli.github.com/), and
[ORAS](https://oras.land/docs/installation), then:

```sh
npm --prefix tools/update-extensions ci
npm --prefix tools/update-extensions test
gh auth login
git worktree add /tmp/extension-hub-pages pages
npm --prefix tools/update-extensions run update-extensions -- --output-dir /tmp/extension-hub-pages/extensions
git -C /tmp/extension-hub-pages diff
```

The script updates files only; the workflow handles the commit and push.
