import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
import { absolutizeFile } from '../../scripts/docs/llms-links.mjs';

// The sidebar and nav are generated from the repository content by
// scripts/docs/generate.mjs, which runs before every dev/build (see the
// package.json "docs:*" scripts).
const { sidebar, nav } = JSON.parse(readFileSync(new URL('./generated.json', import.meta.url), 'utf-8'));

const title = 'Salesforce DevOps Starter Kit';
const description = 'GitHub-native CI/CD building blocks and reusable workflows for Salesforce projects.';
const siteUrl = 'https://svierk.github.io/salesforce-devops-starter-kit/';
const base = '/salesforce-devops-starter-kit/';
const repoBlob = 'https://github.com/svierk/salesforce-devops-starter-kit/blob/main/';
const favicon = '/salesforce-devops-starter-kit/images/salesforce-devops-starter-kit-hero-logo.png';

export default defineConfig({
  title,
  description,
  lang: 'en-US',
  base,
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
  // mermaid's own chunks (core, cytoscape, ...) are up to ~700 kB each, but they
  // are only fetched by pages that render a diagram (see theme/mermaid.ts). Raise
  // the warning limit above them so it still flags growth in the shared bundle.
  vite: {
    // AI-friendly docs: llms.txt (an index of the site), llms-full.txt (every
    // page in one file) and a Markdown copy of each page next to its HTML, for
    // agents that read the docs while they work. Its `domain` option is left
    // out on purpose: it also rewrites links inside the pages, and mangles them
    // under a base path - buildEnd below makes them absolute instead.
    plugins: [llmstxt()],
    build: {
      chunkSizeWarningLimit: 800
    }
  },
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
        md.renderer.rules.code_inline || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
      md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
        tokens[idx].attrSet('v-pre', '');
        return defaultCodeInline(tokens, idx, options, env, self);
      };

      // ```mermaid fences - the strategy decision tree and the per-blueprint
      // branch/org diagrams - become <MermaidDiagram>, which loads mermaid only
      // when a page with a diagram mounts. GitHub renders the same fences from
      // the Markdown source. URI-encoding keeps the source intact as a prop.
      const defaultFence = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.info.trim() === 'mermaid') {
          return `<MermaidDiagram code="${encodeURIComponent(token.content)}" />`;
        }
        return defaultFence(tokens, idx, options, env, self);
      };

      // custom.css stretches tables to the content width (display: table), which
      // drops the default theme's horizontal scrolling - on a phone a wide table
      // (workflow inputs, the blueprint matrices) widened the whole page. Give
      // every table its own scroll container; tabindex keeps it keyboard-scrollable.
      md.renderer.rules.table_open = () => '<div class="table-scroll" tabindex="0"><table>\n';
      md.renderer.rules.table_close = () => '</table>\n</div>\n';

      const defaultRender =
        md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
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
  // The Markdown copies are read on their own, so their relative and
  // root-relative links would resolve against nothing - see
  // scripts/docs/llms-links.mjs. llms.txt itself only links pages, by path.
  buildEnd({ outDir, srcDir }) {
    const isFile = (path) => existsSync(join(srcDir, path));
    for (const file of readdirSync(outDir, { recursive: true })) {
      if (!/\.md$|^llms-full\.txt$/.test(file)) continue;
      const path = join(outDir, file);
      writeFileSync(path, absolutizeFile(readFileSync(path, 'utf-8'), { base, isFile, siteUrl, repoBlob }));
    }
    const index = join(outDir, 'llms.txt');
    writeFileSync(index, readFileSync(index, 'utf-8').replaceAll(`](${base}`, `](${siteUrl}`));
  },
  themeConfig: {
    logo: '/images/salesforce-devops-starter-kit-hero-logo.png',
    // No "Home" or "GitHub" entries: the logo already links home and the GitHub
    // icon below covers the repository. Every nav entry costs width the navbar
    // does not have between 768px and ~1060px, beside the search and sidebar.
    nav,
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
      message: `Released under the MIT License. · <a href="${base}llms.txt">llms.txt</a> for AI agents`,
      copyright: 'Copyright © Sebastiano Schwarz'
    }
  }
});
