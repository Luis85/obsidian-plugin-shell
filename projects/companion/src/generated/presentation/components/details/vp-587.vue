<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-587.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTable from "@nuxt/ui/components/Table.vue";
import RequirementsPanel from "../library/requirements-panel.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-587" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-588" v-if="model.visible('vn-588')" :style="model.style('vn-588')" v-bind="model.attrs('vn-588')" v-on="model.on('vn-588')">
  <h2 data-design-node="vn-589" v-if="model.visible('vn-589')" :style="model.style('vn-589')">{{ model.text('vn-589') }}</h2>
  <p data-design-node="vn-590" v-if="model.visible('vn-590')" :style="model.style('vn-590')">{{ model.text('vn-590') }}</p>
  <UInput data-design-node="vn-591" v-if="model.visible('vn-591')" :style="model.style('vn-591')" :aria-description="model.a11y('vn-591')" v-bind="model.props('vn-591')" v-on="model.on('vn-591')"></UInput>
  <UTable data-design-node="vn-592" v-if="model.visible('vn-592')" :style="model.style('vn-592')" v-bind="model.props('vn-592')" v-on="model.on('vn-592')">
    <template #empty>
      <p data-design-node="vn-600" v-if="model.visible('vn-600')">{{ model.text('vn-600') }}</p>
    </template>
  </UTable>
  <RequirementsPanel data-design-node="vn-593" v-if="model.visible('vn-593')" :style="model.style('vn-593')" v-bind="model.props('vn-593')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-593')">
    <template #content>
      <p data-design-node="vn-594" v-if="model.visible('vn-594')" :style="model.style('vn-594')">{{ model.text('vn-594') }}</p>
    </template>
  </RequirementsPanel>
  <div data-design-node="vn-595" v-if="model.visible('vn-595')" :style="model.style('vn-595')" v-bind="model.attrs('vn-595')" v-on="model.on('vn-595')">
    <UButton data-design-node="vn-596" v-if="model.visible('vn-596')" :style="model.style('vn-596')" v-bind="model.props('vn-596')" v-on="model.on('vn-596')"></UButton>
    <UButton data-design-node="vn-597" v-if="model.visible('vn-597')" :style="model.style('vn-597')" v-bind="model.props('vn-597')" v-on="model.on('vn-597')"></UButton>
  </div>
  <UAlert data-design-node="vn-598" v-if="model.visible('vn-598')" :style="model.style('vn-598')" v-bind="model.props('vn-598')" v-on="model.on('vn-598')"></UAlert>
  <UButton data-design-node="vn-599" v-if="model.visible('vn-599')" :style="model.style('vn-599')" v-bind="model.props('vn-599')" v-on="model.on('vn-599')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
