import { parse } from 'yaml';

export interface Extension {
  id: string;
  title: string;
  description: string;
  tags: string[];
  icon: string;
  repository: string;
  repositoryPath: string;
  owner: string;
  manifestRegistry?: string;
  manifest: string;
  manifestUrl: string;
}

interface RegistryEntry {
  name: string;
  description: string;
  repository: string;
  tags?: string[];
  manifestRegistry?: string;
}

const definitions = import.meta.glob<string>('../../../extensions/*.yaml', {
  eager: true, query: '?raw', import: 'default',
});
const definitionUrls = import.meta.glob<string>('../../../extensions/*.yaml', {
  eager: true, query: '?url', import: 'default',
});

export const EXTENSIONS: Extension[] = Object.entries(definitions).map(([path, manifest]) => {
  const entry: RegistryEntry = parse(manifest);
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
  return {
    id: path.split('/').at(-1)!.replace(/\.yaml$/, ''),
    title: entry.name,
    description: entry.description,
    tags: entry.tags?.length ? entry.tags : ['Other'],
    icon: `${import.meta.env.BASE_URL}logo.svg`,
    repository: 'https://github.com/' + repositoryPath,
    repositoryPath,
    owner: repositoryPath.split('/')[0],
    manifestRegistry: entry.manifestRegistry,
    manifest,
    manifestUrl: definitionUrls[path],
  };
});
