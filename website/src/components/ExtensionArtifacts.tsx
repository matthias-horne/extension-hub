import { useEffect, useState } from 'react';
import type { ExtensionArtifact } from '../data/extensions';
import type { ExtensionImage } from '../data/images';
import { Icon } from './Icon';

const deploymentLabels = {
  extension: 'Extension',
  'admission-runtime': 'Admission (runtime cluster)',
  'admission-virtual': 'Admission (virtual cluster)',
};

const imageDeploymentLabels = {
  extension: 'Extension (seed clusters)',
  'extension-runtime': 'Extension (runtime cluster)',
  admission: 'Admission (runtime and virtual clusters)',
};

function ArtifactCard({ label, reference, type }: { label: string; reference: string; type: 'Helm chart' | 'Container image' }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const referenceLabel = type === 'Helm chart' ? 'OCI reference' : 'image reference';

  useEffect(() => {
    if (copyStatus !== 'copied') return;
    const timer = setTimeout(() => setCopyStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('unavailable');
    }
  }

  return (
    <li className="artifact-card">
      <div className="artifact-heading">
        <h3>{label}</h3>
      </div>
      <div className="artifact-reference">
        <code>{reference}</code>
        <button className="copy-manifest" onClick={copyReference} aria-label={'Copy ' + referenceLabel + ' for ' + label}>
          <Icon name={copyStatus === 'copied' ? 'check' : 'copy'} />{copyStatus === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className={copyStatus === 'unavailable' ? 'artifact-copy-status' : 'sr-only'} role="status">
        {copyStatus === 'copied' ? label + ' ' + referenceLabel + ' copied to clipboard.' : copyStatus === 'unavailable' ? 'Copy is unavailable. Select the reference above.' : ''}
      </p>
    </li>
  );
}

export function ExtensionArtifacts({ artifacts, images = [], manifestRegistry }: { artifacts: ExtensionArtifact[]; images?: ExtensionImage[]; manifestRegistry?: string }) {
  const [registryCopyStatus, setRegistryCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');

  useEffect(() => {
    if (registryCopyStatus !== 'copied') return;
    const timer = setTimeout(() => setRegistryCopyStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [registryCopyStatus]);

  async function copyRegistry() {
    if (!manifestRegistry) return;
    try {
      await navigator.clipboard.writeText(manifestRegistry);
      setRegistryCopyStatus('copied');
    } catch {
      setRegistryCopyStatus('unavailable');
    }
  }

  return (
    <>
      <div className="details-panel-heading">
        <span><Icon name="package" />Extension artifacts</span>
      </div>
      <div className="details-artifacts">
        {manifestRegistry && <section className="artifact-registry">
          <h2>Manifest registry</h2>
          <div className="artifact-card">
            <div className="artifact-reference">
              <code>{manifestRegistry}</code>
              <button className="copy-manifest" onClick={copyRegistry} aria-label="Copy manifest registry">
                <Icon name={registryCopyStatus === 'copied' ? 'check' : 'copy'} />{registryCopyStatus === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className={registryCopyStatus === 'unavailable' ? 'artifact-copy-status' : 'sr-only'} role="status">
              {registryCopyStatus === 'copied' ? 'Manifest registry copied to clipboard.' : registryCopyStatus === 'unavailable' ? 'Copy is unavailable. Select the registry above.' : ''}
            </p>
          </div>
        </section>}
        <section className="artifact-section">
          <h2>Helm charts</h2>
          {artifacts.length > 0 ? (
            <>
              <ul className="artifact-list">
                {artifacts.map((artifact) => <ArtifactCard key={artifact.deployment} label={deploymentLabels[artifact.deployment]} reference={artifact.reference} type="Helm chart" />)}
              </ul>
            </>
          ) : <p>No Helm charts are referenced in this extension.yaml.</p>}
        </section>
        <section className="artifact-section">
          <h2>Container images</h2>
          {images.length > 0 ? (
            <>
              <ul className="artifact-list">
                {images.map((image) => <ArtifactCard key={image.reference} label={image.deployments.map((deployment) => imageDeploymentLabels[deployment]).join(', ')} reference={image.reference} type="Container image" />)}
              </ul>
            </>
          ) : <p>No container images are configured in this extension's Helm values.</p>}
        </section>
      </div>
    </>
  );
}
