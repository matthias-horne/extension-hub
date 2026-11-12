import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { stringify } from 'yaml';
import { parseExtension } from '../src/data/extensions';
import ExtensionDetails from '../src/components/ExtensionDetails';
import { ExtensionCard } from '../src/components/ExtensionCard';
import { ExtensionArtifacts } from '../src/components/ExtensionArtifacts';
import { ExtensionCompatibility } from '../src/components/ExtensionCompatibility';

const registration = { name: 'Community', description: 'Community extension', repository: 'https://github.com/example/community' };

describe('missing extension information', () => {
  test('shows missing-information messages and omits manifest copy, preview, and download controls', () => {
    const extension = parseExtension(stringify(registration), 'community.yaml');
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    const overviewPanel = markup.split('id="overview-panel"')[1].split('</section>')[0];
    expect(overviewPanel).toContain('class="information-warning" role="note"');
    expect(overviewPanel).toContain('Documentation unavailable');
    for (const tab of ['manifest', 'artifacts', 'compatibility']) {
      const panel = markup.split('id="' + tab + '-panel"')[1].split('id="compatibility-panel"')[0];
      expect(panel).not.toContain('information-warning');
    }
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

  test('shows a message for empty compatibility versions and retains actual information', () => {
    const empty = renderToStaticMarkup(<MemoryRouter><ExtensionCompatibility version="v2" compatibility={{ v2: {}, v1: { builtWith: { gardener: 'v1' } } }} /></MemoryRouter>);
    expect(empty).not.toContain('information-warning');
    expect(empty).toContain('Compatibility information for version <strong>v2</strong>');
    expect(empty).toContain('No compatibility information has been published for this version.');
    const populated = renderToStaticMarkup(<MemoryRouter><ExtensionCompatibility version="v1" compatibility={{ v1: { supportedFeatures: ['ipv6'], testedWith: { kubernetesVersions: ['1.36'] } } }} /></MemoryRouter>);
    expect(populated).not.toContain('information-warning');
    expect(populated).toContain('ipv6');
    expect(populated).toContain('1.36');
  });

  test('retains available artifact information without an empty-tab warning', () => {
    for (const props of [
      { artifacts: [], manifestRegistry: 'ghcr.io/example/extensions/community' },
      { artifacts: [], images: [{ reference: 'registry.example/image:v1', deployments: ['extension' as const] }] },
    ]) {
      const markup = renderToStaticMarkup(<ExtensionArtifacts {...props} />);
      expect(markup).not.toContain('information-warning');
    }
  });
});
