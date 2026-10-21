/**
 * Keeps the strategy questionnaire and its documentation in step.
 *
 * The routing lives in docs/.vitepress/theme/strategy-routing.mjs. The same
 * routing is written down twice more for readers: as the routing table and as
 * the static decision tree in docs/strategy/index.md. Nothing else notices when
 * one of the three changes without the others, so this test does - it runs
 * every possible combination of answers against all of them.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ALL_NODES,
  ANSWERS,
  PASS_NODES,
  STEPS,
  TREE,
  TREE_NODES,
  blueprintFor,
  edgeIndex,
  pathNodes,
  variantFor
} from '../../docs/.vitepress/theme/strategy-routing.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf-8');
const index = read('docs/strategy/index.md');
const wizard = read('docs/.vitepress/theme/components/StrategyWizard.vue');

/** Every complete set of answers - one per path through the questionnaire. */
function allCombinations(steps = STEPS) {
  if (steps.length === 0) return [{}];
  const [step, ...rest] = steps;
  return ANSWERS[step].flatMap((value) => allCombinations(rest).map((combo) => ({ [step]: value, ...combo })));
}

/** The result node a complete set of answers ends on. */
function leafFor(answers) {
  const id = blueprintFor(answers);
  return id === 'B2' ? { story: 'B2S', bundle: 'B2B', train: 'B2T' }[variantFor(answers)] : id;
}

const COMBINATIONS = allCombinations();
const LEAVES = ALL_NODES.filter((n) => n.startsWith('B'));

// How the routing table in index.md words each answer, per column. A phrase
// missing here fails the test with a clear message rather than being skipped.
const any = (step) => ANSWERS[step];
const TABLE_VOCABULARY = [
  { 'one org': ['single'], 'several orgs': ['multi'] },
  { any: any('teams'), 'one team': ['one'], several: ['several'] },
  { any: any('setup'), 'developers or balanced': ['developers', 'balanced'], admins: ['lowCode'] },
  { any: any('maturity'), 'level 1-3': ['starting', 'established'], 'level 4': ['advanced'] },
  { any: any('release'), 'story by story': ['continuous'], bundled: ['bundled'], 'whole releases': ['scheduled'] }
];
const TABLE_VARIANTS = { 'story promotion': 'B2S', 'release bundle': 'B2B', 'release train': 'B2T' };

/** The rows of the routing table in index.md, as allowed answers per question plus the result node. */
function routingTable() {
  const lines = index.split('\n');
  const header = lines.findIndex((l) => l.startsWith('| Your answers'));
  assert.ok(header >= 0, 'index.md has no routing table starting with "| Your answers"');
  const rows = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    const [answers, result] = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const cells = answers.split('·').map((cell) => cell.trim().toLowerCase());
    assert.equal(cells.length, STEPS.length, `routing table row needs one cell per question: ${line}`);
    const allowed = cells.map((cell, i) => {
      const values = TABLE_VOCABULARY[i][cell];
      assert.ok(values, `routing table: unknown answer "${cell}" for ${STEPS[i]} - add it to TABLE_VOCABULARY`);
      return values;
    });
    const blueprint = result.match(/\[(B\d)\]/)?.[1];
    assert.ok(blueprint, `routing table row names no blueprint: ${line}`);
    const variant = Object.keys(TABLE_VARIANTS).find((name) => result.toLowerCase().includes(name));
    rows.push({ line, allowed, leaf: blueprint === 'B2' ? TABLE_VARIANTS[variant] : blueprint });
  }
  return rows;
}

/** The edges and node shapes of the static decision tree in index.md. */
function staticTree() {
  const block = index.match(/```mermaid\n([\s\S]*?)```/);
  assert.ok(block, 'index.md has no mermaid decision tree');
  const edges = [];
  const shapes = {};
  for (const line of block[1].split('\n')) {
    const edge = line.match(/^\s*(\w+)(.*?)\s*-->(?:\|([^|]*)\|)?\s*(\w+)(.*)$/);
    if (!edge) continue;
    const [, from, fromShape, label, to, toShape] = edge;
    edges.push([from, to, label]);
    if (fromShape.trim()) shapes[from] = fromShape.trim();
    if (toShape.trim()) shapes[to] = toShape.trim();
  }
  return { edges, shapes };
}

