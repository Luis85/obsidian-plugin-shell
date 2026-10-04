<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-site-footer.ts";
import { specification as spec } from "../../../domain/visual/vc-81.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-81" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-323" v-if="model.visible('vn-323')" :style="model.style('vn-323')" v-bind="model.attrs('vn-323')" v-on="model.on('vn-323')">
  <h2 data-design-node="vn-324" v-if="model.visible('vn-324')" :style="model.style('vn-324')">{{ model.text('vn-324') }}</h2>
  <p data-design-node="vn-325" v-if="model.visible('vn-325')" :style="model.style('vn-325')">{{ model.text('vn-325') }}</p>
  <div data-design-node="vn-326" v-if="model.visible('vn-326')" :style="model.style('vn-326')">
    <slot name="content">
      <p data-design-node="vn-328" v-if="model.visible('vn-328')">{{ model.text('vn-328') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-327" v-if="model.visible('vn-327')" :style="model.style('vn-327')" v-bind="model.props('vn-327')" v-on="model.on('vn-327')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
