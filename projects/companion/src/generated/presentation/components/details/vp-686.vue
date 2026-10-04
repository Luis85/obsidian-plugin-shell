<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-686.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTabs from "@nuxt/ui/components/Tabs.vue";
import ComponentContractPanel from "../library/component-contract-panel.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-686" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-687" v-if="model.visible('vn-687')" :style="model.style('vn-687')" v-bind="model.attrs('vn-687')" v-on="model.on('vn-687')">
  <h2 data-design-node="vn-688" v-if="model.visible('vn-688')" :style="model.style('vn-688')">{{ model.text('vn-688') }}</h2>
  <p data-design-node="vn-689" v-if="model.visible('vn-689')" :style="model.style('vn-689')">{{ model.text('vn-689') }}</p>
  <UInput data-design-node="vn-690" v-if="model.visible('vn-690')" :style="model.style('vn-690')" :aria-description="model.a11y('vn-690')" v-bind="model.props('vn-690')" v-on="model.on('vn-690')"></UInput>
  <UTabs data-design-node="vn-691" v-if="model.visible('vn-691')" :style="model.style('vn-691')" v-bind="model.props('vn-691')" v-on="model.on('vn-691')"></UTabs>
  <ComponentContractPanel data-design-node="vn-692" v-if="model.visible('vn-692')" :style="model.style('vn-692')" v-bind="model.props('vn-692')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-692')">
    <template #content>
      <p data-design-node="vn-693" v-if="model.visible('vn-693')" :style="model.style('vn-693')">{{ model.text('vn-693') }}</p>
    </template>
  </ComponentContractPanel>
  <div data-design-node="vn-694" v-if="model.visible('vn-694')" :style="model.style('vn-694')" v-bind="model.attrs('vn-694')" v-on="model.on('vn-694')">
    <UButton data-design-node="vn-695" v-if="model.visible('vn-695')" :style="model.style('vn-695')" v-bind="model.props('vn-695')" v-on="model.on('vn-695')"></UButton>
    <UButton data-design-node="vn-696" v-if="model.visible('vn-696')" :style="model.style('vn-696')" v-bind="model.props('vn-696')" v-on="model.on('vn-696')"></UButton>
  </div>
  <UAlert data-design-node="vn-697" v-if="model.visible('vn-697')" :style="model.style('vn-697')" v-bind="model.props('vn-697')" v-on="model.on('vn-697')"></UAlert>
  <UButton data-design-node="vn-698" v-if="model.visible('vn-698')" :style="model.style('vn-698')" v-bind="model.props('vn-698')" v-on="model.on('vn-698')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
