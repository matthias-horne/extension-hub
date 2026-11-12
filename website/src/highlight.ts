import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';

const themes = { light: 'github-light', dark: 'github-dark' } as const;

const languages = {
  css: () => import('@shikijs/langs/css'),
  diff: () => import('@shikijs/langs/diff'),
  docker: () => import('@shikijs/langs/docker'),
  go: () => import('@shikijs/langs/go'),
  hcl: () => import('@shikijs/langs/hcl'),
  html: () => import('@shikijs/langs/html'),
  ini: () => import('@shikijs/langs/ini'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  jsx: () => import('@shikijs/langs/jsx'),
  lua: () => import('@shikijs/langs/lua'),
  make: () => import('@shikijs/langs/make'),
  markdown: () => import('@shikijs/langs/markdown'),
  powershell: () => import('@shikijs/langs/powershell'),
  proto: () => import('@shikijs/langs/proto'),
  python: () => import('@shikijs/langs/python'),
  rust: () => import('@shikijs/langs/rust'),
  shellscript: () => import('@shikijs/langs/shellscript'),
  sql: () => import('@shikijs/langs/sql'),
  terraform: () => import('@shikijs/langs/terraform'),
  toml: () => import('@shikijs/langs/toml'),
  tsx: () => import('@shikijs/langs/tsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
};

type Language = keyof typeof languages;

const aliases: Record<string, Language> = {
  bash: 'shellscript',
  cjs: 'javascript',
  console: 'shellscript',
  css: 'css',
  cts: 'typescript',
  diff: 'diff',
  docker: 'docker',
  dockerfile: 'docker',
  go: 'go',
  golang: 'go',
  hcl: 'hcl',
  html: 'html',
  ini: 'ini',
  java: 'java',
  javascript: 'javascript',
  json: 'json',
  jsonc: 'jsonc',
  jsx: 'jsx',
  lua: 'lua',
  make: 'make',
  makefile: 'make',
  markdown: 'markdown',
  md: 'markdown',
  mjs: 'javascript',
  mts: 'typescript',
  powershell: 'powershell',
  properties: 'ini',
  proto: 'proto',
  protobuf: 'proto',
  ps: 'powershell',
  ps1: 'powershell',
  pwsh: 'powershell',
  py: 'python',
  python: 'python',
  rs: 'rust',
  rust: 'rust',
  sh: 'shellscript',
  shell: 'shellscript',
  'shell-session': 'shellscript',
  shellsession: 'shellscript',
  shellscript: 'shellscript',
  sql: 'sql',
  terraform: 'terraform',
  tf: 'terraform',
  tfvars: 'terraform',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  typescript: 'typescript',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'shellscript',
};

const cache = new Map<string, Promise<string | undefined>>();
let highlighter: Promise<HighlighterCore> | undefined;

function getHighlighter() {
  return highlighter ??= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [],
    engine: createOnigurumaEngine(() => import('shiki/wasm')),
  });
}

async function render(code: string, requested: string) {
  const language = aliases[requested];
  if (!language) return undefined;
  const instance = await getHighlighter();
  if (!instance.getLoadedLanguages().includes(language)) {
    await instance.loadLanguage((await languages[language]()).default);
  }
  return instance.codeToHtml(code, {
    lang: language,
    themes,
    defaultColor: false,
    structure: 'inline',
  });
}

export function highlightCode(code: string, requested: string) {
  const language = requested.toLowerCase();
  const key = language + '\n' + code;
  let result = cache.get(key);
  if (!result) {
    result = render(code, language).catch(() => undefined);
    cache.set(key, result);
  }
  return result;
}
