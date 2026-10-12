# Resource Atlas — Rechenmodell und Datenübergabe

Resource Atlas erstellt einen rollengebundenen Ressourceneinsatzplan. Ein Plan besitzt einen Anfang und ein Ende, einen Arbeitskalender, Rollen mit Standard-FTE, konkrete Einsätze und Sperrzeiten. Daraus werden Personentage je Rolle, Zeitraum und Gesamtplan berechnet.

Die Datums- und Rechenregeln liegen in `src/domain.mjs`. Dateiimporte und Exporte liegen in `src/io.mjs`; beide Module funktionieren ohne Vue, Browserzustand oder andere Prototypen. Die Benutzeroberfläche kann dadurch später dieselbe Fachlogik in einem Obsidian-Plugin verwenden.

## 1. FTE, Personentage und Stunden

**FTE** steht für *Full-time equivalent*, auf Deutsch Vollzeitäquivalent. Der Wert beschreibt den Umfang im Verhältnis zu einer vergleichbaren Vollzeittätigkeit. Ein Umfang von 20 Stunden bei einer Vollzeitreferenz von 40 Stunden entspricht beispielsweise 0,5 FTE. FTE ist damit eine Verhältnisgröße; die Bezugsarbeitszeit muss bekannt sein. Diese Verwendung folgt der [FTE-Definition von Eurostat](https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/3101.pdf).

Im Plan gilt folgende ausdrücklich festgelegte Konvention:

- 1 FTE an einem vollständigen Arbeitstag ergibt 1 Personentag, abgekürzt **PT**.
- 0,5 FTE an einem vollständigen Arbeitstag ergeben 0,5 PT.
- 2 FTE an fünf Arbeitstagen ergeben 10 PT.
- Die Einstellung „Stunden pro Personentag“ rechnet PT zusätzlich in Stunden um. Der Beispielwert ist 8; er lässt sich ändern.

