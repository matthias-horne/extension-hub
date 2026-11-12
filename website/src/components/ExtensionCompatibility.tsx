import { useSearchParams } from 'react-router-dom';
import type { ApiCompatibilityInfo, CompatibilityInfo } from '../data/extensions';
import { Icon } from './Icon';
import { Dropdown } from './Dropdown';
import { MissingInformation } from './MissingInformation';

function CompatibilityValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return <ul className="compatibility-list">{value.map((item, index) => <li key={index}><CompatibilityValue value={item} /></li>)}</ul>;
  }
  if (value !== null && typeof value === 'object') {
    return <CompatibilityValues values={value as Record<string, unknown>} />;
  }
  return <span className="compatibility-value">{value == null ? '—' : String(value)}</span>;
}

function CompatibilityValues({ values }: { values: Record<string, unknown> }) {
  return (
    <dl className="compatibility-values">
      {Object.entries(values).map(([name, value]) => (
        <div key={name}>
          <dt>{name === 'kubernetesVersions' ? 'Kubernetes versions' : name}</dt>
          <dd><CompatibilityValue value={value} /></dd>
        </div>
      ))}
    </dl>
  );
}

function apiVersion(version: string, kubernetes: boolean) {
  // Kubernetes Go modules use 0.x.y for Kubernetes releases 1.x.y.
  return kubernetes ? version.replace(/^v?0\./, '1.') : version;
}

export function ExtensionCompatibility({ compatibility, apiCompatibility, version }: {
  compatibility?: Record<string, CompatibilityInfo>;
  apiCompatibility?: Record<string, ApiCompatibilityInfo>;
  version?: string;
}) {
  const history = compatibility ?? {};
  const apiHistory = apiCompatibility ?? {};
  const versions = [...new Set([...(version ? [version] : []), ...Object.keys(history), ...Object.keys(apiHistory)])];
  const [searchParams, setSearchParams] = useSearchParams();
  const selection = searchParams.get('version') ?? '';
  const selectedVersion = versions.includes(selection) ? selection : versions[0];
  const information = selectedVersion && Object.hasOwn(history, selectedVersion) ? history[selectedVersion] : undefined;
  const apiInformation = selectedVersion && Object.hasOwn(apiHistory, selectedVersion) ? apiHistory[selectedVersion] : undefined;
  const apiRanges = [
    { name: 'Gardener', range: apiInformation?.gardener, kubernetes: false },
    { name: 'Kubernetes', range: apiInformation?.kubernetes, kubernetes: true },
  ].flatMap(({ name, range, kubernetes }) => range ? [{ name, range, kubernetes }] : []);
  const apiChanges = apiRanges.flatMap(({ name, range }) => [
    ...(range.breaking_on_lower ?? []).map((change) => ({ label: name + ', below range', change })),
    ...(range.breaking_on_higher ?? []).map((change) => ({ label: name + ', above range', change })),
  ]);
  const groups = [
    { title: 'Requirements', values: information?.requires },
    { title: 'Built with', values: information?.builtWith },
    { title: 'Tested with', values: information?.testedWith },
  ];
  const features = information?.supportedFeatures ?? [];
  const hasInformation = apiRanges.length > 0 || features.length > 0 || groups.some(({ values }) => values && Object.keys(values).length > 0);

  function setSelection(value: string) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('version', value);
      return next;
    });
  }

  return (
    <>
      <div className="details-panel-heading">
        <span><Icon name="check" />Version compatibility</span>
        {selectedVersion && (
          <Dropdown className="version-dropdown" label="Version" listLabel="Versions" value={selectedVersion} onChange={setSelection}
            options={versions.map((tag) => ({ value: tag, label: tag, badge: tag === version ? 'Current' : undefined }))} />
        )}
      </div>
      <div className="panel-body details-compatibility">
        <p className="panel-description">{selectedVersion ? <>Compatibility information for version <strong>{selectedVersion}</strong>.</> : 'No version has been published for this extension.'}</p>
        {hasInformation ? (
          <>
            {groups.map(({ title, values }) => values && Object.keys(values).length > 0 && (
              <section className="content-section" key={title}>
                <h2 className="section-title">{title}</h2>
                <CompatibilityValues values={values} />
              </section>
            ))}
            {apiRanges.length > 0 && (
              <section className="content-section api-compatibility">
                <h2 className="section-title">API compatibility</h2>
                <dl className="compatibility-values">
                  {apiRanges.map(({ name, range, kubernetes }) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>
                        <span className="compatibility-value">
                          {apiVersion(range.from, kubernetes)}
                          {range.from !== range.to && <> – {apiVersion(range.to, kubernetes)}</>}
                        </span>
                        <small className="api-compatibility-reference">Reference version: {apiVersion(range.version, kubernetes)}</small>
                      </dd>
                    </div>
                  ))}
                </dl>
                {apiChanges.length > 0 && (
                  <details className="api-compatibility-changes">
                    <summary>API changes at range boundaries</summary>
                    <ul>{apiChanges.map(({ label, change }, index) => (
                      <li key={index}><strong>{label}:</strong> {change}</li>
                    ))}</ul>
                  </details>
                )}
                <p className="api-compatibility-disclaimer" role="note">API compatibility does not guarantee full functionality.</p>
              </section>
            )}
            {features.length > 0 && (
              <section className="content-section">
                <h2 className="section-title">Supported features</h2>
                <ul className="compatibility-features">{features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              </section>
            )}
          </>
        ) : (
          <MissingInformation title="Compatibility information unavailable" maintainerGuidance>
            {selectedVersion ? 'No compatibility information has been published for this version.' : 'No compatibility information has been published for this extension.'}
          </MissingInformation>
        )}
      </div>
    </>
  );
}
