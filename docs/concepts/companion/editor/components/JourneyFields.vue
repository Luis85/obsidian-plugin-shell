<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import { SITEMAP_LIMITS } from '../../../../../scripts/companion/sitemap/model.ts';
import type { EditorStore } from '../composables/use-editor.ts';
defineProps<{store:EditorStore}>();
</script>
<template>
  <fieldset class="jm-journey-fields" :disabled="store.busy||!store.available">
    <label :for="store.domId('jm-journey-name')">Journey name</label>
    <UInput :id="store.domId('jm-journey-name')" v-model="store.form.journeyName" autofocus maxlength="120" />
    <p class="jm-help">Choose existing surfaces in order. Where several actions connect the same surfaces, choose the intended action. Reordering never invents navigation; missing actions remain review findings.</p>
    <ol class="jm-steps jm-edit-steps">
      <li v-for="(step,index) in store.journeyDraft?.journey.steps" :key="step.id">
        <div class="jm-step-heading"><strong>Step {{ index+1 }}</strong><code>{{ step.id }}</code></div>
        <label :for="'jm-step-surface-'+step.id">Surface for step {{ index+1 }}</label>
        <select :id="'jm-step-surface-'+step.id" :value="step.surface" @change="store.editJourney({type:'surface',step:step.id,surface:($event.target as HTMLSelectElement).value})">
          <option v-if="!store.snapshot?.nodes.some(n=>n.id===step.surface)" :value="step.surface" disabled>{{ step.lastKnownLabel??step.surface }} · missing</option>
          <option v-for="node in store.snapshot?.nodes.filter(n=>n.kind!=='group')" :key="node.id" :value="node.id">{{ node.label }}</option>
        </select>
        <p v-if="step.unresolved" class="jm-help">Unresolved reference: {{ step.lastKnownLabel }}. Choose a surface to repair this step explicitly.</p>
        <UButton v-if="step.unresolved&&store.snapshot?.nodes.some(n=>n.id===step.surface&&n.kind!=='group')" variant="outline" color="neutral" size="sm" :aria-label="'Resolve step '+(index+1)+' with its current surface'" @click="store.editJourney({type:'surface',step:step.id,surface:step.surface})">Use this surface</UButton>
        <template v-if="index>0">
          <label :for="'jm-step-action-'+step.id">Incoming action for step {{ index+1 }}</label>
          <select :id="'jm-step-action-'+step.id" :value="step.via??''" :disabled="step.unresolved" @change="store.editJourney({type:'transition',step:step.id,via:($event.target as HTMLSelectElement).value||null})">
            <option value="">No action selected · needs review</option>
            <option v-if="step.via&&!store.transitionOptions(index).some(e=>e.id===step.via)" :value="step.via" disabled>Retained unresolved action · {{ step.via }}</option>
            <option v-for="edge in store.transitionOptions(index)" :key="edge.id" :value="edge.id">{{ edge.label }} · {{ edge.kind==='conditional'?'condition intent only':edge.kind }} · {{ edge.id }}</option>
          </select>
          <p v-if="step.via&&store.snapshot?.links.find(e=>e.id===step.via)?.kind==='conditional'" class="jm-help">This condition describes intent; it is not an executable decision.</p>
        </template>
        <p v-else class="jm-help">Entry step · no incoming action</p>
        <div class="jm-actions">
          <UButton variant="outline" color="neutral" size="sm" :disabled="index===0" :aria-label="'Move step '+(index+1)+' up'" @click="store.editJourney({type:'move',step:step.id,offset:-1})">Up</UButton>
          <UButton variant="outline" color="neutral" size="sm" :disabled="index===(store.journeyDraft?.journey.steps.length??0)-1" :aria-label="'Move step '+(index+1)+' down'" @click="store.editJourney({type:'move',step:step.id,offset:1})">Down</UButton>
          <UButton variant="ghost" color="neutral" size="sm" :aria-label="'Remove step '+(index+1)" @click="store.editJourney({type:'remove',step:step.id})">Remove</UButton>
        </div>
      </li>
    </ol>
    <label :for="store.domId('jm-step')">Next step</label>
    <div class="jm-actions"><select :id="store.domId('jm-step')" v-model="store.form.target"><option value="">Choose a surface</option><option v-for="node in store.snapshot?.nodes.filter(n=>n.kind!=='group')" :value="node.id" :key="node.id">{{ node.label }}</option></select><UButton color="neutral" variant="outline" :disabled="!store.form.target||(store.journeyDraft?.journey.steps.length??0)>=SITEMAP_LIMITS.steps" @click="store.editJourney({type:'append',surface:store.form.target})">Add step</UButton></div>
    <p class="jm-help">{{ store.journeyDraft?.journey.steps.length??0 }} / {{ SITEMAP_LIMITS.steps }} steps. Apply saves this journey through the current project; Cancel discards only this draft.</p>
  </fieldset>
</template>
