import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { stringify } from 'yaml';
import ExtensionDetails from '../src/components/ExtensionDetails';
import { parseExtension } from '../src/data/extensions';

function renderReadme(lines: string[]) {
  const extension = parseExtension(stringify({
    name: 'Example',
    description: 'An example extension',
    repository: 'https://github.com/example/extension',
    github: {
      stars: 1,
      owner: { login: 'example' },
      readme: {
        markdown: lines.join('\n'),
        path: 'docs/README.md',
        htmlUrl: 'https://github.com/example/extension/blob/main/docs/README.md',
        rawUrl: 'https://raw.githubusercontent.com/example/extension/main/docs/README.md',
      },
    },
  }), 'example.yaml');
  const markup = renderToStaticMarkup(
    <MemoryRouter><ExtensionDetails extension={extension} onCategory={() => {}} /></MemoryRouter>,
  );
  return markup.split('class="panel-body readme-content"')[1].split('</section>')[0];
}

describe('README GitHub alerts', () => {
  test.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('renders %s with a title and decorative icon', (type) => {
    const markup = renderReadme(['> [!' + type + ']', '> Useful information.']);
    expect(markup).toContain('class="markdown-alert markdown-alert-' + type.toLowerCase() + '"');
    expect(markup).toContain('class="markdown-alert-title"');
    expect(markup).toContain('</svg>' + type + '</p>');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('<path d="');
    expect(markup).toContain('<p>Useful information.</p>');
    expect(markup).not.toContain('[!' + type + ']');
    expect(markup).not.toContain('<blockquote>');
  });

  test('preserves multiple paragraphs, formatting, lists, and repository-relative URLs', () => {
    const markup = renderReadme([
      '> [!IMPORTANT]', '> Read **this** and run `setup`.', '>',
      '> Follow the [guide](guide.md).', '>',
      '> - First step', '> - Second step', '>',
      '> ![Diagram](images/diagram.png)', '', 'After the alert.',
    ]);
    expect(markup).toContain('<strong>this</strong>');
    expect(markup).toContain('<code>setup</code>');
    expect(markup).toContain('href="https://github.com/example/extension/blob/main/docs/guide.md" target="_blank" rel="noopener noreferrer"');
    expect(markup).toContain('<li>First step</li>');
    expect(markup).toContain('<li>Second step</li>');
    expect(markup).toContain('src="https://raw.githubusercontent.com/example/extension/main/docs/images/diagram.png"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('</div>\n<p>After the alert.</p>');
  });

  test('supports a blank quoted line or a hard line break after the marker', () => {
    for (const header of [['> [!NOTE]', '>'], ['> [!NOTE]  '], ['> [!NOTE]\\']]) {
      const markup = renderReadme([...header, '> Body text.']);
      expect(markup).toContain('markdown-alert-note');
      expect(markup).toContain('<p>Body text.</p>');
      expect(markup).not.toContain('[!NOTE]');
    }
  });

  test('leaves ordinary blockquotes, unknown markers, inline markers, and code examples unchanged', () => {
    const markup = renderReadme([
      '> Ordinary **quote**.', '',
      '> [!UNKNOWN]', '> Unrecognized alert.', '',
      'Inline [!NOTE].', '',
      '```markdown', '> [!WARNING]', '> Code example.', '```',
    ]);
    expect(markup).not.toContain('markdown-alert');
    expect(markup).toContain('<blockquote>');
    expect(markup).toContain('<p>Ordinary <strong>quote</strong>.</p>');
    expect(markup).toContain('[!UNKNOWN]');
    expect(markup).toContain('<p>Inline [!NOTE].</p>');
    expect(markup).toContain('<code class="language-markdown">&gt; [!WARNING]');
  });

  test('retains GFM tables and task lists alongside alerts', () => {
    const markup = renderReadme([
      '> [!TIP]', '> Check the status below.', '',
      '| Name | Status |', '| --- | --- |', '| Example | Ready |', '',
      '- [x] Complete', '- [ ] Pending',
    ]);
    expect(markup).toContain('markdown-alert-tip');
    expect(markup).toContain('<div class="readme-table"><table>');
    expect(markup).toContain('<td>Ready</td>');
    expect(markup).toContain('class="contains-task-list"');
    expect(markup).toContain('type="checkbox"');
  });

  test('continues to skip raw HTML and reject unsafe URLs inside alerts', () => {
    const markup = renderReadme([
      '> [!CAUTION]', '> <script>alert(1)</script>', '>',
      '> [Unsafe](javascript:alert%281%29)',
    ]);
    expect(markup).toContain('markdown-alert-caution');
    expect(markup).not.toContain('<script>');
    expect(markup).not.toContain('javascript:');
    expect(markup).toContain('href=""');
  });
});
