#!/usr/bin/env node
/**
 * Generates the VitePress documentation for the Salesforce DevOps Starter Kit.
 *
 * Two catalogs are built straight from the repository content, so the site can
 * never drift from what actually ships:
 *
 *   1. Reusable workflows - one page per workflow, generated from the YAML files
 *      in .github/workflows/: the leading comment becomes the description, and
 *      the `inputs:` / `secrets:` blocks become tables. The matching caller from
 *      examples/ is embedded as a copy-paste snippet.
 *
 *   2. Building blocks - one page per Action, whose README is fetched at build
 *      time from its own repository (svierk/<action>), with relative links and
 *      images rewritten to absolute GitHub URLs.
 *
 * The landing page (hero + feature cards) and the sidebar are generated from
 * scripts/docs/site.config.json.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowsDir = join(root, '.github', 'workflows');
const examplesDir = join(root, 'examples');
const imagesDir = join(root, 'images');
const docsDir = join(root, 'docs');
const workflowsOutDir = join(docsDir, 'workflows');
const blocksOutDir = join(docsDir, 'blocks');
const publicDir = join(docsDir, 'public');
const vitepressDir = join(docsDir, '.vitepress');

const config = JSON.parse(readFileSync(join(root, 'scripts', 'docs', 'site.config.json'), 'utf-8'));
const RAW = (repo, file) => `https://raw.githubusercontent.com/${config.owner}/${repo}/main/${file}`;
const BLOB = (repo, file) => `https://github.com/${config.owner}/${repo}/blob/main/${file}`;

/** Remove and recreate only the generated outputs (never the hand-written docs). */
function clean() {
  rmSync(workflowsOutDir, { recursive: true, force: true });
  rmSync(blocksOutDir, { recursive: true, force: true });
  rmSync(join(docsDir, 'index.md'), { force: true });
  mkdirSync(workflowsOutDir, { recursive: true });
  mkdirSync(blocksOutDir, { recursive: true });
  mkdirSync(vitepressDir, { recursive: true });
}

/** Copy the repository images into docs/public so VitePress can serve them
 * under /images/... (logo, favicon and the home hero image live here). */
function copyAssets() {
  const publicImages = join(publicDir, 'images');
  rmSync(publicImages, { recursive: true, force: true });
  mkdirSync(publicImages, { recursive: true });
  if (existsSync(imagesDir)) cpSync(imagesDir, publicImages, { recursive: true });
}

/** Grab the contiguous `#` comment block that follows the `name:` line. */
function extractHeaderComment(raw) {
  const lines = raw.split('\n');
  const start = lines.findIndex((l) => l.startsWith('name:'));
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' && out.length === 0) continue; // allow the blank line after name:
    if (line.startsWith('#')) out.push(line.replace(/^#\s?/, ''));
    else if (out.length)
      break; // stop at the first non-comment once the block started
    else if (line !== '') break;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** Access the workflow_call node regardless of how the YAML lib treats `on`. */
function workflowCall(doc) {
  const on = doc.on ?? doc['on'] ?? doc[true];
  return on?.workflow_call ?? {};
}

function mdTable(headers, rows) {
  if (!rows.length) return '_None._\n';
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}\n`;
}

function cell(value) {
  if (value === undefined || value === '') return '-';
  return String(value).replace(/\|/g, '\\|');
}

function inputRows(inputs = {}) {
  return Object.entries(inputs).map(([name, spec]) => [
    `\`${name}\``,
    cell(spec.description),
    cell(spec.type),
    spec.required ? 'yes' : 'no',
    spec.default === '' || spec.default === undefined ? '-' : `\`${spec.default}\``
  ]);
}

function secretRows(secrets = {}) {
  return Object.entries(secrets).map(([name, spec]) => [
    `\`${name}\``,
    cell(spec.description),
    spec.required ? 'yes' : 'no'
  ]);
}