test('every combination of answers routes to the result the routing table in index.md names', () => {
  const rows = routingTable();
  for (const answers of COMBINATIONS) {
    const matches = rows.filter((row) => STEPS.every((step, i) => row.allowed[i].includes(answers[step])));
    const label = JSON.stringify(answers);
    assert.equal(
      matches.length,
      1,
      `${label} matches ${matches.length} rows of the routing table - expected exactly one`
    );
    assert.equal(leafFor(answers), matches[0].leaf, `${label}: questionnaire and routing table disagree`);
  }
});

test('the static decision tree in index.md is the questionnaire tree', () => {
  const { edges, shapes } = staticTree();
  const key = ([from, to, label]) => `${from} → ${to} [${label ?? ''}]`;
  assert.deepEqual(edges.map(key).sort(), TREE.map(key).sort(), 'edges differ between index.md and TREE');
  for (const node of ALL_NODES) {
    const expected = PASS_NODES.includes(node) ? '(( ))' : TREE_NODES[node];
    assert.equal(shapes[node], expected, `node ${node} is drawn differently in index.md`);
  }
});

test('every complete path crosses all levels and ends on its blueprint', () => {
  for (const answers of COMBINATIONS) {
    const path = pathNodes(answers);
    const label = JSON.stringify(answers);
    assert.equal(path.length, STEPS.length + 1, `${label}: path ${path.join(' → ')} skips a level`);
    for (let i = 1; i < path.length; i++) {
      assert.ok(edgeIndex(path[i - 1], path[i]) >= 0, `${label}: no edge ${path[i - 1]} → ${path[i]} in TREE`);
    }
    assert.equal(path.at(-1), leafFor(answers), `${label}: path ends on ${path.at(-1)}`);
    // Partial answers walk the same path, one level per answered question.
    for (let k = 0; k < STEPS.length; k++) {
      const partial = Object.fromEntries(STEPS.slice(0, k).map((step) => [step, answers[step]]));
      assert.deepEqual(pathNodes(partial), path.slice(0, k + 1), `${label}: partial path after ${k} answers`);
    }
  }
});

test('every edge and every result of the tree is reachable', () => {
  const usedEdges = new Set();
  const usedLeaves = new Set();
  for (const answers of COMBINATIONS) {
    const path = pathNodes(answers);
    for (let i = 1; i < path.length; i++) usedEdges.add(edgeIndex(path[i - 1], path[i]));
    usedLeaves.add(path.at(-1));
  }
  const unused = TREE.filter((_, i) => !usedEdges.has(i)).map(([from, to]) => `${from} → ${to}`);
  assert.deepEqual(unused, [], 'edges no answer leads through');
  assert.deepEqual(
    LEAVES.filter((leaf) => !usedLeaves.has(leaf)),
    [],
    'results no answer leads to'
  );
});

test('the questionnaire offers exactly the questions and answers the routing knows', () => {
  const questions = wizard.match(/const QUESTIONS = \{\n([\s\S]*?)\n\};/);
  assert.ok(questions, 'StrategyWizard.vue has no QUESTIONS object');
  const blocks = questions[1].split(/\n(?= {2}\w+: \{)/);
  const offered = Object.fromEntries(
    blocks.map((block) => [block.match(/^\s*(\w+): \{/)[1], [...block.matchAll(/value: '([^']+)'/g)].map((m) => m[1])])
  );
  assert.deepEqual(Object.keys(offered), STEPS, 'questions or their order differ from STEPS');
  for (const step of STEPS) {
    assert.deepEqual(offered[step], ANSWERS[step], `answer values of "${step}" differ from ANSWERS`);
  }
});
