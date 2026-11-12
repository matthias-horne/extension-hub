import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { stringify } from 'yaml';
import { Dropdown } from '../src/components/Dropdown';
import { ExtensionCompatibility } from '../src/components/ExtensionCompatibility';
import { parseExtension } from '../src/data/extensions';
import { SORT_OPTIONS, sortExtensions } from '../src/data/sorting';

function extension(name: string, stars?: number, addedAt?: string, version = 'v1') {
  return parseExtension(stringify({
    name, description: 'Example', repository: 'https://github.com/example/' + name.toLowerCase(),
    version, addedAt, github: stars === undefined ? undefined : { stars },
  }), name.toLowerCase() + '.yaml');
}

describe('catalog sorting', () => {
  const entries = [
    extension('Charlie', 12, '2026-11-01T00:00:00Z', 'v99'),
    extension('Delta', undefined),
    extension('Bravo', 120, '2026-11-12T10:00:00+01:00'),
    extension('Alpha', 12, '2026-11-12T09:30:00Z'),
    extension('Echo', 0),
  ];
  const names = (items: typeof entries) => items.map((item) => item.title);

  test('sorts most popular by descending GitHub stars, using names to break ties', () => {
    expect(names(sortExtensions(entries, 'popular'))).toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta', 'Echo']);
  });

  test('sorts newest by hub addition date, comparing time zones and placing missing dates last', () => {
    expect(names(sortExtensions(entries, 'newest'))).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
  });

  test('sorts alphabetically without mutating the source', () => {
    expect(names(sortExtensions(entries, 'az'))).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(names(sortExtensions(entries, 'za'))).toEqual(['Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha']);
    expect(names(entries)).toEqual(['Charlie', 'Delta', 'Bravo', 'Alpha', 'Echo']);
    expect(sortExtensions([], 'newest')).toEqual([]);
  });

  test('uses the custom combobox for sort labels and preserves version badges', () => {
    const markup = renderToStaticMarkup(<Dropdown label="Sort extensions" options={SORT_OPTIONS} value="popular" onChange={() => {}} />);
    expect(markup).toContain('role="combobox" aria-label="Sort extensions: Most popular"');
    expect(markup).toContain('role="listbox" aria-label="Sort extensions" hidden=""');
    expect(markup).toContain('aria-selected="true" data-active="false"><span>Most popular</span>');
    for (const option of SORT_OPTIONS) expect(markup).toContain(option.label);
    const versionMarkup = renderToStaticMarkup(<MemoryRouter><ExtensionCompatibility version="v2" compatibility={{ v2: {}, v1: {} }} /></MemoryRouter>);
    expect(versionMarkup).toContain('aria-label="Version: v2"');
    expect(versionMarkup).toContain('<span>v2</span><span class="dropdown-badge">Current</span>');
  });
});
