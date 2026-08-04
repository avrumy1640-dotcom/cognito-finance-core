import type * as React from 'npm:react@18.3.1'
import { template as paymentApprovalRequest } from './payment-approval-request.tsx'
import { template as paymentApprovalDecision } from './payment-approval-decision.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: React.ComponentType<any>
  // deno-lint-ignore no-explicit-any
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  // deno-lint-ignore no-explicit-any
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'payment-approval-request': paymentApprovalRequest,
  'payment-approval-decision': paymentApprovalDecision,
}
