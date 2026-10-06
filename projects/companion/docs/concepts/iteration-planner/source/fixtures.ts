import { clone, type Workspace, type Item, type Iteration, type Work, type Status } from './model.ts';
import { validateWorkspace } from './validation.ts';

export function emptyWorkspace(): Workspace {
  return {kind:'iteration-planner.workspace',schemaVersion:1,productName:'My product',clock:'2026-09-30',nextId:1,nextIteration:0,
    backlogs:[{id:'product',title:'Product backlog'}],items:[],resources:[],iterations:[]};
}
export function demoWorkspace(): Workspace {
  const state = emptyWorkspace();
  state.productName = 'Companion'; state.nextId = 100; state.nextIteration = 3;
  state.backlogs = [{id:'product',title:'Companion MVP'},{id:'improvements',title:'Team improvements'}];
  state.resources = [{id:'maya',name:'Maya Chen',role:'Product design'},{id:'jonas',name:'Jonas Weber',role:'Engineering'},{id:'alex',name:'Alex Rivera',role:'Product owner'}];
  const rows: [string,string,number,Status,string][] = [
    ['Create pages with just a title','Feature',5,'done','jonas'],
    ['Reuse existing components','Feature',8,'done','maya'],
    ['Sketch a page layout','Feature',13,'doing','maya'],
    ['Preserve edits when importing JSON','Bug',8,'blocked','jonas'],
    ['Guide the first prototype','Feature',8,'doing','alex'],
    ['Write the handover checklist','Task',3,'ready','alex'],
    ['Keyboard-first sitemap navigation','Improvement',5,'backlog','jonas'],
    ['Compare two design revisions','Research',8,'backlog','maya'],
    ['Explain blocked work earlier','Improvement',2,'backlog','alex'],
    ['Review plan naming with the team','Research',1,'backlog','alex'],
    ['Document the authoring journey','Research',5,'done','alex'],
    ['Connect sibling pages','Feature',8,'done','jonas']
  ];
  state.items = rows.map((row,index): Item => ({id:`item-${index+1}`,backlogId:index === 8 ? 'improvements' : 'product',title:row[0],
    type:row[1],estimate:row[2],status:row[3],ownerId:row[4],priority:index === 3 ? 'high' : index > 5 ? 'low' : 'medium',
    description:[
      'A person can create a page by entering only its title. Optional detail stays optional.',
      'Select an existing component and reuse it without duplicating the definition.',
      'Place and rearrange components in a clear, keyboard-accessible page outline.',
      'Keep unrelated work intact when a project export is imported. Show conflicts before applying.',
      'Lead a first-time user from an idea to a useful, reviewable prototype.',
      'Explain what is delivered, what is simulated, and how to continue.'
    ][index] ?? 'An example backlog item. Replace this with any kind of work your team needs.',archived:index > 9}));
  function work(index: number, date: string): Work {
    const item = state.items[index];
    return {itemId:item.id,title:item.title,estimate:item.estimate,ownerId:item.ownerId,status:item.status,
      note:item.status === 'done' ? 'Acceptance checks met; ready to demonstrate.' : index === 3 ? 'Waiting for an agreed conflict policy.' : 'The next smallest useful slice is in progress.',
      nextAction:index === 3 ? 'Agree conflict behavior with Alex today.' : 'Validate the next interaction with the team.',
      blocker:index === 3 ? 'Import conflict policy needs a product decision.' : '',doneCheck:item.status === 'done',
      releaseNote:item.status === 'done' ? index === 0 ? 'Pages can now be created with a title only.' : index === 1 ? 'Existing component definitions can be reused on a page.' : 'The agreed interaction is available to the team.' : '',addedAt:date};
  }
  function iteration(index: number, goal: string, start: string, end: string, works: Work[], closed: boolean): Iteration {
    const value: Iteration = {id:`iteration-${index}`,index,goal,description:'Build the smallest coherent improvement, review it together, and use what we learn to shape the next step.',
      start,end,stage:closed?'closed':'active',confidence:closed?'on-track':'at-risk',
      members:[{resourceId:'maya',hours:24},{resourceId:'jonas',hours:32},{resourceId:'alex',hours:16}],
      references:[{id:`reference-${index}`,title:'Definition of Done & team agreement',url:'https://scrumguides.org/scrum-guide.html'}],
      work:works,baseline:clone(works.map(value => ({...value,status:'ready',doneCheck:false,releaseNote:'',note:'',blocker:''}))),scopeChanges:[],daily:[],retro:[],
      increment:{id:`increment-${index}`,summary:closed?'A small, usable step forward in the authoring experience.':'A first usable page-authoring loop, from title to reusable components.',
        reviewNotes:closed?'The team demonstrated the result and agreed the next opportunity.':'',goalOutcome:closed?'met':'not-assessed',
        snapshot:closed?{date:end,delivered:clone(works),unfinished:[]}:null}};
    return value;
  }
  state.iterations = [
    iteration(0,'Map the authoring journey','2026-09-14','2026-09-18',[work(10,'2026-09-14')],true),
    iteration(1,'Make navigation connected','2026-09-21','2026-09-25',[work(11,'2026-09-21')],true),
    iteration(2,'Make the first page feel effortless','2026-09-28','2026-10-02',state.items.slice(0,6).map((_,i)=>work(i,'2026-09-28')),false)
  ];
  const current = state.iterations[2];
  current.daily = [{date:'2026-09-29',finished:true,summary:'Keep the page flow small. Bring the import decision to the next daily.',notes:current.work.map(value=>({itemId:value.itemId,note:'Checked progress together.',nextAction:value.nextAction}))}];
  current.retro = [{id:'retro-1',category:'keep',text:'Review tiny changes together, while they are still easy to adjust.',ownerId:'maya',backlogItemId:null},
    {id:'retro-2',category:'change',text:'Make external decisions visible before work becomes blocked.',ownerId:'alex',backlogItemId:null}];
  return validateWorkspace(state);
}
