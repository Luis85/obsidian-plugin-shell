/**
 * Resource Atlas — pure, date-only resource-planning calculations.
 *
 * A person-day (PT) is one full-time working day. Allocation FTE creates demand;
 * role FTE describes nominal capacity and is never an implicit allocation.
 * All ranges are inclusive. Calendar dates are represented as UTC epoch days,
 * so local time zones and daylight-saving changes cannot change effort.
 * Nothing in this module reads a clock, browser, storage, or external calendar.
 */

export const LIMITS = Object.freeze({ days: 1096, roles: 100, allocations: 2000, blocks: 500, holidays: 400 });
export const DEFAULT_WORKDAYS = Object.freeze([1, 2, 3, 4, 5]);
export const ROLE_COLORS = Object.freeze(['violet', 'blue', 'cyan', 'green', 'amber', 'rose']);
const DAY_MS = 86_400_000;
const EPSILON = 1e-10;
const EFFORT_FIELDS = Object.freeze(['grossPt', 'blockedPt', 'netPt', 'capacityPt', 'grossCapacityPt', 'blockedCapacityPt', 'overloadPt']);

export class PlanValidationError extends Error {
  constructor(errors) {
    super(errors.join('\n'));
    this.name = 'PlanValidationError';
    this.errors = errors;
  }
}

/** Parse a strict ISO calendar date into an integer UTC epoch day. */
export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Datum muss im Format JJJJ-MM-TT angegeben werden.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Datum ist kein gültiger Kalendertag.');
  }
  return date.getTime() / DAY_MS;
}

/** Format an integer UTC epoch day as YYYY-MM-DD. */
export function formatDate(epochDay) {
  if (!Number.isInteger(epochDay)) throw new Error('Kalendertag muss eine ganze Zahl sein.');
  const date = new Date(epochDay * DAY_MS);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) {
    throw new Error('Kalendertag liegt außerhalb des unterstützten Datumsbereichs.');
  }
  return date.toISOString().slice(0, 10);
}

export function addDays(date, amount) {
  if (!Number.isInteger(amount)) throw new Error('Tagesabstand muss eine ganze Zahl sein.');
  return formatDate(parseDate(date) + amount);
}

/** Difference in calendar days; a same-day range has a difference of zero. */
export function daysBetween(start, end) { return parseDate(end) - parseDate(start); }

export function dateRange(start, end) {
  const first = parseDate(start), last = parseDate(end);
  if (last < first) throw new Error('Enddatum darf nicht vor dem Startdatum liegen.');
  if (last - first + 1 > LIMITS.days) throw new Error(`Zeitraum darf höchstens ${LIMITS.days} Kalendertage umfassen.`);
  return Array.from({ length: last - first + 1 }, (_, index) => formatDate(first + index));
}

/** Monday = 1, Sunday = 7, independent of the host time zone. */
export function weekday(date) {
  const epochDay = typeof date === 'number' ? date : parseDate(date);
  return ((epochDay + 3) % 7 + 7) % 7 + 1;
}

export function clampRange(start, end, minimum, maximum) {
  const from = parseDate(start), to = parseDate(end), min = parseDate(minimum), max = parseDate(maximum);
  if (to < from || max < min) throw new Error('Enddatum darf nicht vor dem Startdatum liegen.');
  const first = Math.max(from, min), last = Math.min(to, max);
  return last < first ? null : { start: formatDate(first), end: formatDate(last), days: last - first + 1 };
}

/** ISO week-numbering year, including weeks crossing December/January. */
export function isoWeek(value) {
  const day = typeof value === 'number' ? value : parseDate(value);
  const monday = day - weekday(day) + 1;
  const thursday = monday + 3;
  const year = new Date(thursday * DAY_MS).getUTCFullYear();
  const january4 = parseDate(`${String(year).padStart(4, '0')}-01-04`);
  const firstMonday = january4 - weekday(january4) + 1;
  const week = 1 + Math.round((monday - firstMonday) / 7);
  // A four-digit date at the upper edge may share its ISO week with year 10000.
  // Keep the returned bounds inside the supported date-only representation.
  const maximumDay = parseDate('9999-12-31');
  const end = Math.min(monday + 6, maximumDay);
  const result = { year, week, key: `${String(year).padStart(4, '0')}-W${String(week).padStart(2, '0')}`, start: formatDate(monday), end: formatDate(end) };
  if (end !== monday + 6) result.boundsClipped = true;
  return result;
}

