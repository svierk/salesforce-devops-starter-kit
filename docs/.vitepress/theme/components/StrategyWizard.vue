<script setup>
/**
 * Guided questionnaire that walks a reader to one of the five strategy
 * blueprints, and draws the decision tree with the path they took highlighted.
 *
 * The question flow is adaptive: a question is only asked when its answer can
 * still change the outcome, so the simplest path is three questions rather than
 * five. The routing mirrors the static decision tree in docs/strategy/index.md
 * exactly - if one changes, change the other.
 *
 * The tree is drawn through ../mermaid, which imports mermaid on first draw:
 * the docs site is server-rendered at build time, and mermaid needs a DOM.
 */
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
// The site is served from a repository sub-path on GitHub Pages, so every
// internal href has to go through withBase rather than being hard-coded.
import { withBase } from 'vitepress';
import { renderMermaid } from '../mermaid';

const QUESTIONS = {
  orgs: {
    label: 'Org landscape',
    title: 'How many production orgs do you run?',
    why: 'Asked first because it is an architecture decision your DevOps model has to follow. It decides your repository topology and how far the pipeline fans out. Count production orgs only - sandboxes do not count.',
    options: [
      { value: 'single', label: 'One production org', detail: 'One deployment target, one source of truth.' },
      {
        value: 'multi',
        label: 'Several (region, business unit, brand)',
        detail: 'The same change may land in each of them, on different schedules.'
      }
    ]
  },
  teams: {
    label: 'Teams',
    title: 'How many teams or parallel workstreams?',
    why: 'The strongest driver of how many long-lived branches you need. Every extra long-lived branch costs merge effort and XML conflict risk, permanently.',
    options: [
      {
        value: 'one',
        label: 'One team, one stream',
        detail: 'Every merge is already the integration - no integration branch needed.'
      },
      {
        value: 'several',
        label: 'Several teams or parallel streams',
        detail: 'Streams need somewhere to collide before production.'
      }
    ]
  },
  setup: {
    label: 'Team setup',
    title: 'How is the team set up?',
    why: 'Salesforce is unusual in that much of the change is made by clicking, by people for whom a rebase is not a reasonable ask. The more of your team works that way, the more the strategy has to hide Git rather than expose it.',
    options: [
      {
        value: 'developers',
        label: 'Mostly developers, comfortable with Git',
        detail: 'Pull requests and branches can be everyone’s interface.'
      },
      {
        value: 'balanced',
        label: 'Balanced, cross-functional',
        detail: 'Developers and admins side by side; Git works if tooling bridges the gap.'
      },
      {
        value: 'lowCode',
        label: 'Mostly admins and low-code builders',
        detail: 'Git knowledge is the bottleneck - tooling has to do the promoting.'
      }
    ]
  },
  maturity: {
    label: 'Maturity',
    title: 'How mature is your DevOps practice?',
    why: 'Maturity caps how many environments you can operate, and decides whether several teams can share one trunk. Counter-intuitively, higher maturity means fewer long-lived branches, not more.',
    options: [
      {
        value: 'starting',
        label: 'Level 1 - starting out',
        detail: 'Manual or barely automated deployments, tests run late, no metrics.'
      },
      {
        value: 'established',
        label: 'Level 2-3 - established',
        detail: 'CI on every pull request, scripted and delta deployments, failure rates watched.'
      },
      {
        value: 'advanced',
        label: 'Level 4 - advanced',
        detail: 'Trunk-based or near it, feature flags, delivery metrics tracked and improving.'
      }
    ]
  },
  release: {
    label: 'Release style',
    title: 'How do you ship to production?',
    why: 'How changes are batched on their way to production. With several streams on one org it picks one of three variants of the blueprint; everywhere else it shapes how you set the blueprint up.',
    options: [
      {
        value: 'continuous',
        label: 'Story by story, all the way to production',
        detail: 'Each change ships as soon as it is signed off.'
      },
      {
        value: 'bundled',
        label: 'Story by story to UAT, bundled into production',
        detail: 'Stories are signed off one by one; production gets them together on a date.'
      },
      {
        value: 'scheduled',
        label: 'Whole releases on planned dates',
        detail: 'Scope is frozen per release and tested as one.'
      }
    ]
  }
};

