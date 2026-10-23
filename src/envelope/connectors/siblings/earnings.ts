import { text, date, integer, PayrollError } from '../../security'
import { choice } from '../../workspace/store'
import type { Input } from '../../records'
export const earningProviders = [
  'gauge',
  'plinth',
  'glove',
  'mallet',
  'strap',
  'orbit',
] as const
/** Source statements remain proposals until a current human reviews the exact revision. */
export function earningFacts(provider: string, raw: Input) {
  choice(provider, earningProviders)
  if (
    raw.schema !== 'envelope-job-earning@1' ||
    raw.status !== 'approved' ||
    raw.currency !== 'USD' ||
    raw.paymentState !== 'unpaid'
  )
    throw new PayrollError('not_an_unpaid_approved_earning', 409)
  return {
    sourceId: text(raw.sourceId),
    effectiveDate: date(raw.effectiveDate),
    values: {
      amountCents: integer(raw.amountCents),
      jobId: text(raw.jobId),
      sourceApprovedBy: text(raw.approvedBy),
      earningType: choice(raw.earningType, [
        'job',
        'commission',
        'per-service',
      ]),
    },
    schema: 'envelope-job-earning@1 (documented Envelope intake contract)',
  }
}
