<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-newsletter.ts";
import { specification as spec } from "../../../domain/visual/vc-84.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-84" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-344" v-if="model.visible('vn-344')" :style="model.style('vn-344')" v-bind="model.attrs('vn-344')" v-on="model.on('vn-344')">
  <h2 data-design-node="vn-345" v-if="model.visible('vn-345')" :style="model.style('vn-345')">{{ model.text('vn-345') }}</h2>
  <UInput data-design-node="vn-346" v-if="model.visible('vn-346')" :style="model.style('vn-346')" :aria-description="model.a11y('vn-346')" v-bind="model.props('vn-346')" v-on="model.on('vn-346')"></UInput>
  <div data-design-node="vn-347" v-if="model.visible('vn-347')" :style="model.style('vn-347')">
    <slot name="content">
      <p data-design-node="vn-349" v-if="model.visible('vn-349')">{{ model.text('vn-349') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-348" v-if="model.visible('vn-348')" :style="model.style('vn-348')" v-bind="model.props('vn-348')" v-on="model.on('vn-348')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
