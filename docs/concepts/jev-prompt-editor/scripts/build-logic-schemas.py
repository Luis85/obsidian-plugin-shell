"""Generate closed v2 interchange schemas; runtime adds uniqueness/references/semantics."""
import copy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DRAFT='https://json-schema.org/draft/2020-12/schema'
def obj(properties, optional=()):
    return {'type':'object','additionalProperties':False,'properties':properties,'required':[k for k in properties if k not in optional]}
def text(maximum=4000, minimum=0): return {'type':'string','maxLength':maximum,'minLength':minimum}
def enum(*values): return {'enum':list(values)}
def arr(item,maximum,minimum=0):return {'type':'array','items':item,'maxItems':maximum,'minItems':minimum}
def ref(name):return {'$ref':'#/$defs/'+name}
def integer(low,high):return {'type':'integer','minimum':low,'maximum':high}
key={'type':'string','pattern':'^(?!constructor$|prototype$)[a-z][a-z0-9_]{0,47}$'}
portable={'type':'string','pattern':'^(?!constructor$|prototype$|__proto__$)[a-zA-Z0-9_-]{0,80}$'}
name={**text(160,1),'pattern':'\\S'}
defs={
 'binding':obj({'mode':enum('literal','path','add'),'value':text(16000),'amount':{'type':'number'}}),
 'field':obj({'name':key,'type':enum('string','number','boolean','object','array'),'required':{'type':'boolean'},'description':text(1000)}),
 'mapping':obj({'name':key,'binding':ref('binding')}),
}
fields=arr(ref('field'),40);mappings=arr(ref('mapping'),40)
defs['event']=obj({'id':key,'name':{**text(100,1),'pattern':'^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$'},'description':text(),'when':enum('completed','true','false','review','error'),'fields':fields,'payload':mappings})
events=arr(ref('event'),12)
base={'id':key,'name':name,'description':text(),'status':enum('draft','ready','archived'),'events':events}
defs['decision']=obj({'type':enum('continue','process','end','review'),'code':key,'processId':portable})
defs['condition']=obj({'id':key,'left':ref('binding'),'operator':enum('eq','neq','gt','gte','lt','lte','contains','exists','missing'),'right':ref('binding')})
defs['branch']=obj({'id':{**key,'not':enum('else','error','limit','success')},'name':name,'match':enum('all','any'),'conditions':arr(ref('condition'),12,1),'decision':ref('decision')})
defs['rule']=obj({**base,'mode':enum('if','while'),'inputs':fields,'branches':arr(ref('branch'),12,1),'fallback':ref('decision'),'maxIterations':integer(1,25)})
defs['process']=obj({**base,'mode':enum('transform','fixture','external'),'inputs':fields,'outputs':fields,'mappings':mappings})
defs['node']=obj({'id':key,'kind':enum('start','prompt','rule','process','end'),'name':name,'refId':portable,'x':integer(-4000,12000),'y':integer(-4000,12000),'inputs':mappings,'events':events})
defs['edge']=obj({'id':key,'source':key,'port':text(100,1),'target':key,'kind':enum('control','event')})
defs['flow']=obj({**base,'nodes':arr(ref('node'),60,1),'edges':arr(ref('edge'),120),'sampleInput':text(40000,1),'maxSteps':integer(1,200),'maxEvents':integer(1,100)})
snapshot={'rules':arr(ref('rule'),40),'processes':arr(ref('process'),40),'flows':arr(ref('flow'),20,1)}
defs['snapshot']=obj(snapshot)
defs['revision']=obj({'id':key,'name':name,'createdAt':text(80,1),'snapshot':ref('snapshot')})
logic={**obj({'kind':{'const':'jev-logic'},'schemaVersion':{'const':1},**snapshot,'revisions':arr(ref('revision'),20)}),'$schema':DRAFT,'$id':'urn:jev-studio:logic:1','title':'Jev Studio business logic v1','$defs':defs,'$comment':'No executable code. Runtime validation additionally checks uniqueness, safe paths/literal JSON, references, contracts, and bounded graph semantics.'}
prompt=json.loads((ROOT/'schema/jev-prompt.schema.json').read_text())
prompt['$id']='urn:jev-studio:prompt:2';prompt['title']='Jev Studio event-capable prompt v2';prompt['properties']['schemaVersion']={'const':2};prompt['properties']['events']=arr({'$ref':'urn:jev-studio:logic:1#/$defs/event'},12)
library=json.loads((ROOT/'schema/jev-library.schema.json').read_text())
library['$id']='urn:jev-studio:library:2';library['title']='Jev Studio linked workspace v2';library['properties']['schemaVersion']={'const':2}
recipes={'anyOf':[{'$ref':'urn:jev-studio:prompt:1'},{'$ref':'urn:jev-studio:prompt:2'}]}
library['properties']['prompts']['items']=recipes
library['properties']['revisions']['additionalProperties']['items']['properties']['recipe']=recipes
library['properties']['logic']={'$ref':'urn:jev-studio:logic:1'}
for filename,schema in [('jev-logic.schema.json',logic),('jev-prompt-v2.schema.json',prompt),('jev-workspace.schema.json',library)]:
    (ROOT/'schema'/filename).write_text(json.dumps(schema,indent=2)+'\n')
print('Three closed schemas generated; original v1 schemas retained unchanged.')
