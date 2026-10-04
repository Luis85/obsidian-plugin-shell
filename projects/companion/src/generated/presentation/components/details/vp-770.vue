<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-770.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-770" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-771" v-if="model.visible('vn-771')" :style="model.style('vn-771')" v-bind="model.attrs('vn-771')" v-on="model.on('vn-771')">
  <h2 data-design-node="vn-772" v-if="model.visible('vn-772')" :style="model.style('vn-772')">{{ model.text('vn-772') }}</h2>
  <p data-design-node="vn-773" v-if="model.visible('vn-773')" :style="model.style('vn-773')">{{ model.text('vn-773') }}</p>
  <UInput data-design-node="vn-774" v-if="model.visible('vn-774')" :style="model.style('vn-774')" :aria-description="model.a11y('vn-774')" v-bind="model.props('vn-774')" v-on="model.on('vn-774')"></UInput>
  <ul data-design-node="vn-775" v-if="model.visible('vn-775')" :style="model.style('vn-775')" v-bind="model.attrs('vn-775')" v-on="model.on('vn-775')">
    <li data-design-node="vn-783" v-if="model.visible('vn-783')" v-bind="model.attrs('vn-783')" v-on="model.on('vn-783')">
      <span data-design-node="vn-784" v-if="model.visible('vn-784')">{{ model.text('vn-784') }}</span>
    </li>
    <li data-design-node="vn-785" v-if="model.visible('vn-785')" v-bind="model.attrs('vn-785')" v-on="model.on('vn-785')">
      <span data-design-node="vn-786" v-if="model.visible('vn-786')">{{ model.text('vn-786') }}</span>
    </li>
    <li data-design-node="vn-787" v-if="model.visible('vn-787')" v-bind="model.attrs('vn-787')" v-on="model.on('vn-787')">
      <span data-design-node="vn-788" v-if="model.visible('vn-788')">{{ model.text('vn-788') }}</span>
    </li>
  </ul>
  <StatusNotice data-design-node="vn-776" v-if="model.visible('vn-776')" :style="model.style('vn-776')" v-bind="model.props('vn-776')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-776')">
    <template #details>
      <p data-design-node="vn-777" v-if="model.visible('vn-777')" :style="model.style('vn-777')">{{ model.text('vn-777') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-778" v-if="model.visible('vn-778')" :style="model.style('vn-778')" v-bind="model.attrs('vn-778')" v-on="model.on('vn-778')">
    <UButton data-design-node="vn-779" v-if="model.visible('vn-779')" :style="model.style('vn-779')" v-bind="model.props('vn-779')" v-on="model.on('vn-779')"></UButton>
    <UButton data-design-node="vn-780" v-if="model.visible('vn-780')" :style="model.style('vn-780')" v-bind="model.props('vn-780')" v-on="model.on('vn-780')"></UButton>
  </div>
  <UAlert data-design-node="vn-781" v-if="model.visible('vn-781')" :style="model.style('vn-781')" v-bind="model.props('vn-781')" v-on="model.on('vn-781')"></UAlert>
  <UButton data-design-node="vn-782" v-if="model.visible('vn-782')" :style="model.style('vn-782')" v-bind="model.props('vn-782')" v-on="model.on('vn-782')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
