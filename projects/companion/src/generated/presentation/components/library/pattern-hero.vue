<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-hero.ts";
import { specification as spec } from "../../../domain/visual/vc-76.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-76" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-288" v-if="model.visible('vn-288')" :style="model.style('vn-288')" v-bind="model.attrs('vn-288')" v-on="model.on('vn-288')">
  <h2 data-design-node="vn-289" v-if="model.visible('vn-289')" :style="model.style('vn-289')">{{ model.text('vn-289') }}</h2>
  <p data-design-node="vn-290" v-if="model.visible('vn-290')" :style="model.style('vn-290')">{{ model.text('vn-290') }}</p>
  <div data-design-node="vn-291" v-if="model.visible('vn-291')" :style="model.style('vn-291')">
    <slot name="content">
      <p data-design-node="vn-293" v-if="model.visible('vn-293')">{{ model.text('vn-293') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-292" v-if="model.visible('vn-292')" :style="model.style('vn-292')" v-bind="model.props('vn-292')" v-on="model.on('vn-292')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
