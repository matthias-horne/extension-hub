import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { stringify } from 'yaml';
import { parseExtension, type Extension } from '../src/data/extensions';
import ExtensionDetails from '../src/components/ExtensionDetails';
import { ExtensionCard } from '../src/components/ExtensionCard';
import { ExtensionArtifacts } from '../src/components/ExtensionArtifacts';
import { ExtensionCompatibility } from '../src/components/ExtensionCompatibility';

const registration = { name: 'Community', description: 'Community extension', repository: 'https://github.com/example/community' };
const maintainerGuide = 'https://github.com/matthias-horne/extension-hub#how-to-contribute-my-extension-as-a-maintainer';

function detailsPanel(markup: string, tab: string) {
  return markup.split('id="' + tab + '-panel"')[1].split('</section>')[0];
}

describe('missing extension information', () => {
  test('shows missing-information messages and omits manifest copy, preview, and download controls', () => {
    const extension = parseExtension(stringify(registration), 'community.yaml');
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    const overviewPanel = detailsPanel(markup, 'overview');
    expect(overviewPanel).toContain('class="information-warning" role="note"');
    expect(overviewPanel).toContain('Documentation unavailable');
    for (const tab of ['manifest', 'compatibility']) {
      const panel = detailsPanel(markup, tab);
      expect(panel).toContain('class="information-warning" role="note"');
      expect(panel).toContain('Extension maintainers:');
      expect(panel).toContain('href="' + maintainerGuide + '"');
    }
    expect(detailsPanel(markup, 'artifacts')).not.toContain('information-warning');
    expect(markup).toContain('No extension.yaml is available for this extension.');
    expect(markup).toContain('No Helm charts are referenced in this extension.yaml.');
    expect(markup).toContain('No container images are configured');
    expect(markup).toContain('No version has been published for this extension.');
    expect(markup).not.toContain('download="extension.yaml"');
    expect(markup).not.toContain('Copy YAML');
    expect(markup).not.toContain('id="manifest-preview"');
    expect(markup).toContain('Read on GitHub');
    const card = renderToStaticMarkup(<MemoryRouter><ExtensionCard extension={extension} /></MemoryRouter>);
    expect(card).not.toContain('Show extension.yaml');
    expect(card).not.toContain('download="extension.yaml"');
  });

  test('warns for an empty README even when repository metadata exists', () => {
    const extension = parseExtension(stringify({ ...registration, github: {
      stars: 1, owner: { login: 'example' }, readme: { markdown: '  ', path: 'README.md' },
    } }), 'community.yaml');
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    expect(markup).toContain('Documentation unavailable');
  });

  test('warns for empty compatibility versions and retains actual information', () => {
    const empty = renderToStaticMarkup(<MemoryRouter><ExtensionCompatibility version="v2" compatibility={{ v2: {}, v1: { builtWith: { gardener: 'v1' } } }} /></MemoryRouter>);
    expect(empty).toContain('information-warning');
    expect(empty).toContain('href="' + maintainerGuide + '"');
    expect(empty).toContain('Compatibility information for version <strong>v2</strong>');
    expect(empty).toContain('No compatibility information has been published for this version.');
    const populated = renderToStaticMarkup(<MemoryRouter><ExtensionCompatibility version="v1" compatibility={{ v1: { supportedFeatures: ['ipv6'], testedWith: { kubernetesVersions: ['1.36'] } } }} /></MemoryRouter>);
    expect(populated).not.toContain('information-warning');
    expect(populated).toContain('ipv6');
    expect(populated).toContain('1.36');
  });

  test('warns when a release has no compatibility entry or only empty sections', () => {
    const cases: Extension['compatibility'][] = [undefined, {}, { v2: { requires: {}, builtWith: {}, testedWith: {}, supportedFeatures: [] } }, { v1: { supportedFeatures: ['ipv6'] } }];
    for (const compatibility of cases) {
      const markup = renderToStaticMarkup(<MemoryRouter><ExtensionCompatibility version="v2" compatibility={compatibility} /></MemoryRouter>);
      expect(markup).toContain('information-warning');
      expect(markup).toContain('No compatibility information has been published for this version.');
      expect(markup).toContain('href="' + maintainerGuide + '"');
    }
  });

  test('shows a warning only for the selected compatibility version', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/?tab=compatibility&version=v1']}>
        <ExtensionCompatibility version="v2" compatibility={{ v2: {}, v1: { requires: { gardener: '>=1.0' } } }} />
      </MemoryRouter>,
    );
    expect(markup).not.toContain('information-warning');
    expect(markup).toContain('Requirements');
    expect(markup).toContain('&gt;=1.0');
  });

  test('keeps the manifest preview and download without a warning when a manifest is published', () => {
    const extension = parseExtension(stringify({ ...registration, extension: {
      apiVersion: 'operator.gardener.cloud/v1alpha1', kind: 'Extension', metadata: { name: 'community' },
    } }), 'community.yaml');
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    const panel = detailsPanel(markup, 'manifest');
    expect(panel).not.toContain('information-warning');
    expect(panel).toContain('id="manifest-preview"');
    expect(markup).toContain('download="extension.yaml"');
  });

  test('retains available artifact information without an empty-tab warning', () => {
    for (const props of [
      { artifacts: [{ type: 'helm-chart' as const, deployment: 'extension' as const, reference: 'registry.example/chart:v1' }] },
      { artifacts: [], images: [{ reference: 'registry.example/image:v1', deployments: ['extension' as const] }] },
    ]) {
      const markup = renderToStaticMarkup(<ExtensionArtifacts {...props} />);
      expect(markup).not.toContain('information-warning');
    }
  });

  test('retains a known registry without a warning when no chart or image references are available', () => {
    const registry = 'ghcr.io/example/extensions/community';
    const markup = renderToStaticMarkup(<ExtensionArtifacts artifacts={[]} manifestRegistry={registry} />);
    expect(markup).not.toContain('information-warning');
    expect(markup).toContain(registry);
    expect(markup).toContain('Open manifest registry');
  });
});
