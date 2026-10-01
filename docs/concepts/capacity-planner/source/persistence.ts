import {activeScenario,announce,clone,commit,esc,save,slug,stateRef,validate} from "./core.ts";
import {scenarioMetrics} from "./metrics.ts";

function downloadBlob(blob,name) {
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function exportWorkspace() {
  const blob=new Blob([JSON.stringify(stateRef.state,null,2)],{type:"application/json"});
  downloadBlob(blob,`${slug(stateRef.state.project.name)}-capacity-workspace-r${stateRef.state.revision}.json`);announce("Workspace export created.");
}
export async function importWorkspace(file) {
  try{
    const candidate=JSON.parse(await file.text()),error=validate(candidate);if(error){announce(error);return false;}
    if(candidate.id===stateRef.state.id&&Number(candidate.revision)<Number(stateRef.state.revision)&&stateRef.state.project.persistence.conflictPolicy==="block-old"){
      announce(`Import blocked: revision r${candidate.revision} is older than current r${stateRef.state.revision}.`);return false;
    }
    const relation=candidate.id===stateRef.state.id?`Imported revision r${candidate.revision}; current is r${stateRef.state.revision}.`:"Imported workspace has a different workspace ID.";
    if(!window.confirm(`${relation}\n\nReplace the current workspace with “${candidate.project.name}”?`))return false;
    stateRef.state=clone(candidate);stateRef.taskFilter="";stateRef.dirty=true;save();announce("Workspace imported and saved.");return true;
  }catch{announce("Import failed. Choose a valid Capacity Planner v2 JSON workspace.");return false;}
}

function frontmatter(values) {
  const lines=["---"];
  for(const [key,value] of Object.entries(values)){
    if(Array.isArray(value))lines.push(`${key}: [${value.map(item=>JSON.stringify(item)).join(", ")}]`);
    else if(value&&typeof value==="object")lines.push(`${key}: '${JSON.stringify(value).replaceAll("'","''")}'`);
    else lines.push(`${key}: ${typeof value==="string"?JSON.stringify(value):String(value??"")}`);
  }
  lines.push("---","");return lines.join("\n");
}
function mdTable(headers,rows) {
  return `| ${headers.join(" | ")} |\n| ${headers.map(()=>"---").join(" | ")} |\n${rows.map(row=>`| ${row.map(value=>String(value??"").replaceAll("|","\\|")).join(" | ")} |`).join("\n")}\n`;
}
export function markdownFiles() {
  const state=stateRef.state,project=state.project,p=project.persistence,base=p.basePath.replace(/^\/+|\/+$/g,""),files=[];
  const add=(subpath,name,content)=>files.push({path:`${base}/${subpath}/${name}`.replaceAll("//","/"),content});
  add(p.projectPath,"project.md",frontmatter({type:"capacity-project",id:project.id,name:project.name,orderValue:project.orderValue,timelineOwner:project.timelineOwner,revision:state.revision})+`# ${project.name}\n\nCapacity Planner project record.\n`);
  for(const it of project.iterations)add(p.iterationPath,`${slug(it.name)}-${it.id}.md`,frontmatter({type:"capacity-iteration",id:it.id,index:it.index,name:it.name,start:it.start,end:it.end,project:project.id,timelineOwner:project.timelineOwner})+`# ${it.name}\n`);
  for(const role of project.roles)add(p.rolePath,`${slug(role.name)}-${role.id}.md`,frontmatter({type:"capacity-role",id:role.id,name:role.name,dayRate:role.dayRate,manualFte:role.manualFte,budgetCap:role.budgetCap,project:project.id})+`# ${role.name}\n`);
  for(const person of project.people)add(p.personPath,`${slug(person.name)}-${person.id}.md`,frontmatter({type:"capacity-person",id:person.id,name:person.name,role:person.roleId,baseFte:person.baseFte,project:project.id,availabilityByIteration:person.availabilityByIteration||{}})+`# ${person.name}\n\n${(person.leave||[]).length?mdTable(["Leave","Start","End"],person.leave.map(item=>[item.label||"Leave",item.start,item.end])):"No recorded leave.\n"}`);
  for(const task of project.tasks)add(p.taskPath,`${slug(task.title)}-${task.id}.md`,frontmatter({type:"capacity-task",id:task.id,title:task.title,units:task.units,unitName:project.unitName,project:project.id})+`# ${task.title}\n`);
  for(const scenario of state.scenarios){const metrics=scenarioMetrics(scenario);add(p.scenarioPath,`${slug(scenario.name)}-${scenario.id}.md`,frontmatter({type:"capacity-scenario",id:scenario.id,name:scenario.name,status:scenario.status,budget:scenario.budget,contingencyPct:scenario.contingencyPct,targetMarginPct:scenario.targetMarginPct,project:project.id,revision:state.revision})+`# ${scenario.name}\n\n## Forecast\n\n- Forecast internal cost: €${Math.round(metrics.forecastWithContingency)}\n- Planned capacity: ${metrics.plannedHours.toFixed(1)} h\n- Unallocated work: ${metrics.unallocatedHours.toFixed(1)} h\n\n## Allocations\n\n${mdTable(["Task","Role","Person","Iteration","Hours"],scenario.allocations.map(item=>[item.taskId,item.roleId,item.personId||"—",item.iterationId,item.hours]))}`);}
  for(const baseline of state.baselines)add(p.baselinePath,`${slug(baseline.name)}-${baseline.id}.md`,frontmatter({type:"capacity-baseline",id:baseline.id,name:baseline.name,scenario:baseline.scenarioId,createdAt:baseline.createdAt,approvedAt:baseline.approvedAt||"",revision:baseline.revision,project:project.id})+`# ${baseline.name}\n\nImmutable resource-plan snapshot.\n`);
  add(p.auditPath,"capacity-planner-audit.md",frontmatter({type:"capacity-audit",workspace:state.id,project:project.id,revision:state.revision})+`# Capacity Planner audit log\n\n${mdTable(["Revision","Timestamp","Action","Detail"],state.audit.map(item=>[item.revision,item.at,item.action,item.detail]))}`);
  return files;
}

function crc32(bytes) {
  let crc=-1;for(const byte of bytes){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^-1)>>>0;
}
function u16(value){return new Uint8Array([value&255,(value>>>8)&255]);}
function u32(value){return new Uint8Array([value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255]);}
function concat(parts){const size=parts.reduce((sum,item)=>sum+item.length,0),out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
function zipStore(files) {
  const encoder=new TextEncoder(),locals=[],centrals=[];let offset=0;
  for(const file of files){const name=encoder.encode(file.path),data=encoder.encode(file.content),crc=crc32(data),local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);const central=concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length;}
  const central=concat(centrals),end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(offset),u16(0)]);return concat([...locals,central,end]);
}
export function exportMarkdownZip() {
  const files=markdownFiles(),zip=zipStore(files);downloadBlob(new Blob([zip],{type:"application/zip"}),`${slug(stateRef.state.project.name)}-obsidian-capacity-plan.zip`);announce(`${files.length} Markdown files packaged for the configured Obsidian paths.`);
}
export function markdownPreviewHtml() {
  const files=markdownFiles(),sample=files.slice(0,8);return `<div class="write-preview"><strong>${files.length} Markdown writes</strong><span>Base path: ${esc(stateRef.state.project.persistence.basePath)}</span>${sample.map(file=>`<code>${esc(file.path)}</code>`).join("")}${files.length>sample.length?`<small>…and ${files.length-sample.length} more</small>`:""}</div>`;
}