const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Validate and copy a plan to the canonical data shape. Unknown fields are not
 * copied. Allocations and blocks may extend outside the plan; calculations clip
 * them and report the clipping without silently altering the stored schedule.
 */
export function normalizePlan(input) {
  const errors = [];
  if (!plainObject(input)) throw new PlanValidationError(['Plan muss ein JSON-Objekt sein.']);

  function text(value, label, { required = false, max = 20_000, fallback = '' } = {}) {
    if (value === undefined || value === null) {
      if (required) errors.push(`${label} fehlt.`);
      return fallback;
    }
    if (typeof value !== 'string' || value.length > max || /[\u0000\u0008\u000b\u000c]/.test(value)) {
      errors.push(`${label} muss ein Text mit höchstens ${max} Zeichen sein.`);
      return fallback;
    }
    if (required && !value.trim()) errors.push(`${label} darf nicht leer sein.`);
    return value;
  }
  function id(value, label) {
    const result = text(value, label, { required: true, max: 160 });
    if (result && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result)) errors.push(`${label} darf nur Buchstaben, Ziffern, Punkt, Doppelpunkt, Unterstrich und Bindestrich enthalten.`);
    return result;
  }
  function numeric(value, label, min, max, fallback) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      errors.push(`${label} muss eine Zahl zwischen ${min} und ${max} sein.`);
      return fallback ?? min;
    }
    return value;
  }
  function calendarDate(value, label) {
    try { parseDate(value); return value; }
    catch { errors.push(`${label} muss ein gültiges Datum im Format JJJJ-MM-TT sein.`); return '2000-01-01'; }
  }
  function array(value, label, limit) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > limit) {
      errors.push(`${label} muss eine Liste mit höchstens ${limit} Einträgen sein.`);
      return [];
    }
    return value;
  }
  function row(value, label) {
    if (!plainObject(value)) { errors.push(`${label} muss ein Objekt sein.`); return {}; }
    return value;
  }
  function unique(rows, label) {
    const seen = new Set();
    for (const item of rows) {
      if (seen.has(item.id)) errors.push(`${label}: ID „${item.id}“ ist doppelt vorhanden.`);
      seen.add(item.id);
    }
  }
  function range(value, label) {
    const start = calendarDate(value.start, `${label}: Start`), end = calendarDate(value.end, `${label}: Ende`);
    if (end < start) errors.push(`${label}: Ende darf nicht vor dem Start liegen.`);
    return { start, end };
  }

  const planRange = range(input, 'Plan');
  if (parseDate(planRange.end) - parseDate(planRange.start) + 1 > LIMITS.days) errors.push(`Plan darf höchstens ${LIMITS.days} Kalendertage umfassen.`);
  const calendar = input.calendar === undefined ? {} : row(input.calendar, 'Kalender');
  const suppliedWorkdays = calendar.workdays === undefined ? [...DEFAULT_WORKDAYS] : array(calendar.workdays, 'Arbeitstage', 7);
  if (suppliedWorkdays.some(day => !Number.isInteger(day) || day < 1 || day > 7)) errors.push('Arbeitstage müssen ganze Zahlen von 1 (Montag) bis 7 (Sonntag) sein.');
  if (new Set(suppliedWorkdays).size !== suppliedWorkdays.length) errors.push('Arbeitstage dürfen nicht doppelt vorkommen.');
  const holidays = array(calendar.holidays, 'Feiertage', LIMITS.holidays).map((value, index) => {
    const label = `Feiertag ${index + 1}`, entry = row(value, label);
    return { id: id(entry.id, `${label}: ID`), date: calendarDate(entry.date, label), name: text(entry.name, `${label}: Name`, { max: 160 }) };
  });
  unique(holidays, 'Feiertage');

  const roles = array(input.roles, 'Rollen', LIMITS.roles).map((value, index) => {
    const label = `Rolle ${index + 1}`, entry = row(value, label);
    const color = entry.color === undefined ? '#b5a3f4' : entry.color;
    if (typeof color !== 'string' || (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) && !ROLE_COLORS.includes(color))) errors.push(`${label}: Farbe muss ein Hex-Farbwert oder eine unterstützte Rollenfarbe sein.`);
    return { id: id(entry.id, `${label}: ID`), name: text(entry.name, `${label}: Name`, { required: true, max: 160 }), fte: numeric(entry.fte, `${label}: FTE`, 0.01, 100), color, notes: text(entry.notes, `${label}: Notizen`) };
  });
  unique(roles, 'Rollen');
  const roleIds = new Set(roles.map(role => role.id));
  const allocations = array(input.allocations, 'Einsätze', LIMITS.allocations).map((value, index) => {
    const label = `Einsatz ${index + 1}`, entry = row(value, label);
    const roleId = id(entry.roleId, `${label}: Rollen-ID`);
    if (roleId && !roleIds.has(roleId)) errors.push(`${label}: Zugehörige Rolle fehlt.`);
    return { id: id(entry.id, `${label}: ID`), roleId, name: text(entry.name, `${label}: Name`, { max: 160 }), ...range(entry, label), fte: numeric(entry.fte, `${label}: FTE`, 0.01, 100), notes: text(entry.notes, `${label}: Notizen`) };
  });
  unique(allocations, 'Einsätze');
  const blocks = array(input.blocks, 'Sperrzeiten', LIMITS.blocks).map((value, index) => {
    const label = `Sperrzeit ${index + 1}`, entry = row(value, label);
    const roleId = entry.roleId === null || entry.roleId === undefined ? null : id(entry.roleId, `${label}: Rollen-ID`);
    if (roleId && !roleIds.has(roleId)) errors.push(`${label}: Zugehörige Rolle fehlt.`);
    return { id: id(entry.id, `${label}: ID`), roleId, name: text(entry.name, `${label}: Name`, { max: 160 }), ...range(entry, label), fraction: numeric(entry.fraction, `${label}: Anteil`, 0, 1) };
  });
  unique(blocks, 'Sperrzeiten');
  const plan = {
    id: id(input.id, 'Plan-ID'), name: text(input.name, 'Planname', { required: true, max: 200 }), ...planRange,
    budgetPt: input.budgetPt === null || input.budgetPt === undefined ? null : numeric(input.budgetPt, 'PT-Budget', 0, 1_000_000_000),
    calendar: { workdays: [...suppliedWorkdays].sort((a, b) => a - b), hoursPerDay: numeric(calendar.hoursPerDay, 'Stunden je Personentag', 0.01, 24, 8), holidays },
    roles, allocations, blocks, notes: text(input.notes, 'Plannotizen'),
  };
  if (errors.length) throw new PlanValidationError(errors);
  return plan;
}

