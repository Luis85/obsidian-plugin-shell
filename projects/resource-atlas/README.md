# Resource Atlas

Ein eigenständiger, selbstenthaltener HTML-Prototyp für einen Obsidian-Ressourceneinsatzplan: **Rollen und FTE über einen Zeitraum einplanen, Zeit sperren und den Aufwand in Personentagen auswerten.** Die Oberfläche verwendet Vue 3 und Nuxt UI 4.11.3 mit dem gemeinsamen hellen und dunklen Design der Produktfamilie.

## Schnell starten

Öffne `resource-atlas.html` in einem modernen Desktop-Browser. Für die fertige HTML-Datei sind weder ein Server noch weitere Dateien erforderlich.

Der Startplan **„ERP-Projekt · Beispiel“** ist ein veränderbares Rechenbeispiel: 5. Oktober 2026 bis 19. Februar 2027, vier Rollen, sieben Einsätze und eine Betriebsruhe vom **21. Dezember bis einschließlich 1. Januar**. Er ergibt **164 PT** bei einem Budget von 150 PT: UX 35, Requirements Engineering 35, Entwicklung 80 und Delivery Management 14 PT.

1. **Plan festlegen.** Erstelle einen neuen Plan oder bearbeite den vorhandenen. Start und Ende zählen beide mit. Das PT-Budget ist optional.
2. **Rollen anlegen.** Gib Rollenname und Standard-FTE ein. Dezimalkommas wie `0,2` werden unterstützt. Standard-FTE beschreiben Kapazität und den Vorschlag für neue Einsätze.
3. **Einsätze planen.** Nutze „Einsatz hinzufügen“ oder ziehe mit „Einsatz zeichnen“ einen Zeitraum in einer Rollen-Zeile auf. Im Inspector bearbeitest du Datum, FTE und Notizen. **„Gesamte Planlaufzeit“** setzt beide Datumsfelder auf die Planränder; übernommen wird erst beim Speichern.
4. **Zeit sperren.** Eine Sperrzeit gilt für alle Rollen oder eine einzelne Rolle. 100 Prozent sperren den Zeitraum vollständig, 50 Prozent halbieren die verfügbare Arbeit.
5. **Aufwand prüfen.** „Rollen & Aufwand“ zeigt die gesamte Laufzeit je Rolle. „Auswertung“ verteilt dieselben Tageswerte auf Wochen oder Monate. „Arbeitskalender“ verwaltet Wochentage, Feiertage und Sperrzeiten.

Bestehende Einsatzbalken lassen sich verschieben und an ihren Rändern verändern. Im Inspector stehen auch Duplizieren und Verschieben um einen Kalendertag bereit. Für Änderungen gibt es Rückgängig und Wiederholen. Ungespeicherte Inspector-Eingaben werden vor einem Wechsel zur Bestätigung vorgelegt.

## So entstehen Personentage

**1 FTE × 5 verfügbare Arbeitstage = 5 PT.** Bei 0,2 FTE ergeben dieselben Tage 1 PT. Nur konkrete Einsatzzeiträume erzeugen Aufwand; eine Rolle ohne Einsatz hat 0 geplante PT.

Arbeitstage und eingetragene Feiertage folgen dem Kalender des jeweiligen Plans. Überlappende Einsätze addieren ihren FTE-Bedarf. Bei überlappenden Sperrzeiten gilt der höchste zutreffende Anteil. Sperren reduzieren Aufwand und Kapazität im vorhandenen Zeitraum; sie verschieben Arbeit nicht automatisch.

„Stunden pro Personentag“ rechnet PT in Stunden um. Eine Änderung dieser Einstellung verändert die Stunden, nicht die PT. Das Beispiel verwendet 8 Stunden je PT. Regionale Feiertage werden ausdrücklich gepflegt und nicht automatisch angenommen.

Die vollständigen Formeln, Randfälle und das nachrechenbare Beispiel stehen in [docs/CALCULATION-GUIDE.md](docs/CALCULATION-GUIDE.md).

## Speichern und mitnehmen

Der Prototyp speichert über den lokalen Browser-Speicher. **Er schreibt nicht direkt in einen Obsidian-Vault und enthält noch kein installierbares Obsidian-Manifest.** Bei einem Speicherhinweis müssen die betreffenden Daten vor dem Schließen exportiert werden.

