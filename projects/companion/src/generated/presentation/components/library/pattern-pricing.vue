<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-pricing.ts";
import { specification as spec } from "../../../domain/visual/vc-78.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-78" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-302" v-if="model.visible('vn-302')" :style="model.style('vn-302')" v-bind="model.attrs('vn-302')" v-on="model.on('vn-302')">
  <h2 data-design-node="vn-303" v-if="model.visible('vn-303')" :style="model.style('vn-303')">{{ model.text('vn-303') }}</h2>
  <p data-design-node="vn-304" v-if="model.visible('vn-304')" :style="model.style('vn-304')">{{ model.text('vn-304') }}</p>
  <div data-design-node="vn-305" v-if="model.visible('vn-305')" :style="model.style('vn-305')">
    <slot name="content">
      <p data-design-node="vn-307" v-if="model.visible('vn-307')">{{ model.text('vn-307') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-306" v-if="model.visible('vn-306')" :style="model.style('vn-306')" v-bind="model.props('vn-306')" v-on="model.on('vn-306')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
