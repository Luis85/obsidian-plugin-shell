type Messages = { en: Record<string, Record<string, string>>; de: Record<string, Record<string, string>> };
const authoringLocaleModules: readonly Messages[] = [
];
export function mergeAuthoringMessages(modules: readonly Messages[]): Messages {
  const messages: Messages = { en: {}, de: {} };
  for (const module of modules) {
    const en = Object.keys(module.en).sort(); const de = Object.keys(module.de).sort();
    if (JSON.stringify(en) !== JSON.stringify(de)) throw new Error('AUTHORING_LOCALE_NAMESPACES');
    for (const namespace of en) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(namespace) || ['constructor', 'prototype'].includes(namespace)) throw new Error('AUTHORING_LOCALE_NAMESPACE');
      if (Object.hasOwn(messages.en, namespace)) throw new Error('AUTHORING_LOCALE_COLLISION');
      if (JSON.stringify(Object.keys(module.en[namespace] ?? {}).sort()) !== JSON.stringify(Object.keys(module.de[namespace] ?? {}).sort())) throw new Error('AUTHORING_LOCALE_KEYS');
      Object.assign(messages.en, { [namespace]: module.en[namespace] });
      Object.assign(messages.de, { [namespace]: module.de[namespace] });
    }
  }
  return messages;
}
export const authoringMessages = mergeAuthoringMessages(authoringLocaleModules);