export function validatePlan(input) {
  try { return { valid: true, errors: [], plan: normalizePlan(input) }; }
  catch (error) { return { valid: false, errors: error instanceof PlanValidationError ? error.errors : [error.message], plan: null }; }
}

function zeroEffort() { return Object.fromEntries(EFFORT_FIELDS.map(field => [field, 0])); }
function addEffort(target, source) { for (const field of EFFORT_FIELDS) target[field] += source[field] ?? 0; }
function intersects(item, first, last) { return parseDate(item.end) >= first && parseDate(item.start) <= last; }
function cleanZero(value) { return Math.abs(value) < EPSILON ? 0 : value; }

/** Prepare the shared calendar/availability once, including strongest overlaps. */
function prepareCalendar(plan) {
  const first = parseDate(plan.start), last = parseDate(plan.end), length = last - first + 1;
  const workdays = new Set(plan.calendar.workdays), holidayNames = new Map();
  for (const holiday of plan.calendar.holidays) {
    const names = holidayNames.get(holiday.date) ?? [];
    if (holiday.name && !names.includes(holiday.name)) names.push(holiday.name);
    holidayNames.set(holiday.date, names);
  }
  const globalBlocks = new Float64Array(length);
  const roleBlocks = new Map(plan.roles.map(role => [role.id, new Float64Array(length)]));
  for (const block of plan.blocks) {
    const from = Math.max(first, parseDate(block.start)), to = Math.min(last, parseDate(block.end));
    const fractions = block.roleId === null ? globalBlocks : roleBlocks.get(block.roleId);
    for (let day = from; day <= to; day++) fractions[day - first] = Math.max(fractions[day - first], block.fraction);
  }
  const days = Array.from({ length }, (_, index) => {
    const date = formatDate(first + index), dayOfWeek = weekday(first + index), isHoliday = holidayNames.has(date);
    return { date, weekday: dayOfWeek, working: workdays.has(dayOfWeek) && !isHoliday, holiday: isHoliday ? (holidayNames.get(date).join(' · ') || 'Feiertag') : null, blockedFraction: globalBlocks[index] };
  });
  return { first, last, length, days, globalBlocks, roleBlocks };
}

