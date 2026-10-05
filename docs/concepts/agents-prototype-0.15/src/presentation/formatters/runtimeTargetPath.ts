/** Keep literal {{slug}} placeholders out of Vue interpolation expressions. */
export function formatRuntimeTargetPath(template: string, slug: string): string {
  return template.replaceAll('{{slug}}', slug)
}
