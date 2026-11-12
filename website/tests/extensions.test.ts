import { describe, expect, test } from 'bun:test';
import { loadExtensions, parseExtension } from '../src/data/extensions';

const directory = 'https://data.example/hub/extensions/';
const definition = `
name: Example Extension
version: v0.0.3
addedAt: '2026-11-01T10:00:00.000Z'
description: Example
repository: https://github.com/example/extension
tags: [example]
extension:
  apiVersion: operator.gardener.cloud/v1alpha1
  kind: Extension
  metadata:
    name: example
  spec:
    resources:
      - kind: Extension
        type: example
github:
  stars: 12
  language: Go
  license:
    name: MIT License
    spdxId: MIT
  owner:
    login: example
    avatarUrl: https://avatars.githubusercontent.com/example
    htmlUrl: https://github.com/example
  readme:
    markdown: '# Example 🌱'
    path: README.md
    htmlUrl: https://github.com/example/extension/blob/main/README.md
    rawUrl: https://raw.githubusercontent.com/example/extension/main/README.md
compatibility:
  v0.0.3:
    requires:
      gardener/gardener: '>= 1.135.0'
    supportedFeatures: [namespaced-cloudprofiles, ipv6]
    builtWith:
      gardener/gardener: v1.153.0
    testedWith:
      gardener/gardener: v1.154.1
      kubernetesVersions: ['1.36', '1.30']
  v0.0.2:
    builtWith:
      gardener/gardener: v1.150.0
  v0.0.1: {}
`;

function files(responses: Record<string, string | Response>) {
  const requests: { url: string; options?: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, options?: RequestInit) => {
    requests.push({ url: String(url), options });
    const value = responses[String(url)];
    return value instanceof Response ? value : new Response(value, { status: value === undefined ? 404 : 200 });
  }) as typeof fetch;
  return { fetcher, requests };
}

