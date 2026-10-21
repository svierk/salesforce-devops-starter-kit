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
  lowCode: {
    label: 'Build style',
    title: 'Who builds most of the changes?',
    why: 'Salesforce is unusual in that much of the change is made by clicking, by people for whom a rebase is not a reasonable ask. If that is your team, the strategy has to hide Git rather than expose it.',
    options: [
      {
        value: 'proCode',
        label: 'Mostly developers, comfortable with Git',
        detail: 'Pull requests and branches can be everyone’s interface.'
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
    why: 'Maturity caps how many environments you can operate. Counter-intuitively, higher maturity means fewer long-lived branches, not more.',
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
  modularity: {
    label: 'Modularity',
    title: 'Is your metadata modular enough for packages?',
    why: 'Packaging is what removes long-lived branches. It needs metadata that genuinely factors apart in practice - not just on a whiteboard.',
    options: [
      {
        value: 'modular',
        label: 'Yes - it splits into separable parts',
        detail: 'Clear module boundaries and explicit dependencies between them.'
      },
      {
        value: 'monolith',
        label: 'Not yet - one happy soup',
        detail: 'Everything references everything; staged promotion is the realistic model.'
      }
    ]
  },
  release: {
    label: 'Release style',
    title: 'How do you release?',
    why: 'What a release is for you decides how changes travel to production. With several streams on one org it picks between two variants of the blueprint; everywhere else it shapes how you set the blueprint up.',
    options: [
      {
        value: 'continuous',
        label: 'Continuously, story by story',
        detail: 'Each change ships as soon as it is ready and signed off.'
      },
      {
        value: 'scheduled',
        label: 'On planned release dates',
        detail: 'Changes collect and ship together; scope is frozen per release.'
      },
      {
        value: 'packages',
        label: 'As versioned packages',
        detail: 'A release is a new package version, installed org by org.'
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
      }
    }
  },
  B3: {
    id: 'B3',
    name: 'Package-Based / Modular',
    link: '/strategy/b3-package-based-modular',
    summary: 'Versioned unlocked packages, developed against scratch orgs, released independently.',
    environments: 'Scratch orgs + one staging sandbox + production',
    branches: 'Trunk-based - `main` plus short-lived, feature-flagged branches',
    switchOn: [
      '`scratch-org-ci.yml` as the primary gate on every pull request',
      '`pr-validation.yml` alongside it for fast static-analysis feedback',
      '`create-scratch-org.yml` for developer self-service',
      'Note: `sf package version create` / `promote` has no building block yet - plain CLI step'
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

/** The questions worth asking, given what has been answered so far. */
function stepsFor(a) {
  const steps = ['orgs'];
  if (a.orgs === 'single') {
    steps.push('teams');
    if (a.teams) steps.push('lowCode');
    if (a.teams === 'several' && a.lowCode) {
      steps.push('maturity');
      // Packaging only becomes a question once the basics are in place.
      if (a.maturity && a.maturity !== 'starting') steps.push('modularity');
    }
  }
  // The release style picks B2's variant and tailors every other result - ask it
  // last, and only once the questions so far have produced a blueprint. Route on
  // the answers that are part of the flow, so a stale one cannot produce a result.
  const inFlow = Object.fromEntries(steps.filter((s) => a[s]).map((s) => [s, a[s]]));
  if (blueprintFor(inFlow)) steps.push('release');
  return steps;
}

function blueprintFor(a) {
  if (a.orgs === 'multi') return 'B4';
  if (a.orgs !== 'single') return null;
  if (a.teams === 'one') {
    if (a.lowCode === 'lowCode') return 'B5';
    if (a.lowCode === 'proCode') return 'B1';
    return null;
  }
  if (a.teams === 'several' && a.lowCode) {
    // Build style does not change the blueprint for several teams - it adds the
    // tool-driven promotion note to the result instead.
    if (a.maturity === 'starting') return 'B2';
    if (a.modularity === 'modular') return 'B3';
    if (a.modularity === 'monolith') return 'B2';
  }
  return null;
}

/** B2's variant follows the release style; versioned packages without modular
 * metadata ship on release dates until B3 is in reach. */
function variantFor(a) {
  if (blueprintFor(a) !== 'B2' || !a.release) return null;
  return a.release === 'continuous' ? 'story' : 'train';
}

const steps = computed(() => stepsFor(answers.value));
const currentStepId = computed(() => steps.value[cursor.value] ?? null);
const currentStep = computed(() => (currentStepId.value ? QUESTIONS[currentStepId.value] : null));
const blueprint = computed(() => {
  const id = blueprintFor(answers.value);
  if (!id) return null;
  const base = BLUEPRINTS[id];
  const variant = base.variants?.[variantFor(answers.value)];
  if (!variant) return base;
  return { ...base, ...variant, name: `${base.name} · ${variant.name}`, link: base.link + variant.anchor };
});
const done = computed(() => steps.value.every((s) => answers.value[s]) && !!blueprint.value);
const started = computed(() => Object.keys(answers.value).length > 0);

function choose(stepId, value) {
  const next = { ...answers.value, [stepId]: value };
  // Changing an earlier answer can remove later questions from the flow - drop
  // any answer that is no longer part of it, so a stale one can never leak into
  // the result.
  const valid = stepsFor(next);
  answers.value = Object.fromEntries(Object.entries(next).filter(([k]) => valid.includes(k)));
  const firstUnanswered = valid.findIndex((s) => !answers.value[s]);
  cursor.value = firstUnanswered === -1 ? valid.length : firstUnanswered;
}

function back() {
  if (cursor.value > 0) cursor.value--;
}

function jumpTo(stepId) {
  const i = steps.value.indexOf(stepId);
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
  const order = ['orgs', 'teams', 'lowCode', 'maturity', 'modularity', 'release'];
  const encoded = order
    .filter((k) => answers.value[k])
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
  const valid = stepsFor(parsed);
  answers.value = Object.fromEntries(Object.entries(parsed).filter(([k]) => valid.includes(k)));
  const firstUnanswered = valid.findIndex((s) => !answers.value[s]);
  cursor.value = firstUnanswered === -1 ? valid.length : firstUnanswered;
}

/* ---------- Decision tree with the taken path highlighted ----------------- */

const diagram = ref(null);

// Edge indices follow the order the links are declared in treeSource().
const EDGE = {
  multiOrg: 0,
  singleOrg: 1,
  oneTeam: 2,
  severalTeams: 3,
  lowCode: 4,
  proCode: 5,
  modular: 6,
  notModular: 7,
  storyByStory: 8,
  releaseDates: 9
};

const ALL_NODES = ['QO', 'QT', 'QL', 'QM', 'QR', 'B1', 'B2S', 'B2T', 'B3', 'B4', 'B5'];
const ALL_EDGES = Object.values(EDGE);

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

/** Nodes and edges traversed by the answers given so far. Derived from the
 * answers as a whole rather than looked up per answer: whether "level 2-3"
 * leads on to B3 depends on the modularity answer as well. */
function takenPath() {
  const a = answers.value;
  const nodes = new Set();
  const edges = [];
  const take = (edge, node) => {
    edges.push(edge);
    nodes.add(node);
  };
  if (!a.orgs) return { nodes, edges };
  nodes.add('QO');
  if (a.orgs === 'multi') {
    take(EDGE.multiOrg, 'B4');
    return { nodes, edges };
  }
  take(EDGE.singleOrg, 'QT');
  if (a.teams === 'one') {
    take(EDGE.oneTeam, 'QL');
    if (a.lowCode === 'lowCode') take(EDGE.lowCode, 'B5');
    if (a.lowCode === 'proCode') take(EDGE.proCode, 'B1');
  } else if (a.teams === 'several') {
    take(EDGE.severalTeams, 'QM');
    const id = blueprintFor(a);
    if (id === 'B3') take(EDGE.modular, 'B3');
    if (id === 'B2') {
      take(EDGE.notModular, 'QR');
      if (a.release === 'continuous') take(EDGE.storyByStory, 'B2S');
      else if (a.release) take(EDGE.releaseDates, 'B2T');
    }
  }
  return { nodes, edges };
}

function treeSource(isDark) {
  const c = isDark ? PALETTE.dark : PALETTE.light;
  const { nodes, edges } = takenPath();
  // B2 is two leaves in the tree; until the release style picks one, the path
  // ends at QR without a result.
  const variant = variantFor(answers.value);
  const id = blueprintFor(answers.value);
  const resultId = id === 'B2' ? (variant ? (variant === 'story' ? 'B2S' : 'B2T') : null) : id;

  const lines = [
    'flowchart TD',
    '    QO{"How many<br/>production orgs?"}',
    '    QO -->|Several| B4["<b>B4</b><br/>Multi-Org / Regional"]',
    '    QO -->|One| QT{"How many teams or<br/>parallel workstreams?"}',
    '    QT -->|One| QL{"Mostly admins and<br/>low-code builders?"}',
    '    QT -->|Several| QM{"Level 2+ and metadata<br/>modular enough for packages?"}',
    '    QL -->|Yes| B5["<b>B5</b><br/>Low-Code First"]',
    '    QL -->|No| B1["<b>B1</b><br/>Simple Org Development"]',
    '    QM -->|Yes| B3["<b>B3</b><br/>Package-Based / Modular"]',
    '    QM -->|Not yet| QR{"Ship story by story<br/>or on release dates?"}',
    '    QR -->|Story by story| B2S["<b>B2</b><br/>Environment Branches<br/>· Story Promotion"]',
    '    QR -->|Release dates| B2T["<b>B2</b><br/>Environment Branches<br/>· Release Train"]',
    `    classDef neutral fill:${c.neutralFill},stroke:${c.neutralStroke},color:${c.neutralText};`,
    `    classDef active fill:${c.activeFill},stroke:${c.activeStroke},color:${c.activeText},stroke-width:2px;`,
    `    classDef result fill:${c.resultFill},stroke:${c.resultStroke},color:${c.resultText},stroke-width:2px,font-weight:bold;`,
    `    classDef dim fill:${c.dimFill},stroke:${c.dimStroke},color:${c.dimText};`
  ];

  if (nodes.size === 0) {
    lines.push(`    class ${ALL_NODES.join(',')} neutral;`);
  } else {
    const active = [...nodes].filter((n) => n !== resultId);
    const dim = ALL_NODES.filter((n) => !nodes.has(n));
    if (active.length) lines.push(`    class ${active.join(',')} active;`);
    if (resultId) lines.push(`    class ${resultId} result;`);
    if (dim.length) lines.push(`    class ${dim.join(',')} dim;`);

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

      <p v-if="answers.teams === 'several' && answers.maturity === 'starting'" class="wizard-note">
        <strong>Because you are starting out:</strong> begin with two stages - <code>uat</code> and <code>main</code> -
        and add <code>integration</code> and <code>preprod</code> once CI and delta deployments are routine. Four
        long-lived branches at level 1 collapse under their own weight.
      </p>
      <p v-if="answers.teams === 'several' && answers.lowCode === 'lowCode'" class="wizard-note">
        <strong>Because admins build most of the changes:</strong> keep this blueprint, but let tooling do the promoting
        - nobody should have to resolve an XML conflict by hand - and adopt the
        <a :href="withBase('/strategy/b5-low-code-admin-first#working-agreements')">working agreements of B5</a>.
      </p>
      <p v-if="answers.release === 'scheduled'" class="wizard-note">
        <strong>Because you release on planned dates:</strong> decouple merging from releasing. Changes collect in front
        of production and ship together on the date, behind a <em>production</em> GitHub Environment with required
        reviewers. Freeze each release's scope with a branch or a tag, so the next one can keep moving.
      </p>
      <p v-else-if="answers.release === 'packages'" class="wizard-note">
        <strong>Because you release versioned packages:</strong> a release is a promoted package version, not a merge.
        Pin versions per org, and gate production installs behind a GitHub Environment with required reviewers.
        <template v-if="blueprint.id !== 'B3' && blueprint.id !== 'B4'">
          Packaging needs modular metadata - <a :href="withBase('/strategy/b3-package-based-modular')">B3</a> shows the
          way there.
        </template>
      </p>
      <p v-else class="wizard-note">
        <strong>Because you ship continuously:</strong> merging - or promoting a story to production - is the release
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
