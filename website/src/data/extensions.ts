import { parse, stringify } from 'yaml';

interface GitHubInfo {
  stars: number;
  lastCommit: string | null;
  language: string | null;
  license: { spdxId: string; name: string } | null;
  owner: { login: string; avatarUrl: string; htmlUrl: string };
  readme: { markdown: string; path: string; htmlUrl: string; rawUrl: string } | null;
}

export interface CompatibilityInfo {
  requires?: Record<string, unknown>;
  supportedFeatures?: string[];
  builtWith?: Record<string, unknown>;
  testedWith?: Record<string, unknown>;
}

export interface Extension {
  id: string;
  title: string;
  version?: string;
  description: string;
  tags: string[];
  icon: string;
  repository: string;
  repositoryPath: string;
  owner: string;
  manifestRegistry?: string;
  manifest: string;
  manifestUrl: string;
  github?: GitHubInfo;
  compatibility?: Record<string, CompatibilityInfo>;
}

interface RegistryEntry {
  name: string;
  version?: string;
  description: string;
  repository: string;
  tags?: string[];
  manifestRegistry?: string;
  extension?: { apiVersion: string; kind: string; metadata: { name: string }; spec: object };
  github?: GitHubInfo;
  compatibility?: Record<string, CompatibilityInfo>;
}

export const DEFAULT_EXTENSIONS_URL = 'https://raw.githubusercontent.com/matthias-horne/extension-hub/pages/extensions/';

export function parseExtension(definition: string, path: string, siteBase = '/'): Extension {
  const entry: RegistryEntry = parse(definition);
  if (!entry || typeof entry.name !== 'string' || typeof entry.description !== 'string' || typeof entry.repository !== 'string') {
    throw new Error('Missing extension name, description, or repository in ' + path);
  }
  const repository = new URL(entry.repository);
  const repositoryPath = repository.pathname.replace(/^\/|\/$/g, '').replace(/\.git$/, '');
  if (repository.protocol !== 'https:' || repository.hostname !== 'github.com' || !/^[\w.-]+\/[\w.-]+$/.test(repositoryPath)) {
    throw new Error('Expected a GitHub repository URL in ' + path);
  }
  if (entry.tags && (!Array.isArray(entry.tags) || entry.tags.some((tag) => typeof tag !== 'string'))) {
    throw new Error('Expected a list of tags in ' + path);
  }
  if (entry.manifestRegistry !== undefined && typeof entry.manifestRegistry !== 'string') {
    throw new Error('Expected a manifest registry string in ' + path);
  }
  if (entry.version !== undefined && (typeof entry.version !== 'string' || !entry.version.trim())) {
    throw new Error('Expected a non-empty version string in ' + path);
  }
  const manifest = entry.extension ? stringify(entry.extension) : definition;
  return {
    id: path.split('/').at(-1)!.replace(/\.ya?ml$/, ''),
    title: entry.name,
    version: entry.version,
    description: entry.description,
    tags: entry.tags?.length ? entry.tags : ['Other'],
    icon: `${siteBase}logo.svg`,
    repository: 'https://github.com/' + repositoryPath,
    repositoryPath,
    owner: repositoryPath.split('/')[0],
    manifestRegistry: entry.manifestRegistry,
    manifest,
    manifestUrl: 'data:application/yaml;charset=utf-8,' + encodeURIComponent(manifest),
    github: entry.github,
    compatibility: entry.compatibility,
  };
}

export async function loadExtensions(baseUrl = DEFAULT_EXTENSIONS_URL, {
  signal, fetcher = fetch, siteBase = '/',
}: { signal?: AbortSignal; fetcher?: typeof fetch; siteBase?: string } = {}): Promise<Extension[]> {
  const directory = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  async function getFile(name: string) {
    const response = await fetcher(directory + encodeURIComponent(name), { cache: 'no-cache', signal });
    if (!response.ok) throw new Error('Could not load extension data (HTTP ' + response.status + ').');
    return response;
  }
  const filenames: unknown = await (await getFile('index.json')).json();
  if (!Array.isArray(filenames) || filenames.some((name) =>
    typeof name !== 'string' || !/\.ya?ml$/.test(name) || /[/\\]/.test(name),
  ) || new Set(filenames).size !== filenames.length) {
    throw new Error('The extension catalog index is invalid.');
  }
  return Promise.all(filenames.map(async (name: string) =>
    parseExtension(await (await getFile(name)).text(), name, siteBase),
  ));
}
