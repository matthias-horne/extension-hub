import { parseDocument } from 'yaml';

const helmValuesPaths = [
  ['spec', 'deployment', 'admission', 'values'],
  ['spec', 'deployment', 'extension', 'values'],
  ['spec', 'deployment', 'extension', 'runtimeClusterValues'],
];

export function withoutHelmValues(manifest: string): string {
  const document = parseDocument(manifest);
  if (document.errors.length) return manifest;

  let removed = false;
  for (const path of helmValuesPaths) {
    if (document.hasIn(path)) {
      document.deleteIn(path);
      removed = true;
    }
  }
  return removed ? document.toString() : manifest;
}
