<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-image-gallery.ts";
import { specification as spec } from "../../../domain/visual/vc-82.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-82" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-330" v-if="model.visible('vn-330')" :style="model.style('vn-330')" v-bind="model.attrs('vn-330')" v-on="model.on('vn-330')">
  <h2 data-design-node="vn-331" v-if="model.visible('vn-331')" :style="model.style('vn-331')">{{ model.text('vn-331') }}</h2>
  <img data-design-node="vn-332" v-if="model.visible('vn-332')" :style="model.style('vn-332')" :aria-description="model.a11y('vn-332')" v-bind="model.attrs('vn-332')" v-on="model.on('vn-332')" />
  <div data-design-node="vn-333" v-if="model.visible('vn-333')" :style="model.style('vn-333')">
    <slot name="content">
      <p data-design-node="vn-335" v-if="model.visible('vn-335')">{{ model.text('vn-335') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-334" v-if="model.visible('vn-334')" :style="model.style('vn-334')" v-bind="model.props('vn-334')" v-on="model.on('vn-334')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
