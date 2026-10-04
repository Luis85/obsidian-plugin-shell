<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-navigation.ts";
import { specification as spec } from "../../../domain/visual/vc-63.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-63" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-184" v-if="model.visible('vn-184')" :style="model.style('vn-184')" v-bind="model.attrs('vn-184')" v-on="model.on('vn-184')">
  <h2 data-design-node="vn-185" v-if="model.visible('vn-185')" :style="model.style('vn-185')">{{ model.text('vn-185') }}</h2>
  <ul data-design-node="vn-186" v-if="model.visible('vn-186')" :style="model.style('vn-186')" v-bind="model.attrs('vn-186')" v-on="model.on('vn-186')">
    <li data-design-node="vn-189" v-if="model.visible('vn-189')" v-bind="model.attrs('vn-189')" v-on="model.on('vn-189')">
      <span data-design-node="vn-190" v-if="model.visible('vn-190')">{{ model.text('vn-190') }}</span>
    </li>
    <li data-design-node="vn-191" v-if="model.visible('vn-191')" v-bind="model.attrs('vn-191')" v-on="model.on('vn-191')">
      <span data-design-node="vn-192" v-if="model.visible('vn-192')">{{ model.text('vn-192') }}</span>
    </li>
  </ul>
  <div data-design-node="vn-187" v-if="model.visible('vn-187')" :style="model.style('vn-187')">
    <slot name="content">
      <p data-design-node="vn-193" v-if="model.visible('vn-193')">{{ model.text('vn-193') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-188" v-if="model.visible('vn-188')" :style="model.style('vn-188')" v-bind="model.props('vn-188')" v-on="model.on('vn-188')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
