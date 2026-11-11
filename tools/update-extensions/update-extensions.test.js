import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parse, stringify } from 'yaml';
import {
  COMPATIBILITY_MEDIA_TYPE, EXTENSION_MEDIA_TYPE, aggregate, fetchGitHubInfo,
  integrateHelmValues, listArtifactTags, listReleases, loadMapping, pullCompatibility, pullHelmValues, pullManifest, repositoryName,
  run, updateExtensions, validateCompatibility, validateManifest, writeManifest,
} from './update-extensions.js';

const REGISTRATION = {
  name: 'Example Extension',
  description: 'Example',
  tags: ['example'],
  repository: 'https://github.com/example/extension',
  manifestRegistry: 'ghcr.io/example/extensions/extension',
};
const GITHUB = {
  stars: 12, lastCommit: '2026-11-11T00:00:00Z', language: 'Go',
  license: { name: 'Apache License 2.0', spdxId: 'Apache-2.0' },
  owner: { login: 'example', avatarUrl: 'https://avatars.githubusercontent.com/example', htmlUrl: 'https://github.com/example' },
  readme: { markdown: '# Example 🌱\n', path: 'docs/README.md', htmlUrl: 'https://github.com/example/extension/blob/main/docs/README.md', rawUrl: 'https://raw.githubusercontent.com/example/extension/main/docs/README.md' },
};
const HELM_VALUES = { replicaCount: 1, image: { repository: 'example/extension', tag: 'latest' } };

function release(tag, publishedAt = '2026-11-11T00:00:00Z', fields = {}) {
  return { tag_name: tag, published_at: publishedAt, draft: false, prerelease: false, ...fields };
}

function manifest(tag) {
  return {
    apiVersion: 'operator.gardener.cloud/v1alpha1', kind: 'Extension',
    metadata: { name: 'example', annotations: { 'extension.garden.cloud/manifest': REGISTRATION.manifestRegistry + ':' + tag } },
    spec: {
      deployment: { extension: { helm: { ociRepository: { ref: 'ghcr.io/example/charts/extension:' + tag.replace(/^v/, '') } } } },
      resources: [{ kind: 'Extension', type: 'example' }],
    },
  };
}

function manifestWithValues(tag) {
  const extension = manifest(tag);
  extension.spec.deployment.extension.values = structuredClone(HELM_VALUES);
  extension.spec.deployment.extension.runtimeClusterValues = structuredClone(HELM_VALUES);
  return extension;
}

function compatibility() {
  return {
    requires: { 'gardener/gardener': '>= 1.135.0' },
    supportedFeatures: ['namespaced-cloudprofiles', 'ipv6'],
    builtWith: { 'gardener/gardener': 'v1.153.0' },
    testedWith: { 'gardener/gardener': 'v1.154.1', kubernetesVersions: ['1.36', '1.30'] },
  };
}

function previousManifest() {
  return {
    ...REGISTRATION,
    version: 'v1',
    extension: manifestWithValues('v1'),
    github: GITHUB,
    compatibility: { v1: compatibility(), v0: {} },
  };
}

function dependencies(releases, fetchManifest = async (registry, tag) => manifest(tag)) {
  return {
    listReleases: mock.fn(async () => releases),
    listArtifactTags: mock.fn(async () => releases.map((release) => release.tag_name)),
    pullManifest: mock.fn(fetchManifest),
    pullHelmValues: mock.fn(async () => structuredClone(HELM_VALUES)),
    pullCompatibility: mock.fn(async () => compatibility()),
    fetchGitHubInfo: mock.fn(async () => GITHUB),
  };
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'extension-hub-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const extensions = join(directory, 'registry');
  const output = join(directory, 'pages');
  await mkdir(extensions);
  await mkdir(output);
  return {
    directory, extensions, output,
    options: { log: mock.fn(), error: mock.fn(), summaryPath: undefined },
  };
}

test('lists all pages, excludes drafts, includes prereleases, and sorts by publication time', async () => {
  const command = mock.fn(async () => JSON.stringify([
    [release('v1'), release('v3', undefined, { draft: true })],
    [release('v2-rc1', '2026-11-10T00:00:00Z', { prerelease: true })],
  ]));
  const releases = await listReleases(REGISTRATION.repository, command);
  assert.deepEqual(releases.map((item) => item.tag_name), ['v1', 'v2-rc1']);
  assert.deepEqual(command.mock.calls[0].arguments, [
    'gh', 'api', '--paginate', '--slurp', 'repos/example/extension/releases?per_page=100',
  ]);
});

test('validates GitHub repository URLs', () => {
  assert.equal(repositoryName('https://github.com/example/extension.git/'), 'example/extension');
  for (const url of [
    'http://github.com/example/extension', 'https://other.example/example/extension',
    'https://github.com/example/extension/issues', 'https://github.com/example/extension?x=1',
    'https://user:password@github.com/example/extension',
  ]) {
    assert.throws(() => repositoryName(url), /HTTPS GitHub repository URL/);
  }
});

