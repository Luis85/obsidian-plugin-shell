<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-profile.ts";
import { specification as spec } from "../../../domain/visual/vc-93.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-93" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-415" v-if="model.visible('vn-415')" :style="model.style('vn-415')" v-bind="model.attrs('vn-415')" v-on="model.on('vn-415')">
  <h2 data-design-node="vn-416" v-if="model.visible('vn-416')" :style="model.style('vn-416')">{{ model.text('vn-416') }}</h2>
  <p data-design-node="vn-417" v-if="model.visible('vn-417')" :style="model.style('vn-417')">{{ model.text('vn-417') }}</p>
  <div data-design-node="vn-418" v-if="model.visible('vn-418')" :style="model.style('vn-418')">
    <slot name="content">
      <p data-design-node="vn-420" v-if="model.visible('vn-420')">{{ model.text('vn-420') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-419" v-if="model.visible('vn-419')" :style="model.style('vn-419')" v-bind="model.props('vn-419')" v-on="model.on('vn-419')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
