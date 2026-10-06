export interface ValidationIssue {
  id: string
  severity: 'error' | 'warning'
  path: string
  message: string
}
