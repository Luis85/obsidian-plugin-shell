<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-531.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-531" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-532" v-if="model.visible('vn-532')" :style="model.style('vn-532')" v-bind="model.attrs('vn-532')" v-on="model.on('vn-532')">
  <h2 data-design-node="vn-533" v-if="model.visible('vn-533')" :style="model.style('vn-533')">{{ model.text('vn-533') }}</h2>
  <p data-design-node="vn-534" v-if="model.visible('vn-534')" :style="model.style('vn-534')">{{ model.text('vn-534') }}</p>
  <UInput data-design-node="vn-535" v-if="model.visible('vn-535')" :style="model.style('vn-535')" :aria-description="model.a11y('vn-535')" v-bind="model.props('vn-535')" v-on="model.on('vn-535')"></UInput>
  <ul data-design-node="vn-536" v-if="model.visible('vn-536')" :style="model.style('vn-536')" v-bind="model.attrs('vn-536')" v-on="model.on('vn-536')">
    <li data-design-node="vn-544" v-if="model.visible('vn-544')" v-bind="model.attrs('vn-544')" v-on="model.on('vn-544')">
      <span data-design-node="vn-545" v-if="model.visible('vn-545')">{{ model.text('vn-545') }}</span>
    </li>
    <li data-design-node="vn-546" v-if="model.visible('vn-546')" v-bind="model.attrs('vn-546')" v-on="model.on('vn-546')">
      <span data-design-node="vn-547" v-if="model.visible('vn-547')">{{ model.text('vn-547') }}</span>
    </li>
    <li data-design-node="vn-548" v-if="model.visible('vn-548')" v-bind="model.attrs('vn-548')" v-on="model.on('vn-548')">
      <span data-design-node="vn-549" v-if="model.visible('vn-549')">{{ model.text('vn-549') }}</span>
    </li>
  </ul>
  <StatusNotice data-design-node="vn-537" v-if="model.visible('vn-537')" :style="model.style('vn-537')" v-bind="model.props('vn-537')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-537')">
    <template #details>
      <p data-design-node="vn-538" v-if="model.visible('vn-538')" :style="model.style('vn-538')">{{ model.text('vn-538') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-539" v-if="model.visible('vn-539')" :style="model.style('vn-539')" v-bind="model.attrs('vn-539')" v-on="model.on('vn-539')">
    <UButton data-design-node="vn-540" v-if="model.visible('vn-540')" :style="model.style('vn-540')" v-bind="model.props('vn-540')" v-on="model.on('vn-540')"></UButton>
    <UButton data-design-node="vn-541" v-if="model.visible('vn-541')" :style="model.style('vn-541')" v-bind="model.props('vn-541')" v-on="model.on('vn-541')"></UButton>
  </div>
  <UAlert data-design-node="vn-542" v-if="model.visible('vn-542')" :style="model.style('vn-542')" v-bind="model.props('vn-542')" v-on="model.on('vn-542')"></UAlert>
  <UButton data-design-node="vn-543" v-if="model.visible('vn-543')" :style="model.style('vn-543')" v-bind="model.props('vn-543')" v-on="model.on('vn-543')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
