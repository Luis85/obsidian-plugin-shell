<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-notice.ts";
import { specification as spec } from "../../../domain/visual/vc-74.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-74" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-274" v-if="model.visible('vn-274')" :style="model.style('vn-274')" v-bind="model.attrs('vn-274')" v-on="model.on('vn-274')">
  <h2 data-design-node="vn-275" v-if="model.visible('vn-275')" :style="model.style('vn-275')">{{ model.text('vn-275') }}</h2>
  <UAlert data-design-node="vn-276" v-if="model.visible('vn-276')" :style="model.style('vn-276')" v-bind="model.props('vn-276')" v-on="model.on('vn-276')"></UAlert>
  <div data-design-node="vn-277" v-if="model.visible('vn-277')" :style="model.style('vn-277')">
    <slot name="content">
      <p data-design-node="vn-279" v-if="model.visible('vn-279')">{{ model.text('vn-279') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-278" v-if="model.visible('vn-278')" :style="model.style('vn-278')" v-bind="model.props('vn-278')" v-on="model.on('vn-278')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
