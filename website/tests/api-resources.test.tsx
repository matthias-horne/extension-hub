import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { stringify } from 'yaml';
import ExtensionDetails from '../src/components/ExtensionDetails';
import { parseExtension } from '../src/data/extensions';

const registration = {
  name: 'Example',
  description: 'An example extension',
  repository: 'https://github.com/example/extension',
};

function extensionWithSpec(spec?: unknown) {
  return parseExtension(stringify({
    ...registration,
    extension: {
      apiVersion: 'operator.gardener.cloud/v1alpha1',
      kind: 'Extension',
      metadata: { name: 'example' },
      spec,
    },
  }), 'example.yaml');
}

function apiResourcesSection(markup: string) {
  return markup.split('class="details-api-resources"')[1].split('class="details-support"')[0];
}

describe('API resources in extension details', () => {
  test('lists the unique resource kinds declared by the Extension resource', () => {
    const extension = extensionWithSpec({
      resources: [
        { kind: 'Infrastructure', type: 'gcp' },
        { kind: 'Worker', type: 'gcp' },
        { kind: 'Infrastructure', type: 'gcp' },
      ],
    });
    expect(extension.apiResources).toEqual(['Infrastructure', 'Worker']);
    expect(extension.hasAdmissionController).toBe(false);
  });

  test('detects an admission controller from either admission Helm chart', () => {
    for (const admission of [
      { runtimeCluster: { helm: { ociRepository: { ref: 'registry.example/admission-runtime:v1' } } } },
      { virtualCluster: { helm: { ociRepository: { ref: 'registry.example/admission-virtual:v1' } } } },
    ]) {
      expect(extensionWithSpec({ deployment: { admission }, resources: [] }).hasAdmissionController).toBe(true);
    }
    expect(extensionWithSpec({ deployment: { admission: { values: { image: { repository: 'registry.example/admission' } } } } }).hasAdmissionController).toBe(false);
    expect(extensionWithSpec({ deployment: { admission: { runtimeCluster: { helm: { ociRepository: { ref: '' } } } } } }).hasAdmissionController).toBe(false);
    expect(extensionWithSpec().hasAdmissionController).toBe(false);
  });

  test('handles missing resources and missing manifests', () => {
    expect(extensionWithSpec().apiResources).toEqual([]);
    expect(extensionWithSpec({ resources: [{ kind: '', type: 'gcp' }, { type: 'gcp' }] }).apiResources).toEqual([]);
    const extension = parseExtension(stringify(registration), 'example.yaml');
    expect(extension.apiResources).toEqual([]);
    expect(extension.hasAdmissionController).toBe(false);
  });

  test('renders the section below categories with resource pills and admission status', () => {
    const extension = extensionWithSpec({
      deployment: { admission: { runtimeCluster: { helm: { ociRepository: { ref: 'registry.example/admission:v1' } } } } },
      resources: [{ kind: 'Infrastructure', type: 'gcp' }, { kind: 'Worker', type: 'gcp' }],
    });
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    const section = apiResourcesSection(markup);
    expect(markup.indexOf('API resources')).toBeGreaterThan(markup.indexOf('Categories'));
    expect(section).toMatch(/<h2\b[^>]*>API resources<\/h2>/);
    expect(section).toContain('<li class="api-resource">Infrastructure</li>');
    expect(section).toContain('<li class="api-resource">Worker</li>');
    expect(section).toContain('<dt>Admission controller</dt>');
    expect(section).toContain('<span class="api-admission-yes">');
    expect(section).toContain('>Yes</span>');
  });

  test('shows empty states for resources and admission controllers', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extensionWithSpec()} onCategory={() => {}} /></MemoryRouter>);
    const section = apiResourcesSection(markup);
    expect(section).toContain('No API resources declared.');
    expect(section).toContain('<dd>No</dd>');

    const missingManifest = parseExtension(stringify(registration), 'example.yaml');
    const missingMarkup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={missingManifest} onCategory={() => {}} /></MemoryRouter>);
    const missingSection = apiResourcesSection(missingMarkup);
    expect(missingSection).toContain('API resources are unavailable.');
    expect(missingSection).not.toContain('Admission controller');
  });
});
