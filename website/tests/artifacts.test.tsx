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
    for (const deployment of [undefined, null, {}, { extension: {} }, { extension: { helm: {} } }]) {
      expect(extensionWithDeployment(deployment).artifacts).toEqual([]);
    }
    for (const ociRepository of [undefined, null, {}, { ref: '' }, { ref: 123 }, { repository: 'registry.example/chart' }, { tag: 'v1' }, { digest: 'sha256:abc' }]) {
      expect(extensionWithDeployment({ extension: { helm: { ociRepository } } }).artifacts).toEqual([]);
    }
    const markup = renderToStaticMarkup(<ExtensionArtifacts artifacts={[]} />);
    expect(markup).toContain('No Helm charts are referenced in this extension.yaml.');
    expect(markup).not.toContain('artifact-card');
  });
});
