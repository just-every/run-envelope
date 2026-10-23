# Additional fact-finding responses

`preparePortalResponse` accepts an optional retained `followUp`. The packet then answers that agency correspondence rather than repeating the original separation or earnings questionnaire. The follow-up must match the original request identity, EIN and state employer account. Its current due date, timezone, cutoff basis, original evidence reference, digest and questions remain bound to the response.

For question number `n`, starting at one, supply an answer with `field: 'agency-question:' + n`, the exact retained `question`, and `questionSourceRef` equal to the follow-up's source reference. Every question needs a nonempty answer citing supplied retained payroll evidence, reviewed Willow facts or an allowed evidence attachment. Missing, changed, duplicate, extra or uncited answers refuse preparation. The module preserves the agency's question order. It does not invent a fixed questionnaire for a state or separation category.

The printable packet identifies Additional Fact-Finding, its agency reference and current deadline, the cited answers, payroll sources, preparer, permitted attachment references and exact human signature when supplied. SSN stays masked. Preparing, approving or printing remains `prepared-not-submitted`; no outbound request occurs.

The response digest includes normalized follow-up identity, original source, dates, owner and every question. Confirmation status, response digest and confirmation number are later lifecycle metadata. The module reconstructs the initial follow-up state for hashing so adding that confirmation metadata does not invalidate the response it confirms. A confirmed packet may be reconstructed as evidence; the records layer must refuse a second original transfer. Any changed question, source, deadline, answer or attached evidence requires fresh exact human approval.

The caller owns current human authority, private source custody, actual claimant matching, evidence review, approval persistence, once-only transfer, receipt matching and deadline escalation. Raw client strings naming a signer or reviewer confer no authority. A follow-up receipt must be matched to the follow-up response digest and current follow-up deadline, while retaining the original claim identity. An original response's confirmation cannot close a later unanswered inquiry.

The source is the agency-hosted [NASWA Additional Fact-Finding E-Response User Guide, version 1, September 2019](https://labor.alaska.gov/estax/documents/ADF_E-Response_User_Guide.pdf). This is an identified public guide edition, not a claim to possess a current Central Broker XML schema. Its source digest and page map are recorded in the source fixture `tests/fixtures/sides/adf-guide-source.json` and exported through `portalSources.adf`.

The guide documents the following sequence, using PDF page ordinals including its cover:

1. Pages 8–10: identify the particular request and its due date, verify the supplied claimant and employer information, review agency attachments, then answer the actual inquiries.
2. Pages 11–12: attach relevant permitted evidence, identify the preparer, and resolve required-field validation before submission.
3. Pages 13–14: the authorized human submits through the official portal and retains the confirmation number plus the downloadable response. Viewing or printing before submission does not establish receipt.
4. Page 15: corrections after submission use an amendment with an explanation. An amendment is distinct from replaying the original response.

The guide explicitly instructs employers to respond even when late. An overdue follow-up remains assigned work; the application must not silently reject or close it. Actual portal access and mandate remain necessary for real use. Account-free application journeys can exercise the documented artifact boundary using synthetic facts, while preserving the distinction between imported reviewed confirmation and independently authenticated live agency acceptance.
