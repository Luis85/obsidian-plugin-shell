import {openDialog} from "./dialogs-common.ts";

export function manageDialog() {
  openDialog("Manage Capacity Planner",`
    <div class="manage-groups">
      <section class="manage-group"><div><strong>Plan</strong><span>Scenario, project frame and comparisons</span></div><div class="manage-actions"><button type="button" data-action="plan-settings">Plan settings</button><button type="button" data-action="project-timeline">Project & timeline</button><button type="button" data-action="plans">Resource plans</button><button type="button" data-action="compare-plans">Compare plans</button></div></section>
      <section class="manage-group"><div><strong>Resources & commercial</strong><span>Team, rates, budget and external costs</span></div><div class="manage-actions"><button type="button" data-action="team">Team & availability</button><button type="button" data-action="commercial">Commercials</button></div></section>
      <section class="manage-group"><div><strong>Governance</strong><span>Snapshots, revisions and persistence contract</span></div><div class="manage-actions"><button type="button" data-action="baselines">Baselines</button><button type="button" data-action="audit">Audit & revisions</button><button type="button" data-action="persistence">Obsidian persistence</button></div></section>
      <section class="manage-group"><div><strong>Plan engine JSON</strong><span>Self-contained active plan documents for round-trip engine input/output</span></div><div class="manage-actions"><button type="button" data-action="export-plan">Export whole plan</button><button type="button" data-action="import-plan">Import whole plan</button></div></section><section class="manage-group"><div><strong>Workspace & handoff</strong><span>All scenarios, audit history and Markdown persistence output</span></div><div class="manage-actions"><button type="button" data-action="export-workspace">Export workspace</button><button type="button" data-action="import-workspace">Import workspace</button><button type="button" data-action="export-markdown">Export Markdown ZIP</button></div></section>
    </div>`,null,"",{cancelText:"Done"});
}
