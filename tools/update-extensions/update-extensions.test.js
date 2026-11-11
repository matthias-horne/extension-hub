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
  COMPATIBILITY_FIELDS, aggregate, listReleases, loadMapping, pullManifest,
  repositoryName, run, updateExtensions, validateManifest, writeManifest,
} from './update-extensions.js';

const REGISTRATION = {
  name: 'Example Extension',
  description: 'Example',
  tags: ['example'],
  repository: 'https://github.com/example/extension',
  manifestRegistry: 'ghcr.io/example/manifests/extension',
};

function release(tag, publishedAt = '2026-11-11T00:00:00Z', fields = {}) {
  return { tag_name: tag, published_at: publishedAt, draft: false, prerelease: false, ...fields };
}

function manifest(tag) {
  return {
    name: 'Name supplied by artifact',
    version: tag,
    resources: [{ kind: 'Worker', type: 'example' }],
    builtWith: { 'gardener/gardener': 'v1.153.0' },
    testedWith: { 'gardener/gardener': 'v1.154.1', kubernetesVersions: ['1.36', '1.30'] },
    supportedKubernetesVersions: ['1.36', '1.30'],
  };
}

function previousManifest() {
  return {
    ...REGISTRATION,
    version: 'v1',
    resources: [{ kind: 'Worker', type: 'old' }],
    compatibility: { v1: { builtWith: { 'gardener/gardener': 'v1.152.0' } }, v0: {} },
  };
}

