import { useEffect, useRef, useState } from 'react';
import { ExtensionCard, type Extension } from './components/ExtensionCard';
import { Icon } from './components/Icon';
import './App.css';

const EXTENSIONS: Extension[] = [
  {
    title: 'Auto-Scaler Pro',
    description: 'Advanced automatic scaling for your Gardener workloads based on custom metrics and AI predictions.',
    category: 'Infrastructure',
    icon: '/highlights/extensible.svg',
  },
  {
    title: 'Security Guard',
    description: 'Real-time vulnerability scanning and policy enforcement for all your namespaces.',
    category: 'Security',
    icon: '/highlights/certified.svg',
  },
  {
    title: 'Cost Optimizer',
    description: 'Analyze your cluster spending and receive recommendations for right-sizing your nodes.',
    category: 'Management',
    icon: '/highlights/cloud-agnostic.svg',
  },
  {
    title: 'Log Aggregator',
    description: 'Centralized logging for your Gardener clusters, with dashboards and alerting.',
    category: 'Observability',
    icon: '/highlights/ubiqutious.svg',
  },
  {
    title: 'Backup Master',
    description: 'Automated snapshots and disaster recovery for your entire Gardener environment.',
    category: 'Infrastructure',
    icon: '/highlights/autonomous.svg',
  },
  {
    title: 'Identity Sync',
    description: 'Seamlessly synchronize your corporate identity provider with Gardener RBAC.',
    category: 'Security',
    icon: '/highlights/gardener.svg',
  },
];

const REPOSITORY_URL = 'https://github.com/matthias-horne/extension-hub';
const CATEGORIES = ['All', ...new Set(EXTENSIONS.map((extension) => extension.category))];
type SortOrder = 'default' | 'az' | 'za';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('gardener-theme') !== 'light';
    } catch {
      return true;
    }
  });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const matchingExtensions = EXTENSIONS.filter((extension) =>
    [extension.title, extension.description, extension.category]
      .join(' ').toLowerCase().includes(query.trim().toLowerCase()),
  );
  const visibleExtensions = matchingExtensions.filter((extension) =>
    category === 'All' || extension.category === category,
  );
  if (sortOrder !== 'default') {
    visibleExtensions.sort((a, b) =>
      sortOrder === 'az' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title),
    );
  }
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
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        detailDialog.current?.close();
        searchInput.current?.focus();
      }
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (selectedExtension) detailDialog.current?.showModal();
  }, [selectedExtension]);

  function clearFilters() {
    setQuery('');
    setCategory('All');
    searchInput.current?.focus();
  }

  return (
    <div className="site">
      <a className="skip-link" href="#extensions">Skip to extensions</a>
      <header className="site-header">
        <div className="content-width header-inner">
          <a className="brand" href="/" aria-label="Gardener Extensions Hub home">
            <img src="/logo.svg" alt="" width="28" height="28" />
            <span className="brand-project">Gardener</span>
            <span className="brand-divider" aria-hidden="true" />
            <span>Extensions Hub</span>
          </a>
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

      <main className="content-width catalog" id="extensions">
        <div className="catalog-heading">
          <h1>Extensions</h1>
          <p>{EXTENSIONS.length} community-built extensions for Gardener.</p>
        </div>

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
              <button className="clear-search" aria-label="Clear search" onClick={() => { setQuery(''); searchInput.current?.focus(); }}>
                <Icon name="close" />
              </button>
            )}
          </div>
          <div className="sort-field">
            <select aria-label="Sort extensions" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
              <option value="default">Default order</option>
              <option value="az">Name (A–Z)</option>
              <option value="za">Name (Z–A)</option>
            </select>
            <Icon name="chevron" />
          </div>
        </div>

        <div className="category-filters" role="group" aria-label="Filter by category">
          {CATEGORIES.map((item) => {
            const count = item === 'All'
              ? matchingExtensions.length
              : matchingExtensions.filter((extension) => extension.category === item).length;
            return (
              <button
                key={item}
                className="category-filter"
                aria-label={item}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}<span className="filter-count" aria-hidden="true">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="results-summary">
          <p role="status">{visibleExtensions.length} {visibleExtensions.length === 1 ? 'extension' : 'extensions'}{hasFilters ? ' of ' + EXTENSIONS.length : ''}</p>
          {hasFilters && <button className="clear-filters" onClick={clearFilters}>Clear filters</button>}
        </div>

        {visibleExtensions.length > 0 ? (
          <div className="extension-grid">
            {visibleExtensions.map((extension) => (
              <ExtensionCard key={extension.title} extension={extension} onSelect={setSelectedExtension} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="search" />
            <h2>No extensions found</h2>
            <p>Try another search or category.</p>
            <button className="button-secondary" onClick={clearFilters}>Reset search and filters</button>
          </div>
        )}
      </main>

      <footer className="site-footer content-width">
        <span>Gardener Extensions Hub</span>
        <a href={REPOSITORY_URL + '/issues/new'}>Contribute an extension <Icon name="arrow" /></a>
      </footer>

      <dialog ref={detailDialog} className="detail-dialog" aria-labelledby="extension-title" onClose={() => setSelectedExtension(null)}>
        {selectedExtension && (
          <>
            <div className="dialog-heading">
              <img src={selectedExtension.icon} alt="" width="48" height="48" />
              <button className="icon-button" aria-label="Close extension details" onClick={() => detailDialog.current?.close()}><Icon name="close" /></button>
            </div>
            <span className="detail-category">{selectedExtension.category}</span>
            <h2 id="extension-title">{selectedExtension.title}</h2>
            <p className="detail-description">{selectedExtension.description}</p>
            <a className="button-secondary" href="https://gardener.cloud/docs/gardener/extensions/" target="_blank" rel="noopener noreferrer">Gardener extension documentation <Icon name="arrow" /></a>
          </>
        )}
      </dialog>
    </div>
  );
}

export default App;
