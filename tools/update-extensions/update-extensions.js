import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs, promisify } from 'node:util';
import { parse, stringify } from 'yaml';

const executeFile = promisify(execFile);
export const COMPATIBILITY_FIELDS = ['requires', 'supportedFeatures', 'builtWith', 'testedWith'];
export const EXTENSION_MEDIA_TYPE = 'application/gardener.extension+yaml';
export const COMPATIBILITY_MEDIA_TYPE = 'application/gardener.compatibility+yaml';

export async function run(command, ...args) {
  try {
    const { stdout } = await executeFile(command, args, {
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    throw new Error(command + ' failed: ' + (error.stderr?.trim() || error.message), { cause: error });
  }
}

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function loadMapping(text, source) {
  const data = parse(text);
  if (!isMapping(data)) {
    throw new Error(source + ' must contain a YAML mapping');
  }
  return data;
}

export function repositoryName(url) {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/$/, '').replace(/\.git$/, '');
  if (
    parsed.protocol !== 'https:' || parsed.host !== 'github.com' ||
    parsed.username || parsed.password || parsed.search || parsed.hash ||
    !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(path)
  ) {
    throw new Error('repository must be an HTTPS GitHub repository URL');
  }
  return path.slice(1);
}

export function validateRegistration(registration) {
  for (const field of ['name', 'description', 'repository', 'manifestRegistry']) {
    if (typeof registration[field] !== 'string' || !registration[field].trim()) {
      throw new Error('registration requires a non-empty ' + field);
    }
  }
  const tags = registration.tags ?? [];
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')) {
    throw new Error('tags must be a list of strings');
  }
  repositoryName(registration.repository);
  if (!/^[a-zA-Z0-9.-]+(?::[0-9]+)?\/[a-z0-9]+(?:[._/-][a-z0-9]+)*$/.test(registration.manifestRegistry)) {
    throw new Error('manifestRegistry must be an OCI repository without a scheme or tag');
  }
}

export async function listReleases(repository, command = run) {
  const pages = JSON.parse(await command(
    'gh', 'api', '--paginate', '--slurp',
    'repos/' + repositoryName(repository) + '/releases?per_page=100',
  ));
  // Include prereleases: the example extension currently publishes only these.
  return pages.flat().filter((release) => !release.draft).sort((a, b) =>
    b.published_at.localeCompare(a.published_at) || b.tag_name.localeCompare(a.tag_name),
  );
}

export async function listArtifactTags(registry, command = run) {
  const result = JSON.parse(await command('oras', 'repo', 'tags', registry, '--format', 'json'));
  if (!Array.isArray(result.tags) || result.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error(registry + ' returned an invalid tags list');
  }
  return result.tags;
}

function releaseReference(registry, tag) {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(tag)) {
    throw new Error('release tag ' + JSON.stringify(tag) + ' is not a valid OCI tag');
  }
  return registry + ':' + tag;
}

function validateDigest(digest, source) {
  if (typeof digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error(source + ' has an invalid digest');
  }
}

async function pullYaml(registry, reference, mediaType, command, subjectDigest) {
  const descriptor = JSON.parse(await command('oras', 'manifest', 'fetch', reference));
  if (descriptor.artifactType !== mediaType) {
    throw new Error(reference + ' must have artifact type ' + mediaType);
  }
  if (subjectDigest && descriptor.subject?.digest !== subjectDigest) {
    throw new Error(reference + ' must refer to extension digest ' + subjectDigest);
  }
  const candidates = (descriptor.layers ?? []).filter((layer) => layer.mediaType === mediaType);
  if (candidates.length !== 1) {
    throw new Error(reference + ' must contain one ' + mediaType + ' YAML layer');
  }
  const digest = candidates[0].digest;
  validateDigest(digest, reference);
  // Read the blob directly so filenames in the artifact never control local paths.
  return loadMapping(
    await command('oras', 'blob', 'fetch', registry + '@' + digest, '--output', '-'),
    reference,
  );
}

export async function pullManifest(registry, tag, command = run) {
  const reference = releaseReference(registry, tag);
  const manifest = await pullYaml(registry, reference, EXTENSION_MEDIA_TYPE, command);
  validateManifest(manifest, tag);
  return manifest;
}

