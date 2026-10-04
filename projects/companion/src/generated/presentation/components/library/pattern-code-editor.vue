<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-code-editor.ts";
import { specification as spec } from "../../../domain/visual/vc-94.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-94" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-422" v-if="model.visible('vn-422')" :style="model.style('vn-422')" v-bind="model.attrs('vn-422')" v-on="model.on('vn-422')">
  <h2 data-design-node="vn-423" v-if="model.visible('vn-423')" :style="model.style('vn-423')">{{ model.text('vn-423') }}</h2>
  <UTextarea data-design-node="vn-424" v-if="model.visible('vn-424')" :style="model.style('vn-424')" :aria-description="model.a11y('vn-424')" v-bind="model.props('vn-424')" v-on="model.on('vn-424')"></UTextarea>
  <div data-design-node="vn-425" v-if="model.visible('vn-425')" :style="model.style('vn-425')">
    <slot name="content">
      <p data-design-node="vn-427" v-if="model.visible('vn-427')">{{ model.text('vn-427') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-426" v-if="model.visible('vn-426')" :style="model.style('vn-426')" v-bind="model.props('vn-426')" v-on="model.on('vn-426')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
