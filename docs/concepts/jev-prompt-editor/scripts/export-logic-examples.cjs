const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={console};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'dist/app.js'),'utf8'),context);
const J=context.Jev,library=J.initialLibrary();library.schemaVersion=2;library.logic=J.initialLogic(library.prompts);
library.prompts[0].schemaVersion=2;
library.prompts[0].events=[{id:'answers_ready',name:'prompt.answers_ready',description:'Typed answers from this prompt are available.',when:'completed',fields:[J.field('answers','object')],payload:[J.binding('answers',J.reference('output.answers'))]}];
J.readLibrary(library);
for(const [name,value]of [['business-logic.workspace.json',library],['event-capable.prompt.json',library.prompts[0]]])fs.writeFileSync(path.join(root,'examples',name),JSON.stringify(value,null,2)+'\n');
console.log('Exported validated v2 workspace and event-capable prompt; synthetic data only.');
