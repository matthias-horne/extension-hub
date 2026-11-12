import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { ExtensionCard } from './components/ExtensionCard';
import { Dropdown } from './components/Dropdown';
import { SORT_OPTIONS, sortExtensions, type SortOrder } from './data/sorting';
import { useExtensions } from './hooks/useExtensions';
import { Icon } from './components/Icon';
import './App.css';

const REPOSITORY_URL = 'https://github.com/matthias-horne/extension-hub';
const TAG_DESCRIPTIONS: Record<string, string> = {
  All: 'All extensions',
  Infrastructure: 'Infrastructure providers',
  DNS: 'DNS providers and services',
  OS: 'Operating systems',
  Runtime: 'Container runtimes',
  Network: 'Networking, ingress, and traffic routing',
  Security: 'Authentication, certificates, and protection',
  Observability: 'Auditing, logging, and diagnostics',
  Images: 'Image rewriting, caching, and verification',
  Storage: 'Persistent volumes and backups',
  GitOps: 'Workload management with Flux',
  Example: 'Demonstration extensions',
};
const ExtensionDetails = lazy(() => import('./components/ExtensionDetails'));

function App() {
  const { extensions, status, retry } = useExtensions();
  const categories = ['All', ...new Set(extensions.flatMap((extension) => extension.tags))];
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const route = useMatch('/extensions/:id');
  const extension = route ? extensions.find((item) => item.id === route.params.id) : undefined;
  const isCatalog = pathname === '/';
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('gardener-theme') !== 'light';
    } catch {
      return true;
    }
  });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('popular');
  const searchInput = useRef<HTMLInputElement>(null);
  const catalogScroll = useRef(0);
  const initialNavigation = useRef(true);
  const focusSearchOnNavigation = useRef(false);
  const matchingExtensions = extensions.filter((extension) =>
    [extension.title, extension.description, extension.owner, extension.repositoryPath, ...extension.tags]
      .join(' ').toLowerCase().includes(query.trim().toLowerCase()),
  );
  const visibleExtensions = sortExtensions(matchingExtensions.filter((extension) =>
    category === 'All' || extension.tags.includes(category),
  ), sortOrder);
  const hasFilters = query !== '' || category !== 'All';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('gardener-theme', darkMode ? 'dark' : 'light');
    } catch {
      // The theme also works when browser storage is unavailable.
    }
  }, [darkMode]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    document.title = extension
      ? extension.title + ' | Gardener Extensions Hub'
      : isCatalog || status !== 'ready' ? 'Gardener Extensions Hub' : 'Extension not found | Gardener Extensions Hub';
  }, [extension, isCatalog, status]);

  useLayoutEffect(() => {
    if (initialNavigation.current) {
      initialNavigation.current = false;
    } else {
      window.scrollTo({ top: pathname === '/' ? catalogScroll.current : 0, behavior: 'instant' });
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }
    if (pathname === '/' && focusSearchOnNavigation.current) {
      searchInput.current?.focus();
      focusSearchOnNavigation.current = false;
    }
    return () => {
      if (pathname === '/') catalogScroll.current = window.scrollY;
    };
  }, [pathname]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusSearchOnNavigation.current = searchInput.current === null;
        searchInput.current?.focus();
        if (pathname !== '/') navigate('/');
      }
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [navigate, pathname]);

  function clearFilters() {
    setQuery('');
    setCategory('All');
    searchInput.current?.focus();
  }

  return (
    <div className="site">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById('main-content')?.focus();
      }}>Skip to content</a>
      <header className="site-header">
        <div className="content-width header-inner">
          <Link className="brand" to="/" aria-label="Gardener Extensions Hub home">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width="28" height="28" />
            <span className="brand-project">Gardener</span>
            <span className="brand-divider" aria-hidden="true" />
            <span>Extensions Hub</span>
          </Link>
          <div className="header-tools">
            <a className="repository-link" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label="Extension Hub on GitHub">
              <Icon name="github" /><span>GitHub</span>
            </a>
            <button
              className="theme-switch"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-pressed={darkMode}
            >
              <span className="theme-switch-thumb"><Icon name={darkMode ? 'moon' : 'sun'} /></span>
            </button>
          </div>
        </div>
      </header>

      {status === 'loading' ? (
        <main className="content-width catalog" id="main-content" tabIndex={-1}>
          <p role="status">Loading extensions…</p>
        </main>
      ) : status === 'error' ? (
        <main className="content-width catalog" id="main-content" tabIndex={-1}>
          <div className="empty-state" role="alert">
            <h1>Extensions could not be loaded</h1>
            <p>Please try again.</p>
            <button className="button" onClick={retry}>Retry</button>
          </div>
        </main>
      ) : extension ? (
        <Suspense fallback={<main className="content-width extension-details" id="main-content" tabIndex={-1}><p role="status">Loading extension…</p></main>}>
          <ExtensionDetails key={extension.id} extension={extension} onCategory={(tag) => { setQuery(''); setCategory(tag); }} />
        </Suspense>
      ) : isCatalog ? (
        <main className="content-width catalog" id="main-content" tabIndex={-1}>
          <div className="catalog-toolbar">
            <div className="search-field">
              <Icon name="search" />
              <input
                ref={searchInput}
                type="search"
                aria-label="Search extensions"
                placeholder="Search extensions…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button className="button button-icon clear-search" aria-label="Clear search" onClick={() => { setQuery(''); searchInput.current?.focus(); }}>
                  <Icon name="close" />
                </button>
              )}
            </div>
            <Dropdown className="sort-field" label="Sort extensions" listLabel="Sort order" options={SORT_OPTIONS} value={sortOrder} onChange={setSortOrder} />
          </div>

          <div className="category-filters" role="group" aria-label="Filter by category">
            {categories.map((item) => {
              const count = item === 'All'
                ? matchingExtensions.length
                : matchingExtensions.filter((extension) => extension.tags.includes(item)).length;
              return (
                <button
                  key={item}
                  className="category-filter"
                  aria-label={item}
                  title={TAG_DESCRIPTIONS[item]}
                  aria-description={TAG_DESCRIPTIONS[item]}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}<span className="filter-count" aria-hidden="true">{count}</span>
                </button>
              );
            })}
            {hasFilters && <button className="clear-filters" onClick={clearFilters}>Clear filters</button>}
          </div>

          {visibleExtensions.length > 0 ? (
            <div className="extension-grid">
              {visibleExtensions.map((extension) => (
                <ExtensionCard key={extension.id} extension={extension} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Icon name="search" />
              <h2>No extensions found</h2>
              <p>Try another search or category.</p>
              <button className="button" onClick={clearFilters}>Reset search and filters</button>
            </div>
          )}
        </main>
      ) : (
        <main className="content-width catalog" id="main-content" tabIndex={-1}>
          <Link className="back-link" to="/"><Icon name="back" />All extensions</Link>
          <div className="empty-state">
            <Icon name="search" />
            <h1>Extension not found</h1>
            <p>This extension is not registered in the hub.</p>
            <Link className="button" to="/">Browse extensions<Icon name="arrow" /></Link>
          </div>
        </main>
      )}

      <footer className="site-footer content-width">
        <span>Gardener Extensions Hub</span>
        <a href={REPOSITORY_URL + '/issues/new?template=1-Register.yml'}>Contribute an extension <Icon name="arrow" /></a>
      </footer>

    </div>
  );
}

export default App;
