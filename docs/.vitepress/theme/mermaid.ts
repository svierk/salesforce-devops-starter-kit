/**
 * Shared, lazy entry point to mermaid for the theme components.
 *
 * mermaid is around 700 kB, so it is imported on first use instead of being
 * bundled into the app - pages without a diagram never download it. Renders
 * are chained because mermaid.initialize() is global: two components rendering
 * at once (the wizard and the static tree on the strategy overview) would
 * otherwise pick up each other's config.
 */
import type { MermaidConfig } from 'mermaid';

// Diagrams color their own nodes via classDef; these variables cover the rest -
// edges, edge labels, subgraphs and plain nodes. They mirror the surfaces of
// theme/custom.css (night blue in dark mode), so keep the two in step.
const THEMES: Record<'light' | 'dark', MermaidConfig> = {
  light: {
    theme: 'base',
    themeVariables: {
      background: '#ffffff',
      primaryColor: '#f6f6f7',
      primaryBorderColor: '#9aa0a6',
      primaryTextColor: '#3c3c43',
      textColor: '#3c3c43',
      lineColor: '#67676c',
      edgeLabelBackground: '#ffffff',
      clusterBkg: '#f6f6f7',
      clusterBorder: '#d5d5db'
    }
  },
  dark: {
    theme: 'base',
    themeVariables: {
      darkMode: true,
      background: '#0b1120',
      primaryColor: '#131d33',
      primaryBorderColor: '#3d4c6e',
      primaryTextColor: '#c9d2e6',
      textColor: '#c9d2e6',
      lineColor: '#8a96b0',
      edgeLabelBackground: '#0b1120',
      clusterBkg: '#111a2e',
      clusterBorder: '#26334f'
    }
  }
};

let mermaid: typeof import('mermaid').default | undefined;
let queue: Promise<unknown> = Promise.resolve();
let renderCount = 0;

export function renderMermaid(source: string, isDark: boolean): Promise<string> {
  const job = queue.then(async () => {
    mermaid ??= (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      // mermaid sizes each label box at line-height 1.5, but the label is a <p>
      // and `.vp-doc p` sets 28px - a three-line label then overflows its box
      // and is clipped. themeCSS is scoped to the diagram's id, so it wins.
      themeCSS: 'p { line-height: inherit; }',
      ...THEMES[isDark ? 'dark' : 'light']
    });
    const { svg } = await mermaid.render(`mermaid-${renderCount++}`, source);
    return svg;
  });
  // A failed render must not block the ones queued behind it.
  queue = job.catch(() => {});
  return job;
}