function allocationSummary(plan, allocation, calendar) {
  const from = Math.max(calendar.first, parseDate(allocation.start)), to = Math.min(calendar.last, parseDate(allocation.end));
  const outsidePlan = to < from;
  const summary = { id: allocation.id, roleId: allocation.roleId, name: allocation.name, fte: allocation.fte,
    start: outsidePlan ? null : formatDate(from), end: outsidePlan ? null : formatDate(to),
    originalStart: allocation.start, originalEnd: allocation.end, clipped: allocation.start < plan.start || allocation.end > plan.end,
    outsidePlan, calendarDays: Math.max(0, to - from + 1), workingDays: 0, blockedDays: 0, grossPt: 0, blockedPt: 0, netPt: 0, hours: 0 };
  const roleBlocks = calendar.roleBlocks.get(allocation.roleId);
  for (let day = from; day <= to; day++) {
    const index = day - calendar.first;
    if (!calendar.days[index].working) continue;
    const fraction = Math.max(calendar.globalBlocks[index], roleBlocks[index]);
    summary.workingDays++;
    summary.blockedDays += fraction;
    summary.grossPt += allocation.fte;
    summary.blockedPt += allocation.fte * fraction;
    summary.netPt += allocation.fte * (1 - fraction);
  }
  summary.hours = summary.netPt * plan.calendar.hoursPerDay;
  return summary;
}

/** Calculate one existing or newly proposed allocation against plan availability. */
export function computeAllocation(input, allocation) {
  const candidate = { ...input, allocations: [allocation] };
  const plan = normalizePlan(candidate);
  return allocationSummary(plan, plan.allocations[0], prepareCalendar(plan));
}

/**
 * Full plan result. No intermediate effort is rounded. Capacity/overload are
 * available capacity/overload after the same blackout fraction as allocation.
 * blockedDays is the sum of unavailable fractions on calendar working days;
 * scheduledDays counts working dates carrying any allocation, including dates
 * with a complete blackout. requestedOverloadDays also exposes those dates.
 */
