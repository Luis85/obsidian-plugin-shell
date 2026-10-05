/** Clone the persisted plain-data graph, including Vue proxies, without framework imports.
 * Domain data intentionally excludes Dates, Maps, functions and cyclic object graphs.
 * Boundary validation enforces that contract before imported data reaches this helper.
 */
export function cloneData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => cloneData(item)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneData(item)])) as T
  }
  return value
}
