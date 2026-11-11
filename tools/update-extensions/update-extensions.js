import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs, promisify } from 'node:util';
import { parse, stringify } from 'yaml';

const executeFile = promisify(execFile);
export const COMPATIBILITY_FIELDS = ['builtWith', 'testedWith', 'supportedKubernetesVersions'];

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

export async function pullManifest(registry, tag, command = run) {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(tag)) {
    throw new Error('release tag ' + JSON.stringify(tag) + ' is not a valid OCI tag');
  }
  const reference = registry + ':' + tag;
  const descriptor = JSON.parse(await command('oras', 'manifest', 'fetch', reference));
  const layers = descriptor.layers ?? [];
  let candidates = layers.filter((layer) =>
    layer.annotations?.['org.opencontainers.image.title'] === 'manifest.yaml',
  );
  if (!candidates.length) {
    candidates = layers.filter((layer) =>
      ['application/yaml', 'application/x-yaml', 'text/yaml'].includes(layer.mediaType),
    );
  }
  if (candidates.length !== 1) {
    throw new Error(reference + ' must contain one extension manifest YAML layer');
  }
  const digest = candidates[0].digest;
  if (typeof digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error(reference + ' has an invalid YAML layer digest');
  }
  // Read the blob directly so filenames in the artifact never control local paths.
  const manifest = loadMapping(
    await command('oras', 'blob', 'fetch', registry + '@' + digest, '--output', '-'),
    reference,
  );
  validateManifest(manifest, tag);
  return manifest;
}

export function validateManifest(manifest, tag) {
  if (manifest.version !== tag) {
    throw new Error('manifest version must match release tag ' + JSON.stringify(tag));
  }
  if (!Array.isArray(manifest.resources) || manifest.resources.some((resource) =>
    !isMapping(resource) || ['kind', 'type'].some((field) =>
      typeof resource[field] !== 'string' || !resource[field],
    ),
  )) {
    throw new Error('manifest for ' + tag + ' requires resources with kind and type');
  }
  for (const field of ['builtWith', 'testedWith']) {
    if (Object.hasOwn(manifest, field) && !isMapping(manifest[field])) {
      throw new Error(field + ' in manifest for ' + tag + ' must be a mapping');
    }
  }
  if (Object.hasOwn(manifest, 'supportedKubernetesVersions') && !Array.isArray(manifest.supportedKubernetesVersions)) {
    throw new Error('supportedKubernetesVersions in manifest for ' + tag + ' must be a list');
  }
}

export async function aggregate(registration, previous, {
  listReleases: fetchReleases = listReleases,
  pullManifest: fetchManifest = pullManifest,
} = {}) {
  validateRegistration(registration);
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
  if (!releases.length) return null;
  const latest = releases[0].tag_name;
  let latestManifest;
  for (const release of releases) {
    const tag = release.tag_name;
    if (compatibility.has(tag) && !(tag === latest && previous.version !== latest)) continue;
    const manifest = await fetchManifest(registration.manifestRegistry, tag);
    compatibility.set(tag, Object.fromEntries(COMPATIBILITY_FIELDS
      .filter((field) => Object.hasOwn(manifest, field))
      .map((field) => [field, manifest[field]])));
    if (tag === latest) latestManifest = manifest;
  }
  const resources = latestManifest ? latestManifest.resources : previous.resources;
  if (!Array.isArray(resources)) throw new Error('existing aggregate requires a resources list');
  // Keep historical entries even if a release is subsequently removed on GitHub.
  const tags = new Set([...releases.map((release) => release.tag_name), ...compatibility.keys()]);
  return {
    ...registration,
    version: latest,
    resources,
    compatibility: Object.fromEntries([...tags].map((tag) => [tag, compatibility.get(tag)])),
  };
}

export async function writeManifest(destination, manifest, renameFile = rename) {
  const temporary = await mkdtemp(join(dirname(destination), '.manifest-'));
  try {
    const file = join(temporary, 'manifest.yaml');
    await writeFile(file, stringify(manifest), 'utf8');
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
      if (result === null) {
        status = 'No published releases; kept existing manifest';
      } else if (isDeepStrictEqual(result, previous)) {
        status = 'Already up to date';
      } else {
        // Publish only after every missing release for this extension succeeds.
        await writeManifest(destination, result);
        status = 'Updated to ' + result.version + ' (' + Object.keys(result.compatibility).length + ' releases)';
      }
      summary.push('- ' + name + ': ' + status);
    } catch (error) {
      failures.push(name);
      logError(name + ': ' + error.message);
      summary.push('- ' + name + ': Failed; kept existing manifest (see logs)');
    }
  }
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