/** Build one page per reusable workflow and return sidebar metadata. */
function writeWorkflowPages() {
  const meta = [];
  for (const wf of config.workflows) {
    const raw = readFileSync(join(workflowsDir, wf.file), 'utf-8');
    const doc = parseYaml(raw);
    const call = workflowCall(doc);
    const title = doc.name ?? wf.slug;
    const description = extractHeaderComment(raw);

    let page = `# ${title}\n\n`;
    if (description) page += `${description}\n\n`;
    page += `> Reusable workflow - call it from your own repository with \`uses:\`. `;
    page += `[View source](${BLOB(config.repo, `.github/workflows/${wf.file}`)})\n\n`;
    page += `## Inputs\n\n${mdTable(['Input', 'Description', 'Type', 'Required', 'Default'], inputRows(call.inputs))}\n`;
    page += `## Secrets\n\n${mdTable(['Secret', 'Description', 'Required'], secretRows(call.secrets))}\n`;

    const examplePath = join(examplesDir, wf.example);
    if (existsSync(examplePath)) {
      const example = readFileSync(examplePath, 'utf-8').trimEnd();
      page += `## Example usage\n\n`;
      page += `Copy this caller into your project's \`.github/workflows/\` directory `;
      page += `([source](${BLOB(config.repo, `examples/${wf.example}`)})):\n\n`;
      page += `\`\`\`yaml\n${example}\n\`\`\`\n`;
    }

    writeFileSync(join(workflowsOutDir, `${wf.slug}.md`), page);
    meta.push({ slug: wf.slug, title });
  }
  return meta;
}

/**
 * Rewrite a fetched README so relative images/links resolve on the docs site:
 * images point at raw.githubusercontent, other links at the repo on github.com.
 * Absolute URLs and pure anchors are left untouched.
 */
function rewriteReadme(markdown, repo) {
  const isExternal = (url) => /^(https?:|mailto:|#)/.test(url);
  const norm = (url) => url.replace(/^\.\//, '');
  // Markdown images: ![alt](path)
  let out = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) =>
    isExternal(url) ? m : `![${alt}](${RAW(repo, norm(url))})`
  );
  // HTML <img src="path">
  out = out.replace(/(<img[^>]*\bsrc=")([^"]+)(")/g, (m, pre, url, post) =>
    isExternal(url) ? m : `${pre}${RAW(repo, norm(url))}${post}`
  );
  // Markdown links: [text](path) - skip images (already handled) and externals
  out = out.replace(/(^|[^!])\[([^\]]+)\]\(([^)]+)\)/g, (m, lead, text, url) =>
    isExternal(url) ? m : `${lead}[${text}](${BLOB(repo, norm(url))})`
  );
  return out;
}

