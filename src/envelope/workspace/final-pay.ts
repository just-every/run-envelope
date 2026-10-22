import { addDays } from './schedules'

export const separations = ['none', 'discharge', 'quit-with-notice', 'quit-without-notice'] as const
export type Separation = (typeof separations)[number]

const california = {
  title: 'California Labor Code §§201–202',
  url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=201.',
}

/**
 * Final-wage deadline for a separation on `lastDay` in the work state. Only
 * California is implemented; any other state is a named hold for a person.
 */
export function finalPayDue(state: string, separation: Separation, lastDay: string) {
  if (state !== 'CA' || separation === 'none') return null
  const rule =
    separation === 'discharge'
      ? { due: lastDay, basis: 'Labor Code §201(a): wages are due immediately on discharge' }
      : separation === 'quit-with-notice'
        ? { due: lastDay, basis: 'Labor Code §202(a): wages are due on the last day after at least 72 hours’ notice' }
        : // The time of quitting is not recorded, so the earlier calendar day is used.
          { due: addDays(lastDay, 2), basis: 'Labor Code §202(a): wages are due within 72 hours of quitting without notice' }
  return { ...rule, source: california }
}

/** Named holds and stub detail for employment ending inside a pay period. */
export function finalPayCheck(input: {
  state: string
  separation: Separation
  lastDay: string
  periodStart: string
  periodEnd: string
  payDate: string
}) {
  const { state, separation, lastDay, periodStart, periodEnd, payDate } = input
  if (lastDay < periodStart || lastDay > periodEnd) return { holds: [], details: [] }
  const details = [`Employment ends ${lastDay} (${separation}); earnings stop after that day.`]
  if (separation === 'none')
    return {
      details,
      holds: [{ code: 'final-pay-separation-review',
        reason: `Employment ends ${lastDay} inside this period. Record the separation type so the final-pay deadline can be set.` }],
    }
  const due = finalPayDue(state, separation, lastDay)
  if (!due)
    return {
      details,
      holds: [{ code: 'final-pay-deadline-review',
        reason: `The ${state} final-pay deadline is not implemented. A person must set it before the final wages are due.` }],
    }
  details.push(`Final wages due ${due.due} under ${due.basis} (${due.source.title}).`)
  return {
    details,
    holds:
      payDate > due.due
        ? [{ code: 'final-pay-deadline',
            reason: `Final wages are due ${due.due} under ${due.basis}; this run pays ${payDate}. An off-cycle final payment (ENV-012) must be approved and paid by the deadline. This preview pays nothing.` }]
        : [],
  }
}
