/**
 * Checks how links in the Markdown copies of the docs are made absolute - see
 * scripts/docs/llms-links.mjs. Run with `npm test`.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { absolutizeFile, absolutizeLinks, resolveLink, sourcePathFor } from './llms-links.mjs';

const urls = {
  siteUrl: 'https://svierk.github.io/salesforce-devops-starter-kit/',
  repoBlob: 'https://github.com/svierk/salesforce-devops-starter-kit/blob/main/'
};
const site = (path) => `${urls.siteUrl}${path}`;
const repo = (path) => `${urls.repoBlob}${path}`;

describe('resolveLink', () => {
  const cases = [
    // [target, page it appears on, expected]
    ['b1-simple-org-development.md', 'strategy/index.md', site('strategy/b1-simple-org-development.md')],
    ['index.md', 'strategy/mapping.md', site('strategy.md')],
    ['strategy/index.md', 'getting-started.md', site('strategy.md')],
    [
      'background.md#branching-models',
      'strategy/b5-low-code-admin-first.md',
      site('strategy/background.md#branching-models')
    ],
    ['/workflows/pr-validation', 'strategy/mapping.md', site('workflows/pr-validation.md')],
    ['/authentication', 'strategy/mapping.md', site('authentication.md')],
    ['../README.md#-building-blocks', 'getting-started.md', repo('README.md#-building-blocks')],
    ['../examples', 'getting-started.md', repo('examples')],
    ['../.github/workflows/deployment.yml', 'authentication.md', repo('.github/workflows/deployment.yml')],
    ['../authentication.md', 'strategy/b1-simple-org-development.md', site('authentication.md')],
    ['/images/hero.png', 'index.md', site('images/hero.png')],
    ['https://dora.dev/guides/dora-metrics/', 'strategy/background.md', 'https://dora.dev/guides/dora-metrics/'],
    ['mailto:someone@example.com', 'getting-started.md', 'mailto:someone@example.com'],
    ['#three-ways-to-promote', 'strategy/b2-multi-team-environment-branches.md', '#three-ways-to-promote']
  ];
  for (const [target, page, expected] of cases) {
    test(`${target} on ${page}`, () => assert.equal(resolveLink(target, page, urls), expected));
  }
});

test('absolutizeLinks leaves fenced code alone', () => {
  const markdown =
    'See [B1](b1-simple-org-development.md).\n\n```yaml\nlink: "[x](y.md)"\n```\n\nAnd [mapping](mapping.md).\n';
  assert.equal(
    absolutizeLinks(markdown, 'strategy/index.md', urls),
    `See [B1](${site('strategy/b1-simple-org-development.md')}).\n\n\`\`\`yaml\nlink: "[x](y.md)"\n\`\`\`\n\nAnd [mapping](${site('strategy/mapping.md')}).\n`
  );
});

test('sourcePathFor finds index pages', () => {
  const isFile = (path) => path === 'strategy/index.md';
  assert.equal(
    sourcePathFor('/salesforce-devops-starter-kit/strategy.md', '/salesforce-devops-starter-kit/', isFile),
    'strategy/index.md'
  );
  assert.equal(
    sourcePathFor('/salesforce-devops-starter-kit/strategy/mapping.md', '/salesforce-devops-starter-kit/', isFile),
    'strategy/mapping.md'
  );
});

test('absolutizeFile resolves each page of llms-full.txt against its own url', () => {
  const content = [
    '---\nurl: /salesforce-devops-starter-kit/getting-started.md\n---\n# Getting Started\n\n[Find your blueprint](strategy/index.md)\n\n',
    '---\nurl: /salesforce-devops-starter-kit/strategy.md\ndescription: >-\n  Five questions,\n  five blueprints.\n---\n# Find your blueprint\n\n[B1](b1-simple-org-development.md)\n'
  ].join('');
  const result = absolutizeFile(content, {
    base: '/salesforce-devops-starter-kit/',
    isFile: (path) => path === 'strategy/index.md',
    ...urls
  });
  assert.match(
    result,
    /\[Find your blueprint\]\(https:\/\/svierk\.github\.io\/salesforce-devops-starter-kit\/strategy\.md\)/
  );
  assert.match(
    result,
    /\[B1\]\(https:\/\/svierk\.github\.io\/salesforce-devops-starter-kit\/strategy\/b1-simple-org-development\.md\)/
  );
  assert.match(
    result,
    /^---\nurl: \/salesforce-devops-starter-kit\/strategy\.md\ndescription: >-\n {2}Five questions,\n {2}five blueprints\.\n---\n/m
  );
});
