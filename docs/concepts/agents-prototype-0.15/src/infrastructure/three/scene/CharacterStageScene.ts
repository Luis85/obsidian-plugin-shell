import * as THREE from 'three'
import type { Agent } from '../../../domain/agents/types'
import type { CharacterRegionId as CharacterEditorCategoryId } from '../../../application/ports/CharacterSelection'
import type { CharacterMotionState } from '../../../domain/characters/types'
import { disposeThreeScene } from './disposeThreeScene'
import { CharacterModelFactory, type BuiltCharacterModel } from '../models/CharacterModelFactory'
import { CharacterAnimationController } from './CharacterAnimationController'
import { CharacterTurntable } from './CharacterTurntable'

type StageMesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>
const categories=['identity','appearance','mind','skills','tools','memory','safety','network','character','evals','runtime'] as const
const isCategory=(value:unknown):value is CharacterEditorCategoryId=>typeof value==='string'&&(categories as readonly string[]).includes(value)
export type CharacterStageView='front'|'left'|'right'|'back'|'portrait'
export type CharacterRenderQuality='Balanced'|'High'|'Ultra'
const PLATFORM_TOP_Y=-.31

export class CharacterStageScene {
  private readonly scene=new THREE.Scene()
  private readonly camera=new THREE.PerspectiveCamera(31,1,.1,90)
  private readonly renderer:THREE.WebGLRenderer
  private readonly cameraTarget=new THREE.Vector3(0,2.15,0)
  private cameraDistance=9.35
  private readonly raycaster=new THREE.Raycaster()
  private readonly pointer=new THREE.Vector2()
  private readonly stageRoot=new THREE.Group()
  private readonly characterRoot=new THREE.Group()
  private readonly turntable=new CharacterTurntable(this.characterRoot)
  private readonly characterMotionRoot=new THREE.Group()
  private readonly inventoryRoot=new THREE.Group()
  private readonly fxRoot=new THREE.Group()
  private readonly environmentRoot=new THREE.Group()
  private readonly modelFactory=new CharacterModelFactory()
  private readonly clock=new THREE.Clock()
  private readonly reducedMotion=matchMedia('(prefers-reduced-motion: reduce)')
  private readonly observer:ResizeObserver
  private readonly accentMaterials:THREE.MeshStandardMaterial[]=[]
  private model?:BuiltCharacterModel
  private clickable:StageMesh[]=[]
  private activeCategory:CharacterEditorCategoryId='appearance'
  private hoverCategory?:CharacterEditorCategoryId
  private appearanceKey=''
  private inventoryKey=''
  private disposed=false
  private transitionStart=0
  private plumbob?:THREE.Mesh<THREE.OctahedronGeometry,THREE.MeshPhysicalMaterial>
  private animator?:CharacterAnimationController
  private motion:CharacterMotionState='idle'
  private portraitMode=false
  private pointerStart?:{x:number;y:number;category?:CharacterEditorCategoryId;rotation:number;moved:boolean}

