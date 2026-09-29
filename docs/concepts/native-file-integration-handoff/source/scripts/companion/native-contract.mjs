/** Portable declarative native integrations. No host code, execution or file I/O. */
const nativeReserved = new Set(['md','markdown','canvas','base','pdf','png','jpg','jpeg','gif','svg','webp','avif','bmp','ico','mp3','wav','m4a','ogg','flac','mp4','webm','mov','ogv']);
const nativeId = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
function nativeAssert(ok, path, message) { if (!ok) throw new Error(`NATIVE_INVALID: ${path}: ${message}`); }
function nativeObject(value, keys, path) {
  nativeAssert(value && typeof value === 'object' && !Array.isArray(value), path, 'Expected an object.');
  nativeAssert(Object.keys(value).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(value,key)), path, 'Missing or unsupported field.');
}
function nativeLabel(value, path, max = 80) { nativeAssert(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value), path, 'Expected bounded, single-line text.'); }
export function validateNativeExtension(value, owned = false) {
  nativeAssert(typeof value === 'string' && /^[a-z][a-z0-9]{0,23}$/.test(value), 'extension', 'Use 1–24 lowercase letters/digits, starting with a letter, without a leading dot.');
  nativeAssert(!owned || !nativeReserved.has(value), 'extension', 'Obsidian built-in file types cannot be claimed. Use a distinct custom extension.');
  return value;
}
export function validateNativeIntegrations(value) {
  if (value === undefined) return { fileTypes: [], contextMenus: [] };
  nativeObject(value,['fileTypes','contextMenus'],'nativeIntegrations');
  const ids = new Set(), extensions = new Set(), symbols = new Set();
  for (const key of ['fileTypes','contextMenus']) {
    nativeAssert(Array.isArray(value[key]) && value[key].length <= 16,key,'At most 16 entries.');
    for (const [index, entry] of value[key].entries()) {
      const path = `${key}[${index}]`;
      nativeObject(entry,key === 'fileTypes' ? ['id','name','extension','icon','format','defaultContent'] : ['id','name','extensions','icon'],path);
      nativeAssert(typeof entry.id === 'string' && nativeId.test(entry.id) && entry.id.length <= 48 && !/^(constructor|prototype|con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(entry.id),path+'.id','Use a portable lowercase ID.');
      nativeAssert(!ids.has(entry.id),path+'.id','IDs must be unique across native integrations.'); ids.add(entry.id);
      const symbol = entry.id.split('-').map(part => part[0].toUpperCase()+part.slice(1)).join('');
      nativeAssert(!symbols.has(symbol),path+'.id','IDs must produce distinct TypeScript symbols.'); symbols.add(symbol);
      nativeLabel(entry.name,path+'.name'); nativeLabel(entry.icon,path+'.icon',48);
      nativeAssert(nativeId.test(entry.icon),path+'.icon','Use a local Lucide icon ID.');
      if (key === 'fileTypes') {
        validateNativeExtension(entry.extension,true);
        nativeAssert(!extensions.has(entry.extension),path+'.extension','Duplicate file association.'); extensions.add(entry.extension);
        nativeAssert(['text','json'].includes(entry.format),path+'.format','Use text or json; binary files need a dedicated adapter.');
        nativeAssert(typeof entry.defaultContent === 'string' && new TextEncoder().encode(entry.defaultContent).length <= 65536 && !entry.defaultContent.includes('\0'),path+'.defaultContent','Expected at most 64 KiB of text without NUL.');
        if (entry.format === 'json') { try { JSON.parse(entry.defaultContent); } catch { nativeAssert(false,path+'.defaultContent','Expected valid JSON.'); } }
      } else {
        nativeAssert(Array.isArray(entry.extensions) && entry.extensions.length > 0 && entry.extensions.length <= 16,path+'.extensions','Provide 1–16 explicit file extensions; no wildcards.');
        entry.extensions.forEach(ext => validateNativeExtension(ext));
        nativeAssert(new Set(entry.extensions).size === entry.extensions.length,path+'.extensions','Duplicate extension filter.');
      }
    }
  }
  return value;
}
