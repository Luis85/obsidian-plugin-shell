<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-heading.ts";
import { specification as spec } from "../../../domain/visual/vc-61.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-61" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-170" v-if="model.visible('vn-170')" :style="model.style('vn-170')" v-bind="model.attrs('vn-170')" v-on="model.on('vn-170')">
  <h2 data-design-node="vn-171" v-if="model.visible('vn-171')" :style="model.style('vn-171')">{{ model.text('vn-171') }}</h2>
  <p data-design-node="vn-172" v-if="model.visible('vn-172')" :style="model.style('vn-172')">{{ model.text('vn-172') }}</p>
  <div data-design-node="vn-173" v-if="model.visible('vn-173')" :style="model.style('vn-173')">
    <slot name="content">
      <p data-design-node="vn-175" v-if="model.visible('vn-175')">{{ model.text('vn-175') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-174" v-if="model.visible('vn-174')" :style="model.style('vn-174')" v-bind="model.props('vn-174')" v-on="model.on('vn-174')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