export function computePlan(input) {
  const plan = normalizePlan(input), calendar = prepareCalendar(plan);
  const allocationChanges = new Map(plan.roles.map(role => [role.id, new Float64Array(calendar.length + 1)]));
  const allocationCounts = new Map(plan.roles.map(role => [role.id, new Int32Array(calendar.length + 1)]));
  const activeAllocationCounts = new Map(plan.roles.map(role => [role.id, 0]));
  const warnings = [];
  for (const allocation of plan.allocations) {
    const from = Math.max(calendar.first, parseDate(allocation.start)), to = Math.min(calendar.last, parseDate(allocation.end));
    if (allocation.start < plan.start || allocation.end > plan.end) warnings.push({ code: to < from ? 'allocation-outside-plan' : 'allocation-clipped', severity: 'warning', allocationId: allocation.id, roleId: allocation.roleId, message: to < from ? `„${allocation.name || 'Einsatz'}“ liegt außerhalb des Plans und erzeugt keinen Aufwand.` : `„${allocation.name || 'Einsatz'}“ wird nur innerhalb des Planzeitraums berechnet.` });
    if (to < from) continue;
    const values = allocationChanges.get(allocation.roleId), counts = allocationCounts.get(allocation.roleId);
    values[from - calendar.first] += allocation.fte;
    values[to - calendar.first + 1] -= allocation.fte;
    counts[from - calendar.first]++;
    counts[to - calendar.first + 1]--;
    activeAllocationCounts.set(allocation.roleId, activeAllocationCounts.get(allocation.roleId) + 1);
  }
  for (const block of plan.blocks) {
    if (block.start < plan.start || block.end > plan.end) warnings.push({ code: intersects(block, calendar.first, calendar.last) ? 'block-clipped' : 'block-outside-plan', severity: 'info', blockId: block.id, roleId: block.roleId, message: `„${block.name || 'Sperrzeit'}“ wirkt nur innerhalb des Planzeitraums.` });
  }
  if (!plan.calendar.workdays.length) warnings.push({ code: 'no-workdays', severity: 'warning', message: 'Es sind keine Arbeitstage ausgewählt. Der Plan enthält deshalb keinen Aufwand und keine Kapazität.' });

  const roles = plan.roles.map(role => ({ ...role, roleId: role.id, ...zeroEffort(), scheduledDays: 0, availableDays: 0, blockedDays: 0, workingDays: 0,
    overloadDays: 0, requestedOverloadDays: 0, overlapDays: 0, maxFte: 0, activeAllocationCount: activeAllocationCounts.get(role.id), allocationCount: plan.allocations.filter(item => item.roleId === role.id).length, hours: 0 }));
  const totals = { ...zeroEffort(), calendarDays: calendar.length, workingDays: 0, availableDays: 0, blockedDays: 0, scheduledDays: 0,
    overloadDays: 0, requestedOverloadDays: 0, allocationCount: plan.allocations.length, activeAllocationCount: [...activeAllocationCounts.values()].reduce((sum, count) => sum + count, 0),
    activeBlocks: plan.blocks.filter(block => block.fraction > 0 && intersects(block, calendar.first, calendar.last)).length, budgetPt: plan.budgetPt, budgetRemainingPt: null, budgetExceededPt: null, hours: 0 };
  const runningFte = new Float64Array(roles.length), runningCounts = new Int32Array(roles.length);
  const days = calendar.days.map((baseDay, index) => {
    const day = { ...baseDay, ...zeroEffort(), roles: [], hours: 0 };
    let scheduled = false, overloaded = false, requestedOverload = false;
    if (day.working) { totals.workingDays++; totals.availableDays += 1 - day.blockedFraction; totals.blockedDays += day.blockedFraction; }
    for (const [roleIndex, role] of roles.entries()) {
      runningFte[roleIndex] += allocationChanges.get(role.id)[index];
      runningCounts[roleIndex] += allocationCounts.get(role.id)[index];
      // Avoid retaining floating-point subtraction residues after the final
      // allocation ends; a true gap always has exactly zero demand.
      if (runningCounts[roleIndex] === 0) runningFte[roleIndex] = 0;
      const allocationFte = cleanZero(runningFte[roleIndex]);
      const fraction = Math.max(day.blockedFraction, calendar.roleBlocks.get(role.id)[index]);
      const grossPt = day.working ? allocationFte : 0, grossCapacityPt = day.working ? role.fte : 0;
      const available = 1 - fraction;
      const entry = { roleId: role.id, allocationFte, allocationCount: runningCounts[roleIndex], blockedFraction: fraction,
        grossPt, blockedPt: grossPt * fraction, netPt: grossPt * available,
        grossCapacityPt, blockedCapacityPt: grossCapacityPt * fraction, capacityPt: grossCapacityPt * available,
        overloadPt: day.working ? Math.max(0, cleanZero(allocationFte - role.fte)) * available : 0,
        hours: grossPt * available * plan.calendar.hoursPerDay };
      day.roles.push(entry);
      addEffort(day, entry);
      addEffort(role, entry);
      if (day.working) {
        role.workingDays++;
        role.blockedDays += fraction;
        role.availableDays += available;
        role.maxFte = Math.max(role.maxFte, allocationFte);
        if (allocationFte > EPSILON) { role.scheduledDays++; scheduled = true; }
        if (entry.overloadPt > EPSILON) { role.overloadDays++; overloaded = true; }
        if (allocationFte - role.fte > EPSILON) { role.requestedOverloadDays++; requestedOverload = true; }
        if (entry.allocationCount > 1) role.overlapDays++;
      }
    }
    if (scheduled) totals.scheduledDays++;
    if (overloaded) totals.overloadDays++;
    if (requestedOverload) totals.requestedOverloadDays++;
    day.hours = day.netPt * plan.calendar.hoursPerDay;
    addEffort(totals, day);
    return day;
  });
  for (const role of roles) {
    role.hours = role.netPt * plan.calendar.hoursPerDay;
    if (role.requestedOverloadDays) warnings.push({ code: 'role-over-capacity', severity: 'warning', roleId: role.id, days: role.requestedOverloadDays,
      message: `„${role.name}“ überschreitet an ${role.requestedOverloadDays} Arbeitstag${role.requestedOverloadDays === 1 ? '' : 'en'} die nominelle Kapazität von ${role.fte} FTE.` });
  }
  totals.hours = totals.netPt * plan.calendar.hoursPerDay;
  if (plan.budgetPt !== null) {
    totals.budgetRemainingPt = cleanZero(plan.budgetPt - totals.netPt);
    totals.budgetExceededPt = Math.max(0, -totals.budgetRemainingPt);
    if (totals.budgetExceededPt > EPSILON) warnings.push({ code: 'budget-exceeded', severity: 'warning', message: 'Der geplante Nettoaufwand überschreitet das PT-Budget.' });
  }
  return { plan, days, roles, totals, warnings, allocations: plan.allocations.map(allocation => allocationSummary(plan, allocation, calendar)) };
}

