// All library entries use one component instance workflow. No executable templates.
const unifiedUi={tags:[],sort:'name'};
function normalizeComponentTags(value){
 const raw=Array.isArray(value)?value:String(value||'').split(',');
 return [...new Set(raw.map(t=>String(t).trim().toLowerCase()).filter(Boolean))].sort();
}
function validComponentTags(tags){return tags===undefined||Array.isArray(tags)&&tags.length<=16&&new Set(tags).size===tags.length&&tags.every(t=>typeof t==='string'&&/^[a-z0-9][a-z0-9 -]{0,31}$/.test(t));}
function componentTagDefaults(c){return normalizeComponentTags(['application',String(c.category||'content').toLowerCase()]);}
function componentSearchText(c){return [c.id,c.name,c.category,c.description,c.contentSpec?.title,...(c.tags||[])].join(' ').toLowerCase();}
function expandedComponents(){
 const rows=[
 ['site-header','SiteHeader','Site header','navigation','Navigation','website,navigation,header','Brand, primary links, and the main call to action.'],
 ['hero','HeroSection','Hero / introduction','hero','Content','website,landing,marketing','Explain the value and the next useful action.'],
 ['feature-grid','FeatureGrid','Feature grid','features','Content','website,marketing,overview','Group capabilities around customer outcomes.'],
 ['pricing','PricingPlans','Pricing plans','pricing','Data','website,pricing,comparison','Compare plan limits, pricing assumptions, and actions.'],
 ['testimonials','Testimonials','Customer stories','testimonials','Content','website,trust,marketing','Attributed quotes and evidence; illustrative until supplied.'],
 ['faq','FaqAccordion','Frequently asked questions','faq','Content','website,help,disclosure','Questions and expandable answers with keyboard support.'],
 ['site-footer','SiteFooter','Footer / related links','footer','Navigation','website,navigation,footer','Secondary links, support, and legal destinations.'],
 ['image-gallery','ImageGallery','Image gallery','gallery','Content','website,media,portfolio','Describe images, captions, and alternative text.'],
 ['contact','ContactForm','Contact form','form','Input','website,form,contact','Contact details, validation, consent, and submission outcomes.'],
 ['newsletter','NewsletterSignup','Newsletter signup','actions','Action','website,form,marketing','One deliberate subscription action and clear feedback.'],
 ['article','ArticleBody','Article / documentation','text','Content','website,documentation,reading','Readable structured content with meaningful headings.'],
 ['breadcrumbs','BreadcrumbTrail','Breadcrumbs','breadcrumb','Navigation','website,application,navigation','Show the current location without replacing primary navigation.'],
 ['app-sidebar','AppSidebar','Application navigation','sidebar','Navigation','application,navigation,sidebar','Persistent modules and a visible current selection.'],
 ['tab-strip','TabStrip','Tabs','tabs','Navigation','application,navigation,tabs','Switch related panels and retain local state.'],
 ['metric-summary','MetricSummary','Metric summary','metrics','Data','application,dashboard,metrics','Named values with units, period, and data freshness.'],
 ['activity-timeline','ActivityTimeline','Activity timeline','timeline','Data','application,activity,history','Chronological events with actors and timestamps.'],
 ['calendar','CalendarView','Calendar','calendar','Data','application,scheduling,calendar','Date-based work with an accessible list alternative.'],
 ['file-upload','FileUpload','File upload','upload','Input','application,website,files','Selection, validation, upload progress, and recoverable failure.'],
 ['profile','UserProfile','Profile summary','profile','Data','application,profile,account','Identity, contextual details, and allowed actions.'],
 ['code-editor','CodeEditor','Code / query editor','code','Input','application,developer,editor','Editable source with explicit apply and error feedback.'],
 ['conversation','Conversation','Conversation','chat','Content','application,messaging,communication','Messages, author identity, and deliberate send behavior.'],
 ['progress','ProgressTracker','Step progress','progress','Feedback','application,onboarding,workflow','Show completed, current, and remaining steps truthfully.'],
 ['command-search','CommandSearch','Command search','toolbar','Navigation','application,search,commands','Search actions with keyboard selection and clear context.'],
 ['permissions','PermissionsTable','Permissions matrix','table','Data','application,admin,access','Explain role permissions; editing requires business validation.']
 ];
 return rows.map(([slug,name,title,kind,category,tags,description])=>({id:'pattern-'+slug,name,category,preview:'brick',description,props:'title:string',events:'',slots:'content',variants:'default',a11y:'Use meaningful labels, keyboard access and explicit empty/error states.',version:'1.0.0',revision:1,status:'ready',origin:'starter',replacement:'',tokens:'--text-normal\n--background-primary',tags:normalizeComponentTags(tags),contentSpec:brickSpec(kind,title,description)}));
}
function adoptUnifiedLibrary(d){
 if(d.librarySchema===3)return d;
 // Add metadata without replacing the existing public contract or version.
 for(const c of d.library){
  if(!c.contentSpec)c.contentSpec=brickSpec(({record:'detail',empty:'empty',notice:'notice',toolbar:'toolbar',form:'form'})[c.preview]||'text',c.name,c.description);
  c.preview='brick';if(!c.tags)c.tags=componentTagDefaults(c);
 }
 for(const n of d.nodes){
  if(!canHaveBricks(n))continue;n.bricks=n.bricks||[];
  const retained=[];
  for(const binding of n.components||[]){
   // A historical implementation mapping is retained, but never shown as a second palette.
   if(n.bricks.some(b=>b.component===binding.id&&b.region===binding.slot)){retained.push(binding);continue;}
   const c=d.library.find(c=>c.id===binding.id);
   if(!c||n.bricks.length>=BRICK_LIMITS.perSurface||d.nodes.reduce((sum,x)=>sum+bricksOf(x).length,0)>=BRICK_LIMITS.total){retained.push(binding);continue;}
   const b={schema:1,id:freshBrickId(d),...designCopy(c.contentSpec),region:binding.slot,component:null};
   attachBrickDefinition(b,c);b.version=binding.version;n.bricks.push(b);
  }
  n.components=retained;
 }
 for(const c of expandedComponents())if(!d.library.some(x=>x.id===c.id||x.name===c.name)&&d.library.length<LIBRARY_LIMIT)d.library.push(c);
 d.librarySchema=3;return d;
}
function componentTagChips(c){return `<div class="component-tags">${(c.tags||[]).map(t=>`<button type="button" data-action="unified-tag" data-value="${esc(t)}" aria-pressed="${unifiedUi.tags.includes(t)}">${esc(t)}</button>`).join('')}</div>`;}
function handleUnifiedAction(action,value){
 if(action==='unified-tag'){unifiedUi.tags=unifiedUi.tags.includes(value)?unifiedUi.tags.filter(t=>t!==value):[...unifiedUi.tags,value];render();return true;}
 if(action==='unified-clear'){unifiedUi.tags=[];productUi.filter='';render();return true;}
 return false;
}
function editUnifiedField(el){
 const k=el.dataset.field;
 if(k==='unified-section'){if(!state.activeRun&&sectionForCard(design(),el.dataset.node)!==el.value){recordDesign();assignCardToSection(design(),el.dataset.node,el.value);save();render();}return true;}
 if(k==='unified-tag-select'){if(el.value&&!unifiedUi.tags.includes(el.value)){unifiedUi.tags.push(el.value);render();}return true;}
 if(k==='unified-sort'){unifiedUi.sort=el.value;render();return true;}
 if(k==='unified-tags'){productUi.form.tags=normalizeComponentTags(el.value);return true;}
 return false;
}
function componentWireframe(kind){
 const line=(x,y,w)=>`<path d="M${x} ${y}h${w}"/>`,box=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`;
 const shapes={
  hero:line(12,12,94)+line(12,22,72)+line(12,37,84)+line(12,45,76)+box(12,57,45,15)+box(124,10,74,63),
  features:[12,78,144].map(x=>box(x,9,54,61)+box(x+8,17,15,14)+line(x+8,43,36)+line(x+8,52,30)).join(''),
  pricing:[12,78,144].map((x,i)=>box(x,6,54,70)+line(x+8,17,31)+line(x+8,30,21)+line(x+8,43,36)+box(x+8,56,37,10)).join(''),
  testimonials:box(12,8,186,66)+line(26,23,136)+line(26,33,113)+'<circle cx="32" cy="56" r="8"/>'+line(50,54,69),
  faq:[8,32,56].map(y=>box(12,y,186,18)+line(23,y+8,128)+`<path d="m180 ${y+7} 4 4 4-4"/>`).join(''),
  footer:[12,76,140].map(x=>[15,27,39,51].map(y=>line(x,y,46)).join('')).join(''),
  gallery:[12,77,142].flatMap(x=>[8,43].map(y=>box(x,y,56,29))).join(''),
  breadcrumb:line(12,33,37)+'<path d="m61 29 5 4-5 4"/>'+line(80,33,47)+'<path d="m141 29 5 4-5 4"/>'+line(162,33,33),
  sidebar:box(12,6,57,69)+[17,31,45,59].map(y=>line(21,y,36)).join('')+box(80,6,118,18)+box(80,33,118,42),
  tabs:[12,61,110].map(x=>box(x,8,46,17)).join('')+'<path d="M12 29h185"/>'+line(12,49,153)+line(12,60,103),
  metrics:[12,78,144].map(x=>box(x,15,54,45)+line(x+8,25,35)+box(x+8,37,27,13)).join(''),
  timeline:'<path d="M24 12v54"/>'+[14,37,60].map(y=>`<circle cx="24" cy="${y}" r="5"/>`+line(43,y-2,137)+line(43,y+6,92)).join(''),
  calendar:box(12,6,186,68)+[22,35,48,61].map(y=>line(12,y,186)).join('')+[38,65,92,119,146,172].map(x=>`<path d="M${x} 22v52"/>`).join('')+box(70,39,17,6)+box(125,54,40,5),
  upload:box(12,7,186,65)+'<path d="M105 45V19m-12 12 12-12 12 12M78 51v9h54v-9"/>',
  profile:'<circle cx="41" cy="37" r="23"/>'+line(81,22,87)+line(81,36,109)+box(81,49,52,13),
  code:box(12,6,186,68)+[18,30,42,54,66].map((y,i)=>line(i%2?40:24,y,[82,132,106,145,64][i])).join(''),
  chat:box(12,6,129,18)+box(75,31,123,18)+box(12,56,140,18),
  progress:'<path d="M30 33h150"/>'+[30,105,180].map(x=>`<circle cx="${x}" cy="33" r="10"/>`).join('')+line(12,55,37)+line(85,55,39)+line(159,55,40)
 };
 return shapes[kind]?`<svg class="brick-wireframe ref-wireframe" viewBox="0 0 212 82" aria-hidden="true">${shapes[kind]}</svg>`:null;
}

function retainedBindingNotice(n){
 const pending=(n.components||[]).filter(b=>!bricksOf(n).some(x=>x.component===b.id&&x.region===b.slot));
 return pending.length?`<div class="callout warn"><div><strong>${pending.length} older placement(s) preserved</strong><p>These references could not be converted because a definition is missing or the content limit was reached. No binding was deleted. Review their usage in the library before generating.</p>${pending.map(b=>`<code>${esc(b.id)} · ${esc(b.slot)} · v${esc(b.version)}</code>`).join('<br>')}</div></div>`:'';
}
