import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { parse, stringify } from 'yaml';
import ExtensionDetails from '../src/components/ExtensionDetails';
import { parseExtension } from '../src/data/extensions';
import { withoutHelmValues } from '../src/data/manifest';

const manifest = {
  apiVersion: 'operator.gardener.cloud/v1alpha1',
  kind: 'Extension',
  metadata: { name: 'example', annotations: { values: 'keep this annotation' } },
  spec: {
    deployment: {
      admission: {
        runtimeCluster: { helm: { ociRepository: { ref: 'registry.example/admission:v1' } } },
        virtualCluster: { helm: { ociRepository: { ref: 'registry.example/virtual:v1' } } },
        values: { image: { tag: 'custom' }, enabled: false },
      },
      extension: {
        helm: { ociRepository: { ref: 'registry.example/extension:v1' } },
        injectGardenKubeconfig: true,
        values: { replicaCount: 2, config: 'values: embedded text\n', list: ['one', 'two'] },
        runtimeClusterValues: { replicaCount: 0, enabled: false },
      },
    },
    resources: [{ kind: 'Worker', type: 'example' }],
  },
};

function extensionDefinition(extensionManifest: unknown) {
  return parseExtension(stringify({
    name: 'Example',
    description: 'An example extension',
    repository: 'https://github.com/example/extension',
    extension: extensionManifest,
  }), 'example.yaml');
}

describe('manifest values preview', () => {
  test('hides all deployment values while preserving charts and other manifest fields', () => {
    const original = stringify(manifest);
    const expected = structuredClone(manifest);
    const deployment = expected.spec.deployment;
    Reflect.deleteProperty(deployment.admission, 'values');
    Reflect.deleteProperty(deployment.extension, 'values');
    Reflect.deleteProperty(deployment.extension, 'runtimeClusterValues');

    expect(parse(withoutHelmValues(original))).toEqual(expected);
    expect(parse(original)).toEqual(manifest);
  });

  test('hides empty and null values without requiring every deployment context', () => {
    for (const values of [{}, null]) {
      const source = stringify({ spec: { deployment: { extension: { values } } } });
      expect(parse(withoutHelmValues(source))).toEqual({ spec: { deployment: { extension: {} } } });
    }
    const admissionOnly = stringify({ spec: { deployment: { admission: { values: { enabled: true } } } } });
    expect(parse(withoutHelmValues(admissionOnly))).toEqual({ spec: { deployment: { admission: {} } } });
  });

  test('keeps manifests without Helm values and invalid YAML unchanged', () => {
    for (const source of [
      '# Registry entry\nname: example\n',
      'spec: {}\n',
      'spec: null\n',
      'spec: {deployment: {extension: null}}\n',
      'metadata: {values: keep}\n',
      'hello\n',
      '',
      'spec: [invalid\n',
    ]) {
      expect(withoutHelmValues(source)).toBe(source);
    }
  });

  test('starts with values visible and retains the complete download', () => {
    const extension = extensionDefinition(manifest);
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    expect(markup).toContain('role="switch" aria-controls="manifest-preview" checked=""');
    expect(markup).toContain('Show values');
    expect(markup).toContain('runtimeClusterValues:');
    expect(markup).toContain('replicaCount: 2');
    expect(markup).toContain('id="manifest-preview"');
    expect(decodeURIComponent(extension.manifestUrl.split(',')[1])).toBe(extension.manifest);

    const noValues = extensionDefinition(parse(withoutHelmValues(extension.manifest)));
    const emptyMarkup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={noValues} onCategory={() => {}} /></MemoryRouter>);
    expect(emptyMarkup).toContain('role="switch" disabled=""');
  });
});