const BLUEPRINTS = {
  B1: {
    id: 'B1',
    name: 'Simple Org Development',
    link: '/strategy/b1-simple-org-development',
    summary: 'One team, one production org, one branch that is always deployable.',
    environments: '1 developer sandbox + production',
    branches: 'GitHub Flow - `main` plus short-lived `feature/*`',
    switchOn: [
      '`pr-validation.yml` as a required check on pull requests into `main`',
      '`deployment.yml` on push to `main`, gated by a `production` GitHub Environment',
      'Branch protection on `main`: required PR, required check, no force pushes'
    ]
  },
  B2: {
    id: 'B2',
    name: 'Multi-Team with Environment Branches',
    link: '/strategy/b2-multi-team-environment-branches',
    environments: 'Integration + UAT + pre-production + production',
    // The release style picks the variant - see variantFor().
    variants: {
      train: {
        name: 'Release Train',
        anchor: '#release-train',
        summary:
          'A staged promotion chain: the whole state moves stage by stage, with an explicit release decision at each gate.',
        branches: '`integration` → `uat` → `preprod` → `main`, plus `feature/*` and `hotfix/*`',
        switchOn: [
          '`pr-validation.yml` on pull requests into all four environment branches',
          '`deployment.yml` per environment branch, full deployments, one GitHub Environment per org',
          'Branch protection on all four; `integration` as the default branch',
          'Budget check: Full and Developer Pro sandboxes are a paid add-on on Enterprise Edition'
        ]
      },
      story: {
        name: 'Story Promotion',
        anchor: '#story-promotion',
        summary:
          'Every story travels on its own: merged into each stage through a short-lived promotion branch, and into production when it is signed off.',
        branches:
          'Environment branches `integration`, `uat`, `preprod`, `main`; `feature/*` from `main`, `promotion/*` per story and stage',
        switchOn: [
          '`pr-validation.yml` on pull requests into all four environment branches',
          '`deployment.yml` per environment branch as a delta from `github.event.before`, one GitHub Environment per org',
          'A promotion workflow that opens its pull requests with a GitHub App token - `GITHUB_TOKEN` would skip the validation',
          'Merge `main` back into every environment branch after each production deployment'
        ]
      },
      bundle: {
        name: 'Release Bundle',
        anchor: '#release-bundle',
        summary:
          'Stories travel one by one up to UAT; on the release date, a bundle of the signed-off stories ships through pre-production into production.',
        branches:
          'Environment branches `integration`, `uat`, `preprod`, `main`; `feature/*` and `promotion/*` up to UAT, one `release/*` branch per date from there',
        switchOn: [
          '`pr-validation.yml` on pull requests into all four environment branches',
          '`deployment.yml` per environment branch as a delta from `github.event.before`, one GitHub Environment per org',
          'A release branch per date: cut from `main`, signed-off stories merged in, promoted to `preprod` and `main`',
          'Merge `main` back into every environment branch after each production deployment'
        ]
      }
    }
  },
  B3: {
    id: 'B3',
    name: 'Modular Trunk',
    link: '/strategy/b3-modular-trunk',
    summary:
      'Several teams on one always-releasable trunk, work behind feature flags, metadata cut into modules - packages only where the version boundary pays.',
    environments: 'Scratch orgs or developer sandboxes + one staging sandbox + production',
    branches: 'Trunk-based - `main` plus short-lived, feature-flagged branches',
    switchOn: [
      '`pr-validation.yml` as a blocking required check on every pull request into `main`',
      '`scratch-org-ci.yml` to prove each module builds on its declared dependencies alone',
      '`deployment.yml` from `main` or a release tag, as a delta from the last release',
      'Feature flags as custom permissions, switched on by assigning a permission set'
    ]
  },
  B4: {
    id: 'B4',
    name: 'Multi-Org / Regional Rollout',
    link: '/strategy/b4-multi-org-regional',
    summary: 'Several production orgs fed from one repository; a shared core travels as a package.',
    environments: 'One sandbox chain per production org + shared scratch orgs',
    branches: 'Trunk plus short-lived `release/<org>` branches',
    switchOn: [
      '`deployment.yml` in a matrix, one GitHub Environment per production org',
      '`pr-validation.yml` once per region - a core change touches every org',
      '`sfdx-package-installation` with an explicit version pin per org',
      'CODEOWNERS mapping the core and each org overlay to its team',
      'One team and repository per org instead? Run B2 once per org - see per-org environment chains'
    ]
  },
  B5: {
    id: 'B5',
    name: 'Low-Code First',
    link: '/strategy/b5-low-code-admin-first',
    summary: 'Version control without making Git the admins’ problem - tooling does the promoting.',
    environments: 'Shared dev sandbox + UAT + production',
    branches: 'Two org-bound branches, `uat` and `main`; work-item branches created by tooling',
    switchOn: [
      '`pr-validation.yml` with `severity-threshold: 2` so the gate stays actionable',
      '`deployment.yml` on `uat` and `main`, with required reviewers on `production`',
      '`create-scratch-org.yml` as a self-service form in the Actions tab',
      'Name a pipeline owner - and a deputy. The bus factor is the real risk here'
    ]
  }
};