  constructor(private readonly host:HTMLElement,private agent:Agent,private readonly options:{onCategorySelected(category:CharacterEditorCategoryId):void;onRotationChange?(degrees:number):void}){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false})
    this.setQuality('High')
    this.renderer.shadowMap.enabled=true
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace=THREE.SRGBColorSpace
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure=1.08
    host.appendChild(this.renderer.domElement)
    this.camera.position.set(0,2.62,this.cameraDistance)
    this.camera.lookAt(this.cameraTarget)
    this.configureStage()
    this.scene.add(this.environmentRoot,this.stageRoot)
    this.stageRoot.add(this.characterRoot,this.inventoryRoot,this.fxRoot)
    this.characterRoot.add(this.characterMotionRoot)
    this.rebuildCharacter();this.rebuildInventory();this.setActiveCategory('appearance');this.setView('front')
    this.renderer.domElement.addEventListener('pointermove',this.onPointerMove)
    this.renderer.domElement.addEventListener('pointerleave',this.onPointerLeave)
    this.renderer.domElement.addEventListener('pointerdown',this.onPointerDown)
    this.renderer.domElement.addEventListener('pointerup',this.onPointerUp)
    this.renderer.domElement.addEventListener('pointercancel',this.onPointerCancel)
    this.renderer.domElement.addEventListener('wheel',this.onWheel,{passive:false})
    this.observer=new ResizeObserver(entries=>{const entry=entries[0];if(entry)this.resize(entry.contentRect.width,entry.contentRect.height)})
    this.observer.observe(host)
    this.renderer.setAnimationLoop(this.frame)
  }

  updateAgent(agent:Agent){this.agent=agent;const {pose,...visualAppearance}=agent.appearance;const appearanceKey=JSON.stringify(visualAppearance);const inventoryKey=[...agent.skillIds,...agent.toolIds].join('|');if(appearanceKey!==this.appearanceKey)this.rebuildCharacter();this.animator?.setPose(pose);if(inventoryKey!==this.inventoryKey)this.rebuildInventory()}
  setActiveCategory(category:string){if(isCategory(category)){this.activeCategory=category;this.inventoryRoot.visible=category==='skills'||category==='tools'||category==='memory'||category==='mind';this.highlight()}}
  setMotion(motion:CharacterMotionState){this.motion=motion;this.animator?.setMotion(motion)}
  setFront(){this.setRotation(0)}
  setView(view: CharacterStageView) {
    const nextPortrait=view==='portrait'
    if(nextPortrait!==this.portraitMode){this.portraitMode=nextPortrait;this.fitCamera(nextPortrait)}
    const rotationByView:Record<CharacterStageView,number>={front:0,left:270,right:90,back:180,portrait:0}
    this.setRotation(rotationByView[view])
  }
  setQuality(quality:CharacterRenderQuality){const ratio=quality==='Ultra'?2:quality==='High'?1.55:1.15;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,ratio));this.renderer.shadowMap.type=quality==='Balanced'?THREE.PCFShadowMap:THREE.PCFSoftShadowMap}
  getRotation(){return this.turntable.getRotation()}
  setRotation(degrees:number){this.turntable.setRotation(degrees);this.notifyRotation()}
  rotate(direction:-1|1){this.turntable.rotate(direction*45);this.notifyRotation()}
  zoom(direction:-1|1){const metrics=this.model?.metrics??{height:5.2,width:3};const min=Math.max(4.6,Math.max(metrics.height*1.02,metrics.width*1.7));const max=Math.max(10.8,min*1.75);this.cameraDistance=THREE.MathUtils.clamp(this.cameraDistance+direction*.7,min,max);this.applyCamera()}
  dispose(){if(this.disposed)return;this.disposed=true;this.renderer.setAnimationLoop(null);this.observer.disconnect();this.renderer.domElement.removeEventListener('pointermove',this.onPointerMove);this.renderer.domElement.removeEventListener('pointerleave',this.onPointerLeave);this.renderer.domElement.removeEventListener('pointerdown',this.onPointerDown);this.renderer.domElement.removeEventListener('pointerup',this.onPointerUp);this.renderer.domElement.removeEventListener('pointercancel',this.onPointerCancel);this.renderer.domElement.removeEventListener('wheel',this.onWheel);this.model?.dispose();this.model=undefined;disposeThreeScene(this.scene);this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove()}

  private configureStage(){
    this.scene.background=new THREE.Color('#11132a')
    this.scene.fog=new THREE.FogExp2('#11132a',.026)
    this.scene.add(new THREE.HemisphereLight('#9aa8ff','#17121d',1.18))
    const moon=new THREE.DirectionalLight('#8ea6ff',2.15);moon.position.set(-5,8,5);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.bias=-.00025;moon.shadow.normalBias=.035;this.scene.add(moon)
    const key=new THREE.SpotLight('#ffd7ac',132,35,Math.PI*.22,.48,1.22);key.position.set(5.4,8.2,6.2);key.target.position.set(0,1.4,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0002;key.shadow.normalBias=.04;this.scene.add(key,key.target)
    const fill=new THREE.SpotLight('#755cff',58,32,Math.PI*.28,.68,1.4);fill.position.set(-6.2,5.6,4.2);fill.target.position.set(0,1.7,0);this.scene.add(fill,fill.target)
    const rim=new THREE.SpotLight('#45e1d1',64,28,Math.PI*.22,.55,1.3);rim.position.set(5.8,5.4,-6);rim.target.position.set(0,2,0);this.scene.add(rim,rim.target)

    // A small warm face fill keeps eye/mouth pixels readable without flattening the voxel faces.
    const faceFill=new THREE.PointLight('#ffe4cf',7.5,8,2);faceFill.position.set(0,3.35,4.25);this.scene.add(faceFill)

    const mat=(color:string,roughness=.82,emissive?:string)=>new THREE.MeshStandardMaterial({color,roughness,metalness:.02,emissive:emissive??'#000000',emissiveIntensity:emissive ? .55 : 0,flatShading:true,dithering:true})
    const box=(size:[number,number,number],position:[number,number,number],color:string,parent=this.environmentRoot,opts:{roughness?:number;emissive?:string;cast?:boolean;accent?:boolean}={})=>{const material=mat(color,opts.roughness??.82,opts.emissive);if(opts.accent)this.accentMaterials.push(material);const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);mesh.castShadow=opts.cast??true;mesh.receiveShadow=true;parent.add(mesh);return mesh}

    // Calm voxel workshop floor and a square presentation platform.
    box([16,.3,13],[0,-1.42,-1.2],'#1a1726',this.environmentRoot,{roughness:.92})
    for(let x=-7;x<=7;x++)for(let z=-6;z<=5;z++){if((x+z)%3===0)box([.92,.04,.92],[x*.98,-1.25,z*.98-1.2],(x+z)%2?'#282039':'#211a31',this.environmentRoot,{cast:false})}
    const platform=new THREE.Group();this.environmentRoot.add(platform)
    box([5.15,.7,4.3],[0,-.94,.25],'#29263f',platform,{roughness:.64})
    box([4.75,.18,3.95],[0,-.51,.25],'#46405b',platform,{roughness:.52})
    box([4.28,.1,3.5],[0,-.36,.25],'#5a4f73',platform,{roughness:.42})
    for(const x of[-2.18,2.18])box([.12,.18,3.66],[x,-.69,.25],this.agent.appearance.accentColor,platform,{emissive:this.agent.appearance.accentColor,cast:false,accent:true})
    for(const z of[-1.54,2.04])box([4.46,.18,.12],[0,-.69,z],this.agent.appearance.accentColor,platform,{emissive:this.agent.appearance.accentColor,cast:false,accent:true})

    // Rear wall and library/workshop furniture.
    box([14,6,.28],[0,1.5,-5.9],'#201a31',this.environmentRoot,{cast:false})
    box([4.3,4.5,.9],[-4.2,1.15,-5.15],'#241c2c')
    for(const y of[-.1,1.15,2.4])box([3.8,.18,.96],[-4.2,y,-4.62],'#4a2e2b')
    const bookColors=['#71465a','#8d5f48','#534a78','#49736f','#a66f4f','#5a4773']
    let bi=0
    for(const y of[.28,1.5,2.75])for(let i=0;i<7;i++){const h=.62+((i*7+y*10)%3)*.12;box([.28,h,.4],[-5.55+i*.43,y,-4.1],bookColors[bi++%bookColors.length]!,this.environmentRoot,{roughness:.86})}
    // Window opening / distant night blocks.
    box([4.2,3.2,.18],[3.8,1.85,-5.72],'#11152c',this.environmentRoot,{cast:false})
    for(let x=2.2;x<=5.4;x+=.8)for(let y=.65;y<=3.05;y+=.8){if((Math.round(x*10)+Math.round(y*10))%3===0)box([.18,.18,.08],[x,y,-5.58],'#5b68a8',this.environmentRoot,{emissive:'#5b68a8',cast:false})}
    box([4.3,.16,.2],[3.8,.25,-5.42],'#6e4a2c')

    // Voxel plants and crates keep the scene lively but calm.
    const plant=(x:number,z:number,scale=1)=>{box([.8*scale,.55*scale,.8*scale],[x,-.92,z],'#6a4830');for(const [dx,dy,dz,c] of [[0,.35,0,'#2e6c4f'],[-.32,.68,.1,'#3b815c'],[.32,.72,-.06,'#2f7755'],[0,1.0,.08,'#4a9163']] as const)box([.55*scale,.55*scale,.55*scale],[x+dx*scale,-.67+dy*scale,z+dz*scale],c)}
    plant(-5.2,2.4,.9);plant(5.3,2.2,.8);plant(-2.9,-4.35,.62)
    box([1.2,.82,1.15],[-4.9,-.83,.55],'#754d2e');box([.12,.84,1.18],[-4.9,-.78,.55],'#9a6b3f');box([1.35,.62,1.18],[4.6,-.94,-.05],'#6d452a')

    const lantern=(x:number,y:number,z:number)=>{const g=new THREE.Group();g.position.set(x,y,z);box([.62,.12,.62],[0,-.32,0],'#2b2330',g);box([.52,.66,.52],[0,0,0],'#7f4d2d',g,{emissive:'#ffb154',roughness:.35});box([.62,.12,.62],[0,.38,0],'#2b2330',g);const light=new THREE.PointLight('#ffb154',16,6,2);light.position.set(0,.1,0);g.add(light);this.environmentRoot.add(g)}
    lantern(-5.8,.05,-1.6);lantern(5.6,.28,1.5);lantern(4.3,3.5,-4.8)

    // Soft background block silhouettes add a Minecraft-like depth layer.
    for(const [x,y,z,s,c] of [[-6.4,2.9,-5.4,1.0,'#30462d'],[-5.5,3.4,-5.5,.8,'#385934'],[5.8,3.7,-5.3,1.0,'#30462d'],[6.5,2.8,-5.4,.8,'#42643b']] as const){box([s*1.5,s*1.1,s*.8],[x,y,z],c,this.environmentRoot,{cast:false});box([s*.55,s*1.4,s*.55],[x,y-s*1.15,z],'#4a3326',this.environmentRoot,{cast:false})}

    const particles=new Float32Array(72*3);for(let i=0;i<72;i++){const t=i*12.9898,rand=(n:number)=>((Math.sin(t+n)*43758.5453)%1+1)%1;particles[i*3]=(rand(1)-.5)*12;particles[i*3+1]=rand(2)*6-.5;particles[i*3+2]=(rand(3)-.5)*9-1.5}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(particles,3));this.fxRoot.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:'#d6ceff',size:.028,transparent:true,opacity:.28,depthWrite:false})))
    // Stable contact shadow: part of the stage, not the turntable, so it never rotates with the model.
    const contactShadow=new THREE.Mesh(
      new THREE.CircleGeometry(1.55,48),
      new THREE.MeshBasicMaterial({color:'#03040a',transparent:true,opacity:.28,depthWrite:false})
    )
    contactShadow.rotation.x=-Math.PI/2;contactShadow.scale.set(1.25,.72,1);contactShadow.position.set(0,.018,.12);contactShadow.renderOrder=2;this.stageRoot.add(contactShadow)

    this.stageRoot.position.y=PLATFORM_TOP_Y
  }

  private rebuildCharacter(){
    this.model?.dispose();this.model=undefined;
    while(this.characterMotionRoot.children.length){const child=this.characterMotionRoot.children[0]!;child.removeFromParent();disposeThreeScene(child)}
    this.plumbob=undefined
    const preservedRotation=this.getRotation();this.model=this.modelFactory.build(this.agent.appearance);this.characterMotionRoot.add(this.model.root);this.clickable=this.model.clickable
    this.animator=new CharacterAnimationController(this.model.rig);this.animator.setPose(this.agent.appearance.pose);this.animator.setMotion(this.motion)
    this.setRotation(preservedRotation);this.fitCamera(this.portraitMode,true)
    const plumbobMaterial=new THREE.MeshPhysicalMaterial({color:this.agent.appearance.accentColor,emissive:this.agent.appearance.accentColor,emissiveIntensity:.9,roughness:.28,metalness:.04,transparent:true,opacity:.96,clearcoat:.25})
    const plumbobSize=THREE.MathUtils.clamp(this.model.metrics.width*.1,.24,.36);this.plumbob=new THREE.Mesh(new THREE.OctahedronGeometry(plumbobSize,0),plumbobMaterial);this.plumbob.position.set(0,this.model.metrics.height+.58,0);this.plumbob.castShadow=true;this.characterMotionRoot.add(this.plumbob)
    this.accentMaterials.forEach(material=>{material.color.set(this.agent.appearance.accentColor);material.emissive.set(this.agent.appearance.accentColor)});this.characterRoot.scale.setScalar(.96);this.transitionStart=this.clock.getElapsedTime();const {pose:_,...visualAppearance}=this.agent.appearance;this.appearanceKey=JSON.stringify(visualAppearance);this.highlight()
  }

  private rebuildInventory(){
    while(this.inventoryRoot.children.length){const child=this.inventoryRoot.children[0]!;child.removeFromParent();disposeThreeScene(child)}
    const props=[
      {category:'skills' as const,color:'#4ee6c0',kind:'gem'},
      {category:'memory' as const,color:'#b49cff',kind:'book'},
      {category:'skills' as const,color:'#75b8ff',kind:'laptop'},
      {category:'tools' as const,color:'#ffb55c',kind:'clipboard'}
    ]
    props.forEach((entry,index)=>{const g=new THREE.Group();g.userData.category=entry.category;g.userData.index=index;const material=new THREE.MeshStandardMaterial({color:entry.color,roughness:.58,metalness:.04,emissive:entry.color,emissiveIntensity:.18})
      if(entry.kind==='gem'){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.28,0),material);gem.castShadow=true;g.add(gem)}
      if(entry.kind==='book'){const l=new THREE.Mesh(new THREE.BoxGeometry(.42,.5,.08),material),r=l.clone();l.position.x=-.19;r.position.x=.19;l.rotation.y=.18;r.rotation.y=-.18;l.castShadow=r.castShadow=true;g.add(l,r)}
      if(entry.kind==='laptop'){const base=new THREE.Mesh(new THREE.BoxGeometry(.62,.08,.46),material),screen=new THREE.Mesh(new THREE.BoxGeometry(.58,.42,.06),new THREE.MeshStandardMaterial({color:'#303455',emissive:entry.color,emissiveIntensity:.28,roughness:.5}));screen.position.set(0,.24,-.19);screen.rotation.x=-.16;base.castShadow=screen.castShadow=true;g.add(base,screen)}
      if(entry.kind==='clipboard'){const board=new THREE.Mesh(new THREE.BoxGeometry(.42,.58,.07),material),clip=new THREE.Mesh(new THREE.BoxGeometry(.2,.08,.09),new THREE.MeshStandardMaterial({color:'#f3d7a1',roughness:.72}));clip.position.y=.31;board.castShadow=true;g.add(board,clip)}
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.4,.018,6,28),new THREE.MeshBasicMaterial({color:entry.color,transparent:true,opacity:.22}));ring.rotation.x=Math.PI/2;g.add(ring);this.inventoryRoot.add(g)})
    this.inventoryKey=[...this.agent.skillIds,...this.agent.toolIds].join('|')
  }

  private frame=()=>{
    if(this.disposed||document.hidden)return
    const delta=Math.min(.05,this.clock.getDelta()),t=this.clock.elapsedTime,idle=this.agent.appearance.idleStyle
    const transition=Math.min(1,(t-this.transitionStart)/.28);this.characterRoot.scale.setScalar(THREE.MathUtils.lerp(.96,1,1-Math.pow(1-transition,3)))
    this.animator?.update(t,delta,idle,this.reducedMotion.matches)
    if(!this.reducedMotion.matches&&this.model){
      const amplitude=this.motion==='celebrate'?.055:idle==='playful' ? .038 : idle==='focused' ? .008 : .018,speed=this.motion==='celebrate'?3.2:idle==='confident' ? .9 : idle==='playful' ? 2.05 : 1.35
      this.characterMotionRoot.position.y=Math.sin(t*speed)*amplitude;this.characterMotionRoot.rotation.y=0
      if(this.plumbob){this.plumbob.rotation.y=t*.65;this.plumbob.position.y=(this.model.metrics.height+.58)+Math.sin(t*1.5)*.07}
      const h=this.model.metrics.height,w=this.model.metrics.width;const side=Math.max(1.45,w*.78);const anchors=[[-side,h*.62,.35],[side,h*.66,.05],[-side*1.05,h*.34,.42],[side*1.02,h*.31,.45]]
      if(this.inventoryRoot.visible)this.inventoryRoot.children.forEach((object:THREE.Object3D,index:number)=>{const base=anchors[index]??[0,2,0],phase=t*.42+index*.9;object.position.set(base[0]+Math.cos(phase)*.08,base[1]+Math.sin(phase*1.2)*.08,base[2]+Math.sin(phase)*.08);object.rotation.y=Math.sin(phase*.8)*.12;object.rotation.x=Math.sin(phase*.55)*.04})
      this.fxRoot.rotation.y=t*.018
    }
    this.renderer.render(this.scene,this.camera)
  }

  private fitCamera(portrait=false,preserveDistance=false){
    const metrics=this.model?.metrics??{width:3,height:5.2,depth:2,centerY:2.6}
    const targetY=PLATFORM_TOP_Y+metrics.height*(portrait?.68:.48)
    this.cameraTarget.set(0,targetY,0)
    if(!preserveDistance){
      this.cameraDistance=THREE.MathUtils.clamp(Math.max(metrics.height*(portrait?1.22:1.55),metrics.width*2.25,portrait?5.8:7.4),portrait?5.6:6.8,11.8)
    } else {
      const min=Math.max(4.6,Math.max(metrics.height*1.02,metrics.width*1.7))
      const max=Math.max(10.8,min*1.75)
      this.cameraDistance=THREE.MathUtils.clamp(this.cameraDistance,min,max)
    }
    this.applyCamera(portrait)
  }
  private applyCamera(portrait=this.portraitMode){
    const metrics=this.model?.metrics??{height:5.2}
    this.camera.position.set(0,this.cameraTarget.y+metrics.height*(portrait?.12:.08),this.cameraDistance)
    this.camera.lookAt(this.cameraTarget)
    this.camera.updateMatrixWorld(true)
  }
  private resize(width:number,height:number){if(width<=0||height<=0)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix()}
  private pick(event:PointerEvent){this.characterRoot.updateWorldMatrix(true,true);const bounds=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-((event.clientY-bounds.top)/bounds.height*2-1));this.raycaster.setFromCamera(this.pointer,this.camera);const category=this.raycaster.intersectObjects(this.clickable,false)[0]?.object.userData.category;return isCategory(category)?category:undefined}
  private notifyRotation(){this.options.onRotationChange?.(this.getRotation())}
  private onPointerMove=(event:PointerEvent)=>{if(this.pointerStart){const dx=event.clientX-this.pointerStart.x,dy=event.clientY-this.pointerStart.y;if(Math.hypot(dx,dy)>5)this.pointerStart.moved=true;if(this.pointerStart.moved){this.setRotation(this.pointerStart.rotation+dx*.48);this.renderer.domElement.style.cursor='grabbing';return}}this.hoverCategory=this.pick(event);this.highlight();this.renderer.domElement.style.cursor=this.hoverCategory?'pointer':'grab'}
  private onPointerLeave=()=>{this.hoverCategory=undefined;this.highlight();if(!this.pointerStart)this.renderer.domElement.style.cursor='grab'}
  private onPointerDown=(event:PointerEvent)=>{if(event.button!==0)return;this.pointerStart={x:event.clientX,y:event.clientY,category:this.pick(event),rotation:this.getRotation(),moved:false};this.renderer.domElement.setPointerCapture?.(event.pointerId);this.renderer.domElement.style.cursor='grabbing'}
  private onPointerUp=(event:PointerEvent)=>{if(!this.pointerStart)return;const start=this.pointerStart;this.pointerStart=undefined;if(!start.moved&&start.category)this.options.onCategorySelected(start.category);this.renderer.domElement.releasePointerCapture?.(event.pointerId);this.renderer.domElement.style.cursor=this.hoverCategory?'pointer':'grab'}
  private onPointerCancel=()=>{this.pointerStart=undefined;this.renderer.domElement.style.cursor='grab'}
  private onWheel=(event:WheelEvent)=>{event.preventDefault();this.zoom(event.deltaY>0?1:-1)}
  private highlight(){if(!this.model)return;for(const [category,meshes] of this.model.byCategory)for(const mesh of meshes){const material=mesh.material;material.emissive.copy(mesh.userData.base);material.emissiveIntensity=mesh.userData.intensity??0;if(category===this.activeCategory||category===this.hoverCategory){material.emissive.lerp(new THREE.Color(category===this.activeCategory?'#9d72ff':'#54e1c7'),category===this.activeCategory ? .5 : .34);material.emissiveIntensity=category===this.activeCategory ? .42 : .22}}}
}
