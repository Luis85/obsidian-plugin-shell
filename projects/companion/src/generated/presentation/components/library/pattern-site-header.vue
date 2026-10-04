<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-site-header.ts";
import { specification as spec } from "../../../domain/visual/vc-75.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-75" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-281" v-if="model.visible('vn-281')" :style="model.style('vn-281')" v-bind="model.attrs('vn-281')" v-on="model.on('vn-281')">
  <h2 data-design-node="vn-282" v-if="model.visible('vn-282')" :style="model.style('vn-282')">{{ model.text('vn-282') }}</h2>
  <p data-design-node="vn-283" v-if="model.visible('vn-283')" :style="model.style('vn-283')">{{ model.text('vn-283') }}</p>
  <div data-design-node="vn-284" v-if="model.visible('vn-284')" :style="model.style('vn-284')">
    <slot name="content">
      <p data-design-node="vn-286" v-if="model.visible('vn-286')">{{ model.text('vn-286') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-285" v-if="model.visible('vn-285')" :style="model.style('vn-285')" v-bind="model.props('vn-285')" v-on="model.on('vn-285')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
