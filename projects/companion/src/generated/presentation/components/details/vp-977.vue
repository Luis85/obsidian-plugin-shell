<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-977.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import ShellHandoffPanel from "../library/shell-handoff-panel.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-977" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-978" v-if="model.visible('vn-978')" :style="model.style('vn-978')" v-bind="model.attrs('vn-978')" v-on="model.on('vn-978')">
  <h2 data-design-node="vn-979" v-if="model.visible('vn-979')" :style="model.style('vn-979')">{{ model.text('vn-979') }}</h2>
  <p data-design-node="vn-980" v-if="model.visible('vn-980')" :style="model.style('vn-980')">{{ model.text('vn-980') }}</p>
  <UInput data-design-node="vn-981" v-if="model.visible('vn-981')" :style="model.style('vn-981')" :aria-description="model.a11y('vn-981')" v-bind="model.props('vn-981')" v-on="model.on('vn-981')"></UInput>
  <UTextarea data-design-node="vn-982" v-if="model.visible('vn-982')" :style="model.style('vn-982')" :aria-description="model.a11y('vn-982')" v-bind="model.props('vn-982')" v-on="model.on('vn-982')"></UTextarea>
  <ShellHandoffPanel data-design-node="vn-983" v-if="model.visible('vn-983')" :style="model.style('vn-983')" v-bind="model.props('vn-983')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-983')">
    <template #content>
      <p data-design-node="vn-984" v-if="model.visible('vn-984')" :style="model.style('vn-984')">{{ model.text('vn-984') }}</p>
    </template>
  </ShellHandoffPanel>
  <div data-design-node="vn-985" v-if="model.visible('vn-985')" :style="model.style('vn-985')" v-bind="model.attrs('vn-985')" v-on="model.on('vn-985')">
    <UButton data-design-node="vn-986" v-if="model.visible('vn-986')" :style="model.style('vn-986')" v-bind="model.props('vn-986')" v-on="model.on('vn-986')"></UButton>
    <UButton data-design-node="vn-987" v-if="model.visible('vn-987')" :style="model.style('vn-987')" v-bind="model.props('vn-987')" v-on="model.on('vn-987')"></UButton>
  </div>
  <UAlert data-design-node="vn-988" v-if="model.visible('vn-988')" :style="model.style('vn-988')" v-bind="model.props('vn-988')" v-on="model.on('vn-988')"></UAlert>
  <UButton data-design-node="vn-989" v-if="model.visible('vn-989')" :style="model.style('vn-989')" v-bind="model.props('vn-989')" v-on="model.on('vn-989')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
