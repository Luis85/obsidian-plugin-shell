const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const fail = message => { throw new Error(`METRIC_REPORT_${message}`); };
function cloneTotals(groups) {
  const ranges = new Map(); let tokens = 0;
  for (const group of groups) {
    tokens += group.token_count * (group.instances.length - 1);
    for (const instance of group.instances) {
      const file = ranges.get(instance.file) ?? [];
      file.push([instance.start_line, instance.end_line]); ranges.set(instance.file, file);
    }
  }
  let lines = 0;
  for (const intervals of ranges.values()) {
    intervals.sort((a, b) => a[0] - b[0]); let start = 0; let end = -1;
    for (const [nextStart, nextEnd] of intervals) {
      if (nextStart > end + 1) { lines += end - start + 1; start = nextStart; end = nextEnd; }
      else end = Math.max(end, nextEnd);
    }
    lines += end - start + 1;
  }
  return { lines, tokens };
}
function header(report, kind, schema) {
  if (!report || report.kind !== kind || report.schema_version !== schema || report.version !== '3.28.0') fail('SCHEMA');
  if (report.workspace_diagnostics?.length || report.skipped_files?.length || report.parse_errors?.length) fail('INCOMPLETE');
  if (report.request_outcomes && Object.values(report.request_outcomes).some(outcome => outcome.status !== 'applied')) fail('REQUEST');
}
export function suppressionReport(report) {
  if (report?.kind !== 'suppression-inventory' || report.schema_version !== '1' || report.summary?.total !== 0
    || report.summary.files !== 0 || !Array.isArray(report.files) || report.files.length) fail('SUPPRESSION');
  return { total: 0, files: 0 };
}
export function healthReport(report, inputs) {
  header(report, 'health', 11);
  const summary = report.summary;
  const population = report.vital_signs?.cyclomatic_population;
  if (!summary || summary.files_analyzed !== inputs.length || !integer(summary.functions_analyzed)
    || !integer(summary.functions_above_threshold) || !Array.isArray(report.findings)
    || summary.functions_above_threshold !== report.findings.length
    || summary.max_cyclomatic_threshold !== 10 || summary.max_cognitive_threshold !== 15) fail('HEALTH_INVENTORY');
  if (!integer(population?.functions?.count) || !integer(population?.templates?.count)
    || population.functions.count + population.templates.count !== summary.functions_analyzed) fail('HEALTH_POPULATION');
  const templates = new Map(inputs.filter(input => input.extension === 'vue' && input.templateRegion).map(input => [input.staged, input.templateRegion]));
  if (population.templates.count > templates.size) fail('HEALTH_TEMPLATE_CATEGORY');
  const mapping = new Map(inputs.map(input => [input.staged, input.path]));
  const lengths = new Map(inputs.map(input => [input.staged, input.physicalLines]));
  const findings = report.findings.map(finding => {
    if (!mapping.has(finding.path) || typeof finding.name !== 'string' || !integer(finding.cyclomatic)
      || !integer(finding.cognitive) || !integer(finding.line) || finding.line < 1 || finding.line > lengths.get(finding.path)) fail('HEALTH_FINDING');
    if (finding.name === '<template>') {
      const region = templates.get(finding.path);
      if (!region || finding.line < region.startLine || finding.line > region.endLine) fail('HEALTH_TEMPLATE_CATEGORY');
    }
    return { path: mapping.get(finding.path), name: finding.name, line: finding.line,
      cyclomatic: finding.cyclomatic, cognitive: finding.cognitive };
  }).filter(finding => finding.cyclomatic > 10 || finding.cognitive > 15);
  const templateFindings = findings.filter(finding => finding.name === '<template>');
  if (new Set(templateFindings.map(finding => finding.path)).size !== templateFindings.length || templateFindings.length > population.templates.count) fail('HEALTH_TEMPLATE_CATEGORY');
  return { inputs: inputs.length, functions: population.functions.count, templateUnits: population.templates.count, analyzedUnits: summary.functions_analyzed,
    templateFindings,
    findings: findings.filter(finding => finding.name !== '<template>') };
}
export function duplicationReport(report, inputs) {
  header(report, 'dupes', 10);
  const stats = report.stats;
  const integers = ['total_files', 'files_with_clones', 'total_lines', 'duplicated_lines', 'total_tokens', 'duplicated_tokens', 'clone_groups', 'clone_instances'];
  if (!stats || integers.some(key => !integer(stats[key])) || !finite(stats.duplication_percentage)
    || stats.total_files > inputs.length || stats.duplicated_lines > stats.total_lines
    || stats.duplicated_tokens > stats.total_tokens || !Array.isArray(report.clone_groups)
    || report.clone_groups.length !== stats.clone_groups || report.clone_groups_omitted !== 0
    || report.clone_groups_shown !== stats.clone_groups || stats.clone_groups_ignored || stats.clone_groups_below_min_occurrences
    || stats.near_candidates_skipped) fail('DUPLICATION_SUMMARY');
  const percentage = stats.total_lines === 0 ? 0 : 100 * stats.duplicated_lines / stats.total_lines;
  if (Math.abs(stats.duplication_percentage - percentage) > 0.00000001) fail('DUPLICATION_DENOMINATOR');
  const gate = report.gate_outcomes?.['duplication-threshold'];
  if (!gate || gate.enforced !== true || gate.threshold !== 3 || gate.observed !== stats.duplication_percentage
    || gate.status !== (percentage > 3 ? 'fail' : 'pass')) fail('DUPLICATION_GATE');
  const mapping = new Map(inputs.map(input => [input.staged, input.path]));
  const lengths = new Map(inputs.map(input => [input.staged, input.physicalLines]));
  const cloneFiles = new Set(); let instances = 0;
  for (const group of report.clone_groups) {
    if (!integer(group.token_count) || group.token_count < 50 || !integer(group.line_count) || group.line_count < 5
      || !Array.isArray(group.instances) || group.instances.length < 2) fail('CLONE');
    for (const instance of group.instances) {
      if (!mapping.has(instance.file) || !integer(instance.start_line) || instance.start_line < 1
        || !integer(instance.end_line) || instance.end_line < instance.start_line || instance.end_line > lengths.get(instance.file)) fail('CLONE_INPUT');
      cloneFiles.add(instance.file); instances++;
    }
    if (group.line_count !== Math.max(...group.instances.map(instance => instance.end_line - instance.start_line + 1))) fail('CLONE_LINES');
  }
  if (cloneFiles.size !== stats.files_with_clones || instances !== stats.clone_instances) fail('CLONE_TOTALS');
  if (stats.clone_groups === 0 ? stats.duplicated_lines !== 0 || stats.duplicated_tokens !== 0 : stats.duplicated_lines === 0 || stats.duplicated_tokens === 0) fail('CLONE_TOTALS');
  const totals = cloneTotals(report.clone_groups);
  if (totals.lines !== stats.duplicated_lines || totals.tokens !== stats.duplicated_tokens) fail('CLONE_TOTALS');
  return { ...stats, suppliedInputs: inputs.length, clones: report.clone_groups.map(group => ({
    tokens: group.token_count, lines: group.line_count,
    instances: group.instances.map(instance => ({ path: mapping.get(instance.file), start: instance.start_line, end: instance.end_line })),
  })) };
}