test('lists registry tags to identify releases with published extension artifacts', async () => {
  const command = mock.fn(async () => JSON.stringify({ tags: ['v3', 'sha256-attachment'] }));
  assert.deepEqual(await listArtifactTags(REGISTRATION.manifestRegistry, command), ['v3', 'sha256-attachment']);
  assert.deepEqual(command.mock.calls[0].arguments, ['oras', 'repo', 'tags', REGISTRATION.manifestRegistry, '--format', 'json']);
  await assert.rejects(listArtifactTags(REGISTRATION.manifestRegistry, async () => '{}'), /invalid tags list/);
});

test('stores all displayed GitHub information and decodes UTF-8 README content', async () => {
  const command = mock.fn(async (...args) => args.at(-1).endsWith('/readme')
    ? 'HTTP/2.0 200 OK\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify({
      encoding: 'base64', content: Buffer.from(GITHUB.readme.markdown).toString('base64'),
      path: GITHUB.readme.path, html_url: GITHUB.readme.htmlUrl, download_url: GITHUB.readme.rawUrl,
    })
    : JSON.stringify({
      stargazers_count: GITHUB.stars, pushed_at: GITHUB.lastCommit, language: GITHUB.language,
      license: { name: GITHUB.license.name, spdx_id: GITHUB.license.spdxId },
      owner: { login: GITHUB.owner.login, avatar_url: GITHUB.owner.avatarUrl, html_url: GITHUB.owner.htmlUrl },
    }));
  assert.deepEqual(await fetchGitHubInfo(REGISTRATION.repository, command), GITHUB);
  assert.deepEqual(command.mock.calls.map((call) => call.arguments), [
    ['gh', 'api', 'repos/example/extension'], ['gh', 'api', '--include', 'repos/example/extension/readme'],
  ]);
});

test('treats README 404 as missing but fails on rate limits and malformed content', async () => {
  const repository = JSON.stringify({ stargazers_count: 0, owner: { login: 'example', avatar_url: 'avatar', html_url: 'owner' } });
  const readmeError = (status) => new Error('gh failed', { cause: { stdout: 'HTTP/2.0 ' + status + '\n\n{}' } });
  const command = (readme) => async (...args) => {
    if (!args.at(-1).endsWith('/readme')) return repository;
    if (readme instanceof Error) throw readme;
    return readme;
  };
  const result = await fetchGitHubInfo(REGISTRATION.repository, command(readmeError(404)));
  assert.equal(result.readme, null);
  assert.equal(result.stars, 0);
  assert.equal(result.language, null);
  assert.equal(result.license, null);
  await assert.rejects(fetchGitHubInfo(REGISTRATION.repository, command(readmeError(403))), /gh failed/);
  await assert.rejects(fetchGitHubInfo(REGISTRATION.repository, command('HTTP/2.0 200 OK\n\n{}')), /invalid README/);
  await assert.rejects(fetchGitHubInfo(REGISTRATION.repository, async () => '{}'), /invalid repository/);
});

function compatibilityCommand(referrers, documents = {}, subject = 'sha256:' + 'e'.repeat(64)) {
  return mock.fn(async (...args) => {
    if (args[1] === 'discover') return JSON.stringify({ digest: subject, referrers });
    const digest = args.find((arg) => arg.startsWith(REGISTRATION.manifestRegistry + '@'))?.split('@')[1];
    const document = documents[digest];
    if (!document) throw new Error('unexpected digest ' + digest);
    if (args[1] === 'manifest') return JSON.stringify({
      artifactType: COMPATIBILITY_MEDIA_TYPE, subject: { digest: subject },
      layers: [{ mediaType: COMPATIBILITY_MEDIA_TYPE, digest }],
    });
    return stringify(document);
  });
}

test('discovers compatibility by digest and merges later test attachments in creation order', async () => {
  const buildDigest = 'sha256:' + 'b'.repeat(64);
  const testDigest = 'sha256:' + 'c'.repeat(64);
  const referrer = (digest, created) => ({
    digest, artifactType: COMPATIBILITY_MEDIA_TYPE,
    annotations: { 'org.opencontainers.image.created': created },
  });
  const build = { ...compatibility(), testedWith: { dependency: 'v1', 'gardener/gardener': 'v1.153.0' } };
  const command = compatibilityCommand([
    referrer(testDigest, '2026-11-11T00:00:00Z'),
    { digest: 'sha256:' + 'd'.repeat(64), artifactType: 'application/other' },
    referrer(buildDigest, '2026-11-10T00:00:00Z'),
  ], { [buildDigest]: build, [testDigest]: { testedWith: compatibility().testedWith } });
  assert.deepEqual(await pullCompatibility(REGISTRATION.manifestRegistry, 'v2', command), {
    ...compatibility(), testedWith: { dependency: 'v1', ...compatibility().testedWith },
  });
  assert.deepEqual(command.mock.calls[0].arguments, [
    'oras', 'discover', REGISTRATION.manifestRegistry + ':v2', '--distribution-spec', 'v1.1-referrers-tag',
    '--artifact-type', COMPATIBILITY_MEDIA_TYPE, '--format', 'json', '--depth', '1',
  ]);
  assert.deepEqual(command.mock.calls[1].arguments, ['oras', 'manifest', 'fetch', REGISTRATION.manifestRegistry + '@' + buildDigest]);
  assert.equal(command.mock.callCount(), 5);
});

