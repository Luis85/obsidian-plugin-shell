<script setup lang="ts">
import { specification } from '../../../domain/components/library-pending.ts';
import type { ComponentProps, ComponentEvents } from '../../../domain/components/contracts/library-pending.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
</script>
<template>
<section class="generated-component" :aria-label="specification.name" :data-design-state="props.designState">
<h3>{{ props.title ?? specification.name }}</h3><p>{{ specification.description }}</p>
<p class="generated-hint">Component implementation point</p>
<slot name="actions" />
</section>
</template>
