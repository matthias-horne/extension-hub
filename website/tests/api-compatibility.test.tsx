import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { stringify } from 'yaml';
import ExtensionDetails from '../src/components/ExtensionDetails';
import { parseExtension, type ApiCompatibilityInfo } from '../src/data/extensions';

const range = {
  version: '1.153.0', from: '1.135.0', to: '1.154.1',
  breaking_on_lower: ['1.134.0 removes Extension fields'], breaking_on_higher: null,
};
const apiCompatibility: Record<string, ApiCompatibilityInfo> = {
  v2: {
    gardener: range,
    kubernetes: { version: '0.35.0', from: '0.34.0', to: '0.36.0', breaking_on_lower: null, breaking_on_higher: ['k8s 1.37.0 changes Deployment fields'] },
  },
  v1: { gardener: { ...range, from: '1.130.0', to: '1.130.0', version: '1.130.0', breaking_on_lower: null } },
};

function renderCompatibility(apiHistory: Record<string, ApiCompatibilityInfo> = apiCompatibility, version: string | null = 'v2', selection = '') {
  const extension = parseExtension(stringify({
    name: 'Example', description: 'An example extension', repository: 'https://github.com/example/extension', version: version ?? undefined,
    compatibility: { v2: { testedWith: { 'gardener/gardener': 'v1.154.1' }, supportedFeatures: ['ipv6'] } },
    apiCompatibility: apiHistory,
  }), 'example.yaml');
  const markup = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/extensions/example?tab=compatibility' + (selection ? '&version=' + encodeURIComponent(selection) : '')]}>
      <ExtensionDetails extension={extension} onCategory={() => {}} />
    </MemoryRouter>,
  );
  return { extension, markup };
}

describe('API compatibility section', () => {
  test('loads generated ranges and renders a compact section below Tested with, including the disclaimer', () => {
    const { extension, markup } = renderCompatibility();
    expect(extension.apiCompatibility).toEqual(apiCompatibility);
    expect(markup).toContain('content-section api-compatibility');
    expect(markup.indexOf('Tested with')).toBeLessThan(markup.indexOf('>API compatibility</h2>'));
    expect(markup.indexOf('>API compatibility</h2>')).toBeLessThan(markup.indexOf('Supported features'));
    expect(markup).toContain('<dt>Gardener</dt>');
    expect(markup).toContain('<span class="compatibility-value">1.135.0 – 1.154.1</span>');
    expect(markup).toContain('Reference version: 1.153.0');
    expect(markup).toContain('<dt>Kubernetes</dt>');
    expect(markup).toContain('<span class="compatibility-value">1.34.0 – 1.36.0</span>');
    expect(markup).toContain('Reference version: 1.35.0');
    expect(markup).not.toContain('0.34.0');
    expect(markup).toContain('role="note">API compatibility does not guarantee full functionality.</p>');
    expect(markup).toContain('<details class="api-compatibility-changes">');
    expect(markup).toContain('Gardener, below range:');
    expect(markup).toContain('1.134.0 removes Extension fields');
    expect(markup).toContain('Kubernetes, above range:');
    expect(markup).toContain('k8s 1.37.0 changes Deployment fields');
    expect(markup).not.toContain('open=""');
  });

  test('shows the selected API-only version and a single version for a one-version range', () => {
    const { markup } = renderCompatibility(apiCompatibility, 'v2', 'v1');
    expect(markup).toContain('aria-label="Version: v1"');
    expect(markup).toContain('<span class="compatibility-value">1.130.0</span>');
    expect(markup).not.toContain('1.135.0');
    expect(markup).not.toContain('<dt>Kubernetes</dt>');
    expect(markup).not.toContain('api-compatibility-changes');
    expect(markup).not.toContain('Compatibility information unavailable');
  });

  test('omits the API section when the selected release has no results', () => {
    const histories: Record<string, ApiCompatibilityInfo>[] = [{}, { v2: {} }, { v1: apiCompatibility.v1 }];
    for (const apiHistory of histories) {
      const { markup } = renderCompatibility(apiHistory);
      expect(markup).not.toContain('content-section api-compatibility');
      expect(markup).not.toContain('API compatibility does not guarantee full functionality.');
      expect(markup).toContain('Tested with');
    }
    const { markup } = renderCompatibility({ v1: apiCompatibility.v1 }, 'v3');
    expect(markup).toContain('Compatibility information unavailable');
    expect(markup).not.toContain('content-section api-compatibility');
  });

  test('allows selection of API results for unreleased extensions', () => {
    const { markup } = renderCompatibility({ latest: { gardener: range } }, null, 'latest');
    expect(markup).toContain('aria-label="Version: latest"');
    expect(markup).toContain('content-section api-compatibility');
    expect(markup).toContain('1.135.0 – 1.154.1');
  });
});
