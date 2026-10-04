<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-848.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-848" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-849" v-if="model.visible('vn-849')" :style="model.style('vn-849')" v-bind="model.attrs('vn-849')" v-on="model.on('vn-849')">
  <h2 data-design-node="vn-850" v-if="model.visible('vn-850')" :style="model.style('vn-850')">{{ model.text('vn-850') }}</h2>
  <p data-design-node="vn-851" v-if="model.visible('vn-851')" :style="model.style('vn-851')">{{ model.text('vn-851') }}</p>
  <UInput data-design-node="vn-852" v-if="model.visible('vn-852')" :style="model.style('vn-852')" :aria-description="model.a11y('vn-852')" v-bind="model.props('vn-852')" v-on="model.on('vn-852')"></UInput>
  <ul data-design-node="vn-853" v-if="model.visible('vn-853')" :style="model.style('vn-853')" v-bind="model.attrs('vn-853')" v-on="model.on('vn-853')">
    <li data-design-node="vn-861" v-if="model.visible('vn-861')" v-bind="model.attrs('vn-861')" v-on="model.on('vn-861')">
      <span data-design-node="vn-862" v-if="model.visible('vn-862')">{{ model.text('vn-862') }}</span>
    </li>
    <li data-design-node="vn-863" v-if="model.visible('vn-863')" v-bind="model.attrs('vn-863')" v-on="model.on('vn-863')">
      <span data-design-node="vn-864" v-if="model.visible('vn-864')">{{ model.text('vn-864') }}</span>
    </li>
    <li data-design-node="vn-865" v-if="model.visible('vn-865')" v-bind="model.attrs('vn-865')" v-on="model.on('vn-865')">
      <span data-design-node="vn-866" v-if="model.visible('vn-866')">{{ model.text('vn-866') }}</span>
    </li>
  </ul>
  <StatusNotice data-design-node="vn-854" v-if="model.visible('vn-854')" :style="model.style('vn-854')" v-bind="model.props('vn-854')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-854')">
    <template #details>
      <p data-design-node="vn-855" v-if="model.visible('vn-855')" :style="model.style('vn-855')">{{ model.text('vn-855') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-856" v-if="model.visible('vn-856')" :style="model.style('vn-856')" v-bind="model.attrs('vn-856')" v-on="model.on('vn-856')">
    <UButton data-design-node="vn-857" v-if="model.visible('vn-857')" :style="model.style('vn-857')" v-bind="model.props('vn-857')" v-on="model.on('vn-857')"></UButton>
    <UButton data-design-node="vn-858" v-if="model.visible('vn-858')" :style="model.style('vn-858')" v-bind="model.props('vn-858')" v-on="model.on('vn-858')"></UButton>
  </div>
  <UAlert data-design-node="vn-859" v-if="model.visible('vn-859')" :style="model.style('vn-859')" v-bind="model.props('vn-859')" v-on="model.on('vn-859')"></UAlert>
  <UButton data-design-node="vn-860" v-if="model.visible('vn-860')" :style="model.style('vn-860')" v-bind="model.props('vn-860')" v-on="model.on('vn-860')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
