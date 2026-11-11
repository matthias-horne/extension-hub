# update-extensions

This script scrapes the [registered extensions](../../extensions/) and generates the metadata used in the website for displaying the extension cards.

## Local use

Install Node.js 24+, [GitHub CLI](https://cli.github.com/), and
[ORAS](https://oras.land/docs/installation), then:

```sh
npm --prefix tools/update-extensions ci
npm --prefix tools/update-extensions test
gh auth login
git worktree add /tmp/extension-hub-pages pages
npm --prefix tools/update-extensions run update-extensions -- --output-dir /tmp/extension-hub-pages/extensions
git -C /tmp/extension-hub-pages diff
```

The script updates files only; the workflow handles the commit and push.
