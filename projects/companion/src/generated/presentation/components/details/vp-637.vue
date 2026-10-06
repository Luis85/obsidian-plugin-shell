<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-637.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTabs from "@nuxt/ui/components/Tabs.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-637" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-638" v-if="model.visible('vn-638')" :style="model.style('vn-638')" v-bind="model.attrs('vn-638')" v-on="model.on('vn-638')">
  <h2 data-design-node="vn-639" v-if="model.visible('vn-639')" :style="model.style('vn-639')">{{ model.text('vn-639') }}</h2>
  <p data-design-node="vn-640" v-if="model.visible('vn-640')" :style="model.style('vn-640')">{{ model.text('vn-640') }}</p>
  <UInput data-design-node="vn-641" v-if="model.visible('vn-641')" :style="model.style('vn-641')" :aria-description="model.a11y('vn-641')" v-bind="model.props('vn-641')" v-on="model.on('vn-641')"></UInput>
  <UTabs data-design-node="vn-642" v-if="model.visible('vn-642')" :style="model.style('vn-642')" v-bind="model.props('vn-642')" v-on="model.on('vn-642')"></UTabs>
  <StatusNotice data-design-node="vn-643" v-if="model.visible('vn-643')" :style="model.style('vn-643')" v-bind="model.props('vn-643')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-643')">
    <template #details>
      <p data-design-node="vn-644" v-if="model.visible('vn-644')" :style="model.style('vn-644')">{{ model.text('vn-644') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-645" v-if="model.visible('vn-645')" :style="model.style('vn-645')" v-bind="model.attrs('vn-645')" v-on="model.on('vn-645')">
    <UButton data-design-node="vn-646" v-if="model.visible('vn-646')" :style="model.style('vn-646')" v-bind="model.props('vn-646')" v-on="model.on('vn-646')"></UButton>
    <UButton data-design-node="vn-647" v-if="model.visible('vn-647')" :style="model.style('vn-647')" v-bind="model.props('vn-647')" v-on="model.on('vn-647')"></UButton>
  </div>
  <UAlert data-design-node="vn-648" v-if="model.visible('vn-648')" :style="model.style('vn-648')" v-bind="model.props('vn-648')" v-on="model.on('vn-648')"></UAlert>
  <UButton data-design-node="vn-649" v-if="model.visible('vn-649')" :style="model.style('vn-649')" v-bind="model.props('vn-649')" v-on="model.on('vn-649')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