test('allows no compatibility attachments and rejects invalid digests and subjects', async () => {
  const empty = compatibilityCommand([]);
  assert.deepEqual(await pullCompatibility(REGISTRATION.manifestRegistry, 'v2', empty), {});
  assert.equal(empty.mock.callCount(), 1);
  const digest = 'sha256:' + 'b'.repeat(64);
  const referrer = { digest, artifactType: COMPATIBILITY_MEDIA_TYPE };
  await assert.rejects(pullCompatibility(REGISTRATION.manifestRegistry, 'v2', compatibilityCommand([{ ...referrer, digest: '../../bad' }])), /invalid digest/);
  await assert.rejects(pullCompatibility(REGISTRATION.manifestRegistry, 'v2', compatibilityCommand([], {}, 'invalid')), /invalid digest/);
  const command = compatibilityCommand([referrer], { [digest]: compatibility() });
  await assert.rejects(pullCompatibility(REGISTRATION.manifestRegistry, 'v2', async (...args) => {
    const text = await command(...args);
    if (args[1] !== 'manifest') return text;
    return JSON.stringify({ ...JSON.parse(text), subject: { digest: 'sha256:' + 'f'.repeat(64) } });
  }), /must refer to extension digest/);
});

test('fetches the YAML blob without extracting artifact paths', async () => {
  const digest = 'sha256:' + 'a'.repeat(64);
  const command = mock.fn(async (...args) => args[1] === 'manifest'
    ? JSON.stringify({ layers: [{
      mediaType: EXTENSION_MEDIA_TYPE, digest,
      annotations: { 'org.opencontainers.image.title': '../../extension.yaml' },
    }], artifactType: EXTENSION_MEDIA_TYPE })
    : stringify(manifest('v2')));
  assert.deepEqual(await pullManifest(REGISTRATION.manifestRegistry, 'v2', command), manifest('v2'));
  assert.deepEqual(command.mock.calls[1].arguments, [
    'oras', 'blob', 'fetch', REGISTRATION.manifestRegistry + '@' + digest, '--output', '-',
  ]);
});

test('rejects ambiguous artifacts, invalid digests, and invalid OCI tags', async () => {
  for (const layers of [
    [{ mediaType: EXTENSION_MEDIA_TYPE }, { mediaType: EXTENSION_MEDIA_TYPE }],
    [{ mediaType: EXTENSION_MEDIA_TYPE, digest: 'invalid' }],
    [{ mediaType: 'application/yaml', digest: 'sha256:' + 'a'.repeat(64) }],
  ]) {
    const command = mock.fn(async () => JSON.stringify({ artifactType: EXTENSION_MEDIA_TYPE, layers }));
    await assert.rejects(pullManifest(REGISTRATION.manifestRegistry, 'v2', command), /YAML layer|invalid digest/);
    assert.equal(command.mock.callCount(), 1);
  }
  const command = mock.fn();
  await assert.rejects(pullManifest(REGISTRATION.manifestRegistry, 'release/v2', command), /valid OCI tag/);
  assert.equal(command.mock.callCount(), 0);
});

test('validates operator Extension manifests and rejects the old manifest format', () => {
  for (const data of [
    { version: 'v2', resources: [] },
    { ...manifest('v2'), kind: 'ControllerRegistration' },
    { ...manifest('v2'), metadata: {} },
    { ...manifest('v2'), spec: { resources: [{ kind: 'Worker' }] } },
  ]) {
    assert.throws(() => validateManifest(data, 'v2'));
  }
});

test('reads Helm chart values and accepts empty charts but rejects malformed values', async () => {
  const reference = 'oci://ghcr.io/example/charts/extension:1.2.3';
  const command = mock.fn(async () => stringify(HELM_VALUES));
  assert.deepEqual(await pullHelmValues(reference, command), HELM_VALUES);
  assert.deepEqual(command.mock.calls[0].arguments, ['helm', 'show', 'values', reference]);
  for (const text of ['', '# No default values\n', '{}']) {
    assert.deepEqual(await pullHelmValues(reference, async () => text), {});
  }
  for (const text of ['- item', 'invalid', 'name: first\nname: second\n']) {
    await assert.rejects(pullHelmValues(reference, async () => text));
  }
});

