/** Shared escaped form markup. Extra attributes are trusted template literals, never user HTML. */
function uiFieldFrame(label, id, control, hint = '') {
  const help = hint ? `<small id="${esc(id)}-help">${esc(hint)}</small>` : '';
  return `<div class="field"><label for="${esc(id)}">${esc(label)}</label>${control}${help}</div>`;
}

function uiFieldAttributes(id, hint, field = id) {
  return `id="${esc(id)}" data-field="${esc(field)}"${hint ? ` aria-describedby="${esc(id)}-help"` : ''}`;
}

function uiInput(label, id, value, { type = 'text', hint = '', extra = '', multiline = false, rows = 3, field = id } = {}) {
  const attributes = uiFieldAttributes(id, hint, field);
  const content = multiline
    ? `<textarea ${attributes} rows="${rows}" ${extra}>${esc(value ?? '')}</textarea>`
    : `<input ${attributes} type="${esc(type)}" value="${esc(value ?? '')}" ${extra}>`;
  return uiFieldFrame(label, id, content, hint);
}

function uiSelect(label, id, options, value, extra = '') {
  const choices = options.map(([key, name]) =>
    `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(name)}</option>`
  ).join('');
  return uiFieldFrame(label, id, `<select ${uiFieldAttributes(id, '')} ${extra}>${choices}</select>`);
}
