import { describe, expect, test } from 'bun:test';
import { highlightCode } from '../src/highlight';

describe('syntax highlighting', () => {
  test('highlights YAML with the github-light and github-dark themes', async () => {
    const html = await highlightCode('apiVersion: v1\n', 'yaml');
    expect(html).toContain('--shiki-light:#22863A');
    expect(html).toContain('--shiki-dark:#85E89D');
    expect(html).not.toContain('<pre');
  });

  test('resolves common code fence aliases', async () => {
    for (const language of ['sh', 'bash', 'shell', 'yml', 'py', 'dockerfile']) {
      expect(await highlightCode('echo hello', language)).toContain('--shiki-light');
    }
  });

  test('leaves unknown languages as plain text', async () => {
    expect(await highlightCode('hello', 'not-a-language')).toBeUndefined();
  });
});
