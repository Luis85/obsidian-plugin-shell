<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import './inspector.css';

const props = defineProps({
  draft: { type: Object, default: null },
  plan: { type: Object, default: null },
  calculation: { type: Object, default: null },
  error: { default: '' },
  preview: { type: Object, default: null },
  dirty: { type: Boolean, default: false }
});
const emit = defineEmits(['change', 'save', 'close', 'delete', 'duplicate', 'move']);
const form = ref(null);
const data = computed(() => props.draft?.data ?? {});
const kind = computed(() => props.draft?.kind ?? '');
const isNew = computed(() => Boolean(props.draft?.isNew));
const changed = computed(() => props.dirty || isNew.value);
const title = computed(() => ({
  role: isNew.value ? 'Rolle hinzufügen' : 'Rolle bearbeiten',
  allocation: isNew.value ? 'Einsatz planen' : 'Einsatz bearbeiten',
  block: isNew.value ? 'Sperrzeit anlegen' : 'Sperrzeit bearbeiten',
  plan: isNew.value ? 'Plan erstellen' : 'Plan bearbeiten',
  holiday: isNew.value ? 'Feiertag hinzufügen' : 'Feiertag bearbeiten',
  calendar: 'Arbeitskalender'
}[kind.value] ?? 'Details'));
const saveLabel = computed(() => isNew.value ? ({
  role: 'Rolle anlegen', allocation: 'Einsatz anlegen', block: 'Sperrzeit anlegen',
  plan: 'Plan erstellen', holiday: 'Feiertag anlegen', calendar: 'Kalender speichern'
}[kind.value] ?? 'Speichern') : 'Änderungen speichern');
const errorText = computed(() => Array.isArray(props.error) ? props.error.join('\n') : typeof props.error === 'string' ? props.error : props.error?.message ?? '');
const roleItems = computed(() => (props.plan?.roles ?? []).map(role => ({ label: role.name, value: role.id })));
const blockScopeItems = computed(() => [{ label: 'Alle Rollen', value: '__all__' }, ...roleItems.value]);
const currentRole = computed(() => props.plan?.roles?.find(role => role.id === data.value.roleId));
const existingAllocationCount = computed(() => props.plan?.allocations?.filter(allocation => allocation.roleId === props.draft?.id).length ?? 0);
const deletable = computed(() => !isNew.value && ['role', 'allocation', 'block', 'plan', 'holiday'].includes(kind.value));
const deleteLabel = computed(() => ({ role: 'Rolle löschen', allocation: 'Einsatz löschen', block: 'Sperrzeit löschen', plan: 'Plan löschen', holiday: 'Feiertag löschen' }[kind.value] ?? 'Löschen'));
const palette = [
  { name: 'Violett', key: 'violet', value: '#a78bfa' },
  { name: 'Blau', key: 'blue', value: '#60a5fa' },
  { name: 'Türkis', key: 'cyan', value: '#22d3ee' },
  { name: 'Grün', key: 'green', value: '#34d399' },
  { name: 'Gelb', key: 'amber', value: '#fbbf24' },
  { name: 'Rosa', key: 'rose', value: '#fb7185' }
];
const weekdays = [
  { id: 1, short: 'Mo', label: 'Montag' }, { id: 2, short: 'Di', label: 'Dienstag' },
  { id: 3, short: 'Mi', label: 'Mittwoch' }, { id: 4, short: 'Do', label: 'Donnerstag' },
  { id: 5, short: 'Fr', label: 'Freitag' }, { id: 6, short: 'Sa', label: 'Samstag' },
  { id: 7, short: 'So', label: 'Sonntag' }
];
const firstField = computed(() => ({ role: 'role-name', allocation: 'allocation-name', block: 'block-name', plan: 'plan-name', holiday: 'holiday-name', calendar: 'calendar-hours' }[kind.value]));
const dateLabel = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : '—';
const update = (field, value) => emit('change', field, value);
const selectedColor = color => String(data.value.color ?? '').toLowerCase() === color.value || data.value.color === color.key;
const selectedPercent = value => Number(String(data.value.percent ?? '').replace(',', '.')) === value;
function toggleWorkday(day) {
  const current = Array.isArray(data.value.workdays) ? data.value.workdays : [];
  update('workdays', current.includes(day) ? current.filter(value => value !== day) : [...current, day].sort((a, b) => a - b));
}
watch(() => `${props.draft?.kind ?? ''}:${props.draft?.id ?? ''}:${props.draft?.isNew ?? ''}`, async () => {
  await nextTick();
  const input = form.value?.querySelector(`#${firstField.value}`);
  input?.focus({ preventScroll: true });
  if (isNew.value && input?.type === 'text') input.select?.();
}, { immediate: true });
</script>