test('integrates chart defaults into all contexts while preserving nested manifest overrides', async () => {
  const extension = manifest('v2');
  const deployment = extension.spec.deployment;
  deployment.admission = {
    runtimeCluster: { helm: { ociRepository: { ref: 'ghcr.io/example/charts/admission:2.0.0' } } },
    virtualCluster: { helm: { ociRepository: { ref: 'ghcr.io/example/charts/rbac:2.0.0' } } },
    values: { image: { tag: 'custom' }, enabled: false },
  };
  deployment.extension.values = { image: { tag: 'seed' }, replicaCount: 0, extra: 'keep', list: ['custom'], deleted: null };
  deployment.extension.runtimeClusterValues = { image: { repository: 'runtime/image' }, nested: { enabled: false } };
  const before = structuredClone(extension);
  const defaults = { ...HELM_VALUES, list: ['default'], deleted: 'default', nested: { enabled: true, keep: 1 } };
  const fetchValues = mock.fn(async (reference) => reference.includes('/admission:')
    ? { image: { repository: 'example/admission', tag: 'default' }, enabled: true, port: 443 }
    : defaults);
  const result = await integrateHelmValues(extension, fetchValues);
  const enriched = result.spec.deployment;
  assert.deepEqual(enriched.admission.values, { image: { repository: 'example/admission', tag: 'custom' }, enabled: false, port: 443 });
  assert.deepEqual(enriched.extension.values, {
    ...defaults, image: { repository: 'example/extension', tag: 'seed' }, replicaCount: 0, extra: 'keep', list: ['custom'], deleted: null,
  });
  assert.deepEqual(enriched.extension.runtimeClusterValues, {
    ...defaults, image: { repository: 'runtime/image', tag: 'latest' }, nested: { enabled: false, keep: 1 },
  });
  assert.deepEqual(fetchValues.mock.calls.map((call) => call.arguments), [
    ['oci://ghcr.io/example/charts/admission:2.0.0'], ['oci://ghcr.io/example/charts/extension:2'],
  ]);
  assert.deepEqual(extension, before);
  assert.deepEqual(enriched.admission.virtualCluster, before.spec.deployment.admission.virtualCluster);
  enriched.extension.values.nested.keep = 99;
  assert.equal(enriched.extension.runtimeClusterValues.nested.keep, 1);
  assert.equal(defaults.nested.keep, 1);
});

test('resolves OCI full references, tags, and digests with Gardener precedence', async () => {
  const repository = 'registry.example:5000/charts/extension';
  const digest = 'sha256:' + 'a'.repeat(64);
  for (const [ociRepository, expected] of [
    [{ ref: 'oci://' + repository + ':1.2.3', repository: 'ignored', tag: 'ignored', digest }, repository + ':1.2.3'],
    [{ ref: repository + ':1.2.3' }, repository + ':1.2.3'],
    [{ repository, tag: '1.2.3-rc.1' }, repository + ':1.2.3-rc.1'],
    [{ repository, tag: 'ignored', digest }, repository + '@' + digest],
  ]) {
    const extension = manifest('v2');
    extension.spec.deployment.extension.helm.ociRepository = ociRepository;
    const fetchValues = mock.fn(async () => ({}));
    await integrateHelmValues(extension, fetchValues);
    assert.deepEqual(fetchValues.mock.calls[0].arguments, ['oci://' + expected]);
  }
});

test('skips absent charts and uses runtime admission defaults only', async () => {
  const fetchValues = mock.fn(async () => ({}));
  for (const deployment of [undefined, {}, { extension: {} }, { admission: { virtualCluster: { helm: { ociRepository: { ref: 'ghcr.io/example/rbac:1' } } } } }]) {
    const extension = manifest('v1');
    extension.spec.deployment = deployment;
    assert.deepEqual(await integrateHelmValues(extension, fetchValues), extension);
  }
  assert.equal(fetchValues.mock.callCount(), 0);
});

test('fetches a shared chart once and keeps values independent across deployment contexts', async () => {
  const extension = manifest('v2');
  extension.spec.deployment.admission = { runtimeCluster: structuredClone(extension.spec.deployment.extension) };
  const fetchValues = mock.fn(async () => HELM_VALUES);
  const deployment = (await integrateHelmValues(extension, fetchValues)).spec.deployment;
  assert.equal(fetchValues.mock.callCount(), 1);
  deployment.admission.values.image.tag = 'changed';
  assert.equal(deployment.extension.values.image.tag, 'latest');
  assert.equal(deployment.extension.runtimeClusterValues.image.tag, 'latest');
  assert.equal(HELM_VALUES.image.tag, 'latest');
});

