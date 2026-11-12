import { useSearchParams } from 'react-router-dom';
import type { CompatibilityInfo } from '../data/extensions';
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
  return <code>{value == null ? '—' : String(value)}</code>;
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

export function ExtensionCompatibility({ compatibility, version }: {
  compatibility?: Record<string, CompatibilityInfo>;
  version?: string;
}) {
  const history = compatibility ?? {};
  const versions = [...new Set([...(version ? [version] : []), ...Object.keys(history)])];
  const [searchParams, setSearchParams] = useSearchParams();
  const selection = searchParams.get('version') ?? '';
  const selectedVersion = versions.includes(selection) ? selection : versions[0];
  const information = selectedVersion && Object.hasOwn(history, selectedVersion) ? history[selectedVersion] : undefined;
  const groups = [
    { title: 'Requirements', values: information?.requires },
    { title: 'Built with', values: information?.builtWith },
    { title: 'Tested with', values: information?.testedWith },
  ];
  const features = information?.supportedFeatures ?? [];
  const hasInformation = features.length > 0 || groups.some(({ values }) => values && Object.keys(values).length > 0);

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
