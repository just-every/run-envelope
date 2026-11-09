# Actual official-source review

Reviewed 2026-11-09. The adopted permanent Order 25-054 is dated October 2, 2025
and effective January 1, 2026. Its rate notice expressly lowers WBF to 1.8 cents
per hour for calendar 2026. The marked rule shows old and replacement rates
alongside one another; the signed notice disambiguates the replacement.

Official source retrieved successfully:
https://wcd.oregon.gov/laws/Documents/New_rules/070%20WBF%20-%20January%201%2c%202026/70-25054-rule-notice-and-rules.pdf
SHA-256: 8cab16f8cea0f9c0dae8f18236911466ea7a77defcfb15ef8b14e695d18657a4

The unchanged adopted 436-070-0020 text on PDF page 6 governs one half of the
rate times actual fractional hours for each employee each pay period, with
half-cent upward rounding. Subsection 3 requires the employer amount to equal
the sum retained from employees. Subsection 1a permits documented flat hours,
contract information or another reasonable method only when actual hours are
untracked. Flat hours are 40 per week or 173.33 per month. Subsection 2 requires
a combined report. These exact sections and the rate notice are retained in the
code's bounded edition; no other year is inferred.

A second official source was retrieved for comparison:
https://www.oregon.gov/DCBS/wbf/Documents/4999.pdf
SHA-256: 981aeea019a9e9b3746b1ea32cc8481f27f11b81c9f89e1ca25cec55c59437bc
Edition: 440-4999 December 2025. Its pages 4 and 5 support explicit untracked-hours
methods and non-rounded actual hours. However, page 5's examples conflict with
the adopted rule about employee rounding and employer matching. This FAQ is
therefore explicitly excluded as rounding authority. Old metadata remains
immutable and a new exact source review is required. No legal applicability,
insurance coverage, actual collection, report acceptance or remittance is
claimed by this source review.

Independent arithmetic: 10.5 hours times 0.9 cents = 9.45 cents, rounded to 9;
10.6 times 0.9 = 9.54 cents, rounded to 10; 173.33 times 0.9 = 155.997 cents,
rounded to 156. Employer matches each rounded amount. Two separate half-hour
periods each produce 0.45 cents and round to zero; rounding their aggregate
would incorrectly yield one cent. Five hours yields 4.5 cents and rounds to 5.

Additional precision goldens: 10.555555 hours times 0.9 cents equals
9.4999995 cents and rounds down to 9; 10.555556 hours yields 9.5000004 cents and
rounds up to 10. Rounding either input to hundredths of an hour before
calculation would misstate the first amount. Four separate periods of 0.5,
0.5, 10.555555 and 10.555556 hours total 22.111111 hours but 19 employee cents
and 19 employer cents. Rounding the aggregate hours instead would incorrectly
produce 20 cents each. These extra outcomes are checked through native reviewed
periods and the retained preparation door.
