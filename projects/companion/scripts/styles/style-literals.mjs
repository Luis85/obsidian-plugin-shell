/** Raw colour-literal scanner for handwritten CSS, SFC style blocks and simple inline template styles. No filesystem access. */
const NAMED = ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse '
  + 'chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta '
  + 'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet '
  + 'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green '
  + 'greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan '
  + 'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey '
  + 'lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen '
  + 'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive '
  + 'olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple '
  + 'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow '
  + 'springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' ');
const named = new Set(NAMED);
const colourProperty = /(?:color|background|border|outline|fill|stroke|shadow|decoration|filter|gradient|mask)/i;
const blank = (text) => text.replace(/[^\n]/g, ' ');
const mask = (text, pattern) => text.replace(pattern, blank);
/** Replace comments and string contents with spaces so offsets, lines and columns stay exact. */
function maskCommentsAndStrings(text) {
  let out = '', index = 0;
  while (index < text.length) {
    const rest = text.slice(index, index + 2);
    const quote = text[index] === '"' || text[index] === "'" ? text[index] : '';
    if (rest === '/*') {
      const end = text.indexOf('*/', index + 2), stop = end < 0 ? text.length : end + 2;
      out += blank(text.slice(index, stop)); index = stop;
    } else if (quote) {
      let stop = index + 1;
      while (stop < text.length && text[stop] !== quote && text[stop] !== '\n') stop += text[stop] === '\\' ? 2 : 1;
      out += quote + blank(text.slice(index + 1, stop)) + (text[stop] === quote ? quote : ''); index = Math.min(stop + 1, text.length);
    } else { out += text[index]; index += 1; }
  }
  return out;
}
function callEnd(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')' && (depth -= 1) === 0) return i + 1;
  }
  return text.length;
}
/** A colour function is raw unless it is built from var() references with at most two literal channels. */
function rawFunction(call) {
  const args = call.slice(call.indexOf('(') + 1, -1).replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ' ');
  if (!/var\(/.test(call)) return true;
  return args.split(/[\s,/]+/).filter((token) => /^[-+.\d]/.test(token)).length >= 3;
}
/** Find literals in one declaration value. `value` is already comment/string/url/var-name masked. */
function valueLiterals(value, property) {
  const found = [], masked = [...value];
  const take = (index, literal, kind) => { found.push({ index, literal, kind }); masked.fill(' ', index, index + literal.length); };
  for (const m of value.matchAll(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g)) take(m.index, m[0], 'hex');
  for (const m of value.matchAll(/(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi)) {
    const call = value.slice(m.index, callEnd(value, m.index + m[0].length - 1));
    if (rawFunction(call)) take(m.index, call, /^(?:rgb|hsl|hwb)/i.test(m[1]) ? m[1].toLowerCase().replace(/a$/, '') : 'function');
  }
  if (property.startsWith('--') || colourProperty.test(property)) {
    const rest = masked.join('');
    for (const m of rest.matchAll(/(?<![\w#-])([a-z]+)(?![\w(-])/gi)) if (named.has(m[1].toLowerCase())) take(m.index, m[1], 'named');
  }
  return found.sort((a, b) => a.index - b.index);
}
function maskCss(text) {
  const plain = maskCommentsAndStrings(text);
  const withoutUrls = mask(plain, /url\([^)]*\)/gi);
  return withoutUrls.replace(/var\(\s*--[\w-]+/g, (match) => 'var(' + blank(match.slice(4)));
}
/** Scan CSS text. Results use offsets relative to `text`. Only declaration values are inspected, so selectors are never mistaken for colours. */
function cssLiterals(text) {
  const masked = maskCss(text), results = [];
  for (const m of masked.matchAll(/([-\w]+)[ \t\r\n]*:[ \t\r\n]*([^;{}]+?)[ \t\r\n]*(?=[;}])/dg)) {
    const [valueStart] = m.indices[2];
    for (const hit of valueLiterals(m[2], m[1])) results.push({ ...hit, property: m[1], index: valueStart + hit.index });
  }
  return results;
}
function sfcRegions(text) {
  const styles = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gid)].map((m) => ({ start: m.indices[1][0], text: m[1] }));
  const template = mask(mask(mask(text, /<style\b[\s\S]*?<\/style>/gi), /<script\b[\s\S]*?<\/script>/gi), /<!--[\s\S]*?-->/g);
  return { styles, template };
}
function inlineStyleLiterals(template) {
  const results = [];
  for (const m of template.matchAll(/(?<![\w-])((?::|v-bind:)?)style\s*=\s*("[^"]*"|'[^']*')/gid)) {
    const [valueStart, valueEnd] = m.indices[2], body = template.slice(valueStart + 1, valueEnd - 1);
    if (!m[1]) { for (const hit of cssLiterals(body + ';')) results.push({ ...hit, index: valueStart + 1 + hit.index }); continue; }
    for (const s of body.matchAll(/'[^']*'|"[^"]*"|`[^`]*`/g)) {
      for (const hit of cssLiterals('color:' + maskCss(s[0].slice(1, -1)) + ';')) {
        results.push({ ...hit, property: 'style-binding', index: valueStart + 1 + s.index + 1 + hit.index - 'color:'.length });
      }
    }
  }
  return results;
}
const position = (text, index) => {
  const before = text.slice(0, index), line = before.split('\n').length;
  return { line, column: index - before.lastIndexOf('\n') };
};
/** Scan one file's text. `.css` is all style; `.vue` checks `<style>` blocks and template inline styles; other kinds are ignored. */
export function scanStyleSource(path, text) {
  let hits = [];
  if (path.endsWith('.css')) hits = cssLiterals(text);
  else if (path.endsWith('.vue')) {
    const { styles, template } = sfcRegions(text);
    for (const block of styles) hits.push(...cssLiterals(block.text).map((hit) => ({ ...hit, index: hit.index + block.start })));
    hits.push(...inlineStyleLiterals(template));
  }
  return hits.sort((a, b) => a.index - b.index).map((hit) => ({ file: path, ...position(text, hit.index), literal: hit.literal, kind: hit.kind, property: hit.property }));
}
