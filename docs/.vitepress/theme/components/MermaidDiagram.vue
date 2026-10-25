<script setup>
/**
 * Renders a ```mermaid fence on the site - the markdown hook in config.mts
 * turns every such fence into this component. GitHub renders the same fences
 * natively, so the Markdown source stays the single definition of a diagram.
 *
 * Follows the dark-mode toggle - ../mermaid holds the colors for both modes.
 *
 * A wide diagram is small in the content column, so a click (or the Enlarge
 * button) opens it in a full-screen dialog, large enough to read the labels.
 * The dialog scrolls where the diagram is larger than the screen; the zoom
 * buttons and "Fit" (the whole diagram) adjust it.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';
import { renderMermaid } from '../mermaid';

const props = defineProps({
  // URI-encoded by the markdown hook, so the source survives as an attribute.
  code: { type: String, required: true }
});

const { isDark } = useData();
const source = computed(() => decodeURIComponent(props.code));
const svg = ref('');
const failed = ref(false);

async function draw() {
  try {
    svg.value = await renderMermaid(source.value, isDark.value);
    failed.value = false;
  } catch {
    // Never let a diagram take the page down - show its source instead, which
    // still carries the information.
    failed.value = true;
  }
}

onMounted(draw);
watch(isDark, draw);

const dialog = ref(null);
const body = ref(null);
// Width of the diagram in the dialog, in CSS pixels.
const width = ref(0);
const STEP = 1.25;

/** Natural size of the rendered SVG: mermaid writes it into the viewBox. */
function naturalSize() {
  const box = body.value?.querySelector('svg')?.viewBox?.baseVal;
  return box && box.width ? { w: box.width, h: box.height } : null;
}

/** The largest width at which the whole diagram fits the dialog. */
function fitWidth() {
  const style = getComputedStyle(body.value);
  const innerW = body.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const innerH = body.value.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const size = naturalSize();
  return size ? Math.min(innerW, (innerH * size.w) / size.h) : innerW;
}

// mermaid draws its labels at 16px in the natural size. The dialog opens with
// the whole diagram when its labels stay readable that way, otherwise at three
// quarters of the natural size and lets the player scroll - always on a phone.
const READABLE = 9 / 16;
const ZOOMED = 0.75;

async function open() {
  dialog.value.showModal();
  document.documentElement.classList.add('mermaid-dialog-open');
  await nextTick();
  const natural = naturalSize()?.w ?? 0;
  const whole = fitWidth();
  width.value = whole >= natural * READABLE ? whole : Math.max(whole, natural * ZOOMED);
}

function close() {
  dialog.value.close();
}

function onClose() {
  document.documentElement.classList.remove('mermaid-dialog-open');
}

const zoomIn = () => (width.value *= STEP);
const zoomOut = () => (width.value = Math.max(fitWidth() / 2, width.value / STEP));
const fit = () => (width.value = fitWidth());
</script>

<template>
  <pre v-if="failed"><code>{{ source }}</code></pre>
  <div v-else class="mermaid-frame">
    <div class="mermaid" @click="open" v-html="svg" />
    <button type="button" class="mermaid-enlarge" @click="open">⤢ Enlarge</button>
    <dialog ref="dialog" class="mermaid-dialog" aria-label="Diagram" @close="onClose">
      <div class="mermaid-dialog-bar">
        <button type="button" aria-label="Zoom out" @click="zoomOut">−</button>
        <button type="button" aria-label="Zoom in" @click="zoomIn">+</button>
        <button type="button" @click="fit">Fit</button>
        <button type="button" class="mermaid-dialog-close" aria-label="Close" autofocus @click="close">✕</button>
      </div>
      <div ref="body" class="mermaid-dialog-body" @click.self="close">
        <div class="mermaid" :style="{ width: `${width}px` }" v-html="svg" />
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.mermaid-frame {
  margin: 16px 0;
}

.mermaid-frame > .mermaid {
  cursor: zoom-in;
}

.mermaid-enlarge {
  display: block;
  margin: 4px 0 0 auto;
  padding: 2px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 13px;
  opacity: 0.85;
  transition:
    color 0.2s,
    border-color 0.2s;
}

.mermaid-enlarge:hover,
.mermaid-enlarge:focus-visible {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  opacity: 1;
}

.mermaid-dialog {
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.mermaid-dialog[open] {
  display: flex;
  flex-direction: column;
}

.mermaid-dialog-bar {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.mermaid-dialog-bar button {
  min-width: 40px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 15px;
}

.mermaid-dialog-bar button:hover,
.mermaid-dialog-bar button:focus-visible {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.mermaid-dialog-close {
  margin-left: 8px;
}

/* Auto margins center the diagram while it is smaller than the dialog and
 * collapse to zero once it overflows, so every edge stays scrollable. */
.mermaid-dialog-body {
  display: flex;
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.mermaid-dialog-body > .mermaid {
  flex-shrink: 0;
  margin: auto;
}

.mermaid-dialog-body > .mermaid :deep(svg) {
  display: block;
  width: 100%;
  max-width: none !important;
  height: auto;
}
</style>
