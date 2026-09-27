namespace Jev {
  const unit = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  export function validateResponse(recipe: Recipe, value: unknown): ResponseBody {
    assertSafe(value);
    if (!record(value) || typeof value.model !== 'string' || !record(value.answers) || !record(value.usage)) throw new Error('Expected a Jev response with model, answers, and usage.');
    if (recipe.model === 'jev-1.13.0' && value.model !== recipe.model) throw new Error('The response model does not match the pinned recipe model.');
    for (const k of ['input_tokens','output_tokens']) if (!Number.isInteger(value.usage[k]) || Number(value.usage[k]) < 0) throw new Error('Response usage must contain non-negative integer token counts.');
    if (Object.keys(value.answers).length !== recipe.questions.length) throw new Error('Response question IDs do not match this recipe.');
    for (const q of recipe.questions) {
      const a = value.answers[q.id];
      if (!record(a) || a.type !== q.type) throw new Error(q.id+': missing answer or mismatched type.');
      if (q.type === 'noul') { if (!unit(a.noul) || 'confidence' in a) throw new Error(q.id+': Noul needs a probability from 0 to 1, not confidence.'); continue; }
      if (!unit(a.confidence) || !record(a.probabilities)) throw new Error(q.id+': expected confidence and probabilities.');
      const keys = q.type === 'choice' ? q.options.map(o=>o.key) : q.levels.map((_,i)=>String(i));
      const probabilities = a.probabilities;
      if (Object.keys(probabilities).length !== keys.length || keys.some(k => !unit(probabilities[k]))) throw new Error(q.id+': probability keys must match every option or level.');
      if (Math.abs(keys.reduce((sum,k)=>sum+Number(probabilities[k]),0)-1)>0.0001) throw new Error(q.id+': probabilities must sum to 1.');
      if (q.type === 'choice' && (typeof a.choice !== 'string' || !keys.includes(a.choice) || Number(probabilities[a.choice]) < Math.max(...keys.map(k=>Number(probabilities[k])))-0.0001)) throw new Error(q.id+': choice must be a highest-probability option.');
      if (q.type === 'score') {
        const mean = keys.reduce((sum,k)=>sum+Number(k)*Number(probabilities[k]),0);
        if (typeof a.score !== 'number' || Math.abs(a.score-mean)>0.02 || !record(a.legend) || keys.some(k=>typeof (a.legend as Record<string,unknown>)[k]!=='string')) throw new Error(q.id+': score must match the weighted rubric value and include its legend.');
      }
    }
    return clone(value) as unknown as ResponseBody;
  }
  export function evaluatePolicy(recipe: Recipe, response: ResponseBody): Decision[] {
    return recipe.questions.map(q => {
      const a = response.answers[q.id];
      if (!a || a.type !== q.type) return {id:q.id,type:q.type,value:'Missing',verdict:'invalid',detail:'No matching typed answer.',probabilities:[]};
      if (q.type === 'noul') {
        const p = a.noul ?? 0.5; const yes = p >= recipe.policy.yes; const no = p <= recipe.policy.no;
        return {id:q.id,type:q.type,value:yes?'Yes':no?'No':'Uncertain',verdict:yes||no?'suggestion':'review',detail:'P(yes) '+(p*100).toFixed(1)+'% · '+(yes||no?'outside':'inside')+' the review band',probabilities:[{label:'yes',value:p},{label:'no',value:1-p}]};
      }
      const confidence = a.confidence ?? 0;
      const catchAll = q.type === 'choice' && ['other','unknown','not_stated'].includes(a.choice||'');
      return {id:q.id,type:q.type,value:q.type==='choice'?a.choice||'Missing':(a.score??0).toFixed(2)+' / '+(q.levels.length-1),verdict:confidence>=recipe.policy.confidence&&!catchAll?'suggestion':'review',detail:catchAll?'Fallback option always needs review.':'Reported confidence '+(confidence*100).toFixed(1)+'% · threshold '+(recipe.policy.confidence*100).toFixed(0)+'%',confidence,probabilities:Object.entries(a.probabilities||{}).map(([label,value])=>({label,value}))};
    });
  }
  /** This builds illustrative responses; it never evaluates note semantics or calls a model. */
  export function fixtureResponse(recipe: Recipe, scenario: string): ResponseBody {
    const answers: Record<string, Answer> = {}; const ambiguous = scenario === 'ambiguous';
    for (const q of recipe.questions) {
      if (q.type === 'noul') { answers[q.id]={type:'noul',noul:ambiguous?0.52:scenario==='negative'?0.06:0.94}; continue; }
      const keys = q.type==='choice'?q.options.map(o=>o.key):q.levels.map((_,i)=>String(i));
      const target = scenario==='negative'?keys.length-1:q.type==='score'?Math.min(1,keys.length-1):0;
      const top = ambiguous?1/keys.length:0.94;
      const probabilities = Object.fromEntries(keys.map((k,i)=>[k,i===target?top:ambiguous?top:0.06/(keys.length-1)]));
      const base = {type:q.type,confidence:ambiguous?0.12:0.91,probabilities};
      answers[q.id] = q.type==='choice'?{...base,choice:keys[target]}:{...base,score:keys.reduce((n,k)=>n+Number(k)*probabilities[k],0),legend:Object.fromEntries(q.levels.map((l,i)=>[String(i),l]))};
    }
    return {model:recipe.model==='jev-1.13.0'?recipe.model:'jev-1.13.0',answers,usage:{input_tokens:0,output_tokens:0}};
  }
}
