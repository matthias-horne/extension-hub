# Gardener Extension Hub

The Gardener Extension Hub aggregates [Gardener Extensions](https://gardener.cloud/docs/gardener/extensions/) published by Gardener and the community to enhance their visibility and provide meta information like compatibility matrices and more.

Every registered extension is listed on the [Hub's Website](https://matthias-horne.github.io/extension-hub/). A cron job will continuously update your extensions releases and update the corresponding metadata.

## How to Contribute My Extension as a Maintainer?

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

The catalog includes all known implementations from the [Gardener Extensions Library](https://github.com/gardener/gardener/blob/master/extensions/README.md), with its section headings as tags. Repositories listed in multiple sections have one registration with all applicable tags. Additional tags describe shared capabilities and apply to at least three extensions.

`manifestRegistry` is optional. Extensions without a registry are listed with repository information and release versions; unavailable manifests, artifacts, documentation, and compatibility information show yellow notices. The hub offers an `extension.yaml` download only when an Extension resource is available.

Set `VITE_SHOW_EXTENSIONS_WITHOUT_REGISTRY=false` when building the website to hide entries without a registry. The default is `true`. GitHub Pages builds use the repository Actions variable with the same name. See [the website instructions](website/README.md) for local builds.

When provided, the `manifestRegistry` OCI artifact can contain a referrer pointing to a `compatibility.yaml`.
This format is used to validate extension compatibility by the gardener-operator.

The `compatibility.yaml` is expected to look like this:

```yaml
requires: {}
  # gardener/gardener: '>= x.y.z'
supportedFeatures: []
builtWith:
  gardener/gardener: v<x.y.z>
testedWith:
  gardener/gardener: v<x.y.z>
  kubernetesVersions:
  - 1.36
  - 1.35
  - 1.34
  - 1.33
  - 1.32
  - ...
```

For pushing these artifacts using Github Actions, the [composite action](.github/actions/compatibility/action.yaml) can be utilized.

## Extension Compatibility

The compatibility of an extension is usually defined by a matrix.

- Gardener version
- Kubernetes version
- External API version.

In addition, compatibility can depend on the configuration of these dependencies.

Testing all the possible combinations of these versions and configurations is quite impossible, so the validations derived from the `compatibility.yaml` file only result in warnings.
An operator may choose to ignore these warnings and run the extensions anyway if they know what they are doing.

To help extension maintainers, we offer an [API compatibility checker]((./tools/api-compatibility-indicator/)) that loosely validates API contracts to determine the operating range of an extension.
However, as an extension's behaviour at runtime depends not only on existing contracts, these results are insufficient for building a valid compatibility matrix.
Use this tool in conjunction with your knowledge of how your extension works to make it a valuable tool for maintaining your extension.
