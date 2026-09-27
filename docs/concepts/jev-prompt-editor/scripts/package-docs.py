"""Build JSON schema documents and an offline-readable research page.
Requires the development-only markdown_it package for report rendering.
"""
import json
from pathlib import Path
from markdown_it import MarkdownIt
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'schema').mkdir(exist_ok=True)
def write(name,value):
    (ROOT/'schema'/name).write_text(json.dumps(value,indent=2)+'\n')
def obj(properties,required=None):
    return {'type':'object','additionalProperties':False,'properties':properties,'required':list(properties) if required is None else required}
def text(maximum,minimum=0): return {'type':'string','minLength':minimum,'maxLength':maximum}
def arr(items,maximum,minimum=0): return {'type':'array','items':items,'minItems':minimum,'maxItems':maximum}
def key(): return {'type':'string','pattern':r'^[a-z][a-z0-9_]{0,47}$','not':{'enum':['constructor','prototype','__proto__']}}
option=obj({'key':key(),'description':text(4000,1)})
question=obj({'id':key(),'type':{'enum':['choice','score','noul']},'instructions':text(16000,1),
              'options':{'type':'array'},'levels':{'type':'array'},'yes':{'type':'string'},'no':{'type':'string'}})
question['allOf']=[
 {'if':{'properties':{'type':{'const':'choice'}}},'then':{'properties':{'options':arr(option,255,2)}}},
 {'if':{'properties':{'type':{'const':'score'}}},'then':{'properties':{'levels':arr(text(4000,1),10,2)}}},
 {'if':{'properties':{'type':{'const':'noul'}}},'then':{'properties':{'yes':text(4000,1),'no':text(4000,1)}}}
]
bindings=obj({**{n:{'type':'boolean'} for n in ['body','frontmatter','tasks','headings','selection','linkedNotes']},
              'maxChars':{'type':'integer','minimum':200,'maximum':30000},
              'maxReferences':{'type':'integer','minimum':0,'maximum':20},
              'fields':arr(text(100),30),'excludedFolders':arr(text(100),30)})
recipe=obj({'kind':{'const':'jev-prompt'},'schemaVersion':{'const':1},
            'id':{'type':'string','pattern':r'^[a-zA-Z0-9_-]{1,80}$'},
            'name':{**text(160,1),'pattern':r'\S'},'description':text(4000),
            'tags':arr(text(40),12),'model':{'enum':['jev-1.13.0','jev-latest','jev-preview']},
            'status':{'enum':['draft','ready','archived']},'bindings':bindings,
            'questions':arr(question,24,1),
            'policy':obj({n:{'type':'number','minimum':0,'maximum':1} for n in ['confidence','yes','no']})})
recipe.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:jev-studio:prompt:1',
               'title':'Jev Studio editable prompt recipe v1',
               '$comment':'Product-owned authoring format, not the TypeSafe API nor a companion project. Runtime validation additionally checks whitespace-only instructions, safe nested keys, duplicate IDs/option keys and policy.no < policy.yes. Only the active primitive uses its corresponding options/levels/yes/no fields.'})
write('jev-prompt.schema.json',recipe)
revision=obj({'id':{'type':'string'},'createdAt':{'type':'string'},'message':{'type':'string'},'recipe':{'$ref':'urn:jev-studio:prompt:1'}})
library=obj({'kind':{'const':'jev-prompt-library'},'schemaVersion':{'const':1},
             'prompts':arr({'$ref':'urn:jev-studio:prompt:1'},100,1),
             'revisions':{'type':'object','additionalProperties':arr(revision,50)}})
library.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:jev-studio:library:1',
                'title':'Jev Studio portable library v1',
                '$comment':'References the accompanying prompt schema by URN. Register both schemas locally. Runtime validation additionally checks prompt ID uniqueness and that revision keys and recipe IDs match existing prompts.'})
write('jev-library.schema.json',library)
wireQuestion={'oneOf':[
 obj({'type':{'const':'choice'},'instructions':text(16000,1),'criteria':{'type':'object','minProperties':2,'maxProperties':255,'propertyNames':key(),'additionalProperties':text(4000,1)}}),
 obj({'type':{'const':'score'},'instructions':text(16000,1),'criteria':arr(text(4000,1),10,2)}),
 obj({'type':{'const':'noul'},'instructions':text(16000,1),'criteria':obj({'true':text(4000,1),'false':text(4000,1)})})
]}
request=obj({'model':{'enum':['jev-1.13.0','jev-latest','jev-preview']},
             'state':{'type':'object','required':['active_note','references'],
                      'properties':{'active_note':{'type':'object'},'references':{'type':'array'}}},
             'questions':{'type':'object','minProperties':1,'maxProperties':24,'propertyNames':key(),'additionalProperties':wireQuestion}})
request.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:jev-studio:request-subset:1',
                'title':'Jev Studio emitted request subset',
                '$comment':'This is the subset emitted by this editor, NOT the complete provider API schema. The provider also accepts other state/instructions/criteria structures. No credentials or local approval flags belong in this body.'})
write('jev-request-subset.schema.json',request)
text_md=(ROOT/'docs/RESEARCH.md').read_text()
body=MarkdownIt('commonmark',{'html':False}).enable('table').render(text_md)
css='''*{box-sizing:border-box}body{margin:0;background:#f5f4f8;color:#252332;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:17px;line-height:1.75}main{max-width:980px;margin:48px auto;background:#fff;border:1px solid #dfdce8;border-radius:16px;padding:52px 64px}h1,h2,h3{line-height:1.2;letter-spacing:-.025em}h1{font-size:40px;margin:0 0 24px}h2{font-size:27px;margin-top:54px;border-top:1px solid #e5e2ed;padding-top:30px}h3{font-size:20px;margin-top:30px}p{margin:16px 0}a{color:#58419c;text-underline-offset:3px;overflow-wrap:anywhere}code{font-size:.88em;background:#f1eff6;padding:2px 4px;border-radius:4px;overflow-wrap:anywhere}pre{background:#201e2a;color:#eeebf7;border-radius:10px;padding:24px;overflow:auto}pre code{background:none;padding:0;color:inherit}table{border-collapse:collapse;width:100%;font-size:.88em;line-height:1.55}th,td{text-align:left;vertical-align:top;padding:14px 12px;border-bottom:1px solid #e1dce9}th{background:#f2eff8}li{margin:7px 0}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;color:#786990;font-weight:700;margin-bottom:20px}@media(max-width:700px){body{font-size:16px}main{margin:0;border:0;border-radius:0;padding:30px 22px}h1{font-size:31px}h2{font-size:24px}table{display:block;overflow-x:auto}}@media print{body{background:white}main{border:0;margin:0;padding:0;max-width:none}h2{break-after:avoid}a{color:inherit}}'''
html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'"><title>Jev Studio — Research and product direction</title><style>'+css+'</style></head><body><main><div class="eyebrow">Jev Studio / Research / 27 September 2026</div>'+body+'</main></body></html>'
(ROOT/'docs/RESEARCH.html').write_text(html)
print('Wrote 3 schemas and research HTML.')