const answers = ref({});
const cursor = ref(0);

// Every question is always asked, in this order, so every path through the tree
// has the same length. An answer that cannot change the blueprint on a path
// still tailors its result.
const STEPS = ['orgs', 'teams', 'setup', 'maturity', 'release'];

function blueprintFor(a) {
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
function variantFor(a) {
  if (blueprintFor(a) !== 'B2' || !a.release) return null;
  return { continuous: 'story', bundled: 'bundle', scheduled: 'train' }[a.release] ?? null;
}

const steps = computed(() => STEPS);
const currentStepId = computed(() => STEPS[cursor.value] ?? null);
const currentStep = computed(() => (currentStepId.value ? QUESTIONS[currentStepId.value] : null));
const blueprint = computed(() => {
  const id = blueprintFor(answers.value);
  if (!id) return null;
  const base = BLUEPRINTS[id];
  const variant = base.variants?.[variantFor(answers.value)];
  if (!variant) return base;
  return { ...base, ...variant, name: `${base.name} · ${variant.name}`, link: base.link + variant.anchor };
});
const done = computed(() => STEPS.every((s) => answers.value[s]) && !!blueprint.value);
const started = computed(() => Object.keys(answers.value).length > 0);

/** The first question still open, or past the end once all are answered. */
function firstOpenStep() {
  const i = STEPS.findIndex((s) => !answers.value[s]);
  return i === -1 ? STEPS.length : i;
}

function choose(stepId, value) {
  // All questions stay in the flow, so changing an earlier answer keeps the
  // later ones - the result is simply recalculated.
  answers.value = { ...answers.value, [stepId]: value };
  cursor.value = firstOpenStep();
}

function back() {
  if (cursor.value > 0) cursor.value--;
}

function jumpTo(stepId) {
  const i = STEPS.indexOf(stepId);
  if (i >= 0) cursor.value = i;
}

function reset() {
  answers.value = {};
  cursor.value = 0;
}

/* ---------- Shareable result ---------------------------------------------
 * The answers live in the URL hash so a completed assessment can be pasted
 * into a ticket or a team channel and reopened exactly as it was. */

const HASH_KEY = 'strategy';

function writeHash() {
  if (typeof window === 'undefined') return;
  const encoded = STEPS.filter((k) => answers.value[k])
    .map((k) => `${k}:${answers.value[k]}`)
    .join(',');
  const url = new URL(window.location.href);
  url.hash = encoded ? `${HASH_KEY}=${encoded}` : '';
  window.history.replaceState(null, '', url.toString());
}

function readHash() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash.startsWith(`${HASH_KEY}=`)) return;
  const parsed = {};
  for (const pair of hash.slice(HASH_KEY.length + 1).split(',')) {
    const [k, v] = pair.split(':');
    // Only accept values this wizard actually defines - the hash is user input.
    if (QUESTIONS[k]?.options.some((o) => o.value === v)) parsed[k] = v;
  }
  answers.value = parsed;
  cursor.value = firstOpenStep();
}

