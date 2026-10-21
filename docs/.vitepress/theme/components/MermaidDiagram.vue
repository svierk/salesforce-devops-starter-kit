<script setup>
/**
 * Renders a ```mermaid fence on the site - the markdown hook in config.mts
 * turns every such fence into this component. GitHub renders the same fences
 * natively, so the Markdown source stays the single definition of a diagram.
 *
 * Follows the dark-mode toggle - ../mermaid holds the colors for both modes.
 */
import { computed, onMounted, ref, watch } from 'vue';
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
</script>

<template>
  <pre v-if="failed"><code>{{ source }}</code></pre>
  <div v-else class="mermaid" v-html="svg" />
</template>
