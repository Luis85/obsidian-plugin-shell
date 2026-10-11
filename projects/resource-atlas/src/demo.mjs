/** Illustrative ERP staffing plan. Dates and quantities are editable sample data. */
const DEMO_PLAN = {
  id: 'resource-plan-erp-demo',
  name: 'ERP-Projekt · Beispiel',
  start: '2026-10-05',
  end: '2027-02-19',
  budgetPt: 150,
  calendar: { workdays: [1, 2, 3, 4, 5], hoursPerDay: 8, holidays: [] },
  roles: [
    { id: 'role-ux', name: 'UX / UI Design', fte: 1, color: '#a78bfa', notes: 'Nutzerführung, Interaktionsdesign und visuelle Ausarbeitung.' },
    { id: 'role-re', name: 'Requirements Engineering', fte: 1, color: '#60a5fa', notes: 'Anforderungen strukturieren und mit Fachbereich und Entwicklung abstimmen.' },
    { id: 'role-dev', name: 'Entwicklung', fte: 1, color: '#34d399', notes: 'Umsetzung, technische Qualitätssicherung und Übergabe.' },
    { id: 'role-dm', name: 'Delivery Management', fte: 0.2, color: '#fbbf24', notes: 'Abstimmung, Steuerung und Begleitung der beiden Projektphasen.' }
  ],
  allocations: [
    { id: 'allocation-ux-concept', roleId: 'role-ux', name: 'Konzeption & Design', start: '2026-10-12', end: '2026-11-13', fte: 1, notes: '' },
    { id: 'allocation-ux-refinement', roleId: 'role-ux', name: 'Design-Vertiefung', start: '2026-11-30', end: '2026-12-11', fte: 1, notes: '' },
    { id: 'allocation-re-discovery', roleId: 'role-re', name: 'Anforderungen & Refinement', start: '2026-10-12', end: '2026-11-27', fte: 1, notes: '' },
    { id: 'allocation-dev-iteration1', roleId: 'role-dev', name: 'Umsetzung · Phase 1', start: '2026-10-19', end: '2026-12-18', fte: 1, notes: '' },
    { id: 'allocation-dev-iteration2', roleId: 'role-dev', name: 'Umsetzung · Phase 2', start: '2027-01-04', end: '2027-02-19', fte: 1, notes: '' },
    { id: 'allocation-dm-phase1', roleId: 'role-dm', name: 'Projektbegleitung · Phase 1', start: '2026-10-12', end: '2026-11-27', fte: 0.2, notes: '' },
    { id: 'allocation-dm-phase2', roleId: 'role-dm', name: 'Projektbegleitung · Phase 2', start: '2027-01-04', end: '2027-02-19', fte: 0.2, notes: '' }
  ],
  blocks: [
    { id: 'block-company-break', roleId: null, name: 'Betriebsruhe', start: '2026-12-21', end: '2027-01-01', fraction: 1 }
  ],
  notes: 'Illustrativer Beispielplan: 164 Personentage bei einem Budget von 150 PT. Feiertage sind bewusst nicht automatisch hinterlegt. Einsätze und Sperrzeiten lassen sich vollständig ändern.'
};

export function createDemoPlan() {
  return JSON.parse(JSON.stringify(DEMO_PLAN));
}