Eine Änderung von 8 auf 7,5 Stunden pro PT verändert die ausgewiesenen Stunden, nicht die PT. Der Prototyp setzt 8 Stunden nicht als allgemeingültige Definition von Vollzeit voraus. Auch das Statistische Bundesamt beschreibt Vollzeit im Verhältnis zur jeweils üblichen, tarifvertraglich oder gesetzlich festgelegten Arbeitszeit: [Vollzeittätigkeit](https://www.destatis.de/DE/Themen/Arbeit/Arbeitsmarkt/Glossar/vollzeittaetigkeit.html).

## 2. Rollen-Kapazität und geplante Einsätze

Die **Standard-FTE einer Rolle** haben zwei Aufgaben: Sie beschreiben ihre nominelle Kapazität pro Arbeitstag und liefern einen Vorgabewert für neue Einsätze. Ein Einsatz besitzt zusätzlich einen eigenen FTE-Wert. Dadurch können beispielsweise in der Konzeption 1 FTE und später in der Begleitung 0,2 FTE derselben Rolle eingeplant werden.

**Aufwand entsteht durch konkrete Einsätze.** Eine Rolle ohne Einsatz hat 0 geplante PT, auch wenn ihre nominelle Kapazität 1 FTE beträgt. Soll die Rolle über den gesamten Planzeitraum arbeiten, wird ein Einsatz vom Plananfang bis zum Planende angelegt.

Diese Trennung beantwortet zwei verschiedene Fragen:

| Kennzahl | Bedeutung |
| --- | --- |
| Geplante PT | Wie viel Arbeit die angelegten Einsätze unter Berücksichtigung des Kalenders und der Sperrzeiten ergeben |
| Kapazität PT | Wie viel Arbeit die Rolle mit ihren Standard-FTE über den gesamten Planzeitraum leisten könnte |
| Überlast PT | Wie weit die geplanten Einsätze die verfügbare Rollen-Kapazität an einzelnen Arbeitstagen überschreiten |

Die Kapazität ist keine automatisch erzeugte Beauftragung. Der Plan enthält Rollen und Einsatzumfang; eine Rolle kann auch ein Team mit mehr als 1 FTE repräsentieren. Eine persönliche Mitarbeiterplanung oder eine automatische Zuordnung konkreter Personen ist nicht Bestandteil des Modells.

## 3. Datum und Arbeitskalender

Start und Ende eines Zeitraums sind **einschließlich** gemeint. Ein Einsatz von Montag bis Freitag umfasst deshalb fünf Kalendertage und bei einem Montag-bis-Freitag-Kalender fünf Arbeitstage. Ein Start- und Enddatum am selben Arbeitstag ist gültig.

Der Kalender speichert Arbeitstage als ISO-Wochentage: Montag ist 1, Sonntag ist 7. Standardmäßig gelten Montag bis Freitag. Ein Wochenende ist daher im Modell ein Tag, der nicht als Arbeitstag ausgewählt wurde; bei Bedarf können Samstag oder Sonntag regulär einbezogen werden.

Eingetragene Feiertage erzeugen unabhängig vom Wochentag 0 PT und 0 Kapazität. Mehrere Feiertagsbezeichnungen für denselben Tag schließen ihn nur einmal aus. Feiertage werden bewusst manuell gepflegt; es wird kein bestimmtes Bundesland, Land oder Organisationskalender vorausgesetzt.

Die Berechnung arbeitet mit reinen Datumswerten und ganzen UTC-Kalendertagen. Lokale Zeitzonen und Sommerzeitwechsel verändern die Anzahl der PT nicht. Kalenderwochen folgen der ISO-Wochennummerierung einschließlich des zugehörigen Wochenjahrs. Teilwochen und Teilmonate an den Planrändern enthalten nur die tatsächlich im Plan liegenden Tage.

## 4. Sperrzeiten

Eine Sperrzeit besitzt einen Zeitraum, einen Namen, einen gesperrten Anteil zwischen 0 und 100 Prozent sowie einen Geltungsbereich:

- **Alle Rollen**, etwa für Betriebsruhe oder eine gemeinsame Pause.
- **Eine Rolle**, etwa für Urlaub, anderweitige Bindung oder eingeschränkte Verfügbarkeit.

Ein Sperranteil von 100 Prozent nimmt den Tag vollständig aus der verfügbaren Arbeit heraus. Ein Anteil von 50 Prozent halbiert den geplanten Aufwand und die Kapazität der betroffenen Rolle an diesem Tag.

Wenn mehrere Sperrzeiten auf denselben Tag wirken, gilt **der größte zutreffende Anteil**. Eine globale Sperre von 50 Prozent und eine Rollensperre von 100 Prozent ergeben 100 Prozent. Zwei überlappende Sperren von jeweils 50 Prozent ergeben weiterhin 50 Prozent. Sie werden weder addiert noch miteinander multipliziert. So lässt sich beispielsweise dieselbe Abwesenheit nicht durch überlappende Einträge versehentlich doppelt abziehen.

Ein gesperrter Einsatz bleibt im Plan gespeichert. Die Sperrzeit kürzt seinen verfügbaren Aufwand; sie verschiebt keine Arbeit automatisch auf andere Tage. Soll der volle ursprünglich geplante Aufwand erhalten bleiben, muss der Einsatz verlängert, verschoben oder sein FTE-Wert geändert werden.

## 5. Formeln

Für eine Rolle `r` und einen Tag `d` seien:

- `w(d)` gleich 1, wenn der Tag ein Arbeitstag und kein Feiertag ist, sonst 0;
- `a(r,d)` die Summe der FTE aller an diesem Tag aktiven Einsätze der Rolle;
- `b(r,d)` der höchste an diesem Tag geltende globale oder rollenspezifische Sperranteil;
- `c(r)` die Standard-FTE der Rolle.

Dann gilt:

```text
Brutto-PT(r,d)    = w(d) × a(r,d)
Gesperrte PT(r,d) = Brutto-PT(r,d) × b(r,d)
Geplante PT(r,d)  = Brutto-PT(r,d) × (1 − b(r,d))
Kapazität PT(r,d) = w(d) × c(r) × (1 − b(r,d))
Überlast PT(r,d)  = w(d) × max(0, a(r,d) − c(r)) × (1 − b(r,d))
Stunden(r,d)      = Geplante PT(r,d) × Stunden je PT
```

Rollen- und Gesamtergebnisse werden aus den Tageswerten summiert. Parallel laufende Einsätze addieren ihren FTE-Bedarf. Zwei Einsätze zu je 0,6 FTE benötigen zusammen 1,2 FTE; bei einer nominellen Kapazität von 1 FTE werden 0,2 PT Überlast pro vollständig verfügbarem Arbeitstag sichtbar.

Zusätzlich meldet die Fachlogik eine nominelle Überschreitung auch dann, wenn der betreffende Arbeitstag vollständig gesperrt ist. So verschwindet eine ungünstige ursprüngliche Einsatzplanung nicht allein durch eine Sperrzeit aus den Hinweisen.

Für ein gepflegtes PT-Budget gilt:

```text
Restbudget PT = Budget PT − Geplante PT
```

Ein negativer Wert bezeichnet eine Überschreitung. Ohne Budget wird keine Budgetabweichung berechnet. Das Budget ist eine Vergleichsgröße und begrenzt oder kürzt die Einsätze nicht automatisch.

Intern wird vor dem Summieren nicht gerundet. Anzeige und CSV runden für die Lesbarkeit; exportierte CSV-Zahlen behalten bis zu sechs Nachkommastellen. Bei vielen Bruchteilen können daher minimale Unterschiede zwischen der Summe sichtbarer Einzelwerte und einer genauer gerechneten Gesamtsumme entstehen.

## 6. Nachvollziehbares Beispiel

Der mitgelieferte **„ERP-Projekt · Beispiel“** läuft vom 5. Oktober 2026 bis zum 19. Februar 2027. Seine Werte sind illustrative, veränderbare Beispieldaten. Der Kalender verwendet Montag bis Freitag, 8 Stunden pro PT und keine automatisch eingetragenen Feiertage.

| Rolle | Einsätze | Rechnung | Geplante PT |
| --- | --- | --- | ---: |
| UX / UI Design | 12.10.–13.11. und 30.11.–11.12.2026 | 25 × 1 + 10 × 1 | 35 |
| Requirements Engineering | 12.10.–27.11.2026 | 35 × 1 | 35 |
| Entwicklung | 19.10.–18.12.2026 und 04.01.–19.02.2027 | 45 × 1 + 35 × 1 | 80 |
| Delivery Management | 12.10.–27.11.2026 und 04.01.–19.02.2027 | 35 × 0,2 + 35 × 0,2 | 14 |
| **Gesamt** | | | **164** |

Die globale Betriebsruhe vom 21. Dezember bis zum 1. Januar umfasst zehn der hundert Kalender-Arbeitstage. Da in dieser Pause bereits keine Einsätze liegen, zieht sie im Beispiel keine geplanten PT ab. Sie reduziert dennoch die verfügbare Gesamt-Kapazität von 320 auf 288 PT.

164 PT entsprechen bei 8 Stunden pro PT **1.312 Stunden**. Das Beispielbudget von 150 PT wird um **14 PT** überschritten. Keine Rolle überschreitet ihre eigene Tageskapazität. Budgetabweichung und Rollenüberlast sind daher getrennte Aussagen.

## 7. Import, Sicherung und Obsidian-Dateien

Ein einzelner Plan verwendet diesen versionierten JSON-Umschlag:

```json
{
  "format": "resource-atlas",
  "schemaVersion": 1,
  "plan": { "id": "stabile-plan-id", "name": "…" }
}
```

Das Beispiel zeigt nur den Umschlag, keinen vollständigen importierbaren Plan. Eine vollständige Sicherung verwendet `resource-atlas-workspace`, `schemaVersion: 1`, `plans` und `activePlanId`. Beide Formate erhalten stabile IDs. Der Import validiert sämtliche enthaltenen Pläne, bevor die Oberfläche etwas übernimmt; die Entscheidung zur Übernahme bleibt in der Oberfläche.

Der Markdown-Export erzeugt eine lesbare Notiz mit flachen YAML-Eigenschaften, Rollentabelle, Einsatzliste, Sperrzeiten und dem vollständigen Plan in einem markierten JSON-Datenblock. Diese Form passt zum grundlegenden Obsidian-Modell aus [Markdown-Dateien in einem Vault](https://obsidian.md/help/data-storage) und [YAML-Eigenschaften am Dateianfang](https://obsidian.md/help/properties).

**Beim erneuten Import ist der markierte JSON-Datenblock die vollständige Datenquelle.** Die Tabellen und Eigenschaften darüber sind ein lesbarer Exportstand. Eine manuelle Änderung dieser Zusammenfassung verändert den eingebetteten Plan nicht. Der Import führt kein Markdown, HTML oder JavaScript aus.

Der konfigurierbare Zielordner ist ein relativer Pfad innerhalb des Vaults, beispielsweise `Planung/Ressourcen`. Der Browser-Prototyp lädt die Datei herunter und zeigt ihren vorgesehenen Pfad; er schreibt nicht direkt in einen Obsidian-Vault. Die spätere Plugin-Integration kann denselben Plan über eine Vault-Persistenzschicht speichern.

CSV-Exporte enthalten Rollenübersicht, Tageswerte oder Wochen-/Monatswerte. Sie verwenden Semikolon, Dezimalkomma und eine UTF-8-Kennung. Nutzereingaben werden als Text geschützt. CSV ist ein Auswertungsformat; für vollständige Sicherungen und erneuten Import dienen JSON oder der eigene Markdown-Export.

## 8. Grenzen und Prüfungen

Pro Plan gelten höchstens 1.096 Kalendertage, 100 Rollen, 2.000 Einsätze, 500 Sperrzeiten und 400 Feiertagseinträge. Eine Sicherung kann bis zu 25 Pläne enthalten. Der Dateigrößenrahmen beträgt 32 MB. Diese Grenzen halten die Bearbeitung im Browser überschaubar.

Einsätze und Sperrzeiten dürfen über die Planränder hinausreichen. Die ursprünglichen Datumswerte bleiben gespeichert; berechnet wird nur der innerhalb des Plans liegende Anteil. Ein vollständig außerhalb liegender Einsatz erzeugt 0 PT und einen Hinweis.

Unbekannte importierte Datenfelder, ungültige Daten, nicht vorhandene Rollenreferenzen, doppelte IDs, nicht unterstützte Versionen und mehrdeutige Markdown-Datenblöcke werden vor einer Übernahme abgelehnt. Die Tests in `tests/io.test.mjs` prüfen unter anderem die 164-PT-Beispielrechnung, vollständige JSON- und Markdown-Rundreisen, Schutz bestehender Daten bei fehlerhaften Importen und die Übereinstimmung der CSV-Zeitsummen mit dem Gesamtplan.
