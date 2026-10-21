/**
 * Routing of the strategy questionnaire: which blueprint a set of answers leads
 * to, and the decision tree it is drawn on.
 *
 * Kept free of Vue and of any wording, so the questionnaire component renders it
 * and scripts/docs/strategy-routing.test.mjs checks it against the routing
 * table and the static decision tree in docs/strategy/index.md - change this
 * file, and the test tells you which of those to update.
 */

// Every question is always asked, in this order, so every path through the tree
// has the same length. An answer that cannot change the blueprint on a path
// still tailors its result.
export const STEPS = ['orgs', 'teams', 'setup', 'maturity', 'release'];

// The answer values per question. The option lists in StrategyWizard.vue use
// exactly these values - the test holds the two together.
export const ANSWERS = {
  orgs: ['single', 'multi'],
  teams: ['one', 'several'],
  setup: ['developers', 'balanced', 'lowCode'],
  maturity: ['starting', 'established', 'advanced'],
  release: ['continuous', 'bundled', 'scheduled']
};

export function blueprintFor(a) {
  if (a.orgs === 'multi') return 'B4';
  if (a.orgs !== 'single') return null;
  if (a.teams === 'one') {
    if (a.setup === 'lowCode') return 'B5';
    if (a.setup) return 'B1';
    return null;
  }
  if (a.teams === 'several' && a.setup) {
    // Team setup does not change the blueprint for several teams - it adds a
    // note on tool-driven promotion to the result instead. Level 4 already
    // works trunk-based; modularity only decides what B3 ships.
    if (a.maturity === 'advanced') return 'B3';
    if (a.maturity) return 'B2';
  }
  return null;
}

/** B2's variant follows the release style. */
export function variantFor(a) {
  if (blueprintFor(a) !== 'B2' || !a.release) return null;
  return { continuous: 'story', bundled: 'bundle', scheduled: 'train' }[a.release] ?? null;
}

// The tree has one level per question and every path crosses all of them, so
// all results sit on the bottom level. Where an answer cannot change the
// blueprint on a path, the path runs through a small pass-through node (P…)
// instead of a question. Edge indices follow the order the links are declared
// in TREE - mermaid's linkStyle addresses edges by that index.
export const TREE = [
  ['QO', 'QT', 'One'],
  ['QO', 'P2M', 'Several'],
  ['QT', 'QS', 'One'],
  ['QT', 'P3N', 'Several'],
  ['P2M', 'P3M'],
  ['QS', 'P4B1', 'Developers / balanced'],
  ['QS', 'P4B5', 'Low-code'],
  ['P3N', 'QM'],
  ['P3M', 'P4M'],
  ['P4B1', 'P5B1'],
  ['P4B5', 'P5B5'],
  ['QM', 'QR', 'Level 1-3'],
  ['QM', 'P5B3', 'Level 4'],
  ['P4M', 'P5M'],
  ['P5B1', 'B1'],
  ['P5B5', 'B5'],
  ['QR', 'B2S', 'Story by story'],
  ['QR', 'B2B', 'Bundled from UAT'],
  ['QR', 'B2T', 'Whole releases'],
  ['P5B3', 'B3'],
  ['P5M', 'B4']
];

/** Mermaid shape and label of every named node; pass-through nodes are drawn as (( )). */
export const TREE_NODES = {
  QO: '{"How many<br/>production orgs?"}',
  QT: '{"How many teams or<br/>parallel workstreams?"}',
  QS: '{"How is the<br/>team set up?"}',
  QM: '{"How mature is your<br/>DevOps practice?"}',
  QR: '{"How do you ship<br/>to production?"}',
  B1: '["<b>B1</b><br/>Simple Org Development"]',
  B5: '["<b>B5</b><br/>Low-Code First"]',
  B2S: '["<b>B2</b><br/>Environment Branches<br/>· Story Promotion"]',
  B2B: '["<b>B2</b><br/>Environment Branches<br/>· Release Bundle"]',
  B2T: '["<b>B2</b><br/>Environment Branches<br/>· Release Train"]',
  B3: '["<b>B3</b><br/>Modular Trunk"]',
  B4: '["<b>B4</b><br/>Multi-Org / Regional"]'
};

export const ALL_NODES = [...new Set(TREE.flatMap(([from, to]) => [from, to]))];
export const PASS_NODES = ALL_NODES.filter((n) => n.startsWith('P'));

/** The nodes the answers given so far lead through, one per answered question,
 * starting at the root. Questions are answered in order, so the walk stops at
 * the first one still open. */
export function pathNodes(a) {
  const nodes = ['QO'];
  if (!a.orgs) return nodes;
  if (a.orgs === 'multi') {
    nodes.push('P2M');
    for (const [step, node] of [
      ['teams', 'P3M'],
      ['setup', 'P4M'],
      ['maturity', 'P5M'],
      ['release', 'B4']
    ]) {
      if (!a[step]) return nodes;
      nodes.push(node);
    }
    return nodes;
  }
  nodes.push('QT');
  if (!a.teams) return nodes;
  if (a.teams === 'one') {
    nodes.push('QS');
    if (!a.setup) return nodes;
    const [p4, p5, result] = a.setup === 'lowCode' ? ['P4B5', 'P5B5', 'B5'] : ['P4B1', 'P5B1', 'B1'];
    nodes.push(p4);
    if (a.maturity) nodes.push(p5);
    if (a.maturity && a.release) nodes.push(result);
    return nodes;
  }
  nodes.push('P3N');
  if (!a.setup) return nodes;
  nodes.push('QM');
  if (!a.maturity) return nodes;
  if (a.maturity === 'advanced') {
    nodes.push('P5B3');
    if (a.release) nodes.push('B3');
    return nodes;
  }
  nodes.push('QR');
  if (a.release) nodes.push({ continuous: 'B2S', bundled: 'B2B', scheduled: 'B2T' }[a.release]);
  return nodes;
}

/** Index of the TREE edge between two nodes, or -1. */
export function edgeIndex(from, to) {
  return TREE.findIndex(([f, t]) => f === from && t === to);
}
