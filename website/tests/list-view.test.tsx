import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { stringify } from 'yaml';
import { ExtensionListItem } from '../src/components/ExtensionListItem';
import { parseExtension } from '../src/data/extensions';

describe('catalog list view', () => {
  const extension = parseExtension(stringify({
    name: 'Example Extension',
    description: 'A compact list entry.',
    repository: 'https://github.com/example/example-extension',
    tags: ['Security', 'Network'],
    github: {
      stars: 1234,
      lastCommit: '2026-11-10T12:00:00Z',
      language: null,
      license: null,
      owner: { login: 'example', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4', htmlUrl: 'https://github.com/example' },
      readme: null,
    },
    extension: { apiVersion: 'extensions.gardener.cloud/v1alpha1', kind: 'Extension', metadata: { name: 'example' } },
  }), 'example-extension.yaml');

  test('renders extension metadata, categories, and actions as a list row', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><ExtensionListItem extension={extension} /></MemoryRouter>);
    expect(markup).toContain('class="extension-row"');
    expect(markup).toContain('class="extension-row-link" href="/extensions/example-extension"');
    expect(markup).toContain('Example Extension');
    expect(markup).toContain('A compact list entry.');
    expect(markup).toContain('View example on GitHub');
    expect(markup).toContain('aria-hidden="true">1.2K</span>');
    expect(markup).toContain('class="extension-row-activity" dateTime="2026-11-10T12:00:00Z"');
    expect(markup).toContain('>Updated ');
    expect(markup).toContain('>Security</span>');
    expect(markup).toContain('>Network</span>');
    expect(markup).toContain('Download extension.yaml for Example Extension');
    expect(markup).toContain('Open Example Extension on GitHub');
  });
});
