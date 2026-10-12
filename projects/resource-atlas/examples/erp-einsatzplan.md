---
type: resource-plan
resource_atlas_schema: 1
resource_plan_id: "resource-plan-erp-demo"
title: "ERP-Projekt · Beispiel"
start: 2026-10-05
end: 2027-02-19
hours_per_day: 8
planned_person_days: 164
budget_person_days: 150
resource_folder: "Planung/Ressourcen"
tags:
  - resource-atlas
  - ressourceneinsatzplan
---

# ERP\-Projekt · Beispiel

**Planzeitraum:** 2026-10-05 bis 2027-02-19 (beide Tage eingeschlossen).

**Geplanter Aufwand:** 164 Personentage · 1312 Stunden.

**Arbeitskalender:** Mo, Di, Mi, Do, Fr · 8 Stunden pro Personentag.

## Rollen und Aufwand

| Rolle | Standard-FTE | Brutto-PT | Gesperrte PT | Geplante PT | Kapazität PT | Überlast PT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| UX / UI Design | 1 | 35 | 0 | 35 | 90 | 0 |
| Requirements Engineering | 1 | 35 | 0 | 35 | 90 | 0 |
| Entwicklung | 1 | 80 | 0 | 80 | 90 | 0 |
| Delivery Management | 0,2 | 14 | 0 | 14 | 18 | 0 |

## Einsätze

| Rolle | Einsatz | Von | Bis | FTE |
| --- | --- | --- | --- | ---: |
| UX / UI Design | Konzeption &amp; Design | 2026-10-12 | 2026-11-13 | 1 |
| UX / UI Design | Design\-Vertiefung | 2026-11-30 | 2026-12-11 | 1 |
| Requirements Engineering | Anforderungen &amp; Refinement | 2026-10-12 | 2026-11-27 | 1 |
| Entwicklung | Umsetzung · Phase 1 | 2026-10-19 | 2026-12-18 | 1 |
| Entwicklung | Umsetzung · Phase 2 | 2027-01-04 | 2027-02-19 | 1 |
| Delivery Management | Projektbegleitung · Phase 1 | 2026-10-12 | 2026-11-27 | 0,2 |
| Delivery Management | Projektbegleitung · Phase 2 | 2027-01-04 | 2027-02-19 | 0,2 |

## Sperrzeiten

| Geltungsbereich | Grund | Von | Bis | Gesperrter Anteil |
| --- | --- | --- | --- | ---: |
| Alle Rollen | Betriebsruhe | 2026-12-21 | 2027-01-01 | 100 % |

## Notizen

Illustrativer Beispielplan: 164 Personentage bei einem Budget von 150 PT\. Feiertage sind bewusst nicht automatisch hinterlegt\. Einsätze und Sperrzeiten lassen sich vollständig ändern\.

## Rechenregeln

Nur angelegte Einsätze erzeugen Aufwand. Standard-FTE definieren die verfügbare Rollen-Kapazität und den Vorschlag für neue Einsätze.

Pro Arbeitstag gilt: Geplante PT = Summe der Einsatz-FTE × (1 − wirksamer Sperranteil). Bei überlappenden Sperrzeiten gilt der größte Sperranteil. Wochenenden gemäß Kalender und eingetragene Feiertage ergeben 0 PT.

## Vollständige Plandaten

Dieser markierte Datenblock ist die vollständige Importquelle. Die Zusammenfassung und die Eigenschaften darüber sind ein lesbarer Exportstand. Importieren verändert den Plan erst nach einer ausdrücklichen Bestätigung.

<!-- resource-atlas-data:start -->
```json
{
  "format": "resource-atlas",
  "schemaVersion": 1,
  "plan": {
    "id": "resource-plan-erp-demo",
    "name": "ERP-Projekt · Beispiel",
    "start": "2026-10-05",
    "end": "2027-02-19",
    "budgetPt": 150,
    "calendar": {
      "workdays": [
        1,
        2,
        3,
        4,
        5
      ],
      "hoursPerDay": 8,
      "holidays": []
    },
    "roles": [
      {
        "id": "role-ux",
        "name": "UX / UI Design",
        "fte": 1,
        "color": "#a78bfa",
        "notes": "Nutzerführung, Interaktionsdesign und visuelle Ausarbeitung."
      },
      {
        "id": "role-re",
        "name": "Requirements Engineering",
        "fte": 1,
        "color": "#60a5fa",
        "notes": "Anforderungen strukturieren und mit Fachbereich und Entwicklung abstimmen."
      },
      {
        "id": "role-dev",
        "name": "Entwicklung",
        "fte": 1,
        "color": "#34d399",
        "notes": "Umsetzung, technische Qualitätssicherung und Übergabe."
      },
      {
        "id": "role-dm",
        "name": "Delivery Management",
        "fte": 0.2,
        "color": "#fbbf24",
        "notes": "Abstimmung, Steuerung und Begleitung der beiden Projektphasen."
      }
    ],
    "allocations": [
      {
        "id": "allocation-ux-concept",
        "roleId": "role-ux",
        "name": "Konzeption \u0026 Design",
        "start": "2026-10-12",
        "end": "2026-11-13",
        "fte": 1,
        "notes": ""
      },
      {
        "id": "allocation-ux-refinement",
        "roleId": "role-ux",
        "name": "Design-Vertiefung",
        "start": "2026-11-30",
        "end": "2026-12-11",
        "fte": 1,
        "notes": ""
      },
      {
        "id": "allocation-re-discovery",
        "roleId": "role-re",
        "name": "Anforderungen \u0026 Refinement",
        "start": "2026-10-12",
        "end": "2026-11-27",
        "fte": 1,
        "notes": ""
      },
      {
        "id": "allocation-dev-iteration1",
        "roleId": "role-dev",
        "name": "Umsetzung · Phase 1",
        "start": "2026-10-19",
        "end": "2026-12-18",
        "fte": 1,
        "notes": ""
      },
      {
        "id": "allocation-dev-iteration2",
        "roleId": "role-dev",
        "name": "Umsetzung · Phase 2",
        "start": "2027-01-04",
        "end": "2027-02-19",
        "fte": 1,
        "notes": ""
      },
      {
        "id": "allocation-dm-phase1",
        "roleId": "role-dm",
        "name": "Projektbegleitung · Phase 1",
        "start": "2026-10-12",
        "end": "2026-11-27",
        "fte": 0.2,
        "notes": ""
      },
      {
        "id": "allocation-dm-phase2",
        "roleId": "role-dm",
        "name": "Projektbegleitung · Phase 2",
        "start": "2027-01-04",
        "end": "2027-02-19",
        "fte": 0.2,
        "notes": ""
      }
    ],
    "blocks": [
      {
        "id": "block-company-break",
        "roleId": null,
        "name": "Betriebsruhe",
        "start": "2026-12-21",
        "end": "2027-01-01",
        "fraction": 1
      }
    ],
    "notes": "Illustrativer Beispielplan: 164 Personentage bei einem Budget von 150 PT. Feiertage sind bewusst nicht automatisch hinterlegt. Einsätze und Sperrzeiten lassen sich vollständig ändern."
  }
}
```
<!-- resource-atlas-data:end -->
