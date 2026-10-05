<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterAppearance } from '../../../domain/characters/types'
import { characterModel } from '../../character-catalog/catalog'
import { modelAppearance } from '../../../domain/characters/appearance'
const props=withDefaults(defineProps<{appearance?:CharacterAppearance;modelId?:string;size?:number}>(),{size:76})
const look=computed(()=>props.appearance??modelAppearance(props.modelId??'voxel-human-v2'))
const model=computed(()=>characterModel(look.value.modelId))
const body=computed(()=>look.value.parts.body??'')
const ears=computed(()=>look.value.parts.ears??'ears-none')
const tail=computed(()=>look.value.parts.tail??'tail-none')
</script>
<template>
<svg class="character-thumbnail" :style="{width:size+'px',height:size+'px'}" viewBox="0 0 88 88" aria-hidden="true">
  <defs><linearGradient :id="'thumb-'+look.modelId" x1="0" y1="0" x2="1" y2="1"><stop :stop-color="look.primaryColor"/><stop offset="1" :stop-color="look.secondaryColor"/></linearGradient></defs>
  <circle cx="44" cy="45" r="34" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.07)"/>
  <ellipse cx="44" cy="73" rx="24" ry="5" fill="rgba(0,0,0,.28)"/>
  <g v-if="model.silhouette==='human'">
    <rect x="30" y="33" width="28" height="31" rx="4" :fill="look.primaryColor"/><rect x="33" y="14" width="22" height="22" rx="5" fill="#d8b28d"/>
    <rect x="28" y="17" width="26" height="6" rx="2" :fill="look.secondaryColor"/><rect x="24" y="37" width="6" height="25" rx="2" :fill="look.primaryColor"/><rect x="58" y="37" width="6" height="25" rx="2" :fill="look.primaryColor"/>
    <rect x="33" y="63" width="9" height="12" :fill="look.secondaryColor"/><rect x="46" y="63" width="9" height="12" :fill="look.secondaryColor"/>
    <rect x="38" y="24" width="4" height="4" fill="#151a22"/><rect x="48" y="24" width="4" height="4" fill="#151a22"/>
  </g>
  <g v-else-if="model.silhouette==='quadruped'">
    <path v-if="tail==='tail-fox'||tail==='tail-curled'" d="M27 49C17 45 15 35 22 31" fill="none" :stroke="look.secondaryColor" stroke-width="7" stroke-linecap="round"/>
    <circle v-else-if="tail==='tail-puff'" cx="25" cy="48" r="6" :fill="look.secondaryColor"/>
    <rect x="29" y="42" width="30" :height="body==='body-compact'?20:24" rx="6" :fill="look.primaryColor"/>
    <rect x="31" y="58" width="8" height="15" rx="2" :fill="look.secondaryColor"/><rect x="49" y="58" width="8" height="15" rx="2" :fill="look.secondaryColor"/>
    <rect x="31" y="70" width="10" height="5" rx="2" :fill="look.secondaryColor"/><rect x="47" y="70" width="10" height="5" rx="2" :fill="look.secondaryColor"/>
    <rect x="31" y="22" width="26" height="24" rx="6" :fill="look.primaryColor"/>
    <template v-if="ears==='ears-tall'">
      <rect x="33" y="7" width="6" height="18" rx="2" :fill="look.secondaryColor"/><rect x="49" y="7" width="6" height="18" rx="2" :fill="look.secondaryColor"/>
    </template>
    <path v-else-if="ears==='ears-pointed'" d="M32 24 35 12 41 23M47 23 53 12 56 24" :fill="look.secondaryColor"/>
    <template v-else-if="ears==='ears-floppy'">
      <rect x="27" y="22" width="6" height="17" rx="3" :fill="look.secondaryColor"/><rect x="55" y="22" width="6" height="17" rx="3" :fill="look.secondaryColor"/>
    </template>
    <template v-else>
      <circle cx="33" cy="22" r="5" :fill="look.secondaryColor"/><circle cx="55" cy="22" r="5" :fill="look.secondaryColor"/>
    </template>
    <rect x="35" y="31" width="4" height="4" fill="#151a22"/><rect x="49" y="31" width="4" height="4" fill="#151a22"/>
    <rect x="40" y="36" width="8" height="5" rx="2" :fill="look.secondaryColor"/>
  </g>
  <g v-else-if="model.silhouette==='bird'">
    <ellipse cx="44" cy="50" rx="20" ry="25" :fill="look.primaryColor"/><circle cx="44" cy="25" r="14" :fill="look.primaryColor"/><path d="M31 45 17 52 31 60M57 45 71 52 57 60" :fill="look.secondaryColor"/>
    <circle cx="38" cy="24" r="3" fill="#151a22"/><circle cx="50" cy="24" r="3" fill="#151a22"/><path d="M40 31 48 31 44 36Z" :fill="look.accentColor"/>
  </g>
  <g v-else-if="model.silhouette==='head'">
    <rect x="22" y="21" width="44" height="42" rx="9" :fill="look.primaryColor"/><rect x="25" y="56" width="38" height="7" rx="3" :fill="look.secondaryColor"/><circle cx="36" cy="38" r="4" fill="#151a22"/><circle cx="52" cy="38" r="4" fill="#151a22"/>
  </g>
  <g v-else>
    <rect v-if="body==='body-book'" x="29" y="18" width="31" height="50" rx="3" :fill="look.primaryColor"/><rect v-else-if="body==='body-toolbox'" x="20" y="34" width="48" height="30" rx="4" :fill="look.primaryColor"/><rect v-else x="22" y="22" width="44" height="42" rx="5" :fill="body==='body-terminal'?look.secondaryColor:look.primaryColor"/>
    <rect x="30" y="31" width="28" height="18" rx="3" fill="#071316"/><rect x="35" y="38" width="6" height="4" :fill="look.accentColor"/><rect x="47" y="38" width="6" height="4" :fill="look.accentColor"/>
  </g>
  <rect x="29" y="78" width="30" height="3" rx="2" :fill="look.accentColor" opacity=".65"/>
</svg>
</template>
