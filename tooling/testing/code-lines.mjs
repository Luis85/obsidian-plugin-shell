/** Dependency-free lexical line count. This measures code, not syntax validity. */
function codeLineSet(source, path) {
  const text = source.replace(/\r\n?/g, '\n');
  const supportsJsx = /\.[jt]sx$/i.test(path);
  const lines = new Set(); let index = 0; let line = 0;
  function take(end, code = true) {
    while (index < end) {
      const char = text[index++];
      if (char === '\n') line++;
      else if (code && !/\s/.test(char)) lines.add(line);
    }
  }
  function comment(close) {
    const end = text.indexOf(close, index + 2);
    take(end === -1 ? text.length : end + close.length, false);
  }
  function lineComment() {
    const end = text.slice(index).search(/[\n\u2028\u2029]/);
    take(end === -1 ? text.length : index + end, false);
  }
  function quoted(quote) {
    take(index + 1);
    while (index < text.length) {
      const char = text[index];
      if (char === '\\') take(Math.min(index + 2, text.length));
      else { take(index + 1); if (char === quote) break; }
    }
  }
  function htmlQuoted(quote) {
    const end = text.indexOf(quote, index + 1);
    take(end === -1 ? text.length : end + 1);
  }
  function directiveValue(quote) {
    const end = text.indexOf(quote, index); const boundary = end === -1 ? text.length : end;
    const raw = text.slice(index, boundary); let uncertain = false;
    const entities = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' };
    const decoded = raw.replace(/&([^;\s]+);/g, (entity, name) => {
      let value = entities[name];
      if (name.startsWith('#')) {
        const number = /^#x[\da-f]+$/i.test(name) ? Number.parseInt(name.slice(2), 16) : /^#\d+$/.test(name) ? Number(name.slice(1)) : NaN;
        if (Number.isInteger(number) && number > 0 && number <= 0x10ffff) value = String.fromCodePoint(number);
      }
      // Unknown entities or encoded newlines cannot safely retain original-line
      // mapping. Count their bounded attribute as code rather than drop content.
      if (!value || /[\r\n\u2028\u2029]/.test(value)) { uncertain = true; return entity; }
      return value;
    });
    if (/&(?:#|[a-z])/i.test(decoded)) uncertain = true;
    if (uncertain) take(boundary);
    else {
      const startLine = line; const active = codeLineSet(decoded, 'attribute.ts');
      take(boundary, false); for (const number of active) lines.add(startLine + number);
    }
    if (index < text.length) take(index + 1);
  }
  function regexEnd() {
    let cursor = index + 1; let characterClass = false;
    while (cursor < text.length && !/[\n\u2028\u2029]/.test(text[cursor])) {
      const char = text[cursor++];
      if (char === '\\') cursor++;
      else if (char === '[') characterClass = true;
      else if (char === ']') characterClass = false;
      else if (char === '/' && !characterClass) {
        while (/[a-z]/i.test(text[cursor] ?? '') && cursor < text.length) cursor++;
        return cursor;
      }
    }
    return index + 1;
  }
  function template() {
    take(index + 1);
    while (index < text.length) {
      if (text[index] === '\\') take(Math.min(index + 2, text.length));
      else if (text[index] === '`') { take(index + 1); return; }
      else if (text.startsWith('${', index)) { take(index + 2); javascript('}'); }
      else take(index + 1);
    }
  }
  const expressionWords = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'yield', 'await', 'instanceof', 'in', 'of', 'else', 'do']);
  const controlWords = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);
  function javascript(stop = '', rawTag = '') {
    let expression = true; let previous = ''; const parentheses = []; const braces = [];
    while (index < text.length) {
      const char = text[index];
      if (rawTag && new RegExp(`^</${rawTag}\\s*>`, 'i').test(text.slice(index))) return;
      if (stop && braces.length === 0 && text.startsWith(stop, index)) { take(index + stop.length); return; }
      if (/\s/.test(char)) { take(index + 1, false); continue; }
      if (text.startsWith('//', index)) { lineComment(); continue; }
      if (text.startsWith('/*', index)) { comment('*/'); continue; }
      if (index === 0 && text.startsWith('#!', index)) { lineComment(); continue; }
      if (char === '"' || char === "'") { quoted(char); expression = false; previous = 'value'; continue; }
      if (char === '`') { template(); expression = false; previous = 'value'; continue; }
      if (char === '/') {
        const end = regexEnd(); const candidate = text.slice(index, end);
        // ASI can start a regex where a token-only expression heuristic cannot
        // prove it. Never let a same-line regex's comment bytes hide later code.
        if (expression || candidate.includes('/*') || candidate.includes('//')) { take(end); expression = false; previous = 'value'; continue; }
      }
      if (supportsJsx && char === '<' && /^<(?:[A-Za-z][\w.:-]*(?:[\s/>])|>)/.test(text.slice(index))) { jsx(); expression = false; previous = 'value'; continue; }
      if (/[\w$]/.test(char) || char.charCodeAt(0) > 127) {
        const start = index;
        while (index < text.length && (/[\w$]/.test(text[index]) || text.charCodeAt(index) > 127)) take(index + 1);
        const word = text.slice(start, index); expression = previous !== '.' && expressionWords.has(word); previous = word; continue;
      }
      if (char === '(') { parentheses.push(controlWords.has(previous)); expression = true; }
      else if (char === ')') expression = parentheses.pop() === true;
      else if (char === '{') { braces.push(!expression || previous === ')' || previous === '=>' || previous === 'else' || previous === 'try' || previous === 'finally' || !previous ? 'block' : 'object'); expression = true; }
      else if (char === '}') expression = braces.pop() !== 'object';
      else if (char === ']') expression = false;
      else if (text.startsWith('++', index) || text.startsWith('--', index)) { take(index + 2); previous = 'value'; continue; }
      else if (text.startsWith('=>', index)) { take(index + 2); previous = '=>'; expression = true; continue; }
      else expression = char !== '.';
      take(index + 1); previous = char;
    }
  }
  function css(rawTag = '') {
    while (index < text.length) {
      if (rawTag && /^<\/style\s*>/i.test(text.slice(index))) return;
      const url = !/[\w-]/.test(text[index - 1] ?? '') && /^url\(\s*/i.exec(text.slice(index));
      if (url) {
        take(index + url[0].length);
        if (text[index] === '"' || text[index] === "'") quoted(text[index]);
        while (index < text.length && text[index] !== ')') take(Math.min(index + (text[index] === '\\' ? 2 : 1), text.length));
        if (text[index] === ')') take(index + 1);
      }
      else if (text.startsWith('/*', index)) comment('*/');
      else if (text[index] === '"' || text[index] === "'") quoted(text[index]);
      else take(index + 1);
    }
  }
  function jsx() {
    let depth = 0;
    while (index < text.length) {
      if (text[index] === '{') { take(index + 1); javascript('}'); continue; }
      if (text[index] !== '<') { take(index + 1); continue; }
      const start = index; const closing = text.startsWith('</', index);
      take(index + 1);
      while (index < text.length && text[index] !== '>') {
        if (text[index] === '"' || text[index] === "'") htmlQuoted(text[index]);
        else if (text[index] === '{') { take(index + 1); javascript('}'); }
        else take(index + 1);
      }
      if (index < text.length) take(index + 1);
      if (closing) depth--; else if (!/\/\s*>$/.test(text.slice(start, index))) depth++;
      if (depth === 0) return;
    }
  }
  function markup() {
    const elements = [];
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    while (index < text.length) {
      if (text.startsWith('<!--', index)) { comment('-->'); continue; }
      if (!elements.at(-1)?.pre && text.startsWith('{{', index)) { take(index + 2); javascript('}}'); continue; }
      if (text[index] !== '<') { take(index + 1); continue; }
      const start = index;
      const tag = /^<\s*(\/?)\s*([\w:-]+)/i.exec(text.slice(index));
      const tagName = tag?.[2].toLowerCase();
      const opening = /^<(?:[^>"']|"[^"]*"|'[^']*')*>/.exec(text.slice(index))?.[0] ?? '';
      const pre = elements.at(-1)?.pre || /\sv-pre(?=[\s=>/])/.test(opening.replace(/"[^"]*"|'[^']*'/g, '""'));
      take(index + 1);
      while (index < text.length && text[index] !== '>') {
        const directive = !pre && /\s/.test(text[index - 1] ?? '') ? /^((?:[:@]|v-)[^\s=]+)\s*=\s*(['"])/.exec(text.slice(index)) : null;
        if (directive) { take(index + directive[0].length); directiveValue(directive[2]); }
        else if (text[index] === '"' || text[index] === "'") htmlQuoted(text[index]);
        else take(index + 1);
      }
      if (index < text.length) take(index + 1);
      if (!tag) continue;
      if (tag[1]) { const matched = elements.findLastIndex(element => element.name === tagName); if (matched !== -1) elements.length = matched; continue; }
      if (/\/\s*>$/.test(text.slice(start, index)) || voidTags.has(tagName)) continue;
      elements.push({ name: tagName, pre });
      if (tagName === 'script') javascript('', 'script');
      else if (tagName === 'style') css('style');
      else if (tagName === 'textarea' || tagName === 'title') {
        while (index < text.length && !new RegExp(`^</${tagName}\\s*>`, 'i').test(text.slice(index))) {
          if (!pre && text.startsWith('{{', index)) { take(index + 2); javascript('}}'); }
          else take(index + 1);
        }
      }
    }
  }
  if (/\.(vue|html)$/i.test(path)) markup();
  else if (/\.css$/i.test(path)) css();
  else javascript();
  return lines;
}
export function codeLines(source, path) { return codeLineSet(source, path).size; }
