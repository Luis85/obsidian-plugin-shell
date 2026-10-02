namespace Jev {
  const blockedSegments = new Set(['__proto__','constructor','prototype']);
  export function validPath(value: string): boolean {
    const segments=value.split('.');
    return value.length<=300 && segments.length<=20 && segments.every(p=>/^[a-zA-Z0-9_-]+$/.test(p)&&!blockedSegments.has(p));
  }
  export function readPath(root: unknown, path: string, optional=false): unknown {
    if (!validPath(path)) throw new Error('Unsafe or invalid data path: '+path);
    let current: unknown=root;
    for (const segment of path.split('.')) {
      if ((!record(current)&&!Array.isArray(current)) || !Object.prototype.hasOwnProperty.call(current,segment)) {
        if (optional) return undefined;
        throw new Error('Missing input at '+path+'. Bind it explicitly or use an exists condition.');
      }
      current=Reflect.get(current,segment);
    }
    return current;
  }
  export function resolveValue(value: ValueBinding, context: Record<string, unknown>, optional=false): unknown {
    if (value.mode==='literal') return parseJson(value.value);
    const result=readPath(context,value.value,optional);
    if (value.mode==='path') return result;
    if (value.mode!=='add'||typeof result!=='number'||!Number.isFinite(result)||!Number.isFinite(value.amount)) throw new Error('Add requires a finite numeric source and increment.');
    const added=result+value.amount;
    if (!Number.isFinite(added)) throw new Error('Numeric result is not finite.');
    return added;
  }
  export function resolveBindings(values: NamedBinding[], context: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string,unknown>={};
    for (const row of values) {
      if (!safeKey(row.name) || Object.prototype.hasOwnProperty.call(result,row.name)) throw new Error('Duplicate or unsafe binding name: '+row.name);
      const value=resolveValue(row.binding,context);
      if (value===undefined) throw new Error('Binding '+row.name+' has no value.');
      result[row.name]=clone(value);
    }
    return result;
  }
  export function matchesType(value: unknown, type: FieldType): boolean {
    if (type==='number') return typeof value==='number'&&Number.isFinite(value);
    if (type==='array') return Array.isArray(value);
    if (type==='object') return record(value);
    return typeof value===type;
  }
  export function checkContract(fields: ContractField[], value: Record<string,unknown>, label: string): void {
    assertSafe(value);
    for (const item of fields) {
      const present=Object.prototype.hasOwnProperty.call(value,item.name);
      if (item.required&&!present) throw new Error(label+'.'+item.name+': required '+item.type+' is missing.');
      if (present&&!matchesType(value[item.name],item.type)) throw new Error(label+'.'+item.name+': expected '+item.type+'. No implicit coercion.');
    }
    for (const name of Object.keys(value)) if (!fields.some(f=>f.name===name)) throw new Error(label+'.'+name+': undeclared field.');
  }
  export function evaluateCondition(condition: Condition, context: Record<string,unknown>): boolean {
    const exists=condition.operator==='exists'||condition.operator==='missing';
    const left=resolveValue(condition.left,context,exists);
    if (exists) return condition.operator==='exists'?left!==undefined:left===undefined;
    const right=resolveValue(condition.right,context);
    if (condition.operator==='eq'||condition.operator==='neq') {
      if ((record(left)||Array.isArray(left))||(record(right)||Array.isArray(right))) throw new Error('Equality compares scalar values; select a specific field.');
      if (typeof left!==typeof right) throw new Error('Equality operands must have the same type.');
      return condition.operator==='eq'?left===right:left!==right;
    }
    if (condition.operator==='contains') {
      if (typeof left==='string'&&typeof right==='string') return left.includes(right);
      if (Array.isArray(left)&&['string','number','boolean'].includes(typeof right)) return left.includes(right);
      throw new Error('Contains needs text/text or an array/scalar.');
    }
    if (typeof left!=='number'||typeof right!=='number'||!Number.isFinite(left)||!Number.isFinite(right)) throw new Error('Ordered comparisons require two finite numbers.');
    switch(condition.operator) {
      case 'gt': return left>right; case 'gte': return left>=right;
      case 'lt': return left<right; case 'lte': return left<=right;
      default: throw new Error('Unknown condition operator.');
    }
  }
  /** Ordered, short-circuit rules. Missing data fails closed; it never selects ELSE. */
  export function evaluateRule(rule: BusinessRule, input: Record<string,unknown>, context: Record<string,unknown>, completedIterations=0): RuleEvaluation {
    checkContract(rule.inputs,input,'Rule input');
    const conditions: TraceEntry['conditions']=[];
    for (const branch of rule.branches) {
      const matches:boolean[]=[];
      for (const condition of branch.conditions) {
        const result=evaluateCondition(condition,{...context,input});matches.push(result);
        if (branch.match==='all'&&!result || branch.match==='any'&&result) break;
      }
      const matched=branch.match==='all'?matches.every(Boolean):matches.some(Boolean);
      conditions.push({branch:branch.name,matches,matched});
      if (matched) {
        if (rule.mode==='while'&&completedIterations>=rule.maxIterations) return {decision:decision('review','loop_limit'),port:'limit',conditions,iteration:completedIterations};
        return {decision:clone(branch.decision),port:branch.id,conditions,iteration:completedIterations+(rule.mode==='while'?1:0)};
      }
    }
    return {decision:clone(rule.fallback),port:'else',conditions,iteration:completedIterations};
  }
}
