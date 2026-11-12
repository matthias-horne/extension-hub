import { describe, expect, test } from 'bun:test';
import type { SyntheticEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { parseExtension } from '../src/data/extensions';
import { ExtensionCard } from '../src/components/ExtensionCard';
import ExtensionDetails from '../src/components/ExtensionDetails';
import { ExtensionIcon } from '../src/components/ExtensionIcon';

const extension = parseExtension(`
name: Example
description: Example extension
repository: https://github.com/example/extension
icon: https://images.example/icon.svg
github:
  stars: 12
  socialPreviewUrl: https://images.example/preview.png
  owner:
    login: example
    avatarUrl: https://avatars.githubusercontent.com/example
    htmlUrl: https://github.com/example
`, 'example.yaml', '/hub/');

describe('extension icon images', () => {
  test('advances through all sources on load errors and stops at the Gardener logo', () => {
    const element = ExtensionIcon({ extension, className: 'extension-icon', size: 40 });
    let source = element.props.src;
    const requests: string[] = [];
    const event = { currentTarget: {
      getAttribute: () => source,
      setAttribute: (_name: string, value: string) => { source = value; requests.push(value); },
    } } as unknown as SyntheticEvent<HTMLImageElement>;

    element.props.onError(event);
    expect(source).toBe('https://images.example/preview.png');
    element.props.onError(event);
    expect(source).toBe('https://avatars.githubusercontent.com/example');
    element.props.onError(event);
    expect(source).toBe('/hub/logo.svg');
    element.props.onError(event);
    element.props.onError(event);
    expect(requests).toHaveLength(3);
  });

  test('resets the image when its candidate URLs change', () => {
    const first = ExtensionIcon({ extension, className: 'extension-icon', size: 40 });
    const updated = ExtensionIcon({
      extension: { ...extension, iconFallbacks: ['/hub/logo.svg'] }, className: 'extension-icon', size: 40,
    });
    expect(updated.key).not.toBe(first.key);
    expect(updated.props.src).toBe(extension.icon);
  });

  test('uses the selected image on both cards and detail pages at their existing sizes', () => {
    const card = renderToStaticMarkup(<MemoryRouter><ExtensionCard extension={extension} /></MemoryRouter>);
    const details = renderToStaticMarkup(<MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>);
    expect(card).toContain('class="extension-icon" src="https://images.example/icon.svg" alt="" width="40" height="40"');
    expect(details).toContain('class="details-icon" src="https://images.example/icon.svg" alt="" width="64" height="64"');
  });
});