<template>
  <aside v-if="draft" class="resource-inspector" aria-label="Inspector">
    <header class="inspector-header">
      <div class="inspector-heading">
        <h2 id="resource-inspector-title">{{ title }}</h2>
        <p v-if="plan?.name && kind !== 'plan'" class="inspector-context">{{ plan.name }}</p>
        <p v-else class="inspector-context">Zeitraum, Umfang und Rahmen festlegen</p>
      </div>
      <PfButton type="button" icon="i-lucide-x" color="neutral" variant="ghost" size="sm" class="inspector-close" aria-label="Inspector schließen" title="Details schließen" @click="emit('close')" />
    </header>

    <form ref="form" class="inspector-form" novalidate :aria-describedby="errorText ? 'resource-inspector-error' : undefined" @submit.prevent="changed && emit('save')">
      <div class="inspector-body">
        <div v-if="errorText" id="resource-inspector-error" class="inspector-error" role="alert" aria-atomic="true">
          <PfIcon name="i-lucide-triangle-alert" aria-hidden="true" />
          <p>{{ errorText }}</p>
        </div>

        <template v-if="kind === 'role'">
          <div class="inspector-field">
            <label for="role-name">Rollenname</label>
            <PfInput id="role-name" :model-value="data.name ?? ''" type="text" placeholder="z. B. UX / UI Design" :maxlength="160" autocomplete="off" class="inspector-input" @update:model-value="update('name', $event)" />
          </div>
          <div class="inspector-field">
            <label for="role-fte">Standard-FTE</label>
            <PfInput id="role-fte" :model-value="data.fte ?? ''" type="text" inputmode="decimal" placeholder="1,0" autocomplete="off" aria-describedby="role-fte-hint" class="inspector-input" @update:model-value="update('fte', $event)">
              <template #trailing><span class="inspector-unit">FTE</span></template>
            </PfInput>
            <p id="role-fte-hint" class="inspector-hint">Vorgabe für neue Einsätze und nominelle Tageskapazität. 0,2 FTE entsprechen 20 %.</p>
          </div>
          <div v-if="!isNew && existingAllocationCount" class="inspector-choice">
            <PfCheckbox id="role-apply-fte" :model-value="Boolean(data.applyFte)" label="Auf bestehende Einsätze übernehmen" @update:model-value="update('applyFte', $event === true)" />
            <p class="inspector-hint">{{ existingAllocationCount === 1 ? 'Ändert den FTE-Wert des bestehenden Einsatzes.' : `Ändert die FTE-Werte aller ${existingAllocationCount} bestehenden Einsätze.` }}</p>
          </div>
          <fieldset class="inspector-field inspector-colors">
            <legend>Rollenfarbe</legend>
            <div class="inspector-palette" role="group" aria-label="Rollenfarbe">
              <button v-for="color in palette" :key="color.key" type="button" class="inspector-color" :class="{ selected: selectedColor(color) }" :aria-label="`Rollenfarbe ${color.name}`" :aria-pressed="selectedColor(color)" :title="color.name" @click="update('color', color.value)">
                <span class="inspector-color-dot" :style="{ backgroundColor: color.value }"><PfIcon v-if="selectedColor(color)" name="i-lucide-check" aria-hidden="true" /></span>
              </button>
            </div>
          </fieldset>
          <div class="inspector-field">
            <label for="role-notes">Aufgaben und Hinweise <span class="inspector-optional">optional</span></label>
            <PfTextarea id="role-notes" :model-value="data.notes ?? ''" :rows="4" :autoresize="false" :maxlength="20000" placeholder="Wofür wird diese Rolle benötigt?" class="inspector-input" @update:model-value="update('notes', $event)" />
          </div>
        </template>

        <template v-else-if="kind === 'allocation'">
          <div class="inspector-field">
            <label for="allocation-name">Bezeichnung</label>
            <PfInput id="allocation-name" :model-value="data.name ?? ''" placeholder="z. B. Konzeption & Design" :maxlength="160" autocomplete="off" class="inspector-input" @update:model-value="update('name', $event)" />
          </div>
          <div class="inspector-field">
            <label for="allocation-role">Rolle</label>
            <PfSelect id="allocation-role" :model-value="data.roleId" :items="roleItems" placeholder="Rolle auswählen" class="inspector-input" @update:model-value="update('roleId', $event)" />
          </div>
          <div class="inspector-date-row">
            <div class="inspector-field">
              <label for="allocation-start">Von</label>
              <PfInput id="allocation-start" :model-value="data.start ?? ''" type="date" aria-describedby="allocation-date-hint" class="inspector-input" @update:model-value="update('start', $event)" />
            </div>
            <div class="inspector-field">
              <label for="allocation-end">Bis einschließlich</label>
              <PfInput id="allocation-end" :model-value="data.end ?? ''" type="date" aria-describedby="allocation-date-hint" class="inspector-input" @update:model-value="update('end', $event)" />
            </div>
          </div>
          <p id="allocation-date-hint" class="inspector-hint inspector-date-hint">Plan: {{ dateLabel(plan?.start) }} – {{ dateLabel(plan?.end) }}. Außerhalb des Plans fallen keine PT an.</p>
          <PfButton type="button" icon="i-lucide-maximize" size="xs" color="neutral" variant="outline" class="inspector-full-period" @click="update('start', plan.start); update('end', plan.end)">Gesamte Planlaufzeit</PfButton>
          <div class="inspector-field">
            <label for="allocation-fte">Einsatzumfang</label>
            <PfInput id="allocation-fte" :model-value="data.fte ?? ''" type="text" inputmode="decimal" placeholder="1,0" autocomplete="off" aria-describedby="allocation-fte-hint" class="inspector-input" @update:model-value="update('fte', $event)">
              <template #trailing><span class="inspector-unit">FTE</span></template>
            </PfInput>
            <p id="allocation-fte-hint" class="inspector-hint">1 FTE an einem verfügbaren Arbeitstag ergibt 1 PT.<template v-if="currentRole"> Standard der Rolle: {{ String(currentRole.fte).replace('.', ',') }} FTE.</template></p>
          </div>
          <div class="inspector-field">
            <label for="allocation-notes">Notizen <span class="inspector-optional">optional</span></label>
            <PfTextarea id="allocation-notes" :model-value="data.notes ?? ''" :rows="3" :autoresize="false" :maxlength="20000" placeholder="Ergebnis, Übergabe oder Abhängigkeiten" class="inspector-input" @update:model-value="update('notes', $event)" />
          </div>
        </template>

        <template v-else-if="kind === 'block'">
          <div class="inspector-field">
            <label for="block-name">Grund der Sperrzeit</label>
            <PfInput id="block-name" :model-value="data.name ?? ''" placeholder="z. B. Urlaub oder Betriebsruhe" :maxlength="160" autocomplete="off" class="inspector-input" @update:model-value="update('name', $event)" />
          </div>
          <div class="inspector-field">
            <label for="block-role">Gilt für</label>
            <PfSelect id="block-role" :model-value="data.roleId ?? '__all__'" :items="blockScopeItems" class="inspector-input" @update:model-value="update('roleId', $event)" />
          </div>
          <div class="inspector-date-row">
            <div class="inspector-field">
              <label for="block-start">Von</label>
              <PfInput id="block-start" :model-value="data.start ?? ''" type="date" class="inspector-input" @update:model-value="update('start', $event)" />
            </div>
            <div class="inspector-field">
              <label for="block-end">Bis einschließlich</label>
              <PfInput id="block-end" :model-value="data.end ?? ''" type="date" class="inspector-input" @update:model-value="update('end', $event)" />
            </div>
          </div>
          <div class="inspector-field">
            <label for="block-percent">Gesperrter Anteil</label>
            <PfInput id="block-percent" :model-value="data.percent ?? ''" type="text" inputmode="decimal" placeholder="100" autocomplete="off" aria-describedby="block-percent-hint" class="inspector-input" @update:model-value="update('percent', $event)">
              <template #trailing><span class="inspector-unit">%</span></template>
            </PfInput>
            <div class="inspector-presets" role="group" aria-label="Sperranteil schnell auswählen">
              <PfButton v-for="percent in [25, 50, 100]" :key="percent" type="button" size="xs" color="neutral" :variant="selectedPercent(percent) ? 'soft' : 'outline'" :aria-pressed="selectedPercent(percent)" :aria-label="`${percent} Prozent sperren`" @click="update('percent', String(percent))">{{ percent }} %</PfButton>
            </div>
            <p id="block-percent-hint" class="inspector-hint">100 % sperrt die gesamte Kapazität. Der Anteil kürzt Aufwand und Kapazität; bei überlappenden Sperren gilt der höchste Wert.</p>
          </div>
        </template>

        <template v-else-if="kind === 'plan'">
          <div class="inspector-field">
            <label for="plan-name">Planname</label>
            <PfInput id="plan-name" :model-value="data.name ?? ''" placeholder="z. B. ERP-Einführung" :maxlength="200" autocomplete="off" class="inspector-input" @update:model-value="update('name', $event)" />
          </div>
          <div class="inspector-date-row">
            <div class="inspector-field">
              <label for="plan-start">Planstart</label>
              <PfInput id="plan-start" :model-value="data.start ?? ''" type="date" aria-describedby="plan-date-hint" class="inspector-input" @update:model-value="update('start', $event)" />
            </div>
            <div class="inspector-field">
              <label for="plan-end">Planende</label>
              <PfInput id="plan-end" :model-value="data.end ?? ''" type="date" aria-describedby="plan-date-hint" class="inspector-input" @update:model-value="update('end', $event)" />
            </div>
          </div>
          <p id="plan-date-hint" class="inspector-hint inspector-date-hint">Start und Ende zählen mit. Bestehende Einsätze bleiben erhalten und werden nur innerhalb dieses Zeitraums berechnet.</p>
          <div class="inspector-field">
            <label for="plan-budget">Aufwandsbudget <span class="inspector-optional">optional</span></label>
            <PfInput id="plan-budget" :model-value="data.budgetPt ?? ''" type="text" inputmode="decimal" placeholder="Kein Budget festgelegt" autocomplete="off" aria-describedby="plan-budget-hint" class="inspector-input" @update:model-value="update('budgetPt', $event)">
              <template #trailing><span class="inspector-unit">PT</span></template>
            </PfInput>
            <p id="plan-budget-hint" class="inspector-hint">Vergleicht den geplanten Aufwand mit dem Budget. Leer lassen, um ohne Budgetgrenze zu planen.</p>
          </div>
          <div class="inspector-field">
            <label for="plan-notes">Planungsannahmen <span class="inspector-optional">optional</span></label>
            <PfTextarea id="plan-notes" :model-value="data.notes ?? ''" :rows="4" :autoresize="false" :maxlength="20000" placeholder="Umfang, Annahmen und offene Fragen" class="inspector-input" @update:model-value="update('notes', $event)" />
          </div>
        </template>

        <template v-else-if="kind === 'holiday'">
          <div class="inspector-field">
            <label for="holiday-name">Bezeichnung</label>
            <PfInput id="holiday-name" :model-value="data.name ?? ''" placeholder="z. B. Tag der Deutschen Einheit" :maxlength="160" autocomplete="off" class="inspector-input" @update:model-value="update('name', $event)" />
          </div>
          <div class="inspector-field">
            <label for="holiday-date">Datum</label>
            <PfInput id="holiday-date" :model-value="data.date ?? ''" type="date" aria-describedby="holiday-date-hint" class="inspector-input" @update:model-value="update('date', $event)" />
            <p id="holiday-date-hint" class="inspector-hint">Dieser Tag zählt für alle Rollen als arbeitsfrei. Feiertage werden für jeden Plan ausdrücklich gepflegt.</p>
          </div>
        </template>

        <template v-else-if="kind === 'calendar'">
          <fieldset class="inspector-field inspector-workdays">
            <legend>Reguläre Arbeitstage</legend>
            <div class="inspector-weekdays" role="group" aria-label="Reguläre Arbeitstage auswählen">
              <button v-for="day in weekdays" :key="day.id" type="button" class="inspector-weekday" :class="{ selected: data.workdays?.includes(day.id) }" :aria-label="day.label" :aria-pressed="Boolean(data.workdays?.includes(day.id))" :title="`${day.label} ${data.workdays?.includes(day.id) ? 'ist ein Arbeitstag' : 'ist arbeitsfrei'}`" @click="toggleWorkday(day.id)">{{ day.short }}</button>
            </div>
            <p v-if="data.workdays?.length" class="inspector-hint">Nicht ausgewählte Tage und eingetragene Feiertage ergeben 0 PT.</p>
            <p v-else class="inspector-hint inspector-inline-warning">Kein Arbeitstag ausgewählt. Der Plan ergibt 0 PT und 0 Kapazität.</p>
          </fieldset>
          <div class="inspector-field">
            <label for="calendar-hours">Stunden pro Personentag</label>
            <PfInput id="calendar-hours" :model-value="data.hoursPerDay ?? ''" type="text" inputmode="decimal" placeholder="8" autocomplete="off" aria-describedby="calendar-hours-hint" class="inspector-input" @update:model-value="update('hoursPerDay', $event)">
              <template #trailing><span class="inspector-unit">h / PT</span></template>
            </PfInput>
            <p id="calendar-hours-hint" class="inspector-hint">Dient der Umrechnung in Stunden. Die Anzahl der Personentage bleibt bei einer Änderung gleich.</p>
          </div>
          <div class="inspector-note">
            <PfIcon name="i-lucide-info" aria-hidden="true" />
            <p>Dieser Kalender gilt nur für den aktuellen Plan. Regionale Feiertage werden separat in der Kalenderansicht hinzugefügt.</p>
          </div>
        </template>

        <section v-if="preview" class="inspector-preview" aria-labelledby="inspector-preview-title" aria-live="polite" aria-atomic="true">
          <h3 id="inspector-preview-title">{{ preview.title || 'Auswirkung auf den Plan' }}</h3>
          <dl v-if="preview.items?.length">
            <div v-for="(item, index) in preview.items" :key="`${item.label}-${index}`">
              <dt>{{ item.label }}</dt><dd>{{ item.value }}</dd>
            </div>
          </dl>
          <p v-if="preview.note" class="inspector-hint">{{ preview.note }}</p>
        </section>

        <section v-if="kind === 'allocation' && !isNew" class="inspector-tools" aria-label="Weitere Aktionen für diesen Einsatz">
          <h3>Zeitraum anpassen</h3>
          <div class="inspector-move-actions">
            <PfButton type="button" color="neutral" variant="outline" size="sm" icon="i-lucide-arrow-left" :disabled="dirty" aria-label="Einsatz um einen Kalendertag früher verschieben" title="Einen Kalendertag früher" @click="emit('move', -1)">1 Tag früher</PfButton>
            <PfButton type="button" color="neutral" variant="outline" size="sm" trailing-icon="i-lucide-arrow-right" :disabled="dirty" aria-label="Einsatz um einen Kalendertag später verschieben" title="Einen Kalendertag später" @click="emit('move', 1)">1 Tag später</PfButton>
          </div>
          <PfButton type="button" color="neutral" variant="ghost" size="sm" icon="i-lucide-copy" :disabled="dirty" class="inspector-duplicate" @click="emit('duplicate')">Einsatz duplizieren</PfButton>
          <p v-if="dirty" class="inspector-hint">Speichere die offenen Änderungen, bevor du den Einsatz verschiebst oder duplizierst.</p>
        </section>

        <section v-if="deletable" class="inspector-delete-section">
          <PfButton type="button" color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" @click="emit('delete')">{{ deleteLabel }}</PfButton>
          <p v-if="kind === 'role'" class="inspector-hint">Entfernt auch die Einsätze und Sperrzeiten dieser Rolle. Du bestätigst das Löschen im nächsten Schritt.</p>
          <p v-else-if="kind === 'plan'" class="inspector-hint">Entfernt diesen Plan mit allen Rollen und Einträgen. Du bestätigst das Löschen im nächsten Schritt.</p>
        </section>
      </div>

      <footer class="inspector-footer">
        <div class="inspector-save-state"><span v-if="changed" class="inspector-dirty-dot" aria-hidden="true" />{{ changed ? 'Noch nicht gespeichert' : 'Keine offenen Änderungen' }}</div>
        <div class="inspector-footer-actions">
          <PfButton type="button" color="neutral" variant="outline" size="sm" @click="emit('close')">Abbrechen</PfButton>
          <PfButton type="submit" color="primary" variant="solid" size="sm" :disabled="!changed" class="inspector-save">{{ saveLabel }}</PfButton>
        </div>
      </footer>
    </form>
  </aside>
</template>
