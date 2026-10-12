# Shared product-family design

Resource Atlas inherits the existing Storyloom and Nuxt UI visual system. The new timeline follows the supplied role/time reference.

Use the existing family-base.css tokens: dark charcoal surfaces and lavender accents; corresponding pale light surfaces and purple controls. System sans typography, compact32px controls, restrained semantic role colors, quiet borders, consistent Lucide icons. Actual Nuxt UI Dashboard, Button, Input, Select, Modal, Checkbox and Tooltip components provide shared behavior.

The first viewport is an operating workspace: family ribbon and sidebar, plan header, a compact effort/budget ledger, and the role timeline. The timeline leads; supplementary forms open in a contextual inspector. The primary authored interaction is drawing or resizing an allocation period, with a visible preview before commit. Saved values and totals update together. Reduced motion removes nonessential transitions.

At narrow widths, the sidebar collapses, the timeline scrolls within its own area, and the inspector becomes a full-width working sheet. Essential plan and role totals remain available in the roles view.