/** Extract the H1 title and first paragraph for the sidebar and feature cards. */
function summarize(markdown, fallback) {
  const lines = markdown.split('\n');
  let title = fallback;
  let i = 0;
  for (; i < lines.length; i++) {
    const match = lines[i].match(/^#\s+(.*)$/);
    if (match) {
      title = match[1].replace(/[`*_]/g, '').trim();
      i++;
      break;
    }
  }
  const paragraph = [];
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (paragraph.length) break;
      continue;
    }
    if (/^[<#|>`\-!]/.test(line) || line.startsWith('```')) break;
    paragraph.push(line);
  }
  const description = paragraph
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { title, description };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch a README, retrying transient failures (rate limits, 5xx). */
/** Shorten text to at most `max` chars, cutting on a word boundary + ellipsis. */
function truncate(text, max) {
  if (!text || text.length <= max) return text ?? '';
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

async function fetchReadme(repo, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(RAW(repo, 'README.md'));
      if (res.ok) return res.text();
      if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(500 * (i + 1)); // linear backoff: 0.5s, 1s, 1.5s …
  }
  throw lastError;
}

/** Build one page per building block from its (fetched) README. */
async function writeBlockPages() {
  const meta = {};
  for (const category of config.blockCategories) {
    for (const block of category.blocks) {
      const { repo, icon } = block;
      let markdown;
      try {
        markdown = await fetchReadme(repo);
      } catch (err) {
        console.warn(`[docs] could not fetch README for ${repo} (${err.message}); writing a stub`);
        markdown = `# ${repo}\n\nDocumentation for this building block lives in its repository.\n`;
      }
      const { title, description } = summarize(markdown, repo);
      const body = rewriteReadme(markdown, repo).trimEnd();
      const footer = `\n\n---\n\n➡️ **Full source & releases:** [${config.owner}/${repo}](https://github.com/${config.owner}/${repo})\n`;
      writeFileSync(join(blocksOutDir, `${repo}.md`), `${body}${footer}`);
      // Card teaser: prefer the curated tagline (uniform length, benefit-focused);
      // fall back to a truncated README first paragraph if none is configured.
      const cardText = block.tagline ?? truncate(description, 130);
      meta[repo] = { title, description, icon, cardText };
    }
  }
  return meta;
}

/** Assemble the VitePress sidebar (shown across the whole site). */
function buildSidebar(workflowMeta, blockMeta) {
  const sidebar = [
    {
      text: 'Guide',
      collapsed: false,
      items: [
        { text: 'Getting Started', link: '/getting-started' },
        { text: 'Authentication', link: '/authentication' }
      ]
    },
    {
      text: 'Reusable Workflows',
      collapsed: false,
      items: workflowMeta.map((w) => ({ text: w.title, link: `/workflows/${w.slug}` }))
    }
  ];
  for (const category of config.blockCategories) {
    sidebar.push({
      text: `Building Blocks · ${category.text}`,
      collapsed: false,
      items: category.blocks.map((b) => ({
        text: blockMeta[b.repo]?.title ?? b.repo,
        link: `/blocks/${b.repo}`
      }))
    });
  }
  return sidebar;
}

function writeGenerated(sidebar, workflowMeta, blockMeta) {
  const firstBlock = config.blockCategories[0].blocks[0].repo;
  const nav = [
    { text: 'Guide', link: '/getting-started' },
    { text: 'Workflows', link: `/workflows/${workflowMeta[0].slug}` },
    { text: 'Building Blocks', link: `/blocks/${firstBlock}` }
  ];
  writeFileSync(join(vitepressDir, 'generated.json'), `${JSON.stringify({ sidebar, nav }, null, 2)}\n`);
}

/** Landing page: hero + a feature card per building block, grouped by category. */
function writeIndex(blockMeta) {
  const features = [];
  for (const category of config.blockCategories) {
    for (const block of category.blocks) {
      const info = blockMeta[block.repo];
      features.push({
        icon: block.icon,
        title: info?.title ?? block.repo,
        details: info?.cardText ?? '',
        link: `/blocks/${block.repo}`,
        linkText: 'Read the docs'
      });
    }
  }
  const frontmatter = { layout: 'home', hero: config.hero, features };
  writeFileSync(join(docsDir, 'index.md'), `---\n${toYaml(frontmatter)}---\n`);
}

/** Minimal YAML emitter for our known-shaped frontmatter (values JSON-quoted). */
function toYaml(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    return value.map((item) => `${pad}-\n${toYaml(item, indent + 1)}`).join('');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) =>
        val && typeof val === 'object'
          ? `${pad}${key}:\n${toYaml(val, indent + 1)}`
          : `${pad}${key}: ${JSON.stringify(val)}\n`
      )
      .join('');
  }
  return `${pad}${JSON.stringify(value)}\n`;
}

async function main() {
  clean();
  copyAssets();
  const workflowMeta = writeWorkflowPages();
  const blockMeta = await writeBlockPages();
  const sidebar = buildSidebar(workflowMeta, blockMeta);
  writeGenerated(sidebar, workflowMeta, blockMeta);
  writeIndex(blockMeta);
  console.log(
    `[docs] generated ${workflowMeta.length} workflow pages and ${Object.keys(blockMeta).length} building-block pages`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