describe('runtime extension catalog', () => {
  test('omits the manifest download when only catalog metadata is available', () => {
    const registration = `name: Community Extension
description: An extension without published artifacts
repository: https://github.com/example/community
`;
    for (const registry of ['', 'manifestRegistry: ghcr.io/example/extensions/community']) {
      const extension = parseExtension(registration + registry, 'community.yaml');
      expect(extension.manifest).toBeUndefined();
      expect(extension.manifestUrl).toBeUndefined();
      expect(extension.artifacts).toEqual([]);
      expect(extension.images).toEqual([]);
    }
  });

  test('includes registry-free entries by default and filters by registry when disabled', async () => {
    const server = files({
      [directory + 'index.json']: '["registered.yaml", "community.yaml"]',
      [directory + 'registered.yaml']: definition + 'manifestRegistry: ghcr.io/example/extensions/extension',
      [directory + 'community.yaml']: definition,
    });
    expect((await loadExtensions(directory, server)).map((entry) => entry.id)).toEqual(['registered', 'community']);
    expect((await loadExtensions(directory, { ...server, showWithoutRegistry: true })).map((entry) => entry.id)).toEqual(['registered', 'community']);
    expect((await loadExtensions(directory, { ...server, showWithoutRegistry: false })).map((entry) => entry.id)).toEqual(['registered']);
    const onlyCommunity = files({ [directory + 'index.json']: '["community.yaml"]', [directory + 'community.yaml']: definition });
    expect(await loadExtensions(directory, { ...onlyCommunity, showWithoutRegistry: false })).toEqual([]);
  });

  test('loads the published index and YAML files, preserving cached data and the Extension download', async () => {
    const server = files({
      [directory + 'index.json']: '["example.yaml", "second.yml"]',
      [directory + 'example.yaml']: definition,
      [directory + 'second.yml']: definition.replace('v0.0.3', 'v0.0.2'),
    });
    const extensions = await loadExtensions(directory, { fetcher: server.fetcher, siteBase: '/hub/' });
    expect(extensions.map((extension) => extension.id)).toEqual(['example', 'second']);
    expect(extensions[0].version).toBe('v0.0.3');
    expect(extensions[0].addedAt).toBe('2026-11-01T10:00:00.000Z');
    expect(extensions[0].github?.stars).toBe(12);
    expect(extensions[0].github?.readme?.markdown).toBe('# Example 🌱');
    expect(extensions[0].compatibility).toEqual({
      'v0.0.3': {
        requires: { 'gardener/gardener': '>= 1.135.0' },
        supportedFeatures: ['namespaced-cloudprofiles', 'ipv6'],
        builtWith: { 'gardener/gardener': 'v1.153.0' },
        testedWith: { 'gardener/gardener': 'v1.154.1', kubernetesVersions: ['1.36', '1.30'] },
      },
      'v0.0.2': { builtWith: { 'gardener/gardener': 'v1.150.0' } },
      'v0.0.1': {},
    });
    expect(extensions[0].icon).toBe('/hub/logo.svg');
    expect(extensions[0].manifest).toContain('kind: Extension');
    expect(extensions[0].manifest).not.toContain('markdown:');
    expect(extensions[0].manifest).not.toContain('compatibility:');
    expect(extensions[0].manifest).not.toContain('addedAt:');
    expect(decodeURIComponent(extensions[0].manifestUrl.split(',')[1])).toBe(extensions[0].manifest);
    expect(server.requests.map((request) => request.url)).toEqual([directory + 'index.json', directory + 'example.yaml', directory + 'second.yml']);
    expect(server.requests.every((request) => request.options?.cache === 'no-cache')).toBe(true);
  });

  test('preserves the full compatibility history, including versions without information', () => {
    const history = parseExtension(definition, 'example.yaml').compatibility;
    expect(Object.keys(history!)).toEqual(['v0.0.3', 'v0.0.2', 'v0.0.1']);
    expect(history?.['v0.0.1']).toEqual({});
    const olderRelease = definition.replace('version: v0.0.3', 'version: v0.0.2');
    expect(parseExtension(olderRelease, 'example.yaml').compatibility).toEqual(history);
    const unknownRelease = definition.replace('version: v0.0.3', 'version: v0.0.4');
    expect(parseExtension(unknownRelease, 'example.yaml').compatibility).toEqual(history);
    expect(parseExtension(definition.replace('version: v0.0.3', ''), 'example.yaml').compatibility).toEqual(history);
    const withoutCompatibility = definition.split('compatibility:')[0];
    expect(parseExtension(withoutCompatibility, 'example.yaml').compatibility).toBeUndefined();
    expect(parseExtension(withoutCompatibility + 'compatibility: {v0.0.3: {}}', 'example.yaml').compatibility).toEqual({ 'v0.0.3': {} });
  });

  test('supports legacy entries without an addition date and rejects malformed dates', () => {
    expect(parseExtension(definition.replace("addedAt: '2026-11-01T10:00:00.000Z'", ''), 'example.yaml').addedAt).toBeUndefined();
    for (const date of ['invalid', '42', 'null']) {
      expect(() => parseExtension(definition.replace("'2026-11-01T10:00:00.000Z'", date), 'example.yaml')).toThrow('addedAt date string');
    }
  });

  test('picks up newly published versions and extensions without changing the application', async () => {
    const responses = { [directory + 'index.json']: '["example.yaml"]', [directory + 'example.yaml']: definition };
    const server = files(responses);
    expect((await loadExtensions(directory, server))[0].version).toBe('v0.0.3');
    responses[directory + 'example.yaml'] = definition.replace('v0.0.3', 'v0.0.4');
    responses[directory + 'new.yaml'] = definition;
    responses[directory + 'index.json'] = '["example.yaml", "new.yaml"]';
    const updated = await loadExtensions(directory, server);
    expect(updated[0].version).toBe('v0.0.4');
    expect(updated.map((extension) => extension.id)).toEqual(['example', 'new']);
  });

  test('allows an empty catalog and encodes filenames', async () => {
    expect(await loadExtensions(directory, files({ [directory + 'index.json']: '[]' }))).toEqual([]);
    const server = files({ [directory + 'index.json']: '["an example.yaml"]', [directory + 'an%20example.yaml']: definition });
    expect((await loadExtensions(directory.slice(0, -1), server))[0].id).toBe('an example');
  });

  test('reports failed requests and rejects invalid indexes before requesting files', async () => {
    await expect(loadExtensions(directory, files({}))).rejects.toThrow('HTTP 404');
    await expect(loadExtensions(directory, files({ [directory + 'index.json']: '["missing.yaml"]' }))).rejects.toThrow('HTTP 404');
    for (const index of ['{}', '[1]', '["../example.yaml"]', '["example.txt"]', '["example.yaml", "example.yaml"]']) {
      const server = files({ [directory + 'index.json']: index });
      await expect(loadExtensions(directory, server)).rejects.toThrow('index is invalid');
      expect(server.requests).toHaveLength(1);
    }
  });

  test('rejects malformed aggregates and forwards cancellation', async () => {
    await expect(loadExtensions(directory, files({ [directory + 'index.json']: '["example.yaml"]', [directory + 'example.yaml']: 'name: incomplete' }))).rejects.toThrow('Missing extension');
    const controller = new AbortController();
    const server = files({ [directory + 'index.json']: '[]' });
    await loadExtensions(directory, { ...server, signal: controller.signal });
    expect(server.requests[0].options?.signal).toBe(controller.signal);
  });
});
