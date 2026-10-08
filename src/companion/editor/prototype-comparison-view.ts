import type { PrototypeSelection } from '#shared/companion/prototypes/model.ts';
import { prototypeApi as api } from '#shared/companion/prototypes/api.ts';
import type { PrototypeHost } from './prototype-host.ts';
import { pmEscape as e, pmButton as btn } from './prototype-markup.ts';
export function prototypeComparisonView(snapshot: ReturnType<PrototypeHost['read']>, selection: PrototypeSelection, requested: string, busy: boolean): string {
  const { workspace, working, writable } = snapshot, selected = api.selected(workspace,selection);
  const choices = [{ key:'working', label:'Current working copy', document:working }];
  for (const p of workspace.prototypes) for (const v of p.versions) for (const x of v.variants) choices.push({ key:api.selectionKey({prototypeId:p.id,versionId:v.id,variantId:x.id}), label:`${p.name} / ${v.label} / ${x.name}`, document:x.document });
  const reference = choices.find(x => x.key === requested) ?? choices[0]!;
  const report = api.compare(selected.variant.document,reference.document);
  const canRestore = !report.equal && writable && !busy && !selected.prototype.archived && !selected.version.sealed && selected.variant.status === 'draft' && reference.key !== 'working' && reference.key !== api.selectionKey(selection);
  return `<section class="pm-comparison" aria-label="Snapshot comparison"><h3>Compare complete designs</h3>
    <label>Compare selected snapshot with<select data-pm-comparison aria-label="Comparison reference">${choices.map(x => `<option value="${e(x.key)}"${x.key === reference.key ? ' selected' : ''}>${e(x.label)}</option>`).join('')}</select></label>
    <p class="pm-note">Selected → reference. Arrays are compared in order. Comparing does not open, save or activate anything.</p>
    <p role="status">${report.equal ? 'The complete project snapshots are identical.' : `${report.total} changed values or branches${report.omitted ? `; ${report.omitted} omitted from this preview` : ''}.`}</p>
    ${report.equal ? '' : `<div class="pm-diff-scroll"><table><caption>Values shortened to 180 characters; at most 100 changes shown.</caption><thead><tr><th scope="col">Project path</th><th scope="col">Change</th><th scope="col">Selected</th><th scope="col">Reference</th></tr></thead><tbody>${report.changes.map(x => `<tr><th scope="row"><code>${e(x.path)}</code></th><td>${x.kind}</td><td><code>${e(x.before)}</code></td><td><code>${e(x.after)}</code></td></tr>`).join('')}</tbody></table></div>`}
    ${btn('Restore reference into selected draft','restore-snapshot',!canRestore)}
    <p class="pm-note">Restore is available for editable drafts and a different saved reference. It creates a sealed recovery version containing the complete previous draft. The working copy and active generator selection stay unchanged.</p>
  </section>`;
}
