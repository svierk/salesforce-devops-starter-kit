import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';

// The sidebar and nav are generated from the repository content by
// scripts/docs/generate.mjs, which runs before every dev/build (see the
// package.json "docs:*" scripts).
const { sidebar, nav } = JSON.parse(readFileSync(new URL('./generated.json', import.meta.url), 'utf-8'));

const title = 'Salesforce DevOps Starter Kit';
const description = 'GitHub-native CI/CD building blocks and reusable workflows for Salesforce projects.';
const siteUrl = 'https://svierk.github.io/salesforce-devops-starter-kit/';
const favicon = '/salesforce-devops-starter-kit/images/salesforce-devops-starter-kit-hero-logo.png';

export default defineConfig({
  title,
  description,
  lang: 'en-US',
  base: '/salesforce-devops-starter-kit/',
  cleanUrls: true,
  lastUpdated: true,
  // Favicon - head link hrefs are not base-adjusted, so include the base prefix.
  // The Open Graph tags reuse the GitHub social preview image so shared links to
  // the docs look the same as shared links to the repository.
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: favicon }],
    ['link', { rel: 'apple-touch-icon', href: favicon }],
    ['meta', { name: 'theme-color', content: '#1d4ed8' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: siteUrl }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:image', content: `${siteUrl}images/salesforce-devops-starter-kit-social-preview.jpg` }],
    ['meta', { property: 'og:image:width', content: '1280' }],
    ['meta', { property: 'og:image:height', content: '640' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }]
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
      // Vue also interpolates `{{ ... }}` inside inline code spans. VitePress
      // marks fenced blocks `v-pre`, but not code spans - so a README that
      // mentions `${{ secrets.* }}` in prose fails the build with
      // "Error parsing JavaScript expression". The building-block pages are
      // fetched verbatim from the Action repositories, where such prose appears
      // and changes without a commit here, so mark every code span v-pre.
      const defaultCodeInline =
        md.renderer.rules.code_inline ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
      md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
        tokens[idx].attrSet('v-pre', '');
        return defaultCodeInline(tokens, idx, options, env, self);
      };

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
