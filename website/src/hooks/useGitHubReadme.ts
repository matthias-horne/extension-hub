import { useEffect, useState } from 'react';

interface GitHubReadme {
  markdown: string;
  path: string;
  htmlUrl: string;
  rawUrl: string;
}

type ReadmeResult =
  | { status: 'ready'; data: GitHubReadme }
  | { status: 'missing' | 'unavailable'; data: null };

const requests = new Map<string, Promise<ReadmeResult>>();

function getReadme(repository: string) {
  let request = requests.get(repository);
  if (!request) {
    request = fetch('https://api.github.com/repos/' + repository + '/readme', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000),
    }).then(async (response): Promise<ReadmeResult> => {
      if (!response.ok) return { status: response.status === 404 ? 'missing' : 'unavailable', data: null };
      const data = await response.json();
      if (data.encoding !== 'base64' || typeof data.content !== 'string' ||
          typeof data.path !== 'string' || typeof data.html_url !== 'string' ||
          typeof data.download_url !== 'string') return { status: 'unavailable', data: null };
      const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), (character) => character.charCodeAt(0));
      return {
        status: 'ready',
        data: {
          markdown: new TextDecoder().decode(bytes),
          path: data.path,
          htmlUrl: data.html_url,
          rawUrl: data.download_url,
        },
      };
    }).catch((): ReadmeResult => ({ status: 'unavailable', data: null }));
    requests.set(repository, request);
  }
  return request;
}

export function useGitHubReadme(repository: string) {
  const [result, setResult] = useState<{ repository: string; readme: ReadmeResult } | null>(null);

  useEffect(() => {
    let active = true;
    getReadme(repository).then((readme) => {
      if (active) setResult({ repository, readme });
    });
    return () => { active = false; };
  }, [repository]);

  return result?.repository === repository
    ? result.readme
    : { status: 'loading' as const, data: null };
}
