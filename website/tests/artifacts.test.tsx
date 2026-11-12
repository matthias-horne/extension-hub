import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { parse, stringify } from 'yaml';
import { parseExtension } from '../src/data/extensions';
import { ExtensionArtifacts } from '../src/components/ExtensionArtifacts';
import ExtensionDetails from '../src/components/ExtensionDetails';

// https://github.com/gardener/gardener-extension-provider-gcp/blob/master/example/extension.yaml
const gcpManifest = parse(readFileSync(new URL('./fixtures/provider-gcp-extension.yaml', import.meta.url), 'utf8'));
const registryEntry = {
  name: 'GCP provider',
  description: 'Gardener extension for GCP',
  repository: 'https://github.com/gardener/gardener-extension-provider-gcp',
};

function extensionWithDeployment(deployment: unknown) {
  return parseExtension(stringify({ ...registryEntry, extension: { ...gcpManifest, spec: { deployment } } }), 'gcp.yaml');
}

describe('extension artifacts', () => {
  test('includes all three Helm charts from the GCP Extension manifest', () => {
    const extension = parseExtension(stringify({ ...registryEntry, extension: gcpManifest }), 'gcp.yaml');
    const registry = 'europe-docker.pkg.dev/gardener-project/public/charts/gardener/extensions/';
    expect(extension.artifacts).toEqual([
      { type: 'helm-chart', deployment: 'extension', reference: registry + 'provider-gcp:v1.59.0-dev' },
      { type: 'helm-chart', deployment: 'admission-runtime', reference: registry + 'admission-gcp-runtime:v1.59.0-dev' },
      { type: 'helm-chart', deployment: 'admission-virtual', reference: registry + 'admission-gcp-application:v1.59.0-dev' },
    ]);
    expect(parse(extension.manifest)).toEqual(gcpManifest);
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    expect(markup).toContain('id="artifacts-tab" role="tab"');
    expect(markup).toContain('id="artifacts-panel" role="tabpanel" aria-labelledby="artifacts-tab"');
    expect(markup).toContain('Helm charts (3)');
    for (const artifact of extension.artifacts) expect(markup).toContain('<code>' + artifact.reference + '</code>');
    expect(markup).toContain('Admission (runtime cluster)');
    expect(markup).toContain('Admission (virtual cluster)');
    expect(markup).toContain('Copy OCI reference for Extension');
  });

  test('resolves full references and repository fields with Gardener precedence', () => {
    const digest = 'sha256:' + 'a'.repeat(64);
    const extension = extensionWithDeployment({
      extension: { helm: { ociRepository: { ref: 'oci://registry.example:5000/charts/provider:v1', repository: 'ignored', tag: 'ignored', digest } } },
      admission: {
        runtimeCluster: { helm: { ociRepository: { repository: 'registry.example:5000/charts/runtime', tag: 'v2' } } },
        virtualCluster: { helm: { ociRepository: { repository: 'registry.example/charts/virtual', tag: 'ignored', digest } } },
      },
    });
    expect(extension.artifacts.map(({ reference }) => reference)).toEqual([
      'oci://registry.example:5000/charts/provider:v1',
      'registry.example:5000/charts/runtime:v2',
      'registry.example/charts/virtual@' + digest,
    ]);
  });

  test('lists a chart for each deployment that uses it and excludes references in arbitrary Helm values', () => {
    const chart = { helm: { ociRepository: { ref: 'registry.example/shared:v1' } } };
    const extension = extensionWithDeployment({
      extension: { ...chart, values: { extra: { helm: { ociRepository: { ref: 'ignored:v1' } } } } },
      admission: { runtimeCluster: chart, virtualCluster: chart },
    });
    expect(extension.artifacts).toHaveLength(3);
    expect(new Set(extension.artifacts.map(({ reference }) => reference))).toEqual(new Set(['registry.example/shared:v1']));
    const onlyAdmission = extensionWithDeployment({ admission: { virtualCluster: chart } });
    expect(onlyAdmission.artifacts).toEqual([{ type: 'helm-chart', deployment: 'admission-virtual', reference: 'registry.example/shared:v1' }]);
  });

  test('handles missing charts and unusable OCI references with an empty state', () => {
    const registrationOnly = parseExtension(stringify(registryEntry), 'gcp.yaml');
    expect(registrationOnly.artifacts).toEqual([]);
    expect(registrationOnly.images).toEqual([]);
    for (const deployment of [undefined, null, {}, { extension: {} }, { extension: { helm: {} } }]) {
      expect(extensionWithDeployment(deployment).artifacts).toEqual([]);
    }
    for (const ociRepository of [undefined, null, {}, { ref: '' }, { ref: 123 }, { repository: 'registry.example/chart' }, { tag: 'v1' }, { digest: 'sha256:abc' }]) {
      expect(extensionWithDeployment({ extension: { helm: { ociRepository } } }).artifacts).toEqual([]);
    }
    const markup = renderToStaticMarkup(<ExtensionArtifacts artifacts={[]} />);
    expect(markup).not.toContain('information-warning');
    expect(markup).toContain('No Helm charts are referenced in this extension.yaml.');
    expect(markup).toContain('No container images are configured in this extension’s Helm values.');
    expect(markup).not.toContain('artifact-card');
  });

  test('displays images from all Helm value contexts, grouping shared references with their deployments', () => {
    const image = { repository: 'registry.example:5000/extension', tag: 'v1' };
    const extension = extensionWithDeployment({
      extension: { values: { image }, runtimeClusterValues: { image } },
      admission: { values: { image: { repository: 'registry.example/admission', tag: 'v2' } } },
    });
    expect(extension.images).toEqual([
      { reference: 'registry.example:5000/extension:v1', deployments: ['extension', 'extension-runtime'] },
      { reference: 'registry.example/admission:v2', deployments: ['admission'] },
    ]);
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    const artifactsMarkup = markup.split('id="artifacts-panel"')[1].split('id="compatibility-panel"')[0];
    expect(artifactsMarkup).toContain('Container images (2)');
    for (const { reference } of extension.images) {
      expect(artifactsMarkup.split('<code>' + reference + '</code>')).toHaveLength(2);
    }
    expect(artifactsMarkup).toContain('Extension (seed clusters), Extension (runtime cluster)');
    expect(artifactsMarkup).toContain('Admission (runtime and virtual clusters)');
    expect(artifactsMarkup).toContain('Copy image reference for Extension (seed clusters), Extension (runtime cluster)');
    expect(parse(extension.manifest).spec.deployment.extension.values.image).toEqual(image);
  });

  test('keeps distinct runtime image overrides and recognizes nested components and image collections', () => {
    const extension = extensionWithDeployment({
      extension: {
        values: {
          image: 'registry.example/controller:v1',
          sidecars: [{ image: 'registry.example/proxy:v2' }],
          components: { helper: { image: { repository: 'registry.example/helper', tag: 3 } } },
          images: { controller: 'registry.example/controller:v1', worker: { ref: 'registry.example/worker:v4' } },
        },
        runtimeClusterValues: { image: { repository: 'registry.example/controller', tag: 'runtime' } },
      },
      admission: { values: { images: [{ name: 'admission', repository: 'registry.example/admission', tag: 'v5' }] } },
    });
    expect(extension.images).toEqual([
      { reference: 'registry.example/controller:v1', deployments: ['extension'] },
      { reference: 'registry.example/proxy:v2', deployments: ['extension'] },
      { reference: 'registry.example/helper:3', deployments: ['extension'] },
      { reference: 'registry.example/worker:v4', deployments: ['extension'] },
      { reference: 'registry.example/controller:runtime', deployments: ['extension-runtime'] },
      { reference: 'registry.example/admission:v5', deployments: ['admission'] },
    ]);
  });

  test('resolves image references with full-reference and digest precedence', () => {
    const digest = 'sha256:' + 'b'.repeat(64);
    const extension = extensionWithDeployment({ extension: { values: { images: [
      { ref: 'registry.example/full:v1', repository: 'ignored', tag: 'ignored', digest },
      { repository: 'registry.example/pinned', tag: 'ignored', digest },
      { repository: 'registry.example/tagged', tag: 'v2' },
    ] } } });
    expect(extension.images.map(({ reference }) => reference)).toEqual([
      'registry.example/full:v1', 'registry.example/pinned@' + digest, 'registry.example/tagged:v2',
    ]);
  });

  test('omits incomplete images, unresolved templates, and repositories outside image fields', () => {
    for (const image of [undefined, null, {}, 123, '', '  ', { repository: 'registry.example/image' },
      { repository: 123, tag: 'v1' }, { repository: 'registry.example/image', tag: false },
      '{{ .Values.global.image }}', { repository: 'registry.example/image', tag: '{{ .Chart.AppVersion }}' },
      { ref: '{{ .Values.image }}', repository: 'registry.example/image', tag: 'v1' },
      { repository: 'registry.example/image', digest: '{{ .Values.digest }}', tag: 'v1' },
    ]) {
      expect(extensionWithDeployment({ extension: { values: { image } } }).images).toEqual([]);
    }
    const chart = { helm: { ociRepository: { ref: 'registry.example/chart:v1' } } };
    expect(extensionWithDeployment({ extension: { ...chart, values: {
      repository: 'registry.example/config', tag: 'v1', chart,
      config: { repository: 'registry.example/source', tag: 'v1' },
    } } }).images).toEqual([]);
  });

  test('handles recursive YAML aliases in Helm values', () => {
    const values: Record<string, unknown> = { image: 'registry.example/controller:v1' };
    values.self = values;
    expect(extensionWithDeployment({ extension: { values } }).images).toEqual([
      { reference: 'registry.example/controller:v1', deployments: ['extension'] },
    ]);
  });
});
