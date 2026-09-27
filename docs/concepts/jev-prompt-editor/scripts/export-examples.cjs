// Generate portable examples from the same compiler used by the HTML.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'dist/app.js'), 'utf8'), context);
const J = context.Jev;
const recipe = J.makeRecipe();
const snapshot = J.compileSnapshot(recipe, J.demoVault());
const write = (name, value) => fs.writeFileSync(path.join(root, 'examples', name), JSON.stringify(value, null, 2) + '\n');
write('inbox-routing.prompt.json', recipe);
write('starter-library.json', J.initialLibrary());
write('inbox-routing.demo-request.json', J.compileRequest(recipe, snapshot));
write('inbox-routing.synthetic-response.json', J.fixtureResponse(recipe, 'clear'));
console.log('Exported recipe, library, demo request, and synthetic response. No provider call occurred.');
