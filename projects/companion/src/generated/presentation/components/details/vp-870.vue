<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-870.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTable from "@nuxt/ui/components/Table.vue";
import ReviewFindings from "../library/review-findings.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-870" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-871" v-if="model.visible('vn-871')" :style="model.style('vn-871')" v-bind="model.attrs('vn-871')" v-on="model.on('vn-871')">
  <h2 data-design-node="vn-872" v-if="model.visible('vn-872')" :style="model.style('vn-872')">{{ model.text('vn-872') }}</h2>
  <p data-design-node="vn-873" v-if="model.visible('vn-873')" :style="model.style('vn-873')">{{ model.text('vn-873') }}</p>
  <UInput data-design-node="vn-874" v-if="model.visible('vn-874')" :style="model.style('vn-874')" :aria-description="model.a11y('vn-874')" v-bind="model.props('vn-874')" v-on="model.on('vn-874')"></UInput>
  <UTable data-design-node="vn-875" v-if="model.visible('vn-875')" :style="model.style('vn-875')" v-bind="model.props('vn-875')" v-on="model.on('vn-875')">
    <template #empty>
      <p data-design-node="vn-883" v-if="model.visible('vn-883')">{{ model.text('vn-883') }}</p>
    </template>
  </UTable>
  <ReviewFindings data-design-node="vn-876" v-if="model.visible('vn-876')" :style="model.style('vn-876')" v-bind="model.props('vn-876')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-876')">
    <template #content>
      <p data-design-node="vn-877" v-if="model.visible('vn-877')" :style="model.style('vn-877')">{{ model.text('vn-877') }}</p>
    </template>
  </ReviewFindings>
  <div data-design-node="vn-878" v-if="model.visible('vn-878')" :style="model.style('vn-878')" v-bind="model.attrs('vn-878')" v-on="model.on('vn-878')">
    <UButton data-design-node="vn-879" v-if="model.visible('vn-879')" :style="model.style('vn-879')" v-bind="model.props('vn-879')" v-on="model.on('vn-879')"></UButton>
    <UButton data-design-node="vn-880" v-if="model.visible('vn-880')" :style="model.style('vn-880')" v-bind="model.props('vn-880')" v-on="model.on('vn-880')"></UButton>
  </div>
  <UAlert data-design-node="vn-881" v-if="model.visible('vn-881')" :style="model.style('vn-881')" v-bind="model.props('vn-881')" v-on="model.on('vn-881')"></UAlert>
  <UButton data-design-node="vn-882" v-if="model.visible('vn-882')" :style="model.style('vn-882')" v-bind="model.props('vn-882')" v-on="model.on('vn-882')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
