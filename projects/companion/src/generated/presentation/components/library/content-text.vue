<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-text.ts";
import { specification as spec } from "../../../domain/visual/vc-62.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-62" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-177" v-if="model.visible('vn-177')" :style="model.style('vn-177')" v-bind="model.attrs('vn-177')" v-on="model.on('vn-177')">
  <h2 data-design-node="vn-178" v-if="model.visible('vn-178')" :style="model.style('vn-178')">{{ model.text('vn-178') }}</h2>
  <p data-design-node="vn-179" v-if="model.visible('vn-179')" :style="model.style('vn-179')">{{ model.text('vn-179') }}</p>
  <div data-design-node="vn-180" v-if="model.visible('vn-180')" :style="model.style('vn-180')">
    <slot name="content">
      <p data-design-node="vn-182" v-if="model.visible('vn-182')">{{ model.text('vn-182') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-181" v-if="model.visible('vn-181')" :style="model.style('vn-181')" v-bind="model.props('vn-181')" v-on="model.on('vn-181')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