| Format | Verwendung |
| --- | --- |
| Aktueller Plan · JSON | Vollständiger Plan mit stabilen IDs, Kalender, Rollen, Einsätzen und Sperrzeiten |
| Alle Pläne · JSON | Alle nativen Pläne in einer Datei; Familienverknüpfungen sind hier nicht enthalten |
| Obsidian-Notiz · Markdown | Lesbare Tabellen und Frontmatter mit vollständigem eingebettetem Plan |
| Rollen-, Wochen- oder Tages-CSV | Auswertung mit Semikolon und Dezimalkomma |
| Product Family · JSON | Aktueller nativer Plan, externe Snapshots und Verknüpfungen |

Unter „Darstellung & Vault“ legst du den vorgesehenen Markdown-Ordner fest. Die heruntergeladene Datei legst du selbst dort ab. Beim Markdown-Import zählt der markierte JSON-Datenblock als vollständige Datenquelle; manuelle Änderungen der sichtbaren Zusammenfassung verändern ihn nicht.

Importe werden zuerst geprüft und angezeigt. Gleiche Plan-IDs können ausdrücklich ersetzt oder als unabhängige Kopien übernommen werden. CSV dient der Auswertung und ist kein vollständiges Importformat.

## Eigenständiges Mitglied der Produktfamilie

Resource Atlas liest und schreibt Product-Family-Pakete aus Component Atlas, Storyloom, Sitemap Atlas und Dissect. Importierte Datensätze bleiben externe Snapshots. Ein Plan, eine Rolle oder ein Einsatz kann damit verknüpft werden. Story Points werden nicht automatisch in PT umgerechnet.

Jedes Werkzeug bleibt unabhängig. Der Austausch erfolgt durch Dateien, ohne automatische Synchronisation. Für die optionalen Sprunglinks müssen die anderen HTML-Dateien im selben Ordner liegen. Sie sind für die Ressourcenplanung nicht erforderlich.

## Developer setup

This is the `projects/resource-atlas` project of the Workbench repository. Use Node 24.21.0 (`.nvmrc`). `npm run check` builds and runs the pure tests; `npm run test:e2e` is the browser verification. Nuxt UI components are registered with the `Pf` prefix (`<PfButton>`) and the intermediate Vite build lives in `dist/shell/`, so the Workbench shell's own Nuxt UI detection never picks them up. The delivered prototype is kept in [`docs/concepts/resource-atlas`](../../docs/concepts/resource-atlas/README.md).


Use Node.js 22.12 or newer and npm. From this project directory:

```bash
npm ci
npm run dev
```

The Vite development server uses `http://127.0.0.1:4176`. Create the distributable with:

```bash
npm run build
```

The build compiles Vue and Nuxt UI, includes the required icons, and inlines scripts, styles, and third-party notices into `dist/resource-atlas.html`. Ship that HTML file to run the prototype without the source directory or installed dependencies.

Run the pure calculation and serialization tests:

```bash
npm test
```

For the integrated browser checks, build first and install Playwright Chromium:

```bash
npx playwright install chromium
npm run verify
```

Optional executable and companion locations:

```bash
RESOURCE_CHROMIUM_PATH=/path/to/chromium FAMILY_DIST_PATH=/path/to/family/dist npm run verify
```

Without overrides, Playwright uses its installed Chromium and looks for companion prototypes in the sibling `family/dist` directory. Missing companions are reported as skipped. Browser output and screenshots go to `.qa/`; inspect `.qa/browser-result.json` for the actual result. Run `npm run verify:edge-cases` for the focused persistence, recovery, and import regressions; its report is `.qa/browser-final-result.json`.

### Source map

| File | Responsibility |
| --- | --- |
| `src/domain.mjs` | Pure date arithmetic, plan validation, daily effort, capacity, warnings and period aggregation |
| `src/io.mjs` | Native/workspace validation, JSON, Markdown, CSV and safe export paths |
| `src/usePlanner.js` | Application state, drafts, commands, persistence, history and exchange coordination |
| `src/App.vue` | Shared Nuxt UI shell, navigation, reports, settings and import/export review |
| `src/Timeline.vue`, `src/timeline.css` | Timeline rendering and direct manipulation |
| `src/Inspector.vue`, `src/inspector.css` | Controlled contextual forms; changes are emitted to application state |
| `src/family-protocol.mjs` | Optional portable references, snapshots and links |
| `src/family-base.css`, `src/style.css` | Shared family tokens and Resource Atlas layouts |
| `src/demo.mjs` | Independent copies of the illustrative plan |
| `scripts/package.mjs`, `vite.config.mjs` | Compilation and self-contained packaging |
| `tests/` | Domain, serialization and integrated acceptance checks |

The pure modules do not depend on the UI or another plugin. A production Obsidian implementation can replace browser persistence with a Vault repository while retaining the calculation model and versioned exports. Personal staffing, actual time tracking and automatic resource scheduling are outside this prototype’s scope.
