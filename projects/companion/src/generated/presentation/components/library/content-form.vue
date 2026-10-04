<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-form.ts";
import { specification as spec } from "../../../domain/visual/vc-69.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name) => {
  switch (name) {
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-69" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-239" v-if="model.visible('vn-239')" :style="model.style('vn-239')" v-bind="model.attrs('vn-239')" v-on="model.on('vn-239')">
  <h2 data-design-node="vn-240" v-if="model.visible('vn-240')" :style="model.style('vn-240')">{{ model.text('vn-240') }}</h2>
  <UInput data-design-node="vn-241" v-if="model.visible('vn-241')" :style="model.style('vn-241')" :aria-description="model.a11y('vn-241')" v-bind="model.props('vn-241')" v-on="model.on('vn-241')"></UInput>
  <div data-design-node="vn-242" v-if="model.visible('vn-242')" :style="model.style('vn-242')">
    <slot name="content">
      <p data-design-node="vn-244" v-if="model.visible('vn-244')">{{ model.text('vn-244') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-243" v-if="model.visible('vn-243')" :style="model.style('vn-243')" v-bind="model.props('vn-243')" v-on="model.on('vn-243')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
