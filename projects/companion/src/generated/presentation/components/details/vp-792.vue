<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-792.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-792" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-793" v-if="model.visible('vn-793')" :style="model.style('vn-793')" v-bind="model.attrs('vn-793')" v-on="model.on('vn-793')">
  <h2 data-design-node="vn-794" v-if="model.visible('vn-794')" :style="model.style('vn-794')">{{ model.text('vn-794') }}</h2>
  <p data-design-node="vn-795" v-if="model.visible('vn-795')" :style="model.style('vn-795')">{{ model.text('vn-795') }}</p>
  <UInput data-design-node="vn-796" v-if="model.visible('vn-796')" :style="model.style('vn-796')" :aria-description="model.a11y('vn-796')" v-bind="model.props('vn-796')" v-on="model.on('vn-796')"></UInput>
  <ul data-design-node="vn-797" v-if="model.visible('vn-797')" :style="model.style('vn-797')" v-bind="model.attrs('vn-797')" v-on="model.on('vn-797')">
    <li data-design-node="vn-805" v-if="model.visible('vn-805')" v-bind="model.attrs('vn-805')" v-on="model.on('vn-805')">
      <span data-design-node="vn-806" v-if="model.visible('vn-806')">{{ model.text('vn-806') }}</span>
    </li>
    <li data-design-node="vn-807" v-if="model.visible('vn-807')" v-bind="model.attrs('vn-807')" v-on="model.on('vn-807')">
      <span data-design-node="vn-808" v-if="model.visible('vn-808')">{{ model.text('vn-808') }}</span>
    </li>
    <li data-design-node="vn-809" v-if="model.visible('vn-809')" v-bind="model.attrs('vn-809')" v-on="model.on('vn-809')">
      <span data-design-node="vn-810" v-if="model.visible('vn-810')">{{ model.text('vn-810') }}</span>
    </li>
  </ul>
  <StatusNotice data-design-node="vn-798" v-if="model.visible('vn-798')" :style="model.style('vn-798')" v-bind="model.props('vn-798')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-798')">
    <template #details>
      <p data-design-node="vn-799" v-if="model.visible('vn-799')" :style="model.style('vn-799')">{{ model.text('vn-799') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-800" v-if="model.visible('vn-800')" :style="model.style('vn-800')" v-bind="model.attrs('vn-800')" v-on="model.on('vn-800')">
    <UButton data-design-node="vn-801" v-if="model.visible('vn-801')" :style="model.style('vn-801')" v-bind="model.props('vn-801')" v-on="model.on('vn-801')"></UButton>
    <UButton data-design-node="vn-802" v-if="model.visible('vn-802')" :style="model.style('vn-802')" v-bind="model.props('vn-802')" v-on="model.on('vn-802')"></UButton>
  </div>
  <UAlert data-design-node="vn-803" v-if="model.visible('vn-803')" :style="model.style('vn-803')" v-bind="model.props('vn-803')" v-on="model.on('vn-803')"></UAlert>
  <UButton data-design-node="vn-804" v-if="model.visible('vn-804')" :style="model.style('vn-804')" v-bind="model.props('vn-804')" v-on="model.on('vn-804')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
