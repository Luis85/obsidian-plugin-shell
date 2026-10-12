# Resource Atlas — calculation decisions and verification basis

Reviewed 11 October 2026. This note records the calculation model for the prototype, the reference-image interpretation, and independent verification examples. It does not define payroll, employment contracts, or an individual's actual availability.

## Product scope

The reference sketch is a role-based deployment plan: a bounded timeline, multiple dated assignment bars for each role, a shared company closure, role totals in **Personentage (PT)**, and an approximate PT budget. The sketch totals **35 + 35 + 80 + 14 = 164 PT** against **150 PT** budget. Its month blocks are schematic. The prototype should position real calendar dates rather than assume that every month contains four weeks.

Role FTE describes the default assignment intensity and the nominal role capacity. It does not create effort automatically. Only explicit dated assignments contribute planned effort. A gap in a role's timeline contributes zero PT; different assignments can use different FTE values.

## Formula and stated assumptions

For each date inside the plan, including both boundary dates:

```text
working(date) = 1 if the weekday is selected and the date is not a listed holiday, otherwise 0
blocked(role, date) = maximum matching company or role block fraction
available(role, date) = working(date) × (1 − blocked(role, date))
demand(role, date) = sum of FTE from matching dated assignments
planned PT(role) = sum over dates of demand(role, date) × available(role, date)
nominal capacity PT(role) = role FTE × sum over dates of available(role, date)
```

Block fractions run from 0 to 1. A complete closure produces zero effort on matching days. A 50% block leaves half a working day available. Overlapping blocks use the strongest reduction: two 50% blocks leave 50%, not zero. This is a deliberate product rule because the editor stores date ranges and fractions, not separate morning and afternoon intervals.

Overlapping assignments add demand; they should remain visible and trigger a warning when their combined FTE exceeds nominal capacity. Do not silently cap planned effort at role capacity. Blocks reduce the calculated effort inside fixed assignment dates; they do not automatically extend or reschedule assignments.

One PT is one configured standard working day. **Hours per PT** is an explicit conversion setting, initially 8 hours, rather than a claim that all organizations use eight-hour days. Changing hours per PT changes the optional hours result, not the number of working days or the PT result. Public holidays and company absences are explicit blocks; no country's or region's holiday calendar should be assumed silently.

## Reference-image seed with real dates

A 20-week example from **5 October 2026 to 19 February 2027**, Monday–Friday, contains 100 weekdays. The company closure **21 December 2026–1 January 2027** removes ten weekdays, leaving 90 company working days. The following intervals reproduce the sketch's effort totals exactly:

| Role | FTE | Dated assignments, inclusive | Expected PT |
|---|---:|---|---:|
| UX | 1 | 12 Oct–13 Nov 2026; 30 Nov–11 Dec 2026 | 25 + 10 = 35 |
| Requirements Engineering | 1 | 12 Oct–27 Nov 2026 | 35 |
| Development | 1 | 19 Oct–18 Dec 2026; 4 Jan–19 Feb 2027 | 45 + 35 = 80 |
| Delivery Management | 0.2 | 12 Oct–27 Nov 2026; 4 Jan–19 Feb 2027 | 7 + 7 = 14 |

The total is **164 PT**. Against a 150 PT budget this is **14 PT over budget**, or approximately **9.33%**. At eight hours per PT the total is **1,312 hours**. The nominal combined role capacity is 3.2 FTE × 90 days = **288 PT**. Budget variance and nominal capacity are different comparisons.

## Primary references

1. **Eurostat — Full-time equivalent (FTE).** FTE normalizes hours relative to the full-time reference. For example, 20 weekly hours against a 40-hour reference is 0.5 FTE. This supports using fractional intensity; the prototype's conversion from that intensity to dated PT is an explicit planning convention. [Official glossary](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Glossary%3AFull-time_equivalent_%28FTE%29).
2. **Microsoft — NETWORKDAYS.INTL.** Working-day calculations use a chosen weekend pattern and explicitly supplied excluded dates. Its January 1–31 example counts all 31 calendar dates before excluding weekends. This supports an inclusive calendar model and configurable weekdays. [Official function documentation](https://support.microsoft.com/en-gb/excel/functions/networkdays-intl-function).
3. **TC39 — Temporal.PlainDate.** A calendar date is independent of a time zone. Calendar week numbers must be interpreted with the corresponding week year, which can differ from the calendar year around New Year. The implementation can use its own UTC day-index arithmetic; it need not rely on browser support for Temporal. [Official proposal documentation](https://tc39.es/proposal-temporal/docs/plaindate.html).

## Meaningful verification cases

| Case | Expected result |
|---|---|
| One Monday, 1 FTE, same start/end | 1 PT |
| One Sunday with Monday–Friday calendar | 0 PT |
| Monday–Friday, 0.2 FTE | 1 PT |
| One working day, 0.2 FTE, 50% block | 0.1 PT |
| Five weekdays, 1 FTE, one all-day block | 4 PT |
| Company 50% and role 50% block on same weekday | 0.5 PT at 1 FTE |
| Company 100% and role 50% block on same weekday | 0 PT |
| Two 0.6 FTE assignments on same weekday | 1.2 PT; warning against nominal 1 FTE |
| One assignment outside the plan | Only the intersecting plan dates count; original dates remain explicit |
| No assignments | 0 planned PT, regardless of nominal FTE |
| 28 Feb–1 Mar 2028, Monday–Friday, 1 FTE | 3 PT, including leap day |
| 23–30 Oct 2026, Monday–Friday, 1 FTE | 6 PT in Berlin and other time zones despite DST change |
| 1 Jan 2027 in week view | ISO week 53 of 2026 |
| 4 Jan 2027 in week view | ISO week 1 of 2027 |
| Invalid date or end before start | Reject without mutating saved plan |
| Non-finite/negative FTE or out-of-range block percentage | Reject rather than coerce silently |
| Native export → import → reload | IDs, dates, assignments, blocks, decimal values, settings, and totals survive |
| Family exchange | Retains stable source references without requiring another plugin |

Browser review should additionally cover creation and editing through real form controls, cancel without change, undo/redo, changing plan boundaries without silent data loss, download contents, desktop and narrow layouts, keyboard focus, dark/light theme parity, and zero external requests in the standalone HTML. Test the visible totals and downloaded data rather than only calling calculation functions directly.
