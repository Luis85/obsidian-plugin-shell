import { readAgents, readWorkbench } from '../../domain/adoption/agents.ts';
import { readAngular } from '../../domain/adoption/angular.ts';
import { reportSchemaId, type AdoptionReport, type ProjectInventory, type WorkbenchTargets } from '../../domain/adoption/contracts.ts';
import { angularFindings, sortFindings, toolchainFindings } from '../../domain/adoption/findings.ts';
import { repositoryFindings } from '../../domain/adoption/findings-repository.ts';
import { readFrameworks } from '../../domain/adoption/frameworks.ts';
import { readPackages, readRuntime } from '../../domain/adoption/manifest.ts';
import { InventoryView } from '../../domain/adoption/source.ts';
import { readTooling, readUi } from '../../domain/adoption/tooling.ts';

/** Pure analysis of a bounded inventory: same inventory, targets and clock value give the same report. */
export function analyzeInventory(inventory: ProjectInventory, targets: WorkbenchTargets, recordedAt: string | null): AdoptionReport {
  const view = new InventoryView(inventory);
  const packages = readPackages(view);
  const runtime = readRuntime(view, packages);
  const angular = readAngular(view, packages);
  const frameworks = readFrameworks(view, packages, angular);
  const ui = readUi(view, packages), tooling = readTooling(view, packages);
  const agents = readAgents(view), workbench = readWorkbench(view);
  const findings = sortFindings([
    ...angularFindings(angular, targets),
    ...toolchainFindings(runtime, tooling, targets, view, packages.files.includes('package.json')),
    ...repositoryFindings({ git: inventory.git, scan: inventory.scan, agents, workbench, frameworks, tooling, view }),
  ]);
  return { schema: reportSchemaId, recordedAt, target: { name: inventory.name, git: inventory.git }, scan: inventory.scan, runtime, frameworks, angular, ui, tooling, agents, workbench, targets, findings };
}
