function smMarkdown(map, d = design()) {
  const safe = value => String(value || '').replace(/[\\`*_{}\[\]<>#|]/g, '\\$&');
  const lines = ['# ' + safe(map.title), '', safe(map.purpose), '', '**Audience / scenario:** ' + safe(map.audience || 'Not described'), '**Map state:** ' + safe(map.status), '**Map ID:** ' + map.id, '', 'This document describes planned scope and references, not implementation or verification evidence.', '', '## Linked PRDs', ''];
  for (const ref of map.prds) { const target = d.prds.find(p => p.id === ref.id); lines.push('- ' + safe(target?.title || ref.label) + ' (' + safe(ref.id) + ')' + (target ? '' : ' — target missing')); }
  if (!map.prds.length) lines.push('None.');
  const refs = item => { if (!item.surfaces.length) return item.ui === 'none' ? 'No UI required.' : 'No sitemap links yet.'; return item.surfaces.map(r => { const n = d.nodes.find(n => n.id === r.id); return safe(n?.label || r.label) + ' (' + safe(r.id) + ')' + (n ? '' : ' — target missing'); }).join('; '); };
  lines.push('', '## Experience structure', '');
  for (const activity of map.activities) {
    lines.push('### ' + safe(activity.title), '', 'Sitemap: ' + refs(activity), '');
    for (const step of map.steps.filter(s => s.activityId === activity.id)) lines.push('- ' + safe(step.title) + ' (' + step.id + '). Sitemap: ' + refs(step));
  }
  lines.push('', '## Release slices', '');
  for (const release of [...map.releases, { id: null, title: 'Unplanned', outcome: 'Not assigned to a release.' }]) {
    lines.push('### ' + safe(release.title), '', safe(release.outcome || 'No intended outcome described.'), ''); let count = 0;
    for (const activity of map.activities) for (const step of map.steps.filter(s => s.activityId === activity.id)) for (const story of map.stories.filter(s => s.stepId === step.id && s.releaseId === release.id)) {
      count++; lines.push('#### ' + safe(story.title), '', '**Context:** ' + safe(activity.title + ' / ' + step.title), '**Story ID:** ' + story.id, '', safe(story.description || 'No description.'), '', '**Acceptance notes**', '', safe(story.acceptance || 'Not described.'), '', '**Sitemap:** ' + refs(story), '', '**Requirements:**');
      for (const ref of story.requirements) { const p = d.prds.find(p => p.id === ref.prdId), q = p?.requirements.find(q => q.id === ref.id); lines.push('- ' + safe(q ? p.title + ' / ' + q.title : ref.label + ' — target missing') + ' (' + safe(ref.prdId) + ':' + safe(ref.id) + ')'); }
      if (!story.requirements.length) lines.push('None.'); lines.push('');
    }
    if (!count) lines.push('No stories in this slice.', '');
  }
  return lines.join('\n') + '\n';
}
function smExport() {
  const map = smCurrentMap(); if (!map) throw Error('Open a storymap to export it.');
  const url = URL.createObjectURL(new Blob([smMarkdown(map)], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = map.id + '.storymap.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Saved storymap exported. Use project JSON for a complete importable round trip.');
}
