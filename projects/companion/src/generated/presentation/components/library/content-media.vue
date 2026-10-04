<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-media.ts";
import { specification as spec } from "../../../domain/visual/vc-71.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-71" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-253" v-if="model.visible('vn-253')" :style="model.style('vn-253')" v-bind="model.attrs('vn-253')" v-on="model.on('vn-253')">
  <h2 data-design-node="vn-254" v-if="model.visible('vn-254')" :style="model.style('vn-254')">{{ model.text('vn-254') }}</h2>
  <img data-design-node="vn-255" v-if="model.visible('vn-255')" :style="model.style('vn-255')" :aria-description="model.a11y('vn-255')" v-bind="model.attrs('vn-255')" v-on="model.on('vn-255')" />
  <div data-design-node="vn-256" v-if="model.visible('vn-256')" :style="model.style('vn-256')">
    <slot name="content">
      <p data-design-node="vn-258" v-if="model.visible('vn-258')">{{ model.text('vn-258') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-257" v-if="model.visible('vn-257')" :style="model.style('vn-257')" v-bind="model.props('vn-257')" v-on="model.on('vn-257')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
