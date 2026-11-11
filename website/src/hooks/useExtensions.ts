import { useEffect, useState } from 'react';
import { loadExtensions, type Extension } from '../data/extensions';

type CatalogState =
  | { status: 'loading'; extensions: Extension[] }
  | { status: 'ready'; extensions: Extension[] }
  | { status: 'error'; extensions: Extension[] };

export function useExtensions() {
  const [state, setState] = useState<CatalogState>({ status: 'loading', extensions: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadExtensions(import.meta.env.VITE_EXTENSIONS_URL, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), siteBase: import.meta.env.BASE_URL,
    }).then((extensions) => {
      if (!controller.signal.aborted) setState({ status: 'ready', extensions });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error', extensions: [] });
    });
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ status: 'loading', extensions: [] });
    setAttempt((value) => value + 1);
  }

  return { ...state, retry };
}
