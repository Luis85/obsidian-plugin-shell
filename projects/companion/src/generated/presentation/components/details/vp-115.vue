<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-115.ts";
import UInput from "@nuxt/ui/components/Input.vue";
import ProjectJsonReview from "../library/project-json-review.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-115" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-116" v-if="model.visible('vn-116')" :style="model.style('vn-116')" v-bind="model.attrs('vn-116')" v-on="model.on('vn-116')">
  <UInput data-design-node="vn-117" v-if="model.visible('vn-117')" :style="model.style('vn-117')" :aria-description="model.a11y('vn-117')" v-bind="model.props('vn-117')" v-on="model.on('vn-117')"></UInput>
  <ProjectJsonReview data-design-node="vn-118" v-if="model.visible('vn-118')" :style="model.style('vn-118')" v-bind="model.props('vn-118')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-118')"></ProjectJsonReview>
  <p data-design-node="vn-119" v-if="model.visible('vn-119')" :style="model.style('vn-119')">{{ model.text('vn-119') }}</p>
  <p data-design-node="vn-120" v-if="model.visible('vn-120')" :style="model.style('vn-120')">{{ model.text('vn-120') }}</p>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
