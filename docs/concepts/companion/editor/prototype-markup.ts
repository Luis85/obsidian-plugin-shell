const entities: Record<string, string> = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
export const pmEscape = (value: unknown): string => String(value).replace(/[&<>"']/g, c => entities[c]!);
const e = pmEscape;
export const pmButton = (label: string, action: string, disabled = false, primary = false) => `<button type="button" class="btn ${primary ? 'primary' : ''}" data-pm="${action}"${disabled ? ' disabled' : ''}>${e(label)}</button>`;
export const pmField = (name: string, label: string, value = '', required = true, max = 120) => `<label>${e(label)}<input name="${name}" value="${e(value)}" maxlength="${max}" ${required ? 'required' : ''}${name === 'id' ? ' pattern="[a-z][a-z0-9]*(?:-[a-z0-9]+)*"' : ''}></label>`;
