<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-calendar.ts";
import { specification as spec } from "../../../domain/visual/vc-91.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-91" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-401" v-if="model.visible('vn-401')" :style="model.style('vn-401')" v-bind="model.attrs('vn-401')" v-on="model.on('vn-401')">
  <h2 data-design-node="vn-402" v-if="model.visible('vn-402')" :style="model.style('vn-402')">{{ model.text('vn-402') }}</h2>
  <p data-design-node="vn-403" v-if="model.visible('vn-403')" :style="model.style('vn-403')">{{ model.text('vn-403') }}</p>
  <div data-design-node="vn-404" v-if="model.visible('vn-404')" :style="model.style('vn-404')">
    <slot name="content">
      <p data-design-node="vn-406" v-if="model.visible('vn-406')">{{ model.text('vn-406') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-405" v-if="model.visible('vn-405')" :style="model.style('vn-405')" v-bind="model.props('vn-405')" v-on="model.on('vn-405')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