/* ---------- Decision tree with the taken path highlighted ----------------- */

const diagram = ref(null);

// The tree has one level per question and every path crosses all of them, so
// all results sit on the bottom level. Where an answer cannot change the
// blueprint on a path, the path runs through a small pass-through node (P…)
// instead of a question. Edge indices follow the order the links are declared
// in TREE below - linkStyle addresses edges by that index.
const TREE = [
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

const TREE_NODES = {
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

const ALL_NODES = [...new Set(TREE.flatMap(([from, to]) => [from, to]))];
const PASS_NODES = ALL_NODES.filter((n) => n.startsWith('P'));
const ALL_EDGES = TREE.map((_, i) => i);

// Mermaid needs literal colors, so the brand tokens from theme/custom.css are
// repeated here - keep the two in step when the palette changes. The dark
// surfaces follow the night-blue --vp-c-bg-soft / --vp-c-bg-elv, not grays.
const PALETTE = {
  light: {
    activeFill: '#dde4f9',
    activeStroke: '#1d4ed8',
    activeText: '#0b1a4a',
    resultFill: '#1d4ed8',
    resultStroke: '#163cae',
    resultText: '#ffffff',
    dimFill: '#f6f6f7',
    dimStroke: '#d5d5db',
    dimText: '#8e8e93',
    neutralFill: '#f6f6f7',
    neutralStroke: '#9aa0a6',
    neutralText: '#3c3c43',
    activeLink: '#1d4ed8',
    dimLink: '#d5d5db'
  },
  dark: {
    activeFill: '#152a5e',
    activeStroke: '#6b9bff',
    activeText: '#dfe7ff',
    resultFill: '#1d4ed8',
    resultStroke: '#8cb2ff',
    resultText: '#ffffff',
    dimFill: '#111a2e',
    dimStroke: '#26334f',
    dimText: '#65718c',
    neutralFill: '#131d33',
    neutralStroke: '#3d4c6e',
    neutralText: '#c9d2e6',
    activeLink: '#6b9bff',
    dimLink: '#26334f'
  }
};

/** The nodes the answers given so far lead through, one per answered question,
 * starting at the root. Questions are answered in order, so the walk stops at
 * the first one still open. */
function pathNodes(a) {
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

/** Nodes and edges traversed by the answers given so far. */
function takenPath() {
  const path = pathNodes(answers.value);
  const edges = [];
  for (let i = 1; i < path.length; i++) {
    edges.push(TREE.findIndex(([from, to]) => from === path[i - 1] && to === path[i]));
  }
  // Before the first answer nothing is taken - not even the root.
  return { nodes: new Set(path.length > 1 ? path : []), edges, last: path[path.length - 1] };
}

function treeSource(isDark) {
  const c = isDark ? PALETTE.dark : PALETTE.light;
  const { nodes, edges, last } = takenPath();
  // The result lights up only once every question is answered.
  const resultId = done.value ? last : null;

  const declared = new Set();
  const node = (id) => {
    if (declared.has(id)) return id;
    declared.add(id);
    return id + (id.startsWith('P') ? '(( ))' : TREE_NODES[id]);
  };
  const lines = [
    'flowchart TD',
    ...TREE.map(([from, to, label]) => `    ${node(from)} ${label ? `-->|${label}|` : '-->'} ${node(to)}`),
    `    classDef neutral fill:${c.neutralFill},stroke:${c.neutralStroke},color:${c.neutralText};`,
    `    classDef active fill:${c.activeFill},stroke:${c.activeStroke},color:${c.activeText},stroke-width:2px;`,
    `    classDef result fill:${c.resultFill},stroke:${c.resultStroke},color:${c.resultText},stroke-width:2px,font-weight:bold;`,
    `    classDef dim fill:${c.dimFill},stroke:${c.dimStroke},color:${c.dimText};`,
    `    classDef pass fill:${c.neutralStroke},stroke:${c.neutralStroke};`,
    `    classDef passActive fill:${c.activeStroke},stroke:${c.activeStroke};`,
    `    classDef passDim fill:${c.dimStroke},stroke:${c.dimStroke};`
  ];

  const named = (list) => list.filter((n) => !PASS_NODES.includes(n));
  const passes = (list) => list.filter((n) => PASS_NODES.includes(n));
  const classes = (list, cls) => list.length && lines.push(`    class ${list.join(',')} ${cls};`);

  if (nodes.size === 0) {
    classes(named(ALL_NODES), 'neutral');
    classes(PASS_NODES, 'pass');
  } else {
    const taken = [...nodes].filter((n) => n !== resultId);
    const dim = ALL_NODES.filter((n) => !nodes.has(n));
    classes(named(taken), 'active');
    classes(passes(taken), 'passActive');
    if (resultId) lines.push(`    class ${resultId} result;`);
    classes(named(dim), 'dim');
    classes(passes(dim), 'passDim');

    const off = ALL_EDGES.filter((e) => !edges.includes(e));
    if (edges.length) lines.push(`    linkStyle ${edges.join(',')} stroke:${c.activeLink},stroke-width:2.5px;`);
    if (off.length) lines.push(`    linkStyle ${off.join(',')} stroke:${c.dimLink},opacity:0.45;`);
  }

  return lines.join('\n');
}

let lastDrawn = null;

async function drawTree() {
  if (!diagram.value) return;
  const isDark = document.documentElement.classList.contains('dark');
  const source = treeSource(isDark);
  // The theme observer below fires on any class change on <html>, not just the
  // dark-mode toggle. Re-rendering identical source would only cost a reflow
  // and make the diagram flicker.
  if (source === lastDrawn) return;
  try {
    const svg = await renderMermaid(source, isDark);
    if (diagram.value) diagram.value.innerHTML = svg;
    lastDrawn = source;
  } catch {
    // A diagram is a nice-to-have; never let it take the questionnaire down.
    if (diagram.value) diagram.value.innerHTML = '';
    lastDrawn = null;
  }
}

let themeObserver = null;

onMounted(async () => {
  readHash();
  await nextTick();
  drawTree();
  // VitePress toggles `.dark` on <html>; redraw so the diagram follows suit.
  themeObserver = new MutationObserver(() => drawTree());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onBeforeUnmount(() => themeObserver?.disconnect());

watch(
  answers,
  () => {
    writeHash();
    drawTree();
  },
  { deep: true }
);
</script>

<template>
  <div class="wizard">
    <!-- Question panel ------------------------------------------------- -->
    <div v-if="currentStep" class="wizard-panel">
      <div class="wizard-progress">
        <span class="wizard-step-count">Question {{ cursor + 1 }} of {{ steps.length }}</span>
        <div class="wizard-bar" role="presentation">
          <div class="wizard-bar-fill" :style="{ width: `${(cursor / steps.length) * 100}%` }" />
        </div>
      </div>

      <h3 class="wizard-question">{{ currentStep.title }}</h3>
      <p class="wizard-why">{{ currentStep.why }}</p>

      <div class="wizard-options">
        <button
          v-for="option in currentStep.options"
          :key="option.value"
          type="button"
          class="wizard-option"
          :class="{ 'is-chosen': answers[currentStepId] === option.value }"
          @click="choose(currentStepId, option.value)"
        >
          <span class="wizard-option-label">{{ option.label }}</span>
          <span class="wizard-option-detail">{{ option.detail }}</span>
        </button>
      </div>

      <div class="wizard-actions">
        <button v-if="cursor > 0" type="button" class="wizard-link-btn" @click="back">← Back</button>
        <button v-if="started" type="button" class="wizard-link-btn" @click="reset">Start over</button>
      </div>
    </div>

    <!-- Result panel --------------------------------------------------- -->
    <div v-else-if="done && blueprint" class="wizard-panel wizard-result">
      <span class="wizard-eyebrow">Your blueprint</span>
      <h3 class="wizard-result-title">
        <a :href="withBase(blueprint.link)">{{ blueprint.id }} - {{ blueprint.name }}</a>
      </h3>
      <p class="wizard-result-summary">{{ blueprint.summary }}</p>

      <dl class="wizard-facts">
        <div>
          <dt>Environments</dt>
          <dd>{{ blueprint.environments }}</dd>
        </div>
        <div>
          <dt>Branch model</dt>
          <dd>{{ blueprint.branches }}</dd>
        </div>
      </dl>

      <h4 class="wizard-subhead">What to switch on</h4>
      <ul class="wizard-switch-on">
        <li v-for="item in blueprint.switchOn" :key="item">{{ item }}</li>
      </ul>

      <p v-if="blueprint.id === 'B4' && answers.maturity === 'advanced'" class="wizard-note">
        <strong>Because your practice is advanced:</strong> run the trunk shape - one repository, the shared core as
        versioned modules or packages, and a short release branch per org rollout.
      </p>
      <p v-else-if="blueprint.id === 'B4'" class="wizard-note">
        <strong>Because your practice is still maturing:</strong> start with
        <a :href="withBase('/strategy/b4-multi-org-regional#per-org-environment-chains')">per-org environment chains</a>
        - one repository per org running B2, the shared metadata in a repository of its own.
      </p>
      <p v-if="blueprint.id === 'B2' && answers.maturity === 'starting'" class="wizard-note">
        <strong>Because you are starting out:</strong> begin with two stages - <code>uat</code> and <code>main</code> -
        and add <code>integration</code> and <code>preprod</code> once CI and delta deployments are routine. Four
        long-lived branches at level 1 collapse under their own weight.
      </p>
      <p v-if="answers.teams === 'several' && answers.setup === 'lowCode'" class="wizard-note">
        <strong>Because admins build most of the changes:</strong> keep this blueprint, but let tooling do the promoting
        - nobody should have to resolve an XML conflict by hand - and adopt the
        <a :href="withBase('/strategy/b5-low-code-admin-first#working-agreements')">working agreements of B5</a>.
      </p>
      <p v-if="answers.setup === 'balanced'" class="wizard-note">
        <strong>Because developers and admins work side by side:</strong> keep Git as the shared source of truth, but
        let admins contribute through tooling - the Salesforce extensions for VS Code or DevOps Center - so nobody has
        to resolve an XML conflict by hand.
      </p>
      <p v-if="blueprint.id === 'B3'" class="wizard-note">
        <strong>Decide what you ship per module:</strong> one source tree with feature flags while the metadata is not
        modular yet, source modules once it is, and unlocked packages only where the version boundary pays - see
        <a :href="withBase('/strategy/b3-modular-trunk#what-you-ship')">What you ship</a>.
      </p>
      <p v-if="answers.release === 'scheduled'" class="wizard-note">
        <strong>Because you release on planned dates:</strong> decouple merging from releasing. Changes collect in front
        of production and ship together on the date, behind a <em>production</em> GitHub Environment with required
        reviewers. Freeze each release's scope with a branch or a tag, so the next one can keep moving.
      </p>
      <p v-else-if="answers.release === 'bundled'" class="wizard-note">
        <strong>Because you bundle for production:</strong> sign-off stays per story, but production gets a frozen
        bundle on the release date - cut it from <code>main</code>, merge in only the signed-off stories, and ship it
        behind a <em>production</em> GitHub Environment with required reviewers.
      </p>
      <p v-else class="wizard-note">
        <strong>Because you ship story by story:</strong> merging - or promoting a story to production - is the release
        decision, so the validation check has to genuinely block. Keep a <em>production</em> GitHub Environment anyway:
        it gives you a deployment history, a pause button and, with required reviewers, your approval gate.
      </p>

      <div class="wizard-cta">
        <a class="wizard-btn" :href="withBase(blueprint.link)">Read the {{ blueprint.id }} blueprint</a>
        <a class="wizard-btn is-alt" :href="withBase('/strategy/mapping')">Kit mapping</a>
      </div>
    </div>

    <!-- Answer summary -------------------------------------------------- -->
    <div v-if="started" class="wizard-summary">
      <span class="wizard-summary-label">Your answers</span>
      <button
        v-for="stepId in steps.filter((s) => answers[s])"
        :key="stepId"
        type="button"
        class="wizard-chip"
        :title="`Change: ${QUESTIONS[stepId].title}`"
        @click="jumpTo(stepId)"
      >
        <span class="wizard-chip-key">{{ QUESTIONS[stepId].label }}</span>
        {{ QUESTIONS[stepId].options.find((o) => o.value === answers[stepId]).label }}
      </button>
      <button v-if="done" type="button" class="wizard-link-btn" @click="reset">Start over</button>
    </div>

    <!-- Decision tree ---------------------------------------------------- -->
    <figure class="wizard-tree">
      <div ref="diagram" class="wizard-tree-canvas" />
      <figcaption>
        {{
          started
            ? 'The highlighted path is the one your answers took.'
            : 'The full decision tree - answer above to trace your path through it.'
        }}
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.wizard {
  margin: 24px 0 8px;
}

.wizard-panel {
  padding: 20px 22px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

/* Progress ---------------------------------------------------------------- */
.wizard-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.wizard-step-count {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.wizard-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--vp-c-divider);
  overflow: hidden;
}

.wizard-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--vp-c-brand-1);
  transition: width 0.25s ease;
}

/* Question ---------------------------------------------------------------- */
.wizard-question {
  margin: 0 0 6px;
  font-size: 20px;
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: -0.01em;
  border: 0;
  padding: 0;
}

.wizard-why {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.wizard-options {
  display: grid;
  gap: 10px;
}

@media (min-width: 720px) {
  .wizard-options {
    grid-template-columns: 1fr 1fr;
  }
}

.wizard-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  text-align: left;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    transform 0.1s;
}

.wizard-option:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-elv);
}

.wizard-option:active {
  transform: translateY(1px);
}

.wizard-option.is-chosen {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.wizard-option-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.wizard-option-detail {
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

/* Actions ----------------------------------------------------------------- */
.wizard-actions {
  display: flex;
  gap: 16px;
  margin-top: 14px;
}

.wizard-link-btn {
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-3);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  transition: color 0.2s;
}

.wizard-link-btn:hover {
  color: var(--vp-c-brand-1);
}

/* Result ------------------------------------------------------------------ */
.wizard-result {
  border-color: var(--vp-c-brand-1);
}

.wizard-eyebrow {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
}

.wizard-result-title {
  margin: 0 0 8px;
  font-size: 24px;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -0.02em;
  border: 0;
  padding: 0;
}

.wizard-result-title a {
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.wizard-result-title a:hover {
  color: var(--vp-c-brand-1);
}

.wizard-result-summary {
  margin: 0 0 16px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.wizard-facts {
  display: grid;
  gap: 12px;
  margin: 0 0 20px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--vp-c-bg);
}

@media (min-width: 720px) {
  .wizard-facts {
    grid-template-columns: 1fr 1fr;
  }
}

.wizard-facts dt {
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.wizard-facts dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-1);
}

.wizard-subhead {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  border: 0;
  padding: 0;
}

.wizard-switch-on {
  margin: 0 0 16px;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.7;
}

.wizard-note {
  margin: 0 0 20px;
  padding: 12px 14px;
  border-left: 3px solid var(--vp-c-brand-1);
  border-radius: 0 8px 8px 0;
  background: var(--vp-c-brand-soft);
  font-size: 14px;
  line-height: 1.6;
}

.wizard-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.wizard-btn {
  display: inline-block;
  padding: 9px 18px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  background: var(--vp-button-brand-bg, var(--vp-c-brand-1));
  color: var(--vp-button-brand-text, #fff);
  transition: background-color 0.2s;
}

.wizard-btn:hover {
  background: var(--vp-button-brand-hover-bg, var(--vp-c-brand-2));
}

.wizard-btn.is-alt {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.wizard-btn.is-alt:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}

/* Summary chips ------------------------------------------------------------ */
.wizard-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.wizard-summary-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.wizard-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
}

.wizard-chip:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.wizard-chip-key {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

/* Diagram ------------------------------------------------------------------ */
.wizard-tree {
  margin: 22px 0 0;
}

.wizard-tree-canvas {
  overflow-x: auto;
  padding: 8px 0;
  text-align: center;
}

.wizard-tree-canvas :deep(svg) {
  max-width: 100%;
  height: auto;
}

.wizard-tree figcaption {
  margin-top: 6px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
</style>
