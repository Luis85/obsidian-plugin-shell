import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import CharacterThumbnail from '../src/presentation/components/editor/CharacterThumbnail.vue'
import { modelAppearance } from '../src/domain/characters/appearance'

describe('quadruped thumbnail ear choices', () => {
  const choices = [
    { ears: 'ears-tall', expected: ['<rect x="33" y="7"', '<rect x="49" y="7"'] },
    { ears: 'ears-pointed', expected: ['<path d="M32 24 35 12 41 23M47 23 53 12 56 24"'] },
    { ears: 'ears-floppy', expected: ['<rect x="27" y="22"', '<rect x="55" y="22"'] },
    { ears: 'ears-round', expected: ['<circle cx="33" cy="22"', '<circle cx="55" cy="22"'] }
  ]

  for (const choice of choices) {
    it(`renders the complete ${choice.ears} shape without other ear choices`, async () => {
      const appearance = modelAppearance('voxel-dog-v1')
      appearance.parts.ears = choice.ears
      const svg = await renderToString(createSSRApp(CharacterThumbnail, { appearance }))
      for (const shape of choice.expected) expect(svg).toContain(shape)
      for (const other of choices.filter(candidate => candidate !== choice)) {
        for (const shape of other.expected) expect(svg).not.toContain(shape)
      }
    })
  }
})
