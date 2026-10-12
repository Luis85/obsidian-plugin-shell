<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';
import { parseDate, formatDate, isoWeek, makeBuckets } from './domain.mjs';
import './timeline.css';

const props = defineProps({
  plan: { type: Object, required: true },
  calculation: { type: Object, required: true },
  granularity: { type: String, default: 'week' },
  fit: { type: Boolean, default: true },
  tool: { type: String, default: 'select' },
  selectedId: { type: String, default: null },
});
const emit = defineEmits(['select-allocation', 'edit-role', 'new-role', 'create-allocation', 'create-block', 'update-allocation', 'select-block']);
const scroller = ref(null), viewportWidth = ref(1000), gesture = shallowRef(null), announcement = ref('');
const helpId = `timeline-help-${useId()}`;
let resizeObserver, suppressClick = null;
const first = computed(() => parseDate(props.plan.start));
const last = computed(() => parseDate(props.plan.end));
const dayCount = computed(() => last.value - first.value + 1);
const compact = computed(() => viewportWidth.value < 640);
const labelWidth = computed(() => compact.value ? 112 : 190);
const totalWidth = computed(() => compact.value ? 68 : 90);
const trackWidth = computed(() => {
  const available = Math.max(400, viewportWidth.value - labelWidth.value - totalWidth.value);
  if (props.fit) return available;
  const pxPerDay = props.granularity === 'day' ? 28 : props.granularity === 'month' ? 7 : 12;
  return Math.max(available, dayCount.value * pxPerDay);
});
const gridStyle = computed(() => ({ '--rt-label-width': `${labelWidth.value}px`, '--rt-track-width': `${trackWidth.value}px`, '--rt-total-width': `${totalWidth.value}px` }));
const number = value => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value ?? 0);
const shortDate = date => `${date.slice(8)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
const dateLabel = (start, end) => start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;
const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const semanticColors = { violet: '#b5a3f4', blue: '#93b9ef', cyan: '#81c9c4', green: '#add39b', amber: '#e6be7a', rose: '#dda1b5' };
const colorFor = role => semanticColors[role.color] || role.color || '#b5a3f4';

function extent(start, end) {
  const from = Math.max(first.value, typeof start === 'number' ? start : parseDate(start));
  const to = Math.min(last.value, typeof end === 'number' ? end : parseDate(end));
  return { from, to, visible: to >= from, left: 100 * (from - first.value) / dayCount.value, width: 100 * Math.max(0, to - from + 1) / dayCount.value };
}
function position(start, end) {
  const span = extent(start, end);
  return { left: `${span.left}%`, width: `${span.width}%` };
}
function placeLanes(items) {
  const laneEnds = [];
  const placed = items.map(item => ({ item, ...extent(item.start, item.end) })).filter(item => item.visible)
    .sort((a, b) => a.from - b.from || a.to - b.to || a.item.id.localeCompare(b.item.id));
  for (const entry of placed) {
    let lane = laneEnds.findIndex(end => end < entry.from);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = entry.to;
    entry.lane = lane;
  }
  return { items: placed, lanes: laneEnds.length };
}
const allocationSummaries = computed(() => new Map(props.calculation.allocations.map(item => [item.id, item])));
const roleSummaries = computed(() => new Map(props.calculation.roles.map(item => [item.id, item])));
const roles = computed(() => props.plan.roles.map(role => {
  const allocations = placeLanes(props.plan.allocations.filter(item => item.roleId === role.id));
  const blocks = placeLanes(props.plan.blocks.filter(item => item.roleId === role.id));
  const allocationHeight = Math.max(1, allocations.lanes) * 36;
  return { ...role, allocations: allocations.items, blocks: blocks.items, blockTop: 12 + allocationHeight,
    height: Math.max(68, 20 + allocationHeight + blocks.lanes * 16), summary: roleSummaries.value.get(role.id),
    outsideCount: props.plan.allocations.filter(item => item.roleId === role.id && !extent(item.start, item.end).visible).length };
}));
const companyBlocks = computed(() => placeLanes(props.plan.blocks.filter(item => item.roleId === null)));
const companyHeight = computed(() => Math.max(46, 12 + companyBlocks.value.lanes * 30));
const bodyHeight = computed(() => companyHeight.value + (roles.value.length ? roles.value.reduce((sum, role) => sum + role.height, 0) : 164));
const periods = computed(() => makeBuckets(props.calculation, props.granularity));
const months = computed(() => makeBuckets(props.calculation, 'month').map(month => ({ ...month,
  label: `${monthNames[Number(month.key.slice(5)) - 1]} ${month.key.slice(0, 4)}` })));
const weeks = computed(() => makeBuckets(props.calculation, 'week'));
function pixelWidth(start, end) { return extent(start, end).width * trackWidth.value / 100; }
function axisLabel(period, index) {
  const width = pixelWidth(period.start, period.end);
  if (props.granularity === 'day') {
    const stride = Math.max(1, Math.ceil(23 / (trackWidth.value / dayCount.value)));
    return index % stride === 0 ? period.start.slice(8) : '';
  }
  if (props.granularity === 'week') return width < 22 ? '' : width < 40 ? period.key.slice(-2) : `KW ${period.key.slice(-2)}`;
  return width < 30 ? '' : `${period.workingDays} AT`;
}

// Merge adjacent calendar segments. The background is painted once for the
// whole timeline, independently of the number of role rows or allocation lanes.
const backgroundSegments = computed(() => {
  const segments = [];
  let previous;
  for (const [index, day] of props.calculation.days.entries()) {
    const kind = day.holiday ? 'holiday' : !day.working ? 'off' : 'work';
    const signature = `${kind}/${day.blockedFraction}`;
    if (previous?.signature === signature) previous.length++;
    else {
      previous = { index, length: 1, kind, fraction: day.blockedFraction, signature };
      segments.push(previous);
    }
  }
  return segments;
});
const monthLines = computed(() => months.value.slice(1).map(month => parseDate(month.start) - first.value));
const weekLines = computed(() => weeks.value.slice(1).map(week => parseDate(week.start) - first.value));
const dayLines = computed(() => trackWidth.value / dayCount.value >= 14 ? Array.from({ length: dayCount.value - 1 }, (_, index) => index + 1) : []);

function allocationPosition(entry) {
  const active = gesture.value;
  const span = active?.id === entry.item.id && active.type !== 'draw' ? position(active.start, active.end) : position(entry.item.start, entry.item.end);
  return { ...span, top: `${10 + entry.lane * 36}px` };
}
function allocationDensity(entry) {
  const active = gesture.value;
  const width = active?.id === entry.item.id && active.type !== 'draw' ? pixelWidth(active.start, active.end) : pixelWidth(entry.item.start, entry.item.end);
  return { 'is-compact': width < 100, 'is-narrow': width < 65, 'is-tiny': width < 34 };
}
function companyDensity(item) {
  const width = pixelWidth(item.start, item.end);
  return { 'has-name-only': width >= 90 && width < 150, 'has-compact-value': width < 90, 'has-value-only': width < 50, 'is-tiny': width < 28 };
}
function allocationTitle(item) {
  const summary = allocationSummaries.value.get(item.id);
  const clipped = summary?.clipped ? ' · nur innerhalb des Plans berechnet' : '';
  return `${item.name || 'Einsatz'} · ${dateLabel(item.start, item.end)} · ${number(item.fte)} FTE · ${number(summary?.netPt)} PT${clipped}. Ziehen zum Verschieben; Pfeiltasten: 1 Tag, Umschalt + Pfeiltasten: 7 Tage.`;
}
function blockTitle(item) {
  return `${item.name || 'Sperrzeit'} · ${dateLabel(item.start, item.end)} · ${number(item.fraction * 100)} % gesperrt. Öffnen zum Bearbeiten.`;
}
function quickCreate(roleId, day = first.value) {
  const week = isoWeek(day);
  const start = formatDate(Math.max(first.value, parseDate(week.start)));
  const end = formatDate(Math.min(last.value, parseDate(week.end)));
  emit(roleId === null || props.tool === 'block' ? 'create-block' : 'create-allocation', { roleId, start, end });
}
function dayAt(event, track) {
  const rect = track.getBoundingClientRect();
  return Math.max(first.value, Math.min(last.value, first.value + Math.floor((event.clientX - rect.left) / rect.width * dayCount.value)));
}
function capture(event, active) {
  gesture.value = { ...active, pointerId: event.pointerId, target: event.currentTarget, moved: false };
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Window listeners also finish gestures outside the track. */ }
}
function startDraw(event, roleId) {
  if (event.button !== 0 || props.tool === 'select' || event.target.closest('button')) return;
  if (props.tool === 'allocate' && roleId === null) return;
  event.preventDefault();
  const day = dayAt(event, event.currentTarget);
  capture(event, { type: 'draw', kind: props.tool === 'block' ? 'block' : 'allocation', roleId, track: event.currentTarget, anchor: day, start: day, end: day });
}
function startAllocation(event, item, type = 'move') {
  if (event.button !== 0 || props.tool !== 'select' || event.pointerType === 'touch') return;
  event.stopPropagation();
  event.preventDefault();
  const start = parseDate(item.start), end = parseDate(item.end);
  if (type === 'move' && end - start + 1 > dayCount.value) {
    announcement.value = 'Dieser Einsatz ist länger als der Plan. Den Zeitraum können Sie im Formular anpassen.';
    emit('select-allocation', item.id);
    return;
  }
  const track = event.currentTarget.closest('.rt-track');
  capture(event, { type, id: item.id, roleId: item.roleId, track, initialX: event.clientX,
    pxPerDay: track.getBoundingClientRect().width / dayCount.value, originalStart: start, originalEnd: end, start, end });
}
function moveGesture(event) {
  const active = gesture.value;
  if (!active || event.pointerId !== active.pointerId) return;
  if (event.cancelable) event.preventDefault();
  const next = { ...active };
  if (active.type === 'draw') {
    const day = dayAt(event, active.track);
    next.start = Math.min(active.anchor, day);
    next.end = Math.max(active.anchor, day);
    next.moved = true;
    const frame = scroller.value?.getBoundingClientRect();
    if (frame && scroller.value.scrollWidth > scroller.value.clientWidth) {
      if (event.clientX > frame.right - totalWidth.value - 22) scroller.value.scrollLeft += 16;
      else if (event.clientX < frame.left + labelWidth.value + 22) scroller.value.scrollLeft -= 16;
    }
  } else {
    const delta = Math.round((event.clientX - active.initialX) / active.pxPerDay);
    next.moved = active.moved || Math.abs(event.clientX - active.initialX) >= 3;
    if (active.type === 'move') {
      const duration = active.originalEnd - active.originalStart;
      next.start = Math.max(first.value, Math.min(last.value - duration, active.originalStart + delta));
      next.end = next.start + duration;
    } else if (active.type === 'resize-start') next.start = Math.max(first.value, Math.min(active.originalEnd, Math.min(last.value, Math.max(first.value, active.originalStart) + delta)));
    else next.end = Math.min(last.value, Math.max(active.originalStart, Math.max(first.value, Math.min(last.value, active.originalEnd) + delta)));
  }
  gesture.value = next;
}
function clearGesture() {
  const active = gesture.value;
  gesture.value = null;
  try { if (active?.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId); } catch { /* The target may have been replaced by parent state. */ }
  return active;
}
function finishGesture(event) {
  if (!gesture.value || event.pointerId !== gesture.value.pointerId) return;
  const active = clearGesture();
  if (active.type === 'draw') {
    const payload = { roleId: active.roleId, start: formatDate(active.start), end: formatDate(active.end) };
    announcement.value = `${active.kind === 'block' ? 'Sperrzeit' : 'Einsatz'}: ${dateLabel(payload.start, payload.end)}. Details bearbeiten.`;
    emit(active.kind === 'block' ? 'create-block' : 'create-allocation', payload);
  } else if (active.moved) {
    suppressClick = active.id;
    commitDates(active.id, active.start, active.end, active.originalStart, active.originalEnd);
  }
}
function cancelGesture(event) {
  if (!gesture.value || (event?.pointerId !== undefined && event.pointerId !== gesture.value.pointerId)) return;
  clearGesture();
  announcement.value = 'Änderung abgebrochen.';
}
function allocationClick(item) {
  if (suppressClick === item.id) { suppressClick = null; return; }
  suppressClick = null;
  emit('select-allocation', item.id);
}
function commitDates(id, start, end, previousStart, previousEnd) {
  if (end < start || (start === previousStart && end === previousEnd)) return;
  try {
    const payload = { id, start: formatDate(start), end: formatDate(end) };
    emit('update-allocation', payload);
    announcement.value = `Zeitraum auf ${dateLabel(payload.start, payload.end)} geändert.`;
  } catch { announcement.value = 'Der Zeitraum liegt außerhalb des unterstützten Kalenders. Bitte die Datumsfelder verwenden.'; }
}
function allocationKey(event, item, edge = null) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  const delta = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 7 : 1);
  const oldStart = parseDate(item.start), oldEnd = parseDate(item.end);
  let start = oldStart, end = oldEnd;
  if (edge === 'start') start = Math.max(first.value, Math.min(oldEnd, oldStart + delta));
  else if (edge === 'end') end = Math.min(last.value, Math.max(oldStart, oldEnd + delta));
  else {
    const duration = oldEnd - oldStart;
    if (duration >= dayCount.value) { announcement.value = 'Dieser Einsatz füllt den Planzeitraum bereits aus. Den Zeitraum können Sie im Formular ändern.'; return; }
    start = Math.max(first.value, Math.min(last.value - duration, oldStart + delta));
    end = start + duration;
  }
  commitDates(item.id, start, end, oldStart, oldEnd);
}
function onEscape(event) { if (event.key === 'Escape' && gesture.value) { event.preventDefault(); cancelGesture(); } }
function doubleClick(event, roleId) {
  if (props.tool !== 'select' || event.target.closest('button')) return;
  quickCreate(roleId, dayAt(event, event.currentTarget));
}
const drawFor = roleId => gesture.value?.type === 'draw' && gesture.value.roleId === roleId;
const gestureLabel = computed(() => gesture.value ? dateLabel(formatDate(gesture.value.start), formatDate(gesture.value.end)) : '');
watch(() => [props.plan.id, props.plan.start, props.plan.end, props.tool, props.granularity], () => cancelGesture());
onMounted(() => {
  resizeObserver = new ResizeObserver(entries => { viewportWidth.value = entries[0].contentRect.width; });
  if (scroller.value) resizeObserver.observe(scroller.value);
  window.addEventListener('pointermove', moveGesture, { passive: false });
  window.addEventListener('pointerup', finishGesture);
  window.addEventListener('pointercancel', cancelGesture);
  window.addEventListener('keydown', onEscape);
});
onBeforeUnmount(() => {
  clearGesture();
  resizeObserver?.disconnect();
  window.removeEventListener('pointermove', moveGesture);
  window.removeEventListener('pointerup', finishGesture);
  window.removeEventListener('pointercancel', cancelGesture);
  window.removeEventListener('keydown', onEscape);
});
</script>

<template>
  <section class="resource-timeline" :class="{ 'rt-compact': compact, 'rt-draw-tool': tool !== 'select', 'rt-interacting': gesture }" :style="gridStyle" data-testid="timeline" aria-label="Ressourceneinsatzplan als Zeitachse">
    <div ref="scroller" class="rt-scroll" tabindex="0" aria-label="Zeitachse; bei Bedarf horizontal und vertikal scrollen">
      <div class="rt-grid">
        <header class="rt-header rt-grid-row">
          <div class="rt-label-cell rt-heading"><span>Rollen &amp; Einsätze</span><small>Standard-FTE</small></div>
          <div class="rt-axis">
            <div class="rt-month-axis">
              <div v-for="month in months" :key="month.key" class="rt-month" :style="position(month.start, month.end)" :title="month.label">
                <span v-if="pixelWidth(month.start, month.end) > 40">{{ pixelWidth(month.start, month.end) > 95 ? month.label : month.label.slice(0, 3) }}</span>
              </div>
            </div>
            <div class="rt-period-axis" :aria-label="granularity === 'week' ? 'ISO-Kalenderwochen' : granularity === 'month' ? 'Arbeitstage je Monat' : 'Kalendertage'">
              <div v-for="(period, index) in periods" :key="period.key" class="rt-period" :style="position(period.start, period.end)" :title="`${period.label} · ${dateLabel(period.start, period.end)} · ${period.workingDays} Arbeitstage`">{{ axisLabel(period, index) }}</div>
            </div>
          </div>
          <div class="rt-total-cell rt-heading"><span>Aufwand</span><small>Netto-PT</small></div>
        </header>

        <div class="rt-body" :style="{ height: `${bodyHeight}px` }">
          <div class="rt-backdrop" aria-hidden="true">
            <svg :viewBox="`0 0 ${dayCount} 1`" preserveAspectRatio="none">
              <template v-for="segment in backgroundSegments" :key="segment.index">
                <rect v-if="segment.kind !== 'work'" :x="segment.index" y="0" :width="segment.length" height="1" :class="segment.kind === 'holiday' ? 'rt-bg-holiday' : 'rt-bg-off'" />
                <rect v-if="segment.fraction > 0" :x="segment.index" y="0" :width="segment.length" height="1" class="rt-bg-block" :style="{ opacity: 0.07 + segment.fraction * 0.08 }" />
              </template>
              <line v-for="day in dayLines" :key="`d${day}`" :x1="day" :x2="day" y1="0" y2="1" class="rt-day-line" vector-effect="non-scaling-stroke" />
              <line v-for="week in weekLines" :key="`w${week}`" :x1="week" :x2="week" y1="0" y2="1" class="rt-week-line" vector-effect="non-scaling-stroke" />
              <line v-for="month in monthLines" :key="`m${month}`" :x1="month" :x2="month" y1="0" y2="1" class="rt-month-line" vector-effect="non-scaling-stroke" />
            </svg>
          </div>

          <div class="rt-grid-row rt-company-row" :style="{ height: `${companyHeight}px` }">
            <div class="rt-label-cell rt-company-label">
              <span><strong>Gemeinsame Sperrzeiten</strong><small>Alle Rollen</small></span>
              <button class="rt-row-add" type="button" aria-label="Gemeinsame Sperrzeit anlegen" title="Gemeinsame Sperrzeit anlegen" @click="quickCreate(null)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
            </div>
            <div class="rt-track rt-company-track" data-testid="company-track" @pointerdown="startDraw($event, null)" @dblclick="doubleClick($event, null)">
              <button v-for="entry in companyBlocks.items" :key="entry.item.id" class="rt-company-block" :class="[{ 'is-selected': selectedId === entry.item.id, 'is-zero': entry.item.fraction === 0 }, companyDensity(entry.item)]" :data-block-id="entry.item.id" :style="{ ...position(entry.item.start, entry.item.end), top: `${7 + entry.lane * 30}px` }" :title="blockTitle(entry.item)" :aria-label="blockTitle(entry.item)" @click="emit('select-block', entry.item.id)">
                <svg class="rt-block-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></svg>
                <span class="rt-block-name">{{ entry.item.name || 'Sperrzeit' }}</span><small class="rt-block-fraction">{{ number(entry.item.fraction * 100) }} %</small>
              </button>
              <button v-if="!companyBlocks.items.length && !drawFor(null)" class="rt-empty-track-action" type="button" @click="quickCreate(null)">Betriebsferien oder gemeinsame Sperrzeit eintragen</button>
              <div v-if="drawFor(null)" class="rt-draft rt-draft-block" :style="position(gesture.start, gesture.end)">{{ gestureLabel }}</div>
            </div>
            <div class="rt-total-cell rt-calendar-total" :title="`${number(calculation.totals.blockedDays)} gesperrte Arbeitstage im gemeinsamen Kalender`"><strong>{{ number(calculation.totals.blockedDays) }}</strong><small>AT gesperrt</small></div>
          </div>

          <div v-for="role in roles" :key="role.id" class="rt-grid-row rt-role-row" :style="{ height: `${role.height}px`, '--rt-role-color': colorFor(role) }" :data-role-id="role.id">
            <div class="rt-label-cell rt-role-label">
              <button class="rt-role-edit" type="button" :aria-label="`Rolle ${role.name} bearbeiten, ${number(role.fte)} Standard-FTE`" :title="`${role.name} bearbeiten`" @click="emit('edit-role', role.id)">
                <span class="rt-role-name"><i class="rt-role-dot" aria-hidden="true"></i><strong>{{ role.name }}</strong></span>
                <small>{{ number(role.fte) }} FTE<span v-if="role.outsideCount" class="rt-outside-note"> · {{ role.outsideCount }} außerhalb</span></small>
              </button>
              <button class="rt-row-add" type="button" :aria-label="`${tool === 'block' ? 'Sperrzeit' : 'Einsatz'} für ${role.name} anlegen`" :title="`${tool === 'block' ? 'Sperrzeit' : 'Einsatz'} anlegen`" @click="quickCreate(role.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
            </div>
            <div class="rt-track rt-role-track" :data-testid="`role-track-${role.id}`" @pointerdown="startDraw($event, role.id)" @dblclick="doubleClick($event, role.id)">
              <span v-if="!role.allocations.length && !drawFor(role.id)" class="rt-role-empty">Einsatz mit + anlegen oder einen Zeitraum einzeichnen</span>
              <div v-for="entry in role.allocations" :key="entry.item.id" class="rt-allocation-shell" :class="[{ 'is-selected': selectedId === entry.item.id, 'is-moving': gesture?.id === entry.item.id, 'is-zero': allocationSummaries.get(entry.item.id)?.netPt === 0, 'is-clipped-start': entry.item.start < plan.start, 'is-clipped-end': entry.item.end > plan.end }, allocationDensity(entry)]" :style="allocationPosition(entry)" :data-allocation-id="entry.item.id">
                <button class="rt-allocation" type="button" :title="allocationTitle(entry.item)" :aria-label="allocationTitle(entry.item)" :aria-pressed="selectedId === entry.item.id" :aria-describedby="helpId" aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight" @pointerdown="startAllocation($event, entry.item)" @click="allocationClick(entry.item)" @keydown="allocationKey($event, entry.item)">
                  <span class="rt-allocation-name">{{ entry.item.name || 'Einsatz' }}</span>
                  <span class="rt-allocation-effort">{{ number(allocationSummaries.get(entry.item.id)?.netPt) }} PT<small>{{ number(entry.item.fte) }} FTE</small></span>
                </button>
                <button class="rt-resize rt-resize-start" type="button" :aria-label="`Beginn von ${entry.item.name || 'Einsatz'} ändern; Pfeiltasten verschieben um einen Tag`" :title="`Beginn: ${shortDate(entry.item.start)}`" @pointerdown="startAllocation($event, entry.item, 'resize-start')" @click.stop="emit('select-allocation', entry.item.id)" @keydown="allocationKey($event, entry.item, 'start')"><span></span></button>
                <button class="rt-resize rt-resize-end" type="button" :aria-label="`Ende von ${entry.item.name || 'Einsatz'} ändern; Pfeiltasten verschieben um einen Tag`" :title="`Ende: ${shortDate(entry.item.end)}`" @pointerdown="startAllocation($event, entry.item, 'resize-end')" @click.stop="emit('select-allocation', entry.item.id)" @keydown="allocationKey($event, entry.item, 'end')"><span></span></button>
                <span v-if="gesture?.id === entry.item.id" class="rt-gesture-label">{{ gestureLabel }}</span>
              </div>
              <button v-for="entry in role.blocks" :key="entry.item.id" class="rt-role-block" :class="{ 'is-selected': selectedId === entry.item.id, 'is-zero': entry.item.fraction === 0 }" :data-block-id="entry.item.id" :style="{ ...position(entry.item.start, entry.item.end), top: `${role.blockTop + entry.lane * 16}px` }" :aria-label="blockTitle(entry.item)" :title="blockTitle(entry.item)" @click="emit('select-block', entry.item.id)"><span>{{ number(entry.item.fraction * 100) }} % {{ entry.item.name || 'gesperrt' }}</span></button>
              <div v-if="drawFor(role.id)" class="rt-draft" :class="{ 'rt-draft-block': gesture.kind === 'block' }" :style="position(gesture.start, gesture.end)">{{ gestureLabel }}</div>
            </div>
            <div class="rt-total-cell rt-role-total" :data-testid="`role-total-${role.id}`" :aria-label="`${role.name}: ${number(role.summary?.netPt)} Personentage`" :title="`${number(role.summary?.grossPt)} Brutto-PT − ${number(role.summary?.blockedPt)} gesperrte PT = ${number(role.summary?.netPt)} Netto-PT`">
              <span><strong>{{ number(role.summary?.netPt) }}</strong><small>PT</small></span>
              <small v-if="role.summary?.overloadPt > 0.000001" class="rt-overload">{{ number(role.summary.overloadPt) }} PT über Kap.</small>
              <small v-else>{{ role.summary?.activeAllocationCount || 0 }} {{ role.summary?.activeAllocationCount === 1 ? 'Einsatz' : 'Einsätze' }}</small>
            </div>
          </div>

          <div v-if="!roles.length" class="rt-empty-roles"><h3>Mit der ersten Rolle beginnen</h3><p>Rolle und Standard-FTE festlegen. Anschließend bestimmen Einsätze den geplanten Aufwand.</p><PfButton size="sm" @click="emit('new-role')">Rolle anlegen</PfButton></div>
        </div>

        <footer class="rt-grid-row rt-summary-row">
          <div class="rt-label-cell rt-summary-label"><strong>Geplanter Aufwand</strong><small>{{ calculation.totals.workingDays }} Arbeitstage im Kalender</small></div>
          <div class="rt-track rt-period-totals">
            <div v-for="period in periods" :key="period.key" :style="position(period.start, period.end)" :title="`${period.label}: ${number(period.netPt)} PT`"><span v-if="pixelWidth(period.start, period.end) >= 25">{{ period.netPt ? number(period.netPt) : '–' }}</span></div>
          </div>
          <div class="rt-total-cell rt-grand-total" data-testid="timeline-total"><strong>{{ number(calculation.totals.netPt) }}</strong><small>PT</small></div>
        </footer>
      </div>
    </div>
    <div class="rt-bottom-bar">
      <button class="rt-add-role" type="button" @click="emit('new-role')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Rolle hinzufügen</button>
      <p :id="helpId" class="rt-help"><template v-if="tool === 'allocate'">Zeitraum in einer Rolle ziehen → Einsatz anlegen.</template><template v-else-if="tool === 'block'">Zeitraum ziehen → Zeit sperren.</template><template v-else>Einsatz wählen · Ziehen verschiebt · Kanten ändern den Zeitraum</template><span> · Esc bricht ab</span></p>
      <span class="rt-legend"><i aria-hidden="true"></i>Arbeitsfrei</span>
    </div>
    <span class="rt-sr-only" role="status" aria-live="polite">{{ announcement }}</span>
  </section>
</template>
