import { useEffect, useState } from 'react';

interface GitHubRepository {
  stargazers_count: number;
  pushed_at?: string;
  language?: string | null;
  license?: { spdx_id: string; name: string } | null;
  owner: { login: string; avatar_url: string; html_url: string };
}

// Reuse requests when searching or filtering remounts a card.
const requests = new Map<string, Promise<GitHubRepository | null>>();

function getRepository(path: string) {
  let request = requests.get(path);
  if (!request) {
    request = fetch('https://api.github.com/repos/' + path, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000),
    }).then(async (response) => {
      if (!response.ok) return null;
      const data: GitHubRepository = await response.json();
      if (!Number.isFinite(data.stargazers_count) || data.stargazers_count < 0 ||
          typeof data.owner?.login !== 'string' || typeof data.owner?.avatar_url !== 'string' ||
          typeof data.owner?.html_url !== 'string') return null;
      return data;
    }).catch(() => null);
    requests.set(path, request);
  }
  return request;
}

export function useGitHubRepository(repository: string) {
  const [result, setResult] = useState<{ repository: string; data: GitHubRepository | null } | null>(null);
  useEffect(() => {
    let active = true;
    getRepository(repository).then((data) => {
      if (active) setResult({ repository, data });
    });
    return () => { active = false; };
  }, [repository]);

  const loaded = result?.repository === repository;
  return {
    data: loaded ? result.data : null,
    status: loaded ? result.data ? 'ready' : 'unavailable' : 'loading',
  };
}