/**
 * Aggregate already-calculated days. Each day belongs to exactly one bucket;
 * bucket/role totals therefore conserve the plan's full-precision effort.
 * start/end describe the included part of a bucket, clipped to the plan.
 */
export function makeBuckets(input, mode = 'week') {
  if (!['day', 'week', 'month'].includes(mode)) throw new Error('Ansicht muss day, week oder month sein.');
  const computed = input?.plan && Array.isArray(input.days) && input.totals ? input : computePlan(input);
  const buckets = [], byKey = new Map();
  for (const day of computed.days) {
    const week = mode === 'week' ? isoWeek(day.date) : null;
    const key = mode === 'day' ? day.date : mode === 'month' ? day.date.slice(0, 7) : week.key;
    let bucket = byKey.get(key);
    if (!bucket) {
      const label = mode === 'week' ? `KW ${String(week.week).padStart(2, '0')} · ${week.year}` : mode === 'month' ? `${key.slice(5)}/${key.slice(0, 4)}` : `${key.slice(8)}.${key.slice(5, 7)}.`;
      bucket = { key, label, start: day.date, end: day.date, days: [], calendarDays: 0, workingDays: 0, availableDays: 0, blockedDays: 0, ...zeroEffort(), hours: 0,
        roles: computed.roles.map(role => ({ id: role.id, roleId: role.id, name: role.name, fte: role.fte, ...zeroEffort(), workingDays: 0, availableDays: 0, blockedDays: 0, scheduledDays: 0, maxFte: 0, hours: 0 })) };
      byKey.set(key, bucket);
      buckets.push(bucket);
    }
    bucket.end = day.date;
    bucket.days.push(day);
    bucket.calendarDays++;
    if (day.working) { bucket.workingDays++; bucket.availableDays += 1 - day.blockedFraction; bucket.blockedDays += day.blockedFraction; }
    addEffort(bucket, day);
    bucket.hours += day.hours;
    for (const [index, entry] of day.roles.entries()) {
      const role = bucket.roles[index];
      addEffort(role, entry);
      role.hours += entry.hours;
      if (day.working) {
        role.workingDays++;
        role.availableDays += 1 - entry.blockedFraction;
        role.blockedDays += entry.blockedFraction;
        if (entry.allocationFte > EPSILON) role.scheduledDays++;
        role.maxFte = Math.max(role.maxFte, entry.allocationFte);
      }
    }
  }
  return buckets;
}