test('rejects invalid chart references and invalid overrides', async () => {
  const fetchValues = mock.fn(async () => HELM_VALUES);
  for (const ociRepository of [
    {}, { repository: 'ghcr.io/example/chart' }, { tag: '1.0.0' },
    { ref: '/tmp/chart.tgz' }, { ref: '--help' }, { ref: 'https://example.com/chart' },
    { ref: 'ghcr.io/example/chart' }, { repository: 'ghcr.io/example/chart', digest: 'invalid' },
  ]) {
    const extension = manifest('v2');
    extension.spec.deployment.extension.helm.ociRepository = ociRepository;
    await assert.rejects(integrateHelmValues(extension, fetchValues), /OCI reference|ociRepository/);
  }
  assert.equal(fetchValues.mock.callCount(), 0);
  for (const field of ['values', 'runtimeClusterValues']) {
    const extension = manifest('v2');
    extension.spec.deployment.extension[field] = ['invalid'];
    await assert.rejects(integrateHelmValues(extension, fetchValues), /YAML mapping/);
  }
});

test('merges values with JavaScript property names without changing object prototypes', async () => {
  const extension = manifest('v2');
  extension.spec.deployment.extension.values = parse('__proto__: {custom: true}\nconstructor: {custom: true}');
  const defaults = parse('__proto__: {default: true}\nconstructor: {default: true}');
  const values = (await integrateHelmValues(extension, async () => defaults)).spec.deployment.extension.values;
  assert.equal(Object.getPrototypeOf(values), Object.prototype);
  assert.deepEqual(values.__proto__, { default: true, custom: true });
  assert.deepEqual(values.constructor, { default: true, custom: true });
  assert.equal(Object.prototype.custom, undefined);
});

test('validates compatibility requirements, features, build and test information', () => {
  validateCompatibility(compatibility(), 'test');
  for (const data of [
    { requires: [] }, { builtWith: [] }, { testedWith: 'invalid' },
    { supportedFeatures: {} }, { supportedFeatures: [1] },
    { testedWith: { kubernetesVersions: {} } },
  ]) assert.throws(() => validateCompatibility(data, 'test'));
});

test('rejects non-mapping and duplicate-key YAML and preserves quoted versions', () => {
  for (const text of ['null', '- item', 'name: first\nname: second\n']) {
    assert.throws(() => loadMapping(text, 'test.yaml'));
  }
  const data = manifest('v2');
  assert.deepEqual(loadMapping(stringify(data), 'test.yaml'), data);
});

test('bootstraps all releases using registration metadata and the latest Extension resource', async () => {
  const deps = dependencies([release('v2'), release('v1')]);
  const result = await aggregate(REGISTRATION, {}, deps);
  assert.equal(deps.pullManifest.mock.callCount(), 1);
  assert.equal(deps.pullCompatibility.mock.callCount(), 2);
  assert.equal(result.version, 'v2');
  assert.equal(result.name, REGISTRATION.name);
  assert.equal(Object.hasOwn(result, 'resources'), false);
  assert.deepEqual(result.extension, manifestWithValues('v2'));
  assert.deepEqual(deps.pullHelmValues.mock.calls.map((call) => call.arguments), [['oci://ghcr.io/example/charts/extension:2']]);
  assert.deepEqual(result.github, GITHUB);
  assert.deepEqual(Object.keys(result.compatibility), ['v2', 'v1']);
  assert.deepEqual(result.compatibility.v2, compatibility());
});

test('refreshes published compatibility, retains deleted release history, and leaves input intact', async () => {
  const deps = dependencies([release('v2'), release('v1')]);
  const previous = previousManifest();
  const before = structuredClone(previous);
  const result = await aggregate(REGISTRATION, previous, deps);
  assert.deepEqual(deps.pullManifest.mock.calls.map((call) => call.arguments), [[REGISTRATION.manifestRegistry, 'v2']]);
  assert.deepEqual(deps.pullCompatibility.mock.calls.map((call) => call.arguments),
    [[REGISTRATION.manifestRegistry, 'v2'], [REGISTRATION.manifestRegistry, 'v1']]);
  assert.deepEqual(result.compatibility.v1, before.compatibility.v1);
  assert.deepEqual(result.compatibility.v0, {});
  assert.deepEqual(previous, before);
});

test('repeat runs refresh mutable information and apply registration metadata changes', async () => {
  const deps = dependencies([release('v1')]);
  const previous = previousManifest();
  assert.deepEqual(await aggregate(REGISTRATION, previous, deps), previous);
  const result = await aggregate({ ...REGISTRATION, description: 'Updated description', tags: ['new'] }, previous, deps);
  assert.equal(result.description, 'Updated description');
  assert.deepEqual(result.tags, ['new']);
  assert.deepEqual(result.extension.spec.resources, previous.extension.spec.resources);
  assert.equal(deps.pullManifest.mock.callCount(), 2);
  assert.equal(deps.fetchGitHubInfo.mock.callCount(), 2);
});

