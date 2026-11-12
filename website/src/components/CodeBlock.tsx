import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from 'react';
import hljs from 'highlight.js/lib/core';
import yaml from 'highlight.js/lib/languages/yaml';
import { Icon } from './Icon';

hljs.registerLanguage('yaml', yaml);

export function CodeBlock({ code, highlightYaml = false, id, label = 'Code block', copyLabel = 'Copy code to clipboard' }: {
  code: string;
  highlightYaml?: boolean;
  id?: string;
  label?: string;
  copyLabel?: string;
}) {
  const [copyResult, setCopyResult] = useState<{ code: string; status: 'copied' | 'unavailable' }>();
  const copyStatus = copyResult?.code === code ? copyResult.status : 'idle';
  const highlighted = useMemo(() => highlightYaml
    ? hljs.highlight(code, { language: 'yaml', ignoreIllegals: true }).value
    : undefined, [code, highlightYaml]);

  useEffect(() => {
    if (copyResult?.status !== 'copied') return;
    const timer = setTimeout(() => setCopyResult(undefined), 2000);
    return () => clearTimeout(timer);
  }, [copyResult]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyResult({ code, status: 'copied' });
    } catch {
      setCopyResult({ code, status: 'unavailable' });
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-window">
        <button type="button" className="button button-small button-icon code-block-copy" onClick={copyCode} aria-label={copyLabel} title="Copy to clipboard">
          <Icon name={copyStatus === 'copied' ? 'check' : 'copy'} />
        </button>
        <pre className="code-block-pre" id={id} tabIndex={0} aria-label={label}>
          {highlighted === undefined ? <code>{code}</code>
            // Only Highlight.js-generated markup is inserted; it escapes the source text.
            : <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />}
        </pre>
      </div>
      <p className={copyStatus === 'unavailable' ? 'code-block-status' : 'sr-only'} role="status">
        {copyStatus === 'copied' ? 'Copied to clipboard.' : copyStatus === 'unavailable' ? 'Copy is unavailable. Select the code above.' : ''}
      </p>
    </div>
  );
}

// Customize only Markdown's pre renderer so inline code remains untouched.
export function MarkdownCodeBlock({ children }: { children?: ReactNode }) {
  const child = Children.toArray(children)[0];
  if (!isValidElement<{ children?: ReactNode; className?: string }>(child)) return <pre>{children}</pre>;
  const code = Children.toArray(child.props.children).join('');
  const highlightYaml = /(?:^|\s)language-(?:yaml|yml)(?:\s|$)/i.test(child.props.className ?? '');
  return <CodeBlock code={code} highlightYaml={highlightYaml} />;
}
