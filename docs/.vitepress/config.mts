import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';

// The sidebar and nav are generated from the repository content by
// scripts/docs/generate.mjs, which runs before every dev/build (see the
// package.json "docs:*" scripts).
const { sidebar, nav } = JSON.parse(readFileSync(new URL('./generated.json', import.meta.url), 'utf-8'));

export default defineConfig({
  title: 'Salesforce DevOps Starter Kit',
  description: 'GitHub-native CI/CD building blocks and reusable workflows for Salesforce projects.',
  lang: 'en-US',
  base: '/salesforce-devops-starter-kit/',
  cleanUrls: true,
  lastUpdated: true,
  // Favicon — head link hrefs are not base-adjusted, so include the base prefix.
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/salesforce-devops-starter-kit/images/salesforce-devops-starter-kit-hero-logo.png' }]
  ],
  // Belt-and-suspenders: the markdown hook below turns repo-relative links into
  // absolute GitHub URLs, but keep the check lenient for anything that slips by.
  ignoreDeadLinks: [/\.\.\//],
  markdown: {
    // The hand-written guides link to files outside the docs root
    // (e.g. ../README.md, ../examples/deployment.yml) - correct when viewed on
    // GitHub, but 404 on the site. Rewrite those to absolute GitHub URLs so they
    // resolve either way.
    config: (md) => {
      const repoBlob = 'https://github.com/svierk/salesforce-devops-starter-kit/blob/main/';
      const defaultRender =
        md.renderer.rules.link_open ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const hrefIndex = token.attrIndex('href');
        if (hrefIndex >= 0) {
          const href = token.attrs[hrefIndex][1];
          if (href.includes('../')) {
            token.attrs[hrefIndex][1] = repoBlob + href.replace(/^(\.\/)?(\.\.\/)+/, '');
          }
        }
        return defaultRender(tokens, idx, options, env, self);
      };
    }
  },
  themeConfig: {
    logo: '/images/salesforce-devops-starter-kit-hero-logo.png',
    nav: [{ text: 'Home', link: '/' }, ...nav, { text: 'GitHub', link: 'https://github.com/svierk/salesforce-devops-starter-kit' }],
    sidebar,
    search: {
      provider: 'local'
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/svierk/salesforce-devops-starter-kit' }],
    editLink: {
      pattern: 'https://github.com/svierk/salesforce-devops-starter-kit/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Sebastiano Schwarz'
    }
  }
});
