<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-670.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTabs from "@nuxt/ui/components/Tabs.vue";
import DiagramInspector from "../library/diagram-inspector.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-670" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-671" v-if="model.visible('vn-671')" :style="model.style('vn-671')" v-bind="model.attrs('vn-671')" v-on="model.on('vn-671')">
  <h2 data-design-node="vn-672" v-if="model.visible('vn-672')" :style="model.style('vn-672')">{{ model.text('vn-672') }}</h2>
  <p data-design-node="vn-673" v-if="model.visible('vn-673')" :style="model.style('vn-673')">{{ model.text('vn-673') }}</p>
  <UInput data-design-node="vn-674" v-if="model.visible('vn-674')" :style="model.style('vn-674')" :aria-description="model.a11y('vn-674')" v-bind="model.props('vn-674')" v-on="model.on('vn-674')"></UInput>
  <UTabs data-design-node="vn-675" v-if="model.visible('vn-675')" :style="model.style('vn-675')" v-bind="model.props('vn-675')" v-on="model.on('vn-675')"></UTabs>
  <DiagramInspector data-design-node="vn-676" v-if="model.visible('vn-676')" :style="model.style('vn-676')" v-bind="model.props('vn-676')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-676')">
    <template #content>
      <p data-design-node="vn-677" v-if="model.visible('vn-677')" :style="model.style('vn-677')">{{ model.text('vn-677') }}</p>
    </template>
  </DiagramInspector>
  <div data-design-node="vn-678" v-if="model.visible('vn-678')" :style="model.style('vn-678')" v-bind="model.attrs('vn-678')" v-on="model.on('vn-678')">
    <UButton data-design-node="vn-679" v-if="model.visible('vn-679')" :style="model.style('vn-679')" v-bind="model.props('vn-679')" v-on="model.on('vn-679')"></UButton>
    <UButton data-design-node="vn-680" v-if="model.visible('vn-680')" :style="model.style('vn-680')" v-bind="model.props('vn-680')" v-on="model.on('vn-680')"></UButton>
  </div>
  <UAlert data-design-node="vn-681" v-if="model.visible('vn-681')" :style="model.style('vn-681')" v-bind="model.props('vn-681')" v-on="model.on('vn-681')"></UAlert>
  <UButton data-design-node="vn-682" v-if="model.visible('vn-682')" :style="model.style('vn-682')" v-bind="model.props('vn-682')" v-on="model.on('vn-682')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
