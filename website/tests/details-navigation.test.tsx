import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { stringify } from 'yaml';
import ExtensionDetails from '../src/components/ExtensionDetails';
import { parseExtension, type Extension } from '../src/data/extensions';

const extension = parseExtension(stringify({
  name: 'Example',
  description: 'An example extension',
  repository: 'https://github.com/example/extension',
  version: 'v2',
  compatibility: {
    v2: { supportedFeatures: ['current-feature'] },
    v1: { supportedFeatures: ['historical-feature'] },
    'v1+build/123': { supportedFeatures: ['encoded-version-feature'] },
  },
}), 'example.yaml');

function renderDetails(search = '', entry: Extension = extension) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/extensions/example' + search]}>
      <ExtensionDetails extension={entry} onCategory={() => {}} />
    </MemoryRouter>,
  );
}

function expectTab(markup: string, selected: string) {
  for (const tab of ['overview', 'manifest', 'artifacts', 'compatibility']) {
    expect(markup).toContain(`id="${tab}-tab" role="tab" aria-selected="${tab === selected}"`);
    const panel = markup.match(new RegExp(`<section[^>]*id="${tab}-panel"[^>]*>`))?.[0];
    expect(panel).toBeDefined();
    expect(panel!.includes('hidden=""')).toBe(tab !== selected);
  }
}

describe('details URL navigation', () => {
  test('restores each details tab from a shared URL', () => {
    for (const tab of ['overview', 'manifest', 'artifacts', 'compatibility']) {
      expectTab(renderDetails('?tab=' + tab), tab);
    }
  });

  test('restores a historical compatibility version and retains the current version badge', () => {
    const markup = renderDetails('?tab=compatibility&version=v1');
    expectTab(markup, 'compatibility');
    expect(markup).toContain('aria-label="Version: v1"');
    expect(markup).toContain('<li>historical-feature</li>');
    expect(markup).not.toContain('<li>current-feature</li>');
    expect(markup).toContain('<span>v2</span><span class="dropdown-badge">Current</span>');
  });

  test('decodes version tags with reserved URL characters', () => {
    const markup = renderDetails('?tab=compatibility&version=' + encodeURIComponent('v1+build/123'));
    expect(markup).toContain('aria-label="Version: v1+build/123"');
    expect(markup).toContain('<li>encoded-version-feature</li>');
  });

  test('falls back to Overview and the current version for missing or invalid selections', () => {
    for (const search of ['', '?tab=unknown&version=unknown', '?tab=&version=']) {
      const markup = renderDetails(search);
      expectTab(markup, 'overview');
      expect(markup).toContain('aria-label="Version: v2"');
      expect(markup).toContain('<li>current-feature</li>');
    }
  });

  test('uses the first compatibility version when no current version is available', () => {
    const markup = renderDetails('?tab=compatibility&version=unknown', { ...extension, version: undefined });
    expect(markup).toContain('aria-label="Version: v2"');
    expect(markup).toContain('<li>current-feature</li>');
    expect(markup).not.toContain('dropdown-badge');
  });

  test('handles a shared version URL when the extension has no versions', () => {
    const markup = renderDetails('?tab=compatibility&version=v1', { ...extension, version: undefined, compatibility: undefined });
    expectTab(markup, 'compatibility');
    expect(markup).toContain('No version has been published for this extension.');
    expect(markup).not.toContain('role="combobox"');
  });
});
