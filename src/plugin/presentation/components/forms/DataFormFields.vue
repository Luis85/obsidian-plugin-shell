<script setup lang="ts">
import UInput from '@nuxt/ui/components/Input.vue';
import UTextarea from '@nuxt/ui/components/Textarea.vue';
import type { DataFormNode } from '../../../domain/forms/values';
import type { DataFormModel } from '../../composables/use-data-form';
const props = defineProps<{ nodes: readonly DataFormNode[]; model: DataFormModel }>();
</script>

<template>
  <template v-for="node in props.nodes" :key="node.path">
    <fieldset v-if="node.children" class="shell-data-form-group shell-data-form-section" :data-field="node.path">
      <legend>{{ node.field.label }}</legend>
      <small v-if="node.field.help">{{ node.field.help }}</small>
      <DataFormFields :nodes="node.children" :model="props.model" />
    </fieldset>
    <fieldset v-else-if="node.field.kind === 'multi'" class="shell-data-form-group shell-field" :data-field="node.path" :aria-describedby="props.model.describedBy(node)">
      <legend>{{ node.field.label }} <span v-if="props.model.required(node.field)" aria-hidden="true">*</span></legend>
      <small v-if="node.field.help" :id="props.model.describe(node.path, 'help')">{{ node.field.help }}</small>
      <label v-for="choice in node.field.choices" :key="choice.id" class="shell-data-form-choice"><input type="checkbox" :name="node.path" :value="choice.id" :checked="props.model.picked(node.path, choice.id)" :aria-invalid="props.model.invalid(node.path)" :aria-describedby="props.model.describedBy(node)" @change="props.model.onPick(node, choice.id, $event)">{{ choice.label }}</label>
      <p v-if="props.model.issue(node.path)" :id="props.model.describe(node.path, 'error')" class="shell-error">{{ props.model.issue(node.path) }}</p>
    </fieldset>
    <div v-else class="shell-field" :data-field="node.path" :data-kind="node.field.kind">
      <label :for="props.model.control(node.path)">{{ node.field.label }} <span v-if="props.model.required(node.field)" aria-hidden="true">*</span></label>
      <small v-if="node.field.help" :id="props.model.describe(node.path, 'help')">{{ node.field.help }}</small>
      <small v-if="node.field.kind === 'list'" :id="props.model.describe(node.path, 'hint')">{{ props.model.t('form.listHint') }}</small>
      <input v-if="node.field.kind === 'boolean'" :id="props.model.control(node.path)" type="checkbox" :name="node.path" :checked="props.model.flag(node.path)" :aria-invalid="props.model.invalid(node.path)" :aria-describedby="props.model.describedBy(node)" @change="props.model.onFlag(node.path, $event)">
      <select v-else-if="node.field.kind === 'select'" :id="props.model.control(node.path)" :name="node.path" :value="props.model.text(node.path)" :aria-invalid="props.model.invalid(node.path)" :aria-describedby="props.model.describedBy(node)" @change="props.model.onText(node.path, $event)">
        <option value="" :disabled="node.field.default !== undefined">{{ props.model.t('form.choose') }}</option>
        <option v-for="choice in node.field.choices" :key="choice.id" :value="choice.id">{{ choice.label }}</option>
      </select>
      <UTextarea v-else-if="node.field.kind === 'list' || node.field.multiline" :id="props.model.control(node.path)" :name="node.path" :rows="4" :model-value="props.model.text(node.path)" :aria-required="props.model.required(node.field)" :aria-invalid="props.model.invalid(node.path)" :aria-describedby="props.model.describedBy(node)" @update:model-value="props.model.setText(node.path, $event)" />
      <UInput v-else :id="props.model.control(node.path)" :name="node.path" :type="node.field.kind === 'number' ? 'number' : 'text'" :model-value="props.model.text(node.path)" :aria-required="props.model.required(node.field)" :aria-invalid="props.model.invalid(node.path)" :aria-describedby="props.model.describedBy(node)" @update:model-value="props.model.setText(node.path, $event)" />
      <p v-if="props.model.issue(node.path)" :id="props.model.describe(node.path, 'error')" class="shell-error">{{ props.model.issue(node.path) }}</p>
    </div>
  </template>
</template>