function dependencies(releases, fetchManifest = async (registry, tag) => manifest(tag)) {
  return {
    listReleases: mock.fn(async () => releases),
    pullManifest: mock.fn(fetchManifest),
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

test('fetches the YAML blob without extracting artifact paths', async () => {
  const digest = 'sha256:' + 'a'.repeat(64);
  const command = mock.fn(async (...args) => args[1] === 'manifest'
    ? JSON.stringify({ layers: [{
      mediaType: 'application/yaml', digest,
      annotations: { 'org.opencontainers.image.title': '../../manifest.yaml' },
    }] })
    : stringify(manifest('v2')));
  assert.deepEqual(await pullManifest(REGISTRATION.manifestRegistry, 'v2', command), manifest('v2'));
  assert.deepEqual(command.mock.calls[1].arguments, [
    'oras', 'blob', 'fetch', REGISTRATION.manifestRegistry + '@' + digest, '--output', '-',
  ]);
});

test('rejects ambiguous artifacts, invalid digests, and invalid OCI tags', async () => {
  for (const layers of [
    [{ mediaType: 'application/yaml' }, { mediaType: 'application/yaml' }],
    [{ mediaType: 'application/yaml', digest: 'invalid' }],
  ]) {
    const command = mock.fn(async () => JSON.stringify({ layers }));
    await assert.rejects(pullManifest(REGISTRATION.manifestRegistry, 'v2', command), /manifest YAML layer|invalid YAML layer digest/);
    assert.equal(command.mock.callCount(), 1);
  }
  const command = mock.fn();
  await assert.rejects(pullManifest(REGISTRATION.manifestRegistry, 'release/v2', command), /valid OCI tag/);
  assert.equal(command.mock.callCount(), 0);
});

test('validates release manifest versions, resources, and compatibility fields', () => {
  for (const data of [
    { ...manifest('v2'), version: 'v3' },
    { ...manifest('v2'), resources: [{ kind: 'Worker' }] },
    { ...manifest('v2'), builtWith: [] },
    { ...manifest('v2'), testedWith: 'invalid' },
    { ...manifest('v2'), supportedKubernetesVersions: {} },
  ]) {
    assert.throws(() => validateManifest(data, 'v2'));
  }
});

test('rejects non-mapping and duplicate-key YAML and preserves quoted versions', () => {
  for (const text of ['null', '- item', 'name: first\nname: second\n']) {
    assert.throws(() => loadMapping(text, 'test.yaml'));
  }
  const data = manifest('v2');
  assert.deepEqual(loadMapping(stringify(data), 'test.yaml'), data);
});

test('bootstraps all releases using registration metadata and latest resources', async () => {
  const deps = dependencies([release('v2'), release('v1')]);
  const result = await aggregate(REGISTRATION, {}, deps);
  assert.equal(deps.pullManifest.mock.callCount(), 2);
  assert.equal(result.version, 'v2');
  assert.equal(result.name, REGISTRATION.name);
  assert.deepEqual(result.resources, manifest('v2').resources);
  assert.deepEqual(Object.keys(result.compatibility), ['v2', 'v1']);
  assert.deepEqual(result.compatibility.v2, Object.fromEntries(
    COMPATIBILITY_FIELDS.map((field) => [field, manifest('v2')[field]]),
  ));
});

test('pulls only missing releases, retains old history, and leaves input intact', async () => {
  const deps = dependencies([release('v2'), release('v1')]);
  const previous = previousManifest();
  const before = structuredClone(previous);
  const result = await aggregate(REGISTRATION, previous, deps);
  assert.deepEqual(deps.pullManifest.mock.calls.map((call) => call.arguments), [[REGISTRATION.manifestRegistry, 'v2']]);
  assert.deepEqual(result.compatibility.v1, before.compatibility.v1);
  assert.deepEqual(result.compatibility.v0, {});
  assert.deepEqual(previous, before);
});

test('repeat runs and registration metadata changes do not refetch', async () => {
  const deps = dependencies([release('v1')]);
  const previous = previousManifest();
  assert.deepEqual(await aggregate(REGISTRATION, previous, deps), previous);
  const result = await aggregate({ ...REGISTRATION, description: 'Updated description', tags: ['new'] }, previous, deps);
  assert.equal(result.description, 'Updated description');
  assert.deepEqual(result.tags, ['new']);
  assert.deepEqual(result.resources, previous.resources);
  assert.equal(deps.pullManifest.mock.callCount(), 0);
});

test('caches releases even when they have no compatibility fields', async () => {
  const deps = dependencies([release('v1')], async () => ({ version: 'v1', resources: [] }));
  const result = await aggregate(REGISTRATION, {}, deps);
  assert.deepEqual(result.compatibility, { v1: {} });
  assert.deepEqual(await aggregate(REGISTRATION, result, deps), result);
  assert.equal(deps.pullManifest.mock.callCount(), 1);
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
  assert.deepEqual(result.resources, manifest('v0').resources);
});

test('skips extensions without published releases', async () => {
  const deps = dependencies([]);
  assert.equal(await aggregate(REGISTRATION, previousManifest(), deps), null);
  assert.equal(deps.pullManifest.mock.callCount(), 0);
});

test('release tags matching JavaScript property names are stored and cached safely', async () => {
  const deps = dependencies([release('__proto__'), release('constructor')]);
  const result = await aggregate(REGISTRATION, {}, deps);
  assert.deepEqual(Object.keys(result.compatibility), ['__proto__', 'constructor']);
  assert.equal(Object.getPrototypeOf(result.compatibility), Object.prototype);
  assert.deepEqual(await aggregate(REGISTRATION, result, deps), result);
  assert.equal(deps.pullManifest.mock.callCount(), 2);
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
  deps.pullManifest = mock.fn(async (registry, tag) => {
    if (++calls === 2) throw new Error('manifest not published yet');
    return manifest(tag);
  });
  const summaryPath = join(directory, 'summary.md');
  assert.equal(await updateExtensions(extensions, output, { ...options, ...deps, summaryPath }), 1);
  assert.equal(await readFile(broken, 'utf8'), oldText);
  const healthy = join(output, 'b-healthy.yaml');
  assert.equal(parse(await readFile(healthy, 'utf8')).version, 'v3');
  assert.match(await readFile(summaryPath, 'utf8'), /updates\n\n- a-broken.yaml: Failed/);
  assert.match(options.error.mock.calls[0].arguments[0], /manifest not published yet/);
  const retry = dependencies([release('v3'), release('v2'), release('v1')]);
  assert.equal(await updateExtensions(extensions, output, { ...options, ...retry }), 0);
  assert.equal(parse(await readFile(broken, 'utf8')).version, 'v3');
  assert.equal(retry.pullManifest.mock.callCount(), 2);
});

test('an unchanged aggregate keeps its formatting and unrelated site files', async (t) => {
  const { directory, extensions, output, options } = await fixture(t);
  await writeFile(join(extensions, 'example.yaml'), stringify(REGISTRATION));
  const destination = join(output, 'example.yaml');
  const text = '# Keep formatting on an unchanged run\n' + stringify(previousManifest());
  await writeFile(destination, text);
  const timestamp = (await stat(destination)).mtimeMs;
  const unrelated = join(directory, 'index.html');
  await writeFile(unrelated, 'The hub');
  assert.equal(await updateExtensions(extensions, output, { ...options, ...dependencies([release('v1')]) }), 0);
  assert.equal(await readFile(destination, 'utf8'), text);
  assert.equal((await stat(destination)).mtimeMs, timestamp);
  assert.equal(await readFile(unrelated, 'utf8'), 'The hub');
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
