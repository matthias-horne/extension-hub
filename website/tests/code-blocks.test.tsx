import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import { MarkdownCodeBlock } from '../src/components/CodeBlock';

function renderMarkdown(source: string) {
  return renderToStaticMarkup(<Markdown skipHtml components={{ pre: MarkdownCodeBlock }}>{source}</Markdown>);
}

function codeText(markup: string) {
  const code = markup.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/)?.[1];
  return code?.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
}

describe('code blocks', () => {
  test('highlights YAML and its alias case-insensitively', () => {
    const code = '\nenabled: true\nreplicas: 2\n\n';
    for (const language of ['yaml', 'yml', 'YAML']) {
      const markup = renderMarkdown('```' + language + '\n' + code + '```');
      expect(markup).toContain('<span class="hljs-attr">enabled:</span>');
      expect(codeText(markup)).toBe(code);
    }
  });

  test('escapes HTML-like source even in highlighted code', () => {
    const code = 'html: "<img src=x onerror=alert(1)> & <script>alert(1)</script>"\n';
    const markup = renderMarkdown('```yaml\n' + code + '```');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('<script');
    expect(codeText(markup)).toBe(code);
  });

  test('keeps non-YAML blocks plain and inline code unchanged', () => {
    const markup = renderMarkdown('Use `inline` code.\n\n```unknown\nenabled: true\n```\n\n    untagged\n    second line\n');
    expect(markup).toContain('<p>Use <code>inline</code> code.</p>');
    expect(markup).not.toContain('class="hljs"');
    expect(markup).toContain('<code>enabled: true\n</code>');
    expect(markup).toContain('<code>untagged\nsecond line\n</code>');
    expect(markup.match(/class="code-block-window"/g)).toHaveLength(2);
    expect(markup.match(/aria-label="Copy code to clipboard"/g)).toHaveLength(2);
  });

});
