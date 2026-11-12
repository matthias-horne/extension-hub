import { useEffect, useRef } from 'react';

const GISCUS_ORIGIN = 'https://giscus.app';
const DEFAULT_REPO = 'matthias-horne/extension-hub';
const DEFAULT_REPO_ID = 'R_kgDOVqenPA';
const DEFAULT_CATEGORY = 'Compatibility';
const DEFAULT_CATEGORY_ID = 'DIC_kwDOVqenPM4DK_fH';

function giscusTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark_dimmed' : 'light';
}

export function GiscusComments({ term }: { term: string }) {
  const container = useRef<HTMLDivElement>(null);
  const repo = import.meta.env.VITE_GISCUS_REPO?.trim() || DEFAULT_REPO;
  const repoId = import.meta.env.VITE_GISCUS_REPO_ID?.trim() || DEFAULT_REPO_ID;
  const category = import.meta.env.VITE_GISCUS_CATEGORY?.trim() || DEFAULT_CATEGORY;
  const categoryId = import.meta.env.VITE_GISCUS_CATEGORY_ID?.trim() || DEFAULT_CATEGORY_ID;
  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    const script = document.createElement('script');
    script.src = GISCUS_ORIGIN + '/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-repo', repo);
    script.setAttribute('data-repo-id', repoId);
    script.setAttribute('data-category', category);
    script.setAttribute('data-category-id', categoryId);
    script.setAttribute('data-mapping', 'specific');
    script.setAttribute('data-term', term);
    script.setAttribute('data-strict', '1');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'top');
    script.setAttribute('data-theme', giscusTheme());
    script.setAttribute('data-lang', 'en');
    script.setAttribute('data-loading', 'lazy');
    element.append(script);

    function syncTheme() {
      const frame = element.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      if (!frame?.src.startsWith(GISCUS_ORIGIN)) return;
      try {
        // The lazy-loaded iframe starts on a same-origin about:blank document.
        if (frame.contentWindow?.location.href === 'about:blank') return;
      } catch {
        // Access throws once the cross-origin giscus document has loaded.
      }
      frame.contentWindow?.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, GISCUS_ORIGIN);
    }

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    element.addEventListener('load', syncTheme, true);
    return () => {
      observer.disconnect();
      element.removeEventListener('load', syncTheme, true);
      element.replaceChildren();
    };
  }, [category, categoryId, repo, repoId, term]);

  const headingId = 'discussion-' + term;
  return (
    <div className="extension-discussion" role="region" aria-labelledby={headingId}>
      <h2 className="section-title" id={headingId}>Add compatibility feedback for this extension</h2>
      <p className="panel-description">Have you encountered a compatibility problem? Ask the community below. </p>
      <p className="panel-description">When you want to contact the extension's maintainers directly raise an issue in the corresponding repository.</p>
      <div ref={container} className="giscus-comments" />
    </div>
  );
}