test('refreshes Helm defaults on every update without retaining removed defaults from the cache', async () => {
  const deps = dependencies([release('v1')]);
  const previous = previousManifest();
  previous.extension.spec.deployment.extension.values.removedDefault = true;
  previous.extension.spec.deployment.extension.runtimeClusterValues.removedDefault = true;
  deps.pullHelmValues = mock.fn(async () => ({ replicaCount: 3, newDefault: true }));
  const result = await aggregate(REGISTRATION, previous, deps);
  for (const field of ['values', 'runtimeClusterValues']) {
    assert.deepEqual(result.extension.spec.deployment.extension[field], { replicaCount: 3, newDefault: true });
  }
  assert.deepEqual(await aggregate(REGISTRATION, result, deps), result);
  assert.equal(deps.pullHelmValues.mock.callCount(), 2);
});

test('updates cached repository information when no release changes', async () => {
  const deps = dependencies([release('v1')]);
  deps.fetchGitHubInfo = mock.fn(async () => ({ ...GITHUB, stars: 99, readme: { ...GITHUB.readme, markdown: 'Updated docs' } }));
  const result = await aggregate(REGISTRATION, previousManifest(), deps);
  assert.equal(result.github.stars, 99);
  assert.equal(result.github.readme.markdown, 'Updated docs');
  assert.deepEqual(result.compatibility, previousManifest().compatibility);
});

test('retains historical releases without artifacts and requires the latest artifact', async () => {
  const deps = dependencies([release('v3'), release('v2'), release('v1')]);
  deps.listArtifactTags = mock.fn(async () => ['v3']);
  const warn = mock.fn();
  const result = await aggregate(REGISTRATION, {}, { ...deps, warn });
  assert.deepEqual(result.compatibility, { v3: compatibility(), v2: {}, v1: {} });
  assert.equal(deps.pullCompatibility.mock.callCount(), 1);
  assert.equal(warn.mock.callCount(), 2);
  const cached = await aggregate(REGISTRATION, previousManifest(), { ...deps, warn });
  assert.deepEqual(cached.compatibility, { v3: compatibility(), v2: {}, v1: compatibility(), v0: {} });
  deps.listArtifactTags = mock.fn(async () => ['v1']);
  await assert.rejects(aggregate(REGISTRATION, previousManifest(), deps), /latest release v3 has no published extension artifact/);
});

test('publishes empty historical entries, keeps them on later runs, and fills in new attachments', async (t) => {
  const { extensions, output, options } = await fixture(t);
  await writeFile(join(extensions, 'example.yaml'), stringify(REGISTRATION));
  const destination = join(output, 'example.yaml');
  const deps = dependencies([release('v3'), release('v2'), release('v1')]);
  deps.listArtifactTags = mock.fn(async () => ['v3', 'v1']);
  deps.pullCompatibility = mock.fn(async (_registry, tag) => tag === 'v3' ? compatibility() : {});
  const warn = mock.fn();
  assert.equal(await updateExtensions(extensions, output, { ...options, ...deps, warn }), 0);
  const first = parse(await readFile(destination, 'utf8'));
  assert.deepEqual(first.compatibility, { v3: compatibility(), v2: {}, v1: {} });

  deps.listReleases = mock.fn(async () => [release('v3'), release('v2')]);
  deps.listArtifactTags = mock.fn(async () => ['v3']);
  assert.equal(await updateExtensions(extensions, output, { ...options, ...deps, warn }), 0);
  assert.deepEqual(parse(await readFile(destination, 'utf8')).compatibility, first.compatibility);

  deps.listArtifactTags = mock.fn(async () => ['v3', 'v2']);
  deps.pullCompatibility = mock.fn(async () => compatibility());
  assert.equal(await updateExtensions(extensions, output, { ...options, ...deps, warn }), 0);
  assert.deepEqual(parse(await readFile(destination, 'utf8')).compatibility, {
    v3: compatibility(), v2: compatibility(), v1: {},
  });
});

test('tracks releases without compatibility and picks up attachments added later', async () => {
  const deps = dependencies([release('v1')]);
  deps.pullCompatibility = mock.fn(async () => ({}));
  const result = await aggregate(REGISTRATION, {}, deps);
  assert.deepEqual(result.compatibility, { v1: {} });
  assert.deepEqual(await aggregate(REGISTRATION, result, deps), result);
  deps.pullCompatibility = mock.fn(async () => compatibility());
  assert.deepEqual((await aggregate(REGISTRATION, result, deps)).compatibility.v1, compatibility());
});

