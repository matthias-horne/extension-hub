import { useState } from 'react';
import type { ExtensionArtifact } from '../data/extensions';
import { Icon } from './Icon';

const deploymentLabels = {
  extension: 'Extension',
  'admission-runtime': 'Admission (runtime cluster)',
  'admission-virtual': 'Admission (virtual cluster)',
};

function ArtifactCard({ artifact }: { artifact: ExtensionArtifact }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const label = deploymentLabels[artifact.deployment];

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(artifact.reference);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('unavailable');
    }
  }

  return (
    <li className="artifact-card">
      <div className="artifact-heading">
        <h2>{label}</h2>
        <span className="artifact-type">Helm chart</span>
      </div>
      <div className="artifact-reference">
        <code>{artifact.reference}</code>
        <button className="copy-manifest" onClick={copyReference} aria-label={'Copy OCI reference for ' + label}>
          <Icon name={copyStatus === 'copied' ? 'check' : 'copy'} />{copyStatus === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className={copyStatus === 'unavailable' ? 'artifact-copy-status' : 'sr-only'} role="status">
        {copyStatus === 'copied' ? label + ' OCI reference copied to clipboard.' : copyStatus === 'unavailable' ? 'Copy is unavailable. Select the reference above.' : ''}
      </p>
    </li>
  );
}

export function ExtensionArtifacts({ artifacts, manifestRegistry }: { artifacts: ExtensionArtifact[]; manifestRegistry?: string }) {
  return (
    <>
      <div className="details-panel-heading">
        <span><Icon name="package" />Extension artifacts</span>
      </div>
      <div className="details-artifacts">
        {manifestRegistry && <section className="artifact-registry">
          <h2>Manifest registry</h2>
          <code>{manifestRegistry}</code>
        </section>}
        <section className="artifact-charts">
          <h2>Helm charts ({artifacts.length})</h2>
          {artifacts.length > 0 ? (
            <>
              <p>Helm charts referenced in this extension.yaml.</p>
              <ul className="artifact-list">
                {artifacts.map((artifact) => <ArtifactCard key={artifact.deployment} artifact={artifact} />)}
              </ul>
            </>
          ) : <p>No Helm charts are referenced in this extension.yaml.</p>}
        </section>
      </div>
    </>
  );
}
