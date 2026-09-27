"""Check shipped examples against their local schemas and reject wrong envelopes."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
ROOT=Path(__file__).resolve().parents[1]
schemas=[json.loads(p.read_text()) for p in sorted((ROOT/'schema').glob('*.schema.json'))]
registry=Registry().with_resources((s['$id'],Resource.from_contents(s)) for s in schemas)
validators={s['$id']:Draft202012Validator(s,registry=registry) for s in schemas}
checks=[]
for file,urn in [('inbox-routing.prompt.json','urn:jev-studio:prompt:1'),
                 ('edited-roundtrip.prompt.json','urn:jev-studio:prompt:1'),
                 ('starter-library.json','urn:jev-studio:library:1'),
                 ('business-logic.workspace.json','urn:jev-studio:library:2'),
                 ('event-capable.prompt.json','urn:jev-studio:prompt:2'),
                 ('inbox-routing.demo-request.json','urn:jev-studio:request-subset:1')]:
    validators[urn].validate(json.loads((ROOT/'examples'/file).read_text()))
    checks.append({'name':file+' validates','status':'passed'})
for s in schemas:
    Draft202012Validator.check_schema(s)
    checks.append({'name':s['title']+' is a valid schema','status':'passed'})
request=json.loads((ROOT/'examples/inbox-routing.demo-request.json').read_text())
assert not validators['urn:jev-studio:prompt:1'].is_valid(request)
checks.append({'name':'API request is not accepted as editable recipe','status':'passed'})
recipe=json.loads((ROOT/'examples/inbox-routing.prompt.json').read_text())
recipe['schemaVersion']=2
assert not validators['urn:jev-studio:prompt:1'].is_valid(recipe)
checks.append({'name':'Future recipe version rejected','status':'passed'})
workspace=json.loads((ROOT/'examples/business-logic.workspace.json').read_text())
for name,mutate in [
    ('Unknown workspace fields rejected',lambda v:v.update(extra=True)),
    ('Future workspace version rejected',lambda v:v.update(schemaVersion=3)),
    ('Unknown executable rule fields rejected',lambda v:v['logic']['rules'][0].update(script='no code')),
    ('Excessive step limit rejected',lambda v:v['logic']['flows'][0].update(maxSteps=201)),
    ('Invalid event trigger rejected',lambda v:v['prompts'][0]['events'][0].update(when='every_second')),
]:
    candidate=json.loads(json.dumps(workspace));mutate(candidate)
    assert not validators['urn:jev-studio:library:2'].is_valid(candidate),name
    checks.append({'name':name,'status':'passed'})
assert not validators['urn:jev-studio:library:1'].is_valid(workspace)
checks.append({'name':'Older schema fails closed on linked workspace','status':'passed'})
(ROOT/'evidence/schema.json').write_text(json.dumps({'passed':len(checks),'checks':checks},indent=2)+'\n')
print(str(len(checks))+' schema/example checks passed.')
