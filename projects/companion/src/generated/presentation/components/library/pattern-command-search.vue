<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-command-search.ts";
import { specification as spec } from "../../../domain/visual/vc-97.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-97" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-447" v-if="model.visible('vn-447')" :style="model.style('vn-447')" v-bind="model.attrs('vn-447')" v-on="model.on('vn-447')">
  <h2 data-design-node="vn-448" v-if="model.visible('vn-448')" :style="model.style('vn-448')">{{ model.text('vn-448') }}</h2>
  <UInput data-design-node="vn-449" v-if="model.visible('vn-449')" :style="model.style('vn-449')" :aria-description="model.a11y('vn-449')" v-bind="model.props('vn-449')" v-on="model.on('vn-449')"></UInput>
  <div data-design-node="vn-450" v-if="model.visible('vn-450')" :style="model.style('vn-450')">
    <slot name="content">
      <p data-design-node="vn-452" v-if="model.visible('vn-452')">{{ model.text('vn-452') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-451" v-if="model.visible('vn-451')" :style="model.style('vn-451')" v-bind="model.props('vn-451')" v-on="model.on('vn-451')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