export function validateManifest(manifest, tag) {
  if (manifest.apiVersion !== 'operator.gardener.cloud/v1alpha1' || manifest.kind !== 'Extension' ||
      typeof manifest.metadata?.name !== 'string' || !manifest.metadata.name) {
    throw new Error('manifest for ' + tag + ' must be a Gardener operator Extension resource');
  }
  if (!Array.isArray(manifest.spec?.resources) || manifest.spec.resources.some((resource) =>
    !isMapping(resource) || ['kind', 'type'].some((field) =>
      typeof resource[field] !== 'string' || !resource[field],
    ),
  )) {
    throw new Error('manifest for ' + tag + ' requires resources with kind and type');
  }
}

function helmReference(repository) {
  if (!isMapping(repository)) throw new Error('Helm ociRepository must be a mapping');
  let reference = repository.ref;
  if (reference == null) {
    const version = repository.digest ?? repository.tag;
    if (typeof repository.repository !== 'string' || typeof version !== 'string') {
      throw new Error('Helm ociRepository requires a repository and tag or digest');
    }
    reference = repository.repository + (repository.digest != null ? '@' : ':') + version;
  }
  if (typeof reference !== 'string') throw new Error('Helm ociRepository requires a reference');
  const normalized = reference.replace(/^oci:\/\//, '');
  if (!/^[a-zA-Z0-9.-]+(?::[0-9]+)?\/[a-z0-9]+(?:[._/-][a-z0-9]+)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[a-f0-9]{64})$/.test(normalized)) {
    throw new Error('Helm ociRepository requires an OCI reference with a tag or digest');
  }
  return 'oci://' + normalized;
}

export async function pullHelmValues(reference, command = run) {
  const values = parse(await command('helm', 'show', 'values', reference));
  // Helm charts may have an empty or comments-only values.yaml.
  if (values === null) return {};
  if (!isMapping(values)) throw new Error(reference + ' values must contain a YAML mapping');
  return values;
}

function mergeValues(defaults, overrides) {
  const values = new Map(Object.entries(defaults));
  for (const [key, value] of Object.entries(overrides)) {
    values.set(key, isMapping(value) && isMapping(values.get(key))
      ? mergeValues(values.get(key), value)
      : value);
  }
  return Object.fromEntries(values);
}

export async function integrateHelmValues(manifest, fetchValues = pullHelmValues) {
  const extension = structuredClone(manifest);
  const deployment = extension.spec?.deployment;
  const charts = [
    { chart: deployment?.admission?.runtimeCluster, target: deployment?.admission, fields: ['values'] },
    { chart: deployment?.extension, target: deployment?.extension, fields: ['values', 'runtimeClusterValues'] },
  ];
  const defaultsByReference = new Map();
  for (const { chart, target, fields } of charts) {
    if (chart?.helm?.ociRepository == null) continue;
    const reference = helmReference(chart.helm.ociRepository);
    if (!defaultsByReference.has(reference)) defaultsByReference.set(reference, await fetchValues(reference));
    const defaults = defaultsByReference.get(reference);
    if (!isMapping(defaults)) throw new Error(reference + ' values must contain a YAML mapping');
    for (const field of fields) {
      const overrides = target[field] ?? {};
      if (!isMapping(overrides)) throw new Error(field + ' must contain a YAML mapping');
      target[field] = structuredClone(mergeValues(defaults, overrides));
    }
  }
  return extension;
}

export function validateCompatibility(compatibility, source) {
  for (const field of ['requires', 'builtWith', 'testedWith']) {
    if (Object.hasOwn(compatibility, field) && !isMapping(compatibility[field])) {
      throw new Error(field + ' in ' + source + ' must be a mapping');
    }
  }
  if (Object.hasOwn(compatibility, 'supportedFeatures') &&
      (!Array.isArray(compatibility.supportedFeatures) || compatibility.supportedFeatures.some((feature) => typeof feature !== 'string'))) {
    throw new Error('supportedFeatures in ' + source + ' must be a list of strings');
  }
  if (compatibility.testedWith?.kubernetesVersions !== undefined &&
      !Array.isArray(compatibility.testedWith.kubernetesVersions)) {
    throw new Error('testedWith.kubernetesVersions in ' + source + ' must be a list');
  }
}

