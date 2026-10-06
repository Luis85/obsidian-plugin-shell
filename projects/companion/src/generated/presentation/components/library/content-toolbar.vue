<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-toolbar.ts";
import { specification as spec } from "../../../domain/visual/vc-64.ts";
import UButton from "@nuxt/ui/components/Button.vue";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-64" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-195" v-if="model.visible('vn-195')" :style="model.style('vn-195')" v-bind="model.attrs('vn-195')" v-on="model.on('vn-195')">
  <h2 data-design-node="vn-196" v-if="model.visible('vn-196')" :style="model.style('vn-196')">{{ model.text('vn-196') }}</h2>
  <p data-design-node="vn-197" v-if="model.visible('vn-197')" :style="model.style('vn-197')">{{ model.text('vn-197') }}</p>
  <div data-design-node="vn-198" v-if="model.visible('vn-198')" :style="model.style('vn-198')">
    <slot name="content">
      <p data-design-node="vn-200" v-if="model.visible('vn-200')">{{ model.text('vn-200') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-199" v-if="model.visible('vn-199')" :style="model.style('vn-199')" v-bind="model.props('vn-199')" v-on="model.on('vn-199')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
