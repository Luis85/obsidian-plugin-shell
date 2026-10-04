<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-faq.ts";
import { specification as spec } from "../../../domain/visual/vc-80.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-80" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-316" v-if="model.visible('vn-316')" :style="model.style('vn-316')" v-bind="model.attrs('vn-316')" v-on="model.on('vn-316')">
  <h2 data-design-node="vn-317" v-if="model.visible('vn-317')" :style="model.style('vn-317')">{{ model.text('vn-317') }}</h2>
  <p data-design-node="vn-318" v-if="model.visible('vn-318')" :style="model.style('vn-318')">{{ model.text('vn-318') }}</p>
  <div data-design-node="vn-319" v-if="model.visible('vn-319')" :style="model.style('vn-319')">
    <slot name="content">
      <p data-design-node="vn-321" v-if="model.visible('vn-321')">{{ model.text('vn-321') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-320" v-if="model.visible('vn-320')" :style="model.style('vn-320')" v-bind="model.props('vn-320')" v-on="model.on('vn-320')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