test('changing repository or registry resets compatibility history', async () => {
  for (const changes of [
    { manifestRegistry: 'registry.example.com/extensions/example' },
    { repository: 'https://github.com/example/another-extension' },
  ]) {
    const deps = dependencies([release('v1')]);
    const registration = { ...REGISTRATION, ...changes };
    const result = await aggregate(registration, previousManifest(), deps);
    assert.deepEqual(deps.pullManifest.mock.calls[0].arguments, [registration.manifestRegistry, 'v1']);
    assert.deepEqual(Object.keys(result.compatibility), ['v1']);
  }
});

test('refetches a cached release if it becomes the newest published release', async () => {
  const deps = dependencies([release('v0'), release('v1')]);
  const result = await aggregate(REGISTRATION, previousManifest(), deps);
  assert.deepEqual(deps.pullManifest.mock.calls[0].arguments, [REGISTRATION.manifestRegistry, 'v0']);
  assert.equal(deps.pullManifest.mock.callCount(), 1);
  assert.equal(result.version, 'v0');
  assert.deepEqual(result.extension.spec.resources, manifest('v0').spec.resources);
});

test('updates repository information even without published releases', async () => {
  const deps = dependencies([]);
  assert.deepEqual(await aggregate(REGISTRATION, previousManifest(), deps), previousManifest());
  assert.deepEqual(await aggregate(REGISTRATION, {}, deps), { ...REGISTRATION, github: GITHUB, compatibility: {} });
  assert.equal(deps.pullManifest.mock.callCount(), 0);
  assert.equal(deps.pullHelmValues.mock.callCount(), 0);
});

test('release tags matching JavaScript property names are stored and cached safely', async () => {
  const deps = dependencies([release('__proto__'), release('constructor')]);
  const result = await aggregate(REGISTRATION, {}, deps);
  assert.deepEqual(Object.keys(result.compatibility), ['__proto__', 'constructor']);
  assert.equal(Object.getPrototypeOf(result.compatibility), Object.prototype);
  assert.deepEqual(await aggregate(REGISTRATION, result, deps), result);
  assert.equal(deps.pullManifest.mock.callCount(), 2);
  assert.equal(deps.pullCompatibility.mock.callCount(), 4);
});

test('failed file replacement preserves original data and removes temporary files', async (t) => {
  const { output } = await fixture(t);
  const destination = join(output, 'example.yaml');
  await writeFile(destination, 'Existing manifest');
  await assert.rejects(writeManifest(destination, previousManifest(), async () => {
    throw new Error('write failed');
  }), /write failed/);
  assert.equal(await readFile(destination, 'utf8'), 'Existing manifest');
  assert.deepEqual(await readdir(output), ['example.yaml']);
});

test('a failed extension stays intact while others update and the next run retries', async (t) => {
  const { directory, extensions, output, options } = await fixture(t);
  for (const name of ['a-broken.yaml', 'b-healthy.yaml']) {
    await writeFile(join(extensions, name), stringify(REGISTRATION));
  }
  const broken = join(output, 'a-broken.yaml');
  const oldText = stringify(previousManifest());
  await writeFile(broken, oldText);
  const deps = dependencies([release('v3'), release('v2'), release('v1')]);
  let calls = 0;
  deps.pullCompatibility = mock.fn(async () => {
    if (++calls === 2) throw new Error('manifest not published yet');
    return compatibility();
  });
  const summaryPath = join(directory, 'summary.md');
  assert.equal(await updateExtensions(extensions, output, { ...options, ...deps, summaryPath }), 1);
  assert.equal(await readFile(broken, 'utf8'), oldText);
  const healthy = join(output, 'b-healthy.yaml');
  assert.equal(parse(await readFile(healthy, 'utf8')).version, 'v3');
  assert.deepEqual(JSON.parse(await readFile(join(output, 'index.json'), 'utf8')), ['a-broken.yaml', 'b-healthy.yaml']);
  assert.match(await readFile(summaryPath, 'utf8'), /updates\n\n- a-broken.yaml: Failed/);
  assert.match(options.error.mock.calls[0].arguments[0], /manifest not published yet/);
  const retry = dependencies([release('v3'), release('v2'), release('v1')]);
  assert.equal(await updateExtensions(extensions, output, { ...options, ...retry }), 0);
  assert.equal(parse(await readFile(broken, 'utf8')).version, 'v3');
  assert.equal(retry.pullManifest.mock.callCount(), 2);
  assert.equal(retry.pullCompatibility.mock.callCount(), 6);
});