export async function pullCompatibility(registry, tag, command = run) {
  const reference = releaseReference(registry, tag);
  const discovery = JSON.parse(await command(
    'oras', 'discover', reference, '--distribution-spec', 'v1.1-referrers-tag',
    '--artifact-type', COMPATIBILITY_MEDIA_TYPE, '--format', 'json', '--depth', '1',
  ));
  validateDigest(discovery.digest, reference);
  if (!Array.isArray(discovery.referrers)) throw new Error(reference + ' has no referrers list');
  const referrers = discovery.referrers.filter((referrer) => referrer.artifactType === COMPATIBILITY_MEDIA_TYPE);
  for (const referrer of referrers) validateDigest(referrer.digest, reference);
  // Later attachments can add test results to compatibility published at build time.
  referrers.sort((a, b) =>
    (a.annotations?.['org.opencontainers.image.created'] ?? '').localeCompare(b.annotations?.['org.opencontainers.image.created'] ?? '') ||
    a.digest.localeCompare(b.digest),
  );
  const result = {};
  for (const referrer of referrers) {
    const source = registry + '@' + referrer.digest;
    const compatibility = await pullYaml(registry, source, COMPATIBILITY_MEDIA_TYPE, command, discovery.digest);
    validateCompatibility(compatibility, source);
    for (const field of COMPATIBILITY_FIELDS.filter((field) => Object.hasOwn(compatibility, field))) {
      result[field] = isMapping(compatibility[field])
        ? { ...result[field], ...compatibility[field] }
        : compatibility[field];
    }
  }
  return result;
}

export async function fetchGitHubInfo(repository, command = run) {
  const endpoint = 'repos/' + repositoryName(repository);
  const data = JSON.parse(await command('gh', 'api', endpoint));
  if (!Number.isFinite(data.stargazers_count) || data.stargazers_count < 0 ||
      typeof data.owner?.login !== 'string' || typeof data.owner?.avatar_url !== 'string' ||
      typeof data.owner?.html_url !== 'string') {
    throw new Error(endpoint + ' returned invalid repository information');
  }
  // A missing README is normal; other API failures must preserve the last aggregate.
  const response = await command('gh', 'api', '--include', endpoint + '/readme').catch((error) => {
    if (error.cause?.stdout && /^HTTP\/\S+ 404\b/.test(error.cause.stdout)) return error.cause.stdout;
    throw error;
  });
  const readmeResponse = response.match(/^HTTP\/\S+ (\d{3})[^\r\n]*[\s\S]*?\r?\n\r?\n([\s\S]*)$/);
  if (!readmeResponse || !['200', '404'].includes(readmeResponse[1])) {
    throw new Error(endpoint + '/readme returned an unexpected response');
  }
  let readme = null;
  if (readmeResponse[1] === '200') {
    const document = JSON.parse(readmeResponse[2]);
    if (document.encoding !== 'base64' || typeof document.content !== 'string' ||
        typeof document.path !== 'string' || typeof document.html_url !== 'string' ||
        typeof document.download_url !== 'string') {
      throw new Error(endpoint + '/readme returned invalid README information');
    }
    readme = {
      markdown: Buffer.from(document.content, 'base64').toString('utf8'),
      path: document.path, htmlUrl: document.html_url, rawUrl: document.download_url,
    };
  }
  return {
    stars: data.stargazers_count, lastCommit: data.pushed_at ?? null,
    language: data.language ?? null,
    license: data.license ? { name: data.license.name, spdxId: data.license.spdx_id } : null,
    owner: { login: data.owner.login, avatarUrl: data.owner.avatar_url, htmlUrl: data.owner.html_url },
    readme,
  };
}

