import { parse, stringify } from 'yaml';
import { extensionImages, type ExtensionImage } from './images';

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

export interface ExtensionArtifact {
  type: 'helm-chart';
  deployment: 'extension' | 'admission-runtime' | 'admission-virtual';
  reference: string;
}

interface OCIRepository {
  ref?: string;
  repository?: string;
  tag?: string;
  digest?: string;
}

interface HelmDeployment {
  helm?: { ociRepository?: OCIRepository };
  values?: unknown;
  runtimeClusterValues?: unknown;
}

interface ExtensionManifest {
  apiVersion: string;
  kind: string;
  metadata: { name: string };
  spec?: {
    deployment?: {
      extension?: HelmDeployment;
      admission?: { runtimeCluster?: HelmDeployment; virtualCluster?: HelmDeployment; values?: unknown };
    };
  };
}

export interface Extension {
  id: string;
  title: string;
  version?: string;
  addedAt?: string;
  description: string;
  tags: string[];
  icon: string;
  repository: string;
  repositoryPath: string;
  owner: string;
  manifestRegistry?: string;
  manifest: string;
  manifestUrl: string;
  artifacts: ExtensionArtifact[];
  images: ExtensionImage[];
  github?: GitHubInfo;
  compatibility?: Record<string, CompatibilityInfo>;
}

interface RegistryEntry {
  name: string;
  version?: string;
  addedAt?: string;
  description: string;
  repository: string;
  tags?: string[];
  manifestRegistry?: string;
  extension?: ExtensionManifest;
  github?: GitHubInfo;
  compatibility?: Record<string, CompatibilityInfo>;
}

export const DEFAULT_EXTENSIONS_URL = 'https://raw.githubusercontent.com/matthias-horne/extension-hub/pages/extensions/';

function helmReference(repository?: OCIRepository): string | undefined {
  if (typeof repository?.ref === 'string' && repository.ref.trim()) return repository.ref;
  if (typeof repository?.repository !== 'string' || !repository.repository.trim()) return undefined;
  // Gardener gives a full reference precedence over repository fields, and a digest precedence over a tag.
  if (typeof repository.digest === 'string' && repository.digest.trim()) return repository.repository + '@' + repository.digest;
  if (typeof repository.tag === 'string' && repository.tag.trim()) return repository.repository + ':' + repository.tag;
  return undefined;
}

function extensionArtifacts(manifest?: ExtensionManifest): ExtensionArtifact[] {
  const deployment = manifest?.spec?.deployment;
  const charts: { deployment: ExtensionArtifact['deployment']; chart?: HelmDeployment }[] = [
    { deployment: 'extension', chart: deployment?.extension },
    { deployment: 'admission-runtime', chart: deployment?.admission?.runtimeCluster },
    { deployment: 'admission-virtual', chart: deployment?.admission?.virtualCluster },
  ];
  return charts.flatMap(({ deployment, chart }) => {
    const reference = helmReference(chart?.helm?.ociRepository);
    return reference ? [{ type: 'helm-chart' as const, deployment, reference }] : [];
  });
}

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
  if (entry.addedAt !== undefined && (typeof entry.addedAt !== 'string' || !Number.isFinite(Date.parse(entry.addedAt)))) {
    throw new Error('Expected an addedAt date string in ' + path);
  }
  const manifest = entry.extension ? stringify(entry.extension) : definition;
  return {
    id: path.split('/').at(-1)!.replace(/\.ya?ml$/, ''),
    title: entry.name,
    version: entry.version,
    addedAt: entry.addedAt,
    description: entry.description,
    tags: entry.tags?.length ? entry.tags : ['Other'],
    icon: `${siteBase}logo.svg`,
    repository: 'https://github.com/' + repositoryPath,
    repositoryPath,
    owner: repositoryPath.split('/')[0],
    manifestRegistry: entry.manifestRegistry,
    manifest,
    manifestUrl: 'data:application/yaml;charset=utf-8,' + encodeURIComponent(manifest),
    artifacts: extensionArtifacts(entry.extension),
    images: extensionImages([
      { deployment: 'extension', values: entry.extension?.spec?.deployment?.extension?.values },
      { deployment: 'extension-runtime', values: entry.extension?.spec?.deployment?.extension?.runtimeClusterValues },
      { deployment: 'admission', values: entry.extension?.spec?.deployment?.admission?.values },
    ]),
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