test('an unchanged aggregate keeps its formatting and unrelated site files', async (t) => {
  const { directory, extensions, output, options } = await fixture(t);
  await writeFile(join(extensions, 'example.yaml'), stringify(REGISTRATION));
  const destination = join(output, 'example.yaml');
  const text = '# Keep formatting on an unchanged run\n' + stringify(previousManifest());
  await writeFile(destination, text);
  const indexPath = join(output, 'index.json');
  await writeFile(indexPath, JSON.stringify(['example.yaml'], null, 2) + '\n');
  const indexTimestamp = (await stat(indexPath)).mtimeMs;
  const timestamp = (await stat(destination)).mtimeMs;
  const unrelated = join(directory, 'index.html');
  await writeFile(unrelated, 'The hub');
  assert.equal(await updateExtensions(extensions, output, { ...options, ...dependencies([release('v1')]) }), 0);
  assert.equal(await readFile(destination, 'utf8'), text);
  assert.equal((await stat(destination)).mtimeMs, timestamp);
  assert.equal((await stat(indexPath)).mtimeMs, indexTimestamp);
  assert.equal(await readFile(unrelated, 'utf8'), 'The hub');
});

test('runtime index includes only registered extensions with published aggregates', async (t) => {
  const { extensions, output, options } = await fixture(t);
  await writeFile(join(extensions, 'healthy.yml'), stringify(REGISTRATION));
  await writeFile(join(extensions, 'unpublished.yaml'), stringify({ ...REGISTRATION, repository: 'https://github.com/example/unpublished' }));
  await writeFile(join(output, 'unregistered.yaml'), stringify(previousManifest()));
  const deps = dependencies([release('v1')]);
  deps.listReleases = async (repository) => {
    if (repository.endsWith('/unpublished')) throw new Error('release unavailable');
    return [release('v1')];
  };
  assert.equal(await updateExtensions(extensions, output, { ...options, ...deps }), 1);
  assert.deepEqual(JSON.parse(await readFile(join(output, 'index.json'), 'utf8')), ['healthy.yml']);
});

test('a timed-out release request returns failure and preserves the existing file', async (t) => {
  const { extensions, output, options } = await fixture(t);
  await writeFile(join(extensions, 'example.yml'), stringify(REGISTRATION));
  const destination = join(output, 'example.yml');
  const original = stringify(previousManifest());
  await writeFile(destination, original);
  assert.equal(await updateExtensions(extensions, output, {
    ...options,
    listReleases: async () => { throw new Error('gh timed out after 120 seconds'); },
  }), 1);
  assert.equal(await readFile(destination, 'utf8'), original);
});

test('repository metadata failures keep the previous aggregate intact', async (t) => {
  const { extensions, output, options } = await fixture(t);
  await writeFile(join(extensions, 'example.yaml'), stringify(REGISTRATION));
  const destination = join(output, 'example.yaml');
  const original = stringify(previousManifest());
  await writeFile(destination, original);
  const deps = dependencies([release('v1')]);
  deps.fetchGitHubInfo = async () => { throw new Error('GitHub rate limit exceeded'); };
  assert.equal(await updateExtensions(extensions, output, { ...options, ...deps }), 1);
  assert.equal(await readFile(destination, 'utf8'), original);
});

test('chart retrieval or validation failures retain the aggregate and a successful retry publishes values', async (t) => {
  const { extensions, output, options } = await fixture(t);
  await writeFile(join(extensions, 'example.yaml'), stringify(REGISTRATION));
  const destination = join(output, 'example.yaml');
  const original = stringify(previousManifest());
  await writeFile(destination, original);
  for (const fetchValues of [
    async () => { throw new Error('Helm registry unavailable'); },
    async () => ['invalid'],
  ]) {
    const deps = dependencies([release('v2')]);
    deps.pullHelmValues = fetchValues;
    assert.equal(await updateExtensions(extensions, output, { ...options, ...deps }), 1);
    assert.equal(await readFile(destination, 'utf8'), original);
  }
  assert.equal(await updateExtensions(extensions, output, { ...options, ...dependencies([release('v2')]) }), 0);
  assert.deepEqual(parse(await readFile(destination, 'utf8')).extension, manifestWithValues('v2'));
});

test('executes subprocess arguments literally and reports subprocess failures', async () => {
  const literal = '$(echo unexpected)';
  assert.equal(await run(process.execPath, '-e', 'process.stdout.write(process.argv[1])', literal), literal);
  await assert.rejects(run(process.execPath, '-e', "process.stderr.write('request failed'); process.exit(1)"), /failed: request failed/);
});

test('CLI prints help and exits with failure when a required argument is missing', async () => {
  const script = fileURLToPath(new URL('./update-extensions.js', import.meta.url));
  const executeFile = promisify(execFile);
  const { stdout } = await executeFile(process.execPath, [script, '--help']);
  assert.match(stdout, /Usage:.*--output-dir/);
  await assert.rejects(executeFile(process.execPath, [script]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /--output-dir is required/);
    return true;
  });
});