export async function aggregate(registration, previous, {
  addedAt = new Date().toISOString(),
  listReleases: fetchReleases = listReleases,
  listArtifactTags: fetchTags = listArtifactTags,
  pullManifest: fetchManifest = pullManifest,
  pullHelmValues: fetchValues = pullHelmValues,
  pullCompatibility: fetchCompatibility = pullCompatibility,
  fetchGitHubInfo: fetchInfo = fetchGitHubInfo,
  warn = console.warn,
} = {}) {
  validateRegistration(registration);
  // Record the first successful discovery in the published aggregates.
  const firstAddedAt = previous.addedAt ?? addedAt;
  // A new repository/registry identity must not inherit another extension's history.
  if (['repository', 'manifestRegistry'].some((field) => previous[field] !== registration[field])) {
    previous = {};
  }
  const history = Object.hasOwn(previous, 'compatibility') ? previous.compatibility : {};
  if (!isMapping(history) || Object.values(history).some((details) => !isMapping(details))) {
    throw new Error('existing compatibility must map release tags to mappings');
  }
  const compatibility = new Map(Object.entries(history));
  const releases = await fetchReleases(registration.repository);
  const github = await fetchInfo(registration.repository);
  const latest = releases[0]?.tag_name;
  const artifactTags = new Set(latest ? await fetchTags(registration.manifestRegistry) : []);
  if (latest && !artifactTags.has(latest)) {
    throw new Error('latest release ' + latest + ' has no published extension artifact');
  }
  const extension = latest
    ? await integrateHelmValues(await fetchManifest(registration.manifestRegistry, latest), fetchValues)
    : previous.extension;
  for (const release of releases) {
    const tag = release.tag_name;
    if (!artifactTags.has(tag)) {
      if (!compatibility.has(tag)) compatibility.set(tag, {});
      warn(registration.name + ': retaining historical release ' + tag + ' without a published extension artifact');
      continue;
    }
    // Compatibility is mutable: discover attachments on every update, for every release.
    compatibility.set(tag, await fetchCompatibility(registration.manifestRegistry, tag));
  }
  // Keep historical entries even if a release is subsequently removed on GitHub.
  const tags = new Set([...releases.map((release) => release.tag_name), ...compatibility.keys()]);
  return {
    ...registration,
    addedAt: firstAddedAt,
    ...(extension ? { version: latest ?? previous.version, extension } : {}),
    github,
    compatibility: Object.fromEntries([...tags].map((tag) => [tag, compatibility.get(tag)])),
  };
}

export async function writeManifest(destination, manifest, renameFile = rename) {
  await writeAtomically(destination, stringify(manifest), renameFile);
}

async function writeAtomically(destination, text, renameFile = rename) {
  const temporary = await mkdtemp(join(dirname(destination), '.manifest-'));
  try {
    const file = join(temporary, 'manifest.yaml');
    await writeFile(file, text, 'utf8');
    await renameFile(file, destination);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function updateExtensions(extensionsDir, outputDir, {
  log = console.log,
  error: logError = console.error,
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
  ...dependencies
} = {}) {
  await mkdir(outputDir, { recursive: true });
  const registrations = (await readdir(extensionsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => entry.name).sort();
  if (!registrations.length) throw new Error('no extension registrations found in ' + extensionsDir);
  const failures = [];
  const summary = [];
  for (const name of registrations) {
    const source = join(extensionsDir, name);
    const destination = join(outputDir, name);
    try {
      const registration = loadMapping(await readFile(source, 'utf8'), source);
      let previous = {};
      try {
        previous = loadMapping(await readFile(destination, 'utf8'), destination);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const result = await aggregate(registration, previous, dependencies);
      let status;
      if (isDeepStrictEqual(result, previous)) {
        status = 'Already up to date';
      } else {
        // Publish only after all artifacts and repository information are read successfully.
        await writeManifest(destination, result);
        status = result.version
          ? 'Updated to ' + result.version + ' (' + Object.keys(result.compatibility).length + ' releases)'
          : 'Updated repository information; no published releases';
      }
      summary.push('- ' + name + ': ' + status);
    } catch (error) {
      failures.push(name);
      logError(name + ': ' + error.message);
      summary.push('- ' + name + ': Failed; kept existing manifest (see logs)');
    }
  }
  // Index only registered extensions that have an aggregate, including retained files
  // after a failed update. The browser discovers this list without a website build.
  const published = new Set((await readdir(outputDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile()).map((entry) => entry.name));
  const index = JSON.stringify(registrations.filter((name) => published.has(name)), null, 2) + '\n';
  const indexPath = join(outputDir, 'index.json');
  let existingIndex;
  try {
    existingIndex = await readFile(indexPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (index !== existingIndex) await writeAtomically(indexPath, index);
  log(summary.join('\n'));
  if (summaryPath) {
    await appendFile(summaryPath, '## Extension manifest updates\n\n' + summary.join('\n') + '\n', 'utf8');
  }
  return failures.length ? 1 : 0;
}

export async function main(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({ args, options: {
      'extensions-dir': { type: 'string', default: fileURLToPath(new URL('../../extensions/', import.meta.url)) },
      'output-dir': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    } });
    if (values.help) {
      console.log('Usage: node tools/update-extensions/update-extensions.js [--extensions-dir <path>] --output-dir <pages/extensions>');
      return 0;
    }
    if (!values['output-dir']) throw new Error('--output-dir is required');
    return await updateExtensions(values['extensions-dir'], values['output-dir']);
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
