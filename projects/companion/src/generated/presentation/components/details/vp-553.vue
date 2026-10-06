<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-553.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-553" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-554" v-if="model.visible('vn-554')" :style="model.style('vn-554')" v-bind="model.attrs('vn-554')" v-on="model.on('vn-554')">
  <h2 data-design-node="vn-555" v-if="model.visible('vn-555')" :style="model.style('vn-555')">{{ model.text('vn-555') }}</h2>
  <p data-design-node="vn-556" v-if="model.visible('vn-556')" :style="model.style('vn-556')">{{ model.text('vn-556') }}</p>
  <UInput data-design-node="vn-557" v-if="model.visible('vn-557')" :style="model.style('vn-557')" :aria-description="model.a11y('vn-557')" v-bind="model.props('vn-557')" v-on="model.on('vn-557')"></UInput>
  <ul data-design-node="vn-558" v-if="model.visible('vn-558')" :style="model.style('vn-558')" v-bind="model.attrs('vn-558')" v-on="model.on('vn-558')">
    <li data-design-node="vn-566" v-if="model.visible('vn-566')" v-bind="model.attrs('vn-566')" v-on="model.on('vn-566')">
      <span data-design-node="vn-567" v-if="model.visible('vn-567')">{{ model.text('vn-567') }}</span>
    </li>
    <li data-design-node="vn-568" v-if="model.visible('vn-568')" v-bind="model.attrs('vn-568')" v-on="model.on('vn-568')">
      <span data-design-node="vn-569" v-if="model.visible('vn-569')">{{ model.text('vn-569') }}</span>
    </li>
    <li data-design-node="vn-570" v-if="model.visible('vn-570')" v-bind="model.attrs('vn-570')" v-on="model.on('vn-570')">
      <span data-design-node="vn-571" v-if="model.visible('vn-571')">{{ model.text('vn-571') }}</span>
    </li>
    <li data-design-node="vn-572" v-if="model.visible('vn-572')" v-bind="model.attrs('vn-572')" v-on="model.on('vn-572')">
      <span data-design-node="vn-573" v-if="model.visible('vn-573')">{{ model.text('vn-573') }}</span>
    </li>
    <li data-design-node="vn-574" v-if="model.visible('vn-574')" v-bind="model.attrs('vn-574')" v-on="model.on('vn-574')">
      <span data-design-node="vn-575" v-if="model.visible('vn-575')">{{ model.text('vn-575') }}</span>
    </li>
    <li data-design-node="vn-576" v-if="model.visible('vn-576')" v-bind="model.attrs('vn-576')" v-on="model.on('vn-576')">
      <span data-design-node="vn-577" v-if="model.visible('vn-577')">{{ model.text('vn-577') }}</span>
    </li>
    <li data-design-node="vn-578" v-if="model.visible('vn-578')" v-bind="model.attrs('vn-578')" v-on="model.on('vn-578')">
      <span data-design-node="vn-579" v-if="model.visible('vn-579')">{{ model.text('vn-579') }}</span>
    </li>
    <li data-design-node="vn-580" v-if="model.visible('vn-580')" v-bind="model.attrs('vn-580')" v-on="model.on('vn-580')">
      <span data-design-node="vn-581" v-if="model.visible('vn-581')">{{ model.text('vn-581') }}</span>
    </li>
    <li data-design-node="vn-582" v-if="model.visible('vn-582')" v-bind="model.attrs('vn-582')" v-on="model.on('vn-582')">
      <span data-design-node="vn-583" v-if="model.visible('vn-583')">{{ model.text('vn-583') }}</span>
    </li>
  </ul>
  <StatusNotice data-design-node="vn-559" v-if="model.visible('vn-559')" :style="model.style('vn-559')" v-bind="model.props('vn-559')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-559')">
    <template #details>
      <p data-design-node="vn-560" v-if="model.visible('vn-560')" :style="model.style('vn-560')">{{ model.text('vn-560') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-561" v-if="model.visible('vn-561')" :style="model.style('vn-561')" v-bind="model.attrs('vn-561')" v-on="model.on('vn-561')">
    <UButton data-design-node="vn-562" v-if="model.visible('vn-562')" :style="model.style('vn-562')" v-bind="model.props('vn-562')" v-on="model.on('vn-562')"></UButton>
    <UButton data-design-node="vn-563" v-if="model.visible('vn-563')" :style="model.style('vn-563')" v-bind="model.props('vn-563')" v-on="model.on('vn-563')"></UButton>
  </div>
  <UAlert data-design-node="vn-564" v-if="model.visible('vn-564')" :style="model.style('vn-564')" v-bind="model.props('vn-564')" v-on="model.on('vn-564')"></UAlert>
  <UButton data-design-node="vn-565" v-if="model.visible('vn-565')" :style="model.style('vn-565')" v-bind="model.props('vn-565')" v-on="model.on('vn-565')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
