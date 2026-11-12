import { useEffect, useState, type ComponentProps } from 'react';

export function HighlightedCode({ code, language, className, ...props }: {
  code: string;
  language: string;
  className?: string;
} & Omit<ComponentProps<'code'>, 'children' | 'className' | 'dangerouslySetInnerHTML'>) {
  const key = language + '\n' + code;
  const [result, setResult] = useState<{ key: string; html?: string }>();

  useEffect(() => {
    let active = true;
    import('../highlight')
      .then(({ highlightCode }) => highlightCode(code, language))
      .then((html) => {
        if (active) setResult({ key, html });
      })
      .catch(() => {
        if (active) setResult({ key });
      });
    return () => {
      active = false;
    };
  }, [code, language, key]);

  const html = result?.key === key ? result.html : undefined;
  const classes = html ? [className, 'shiki'].filter(Boolean).join(' ') : className;

  return html
    ? <code {...props} className={classes} dangerouslySetInnerHTML={{ __html: html }} />
    : <code {...props} className={classes}>{code}</code>;
}
