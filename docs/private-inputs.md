# Private claim originals

Claim imports retain original bytes in encrypted, company-scoped private records.
Every retrieval checks the current native session and company owner grant, including
compensation, tax, SSN and independent export permissions. Historical signed packets
use the same current authority checks. A prior session or a file identifier never
confers access to another company.

An individual original is limited to 512 KiB, with at most 30 retained originals
and 2 MiB of original bytes per claim. The claim request boundary stops reading at
3 MiB. Only the existing permitted document types are accepted; base64 and any
supplied digest are checked before a claim version is written. Retaining the same
identifier with different bytes, filename or declared type is refused.

Untrusted originals download as binary attachments with MIME sniffing disabled and
a sandbox content security policy that allows no scripts, network resources, forms
or embedding. The original declared type remains in private metadata. Envelope does
not embed an HTML document, invoke PDF actions or fetch its referenced images.
Downloaded bytes are originals, not sanitized documents; opening a saved copy in
another application is outside the browser response's protections.

Malformed UTF-8 requests receive an invalid-input response rather than an internal
error. This does not make a malformed business import valid or permit any payroll
effect. Prepared signed response packets are generated from escaped fields and
remain distinct from the untrusted originals.

`tests/claims-browser.mjs` exercises these public doors with hostile HTML and PDF
content, malformed and oversized inputs, immutable retained identities, signed-out
visitors, a native member without a company grant and a foreign company. Native
sign-out also fences current and historical downloads in `tests/claims-runtime.mjs`.
Public automated accessibility checks cover the native Lobby, sign-in, setup
redirect and invalid confirmation at 1440 and 390. Operator audits still report
business-chip contrast failures; an accessibility tree is not screen-reader proof.
ENV-057 remains partial until its complete privacy and WCAG 2.2 AA journey passes.
Future document doors under ENV-022, ENV-024, ENV-025, ENV-030, ENV-045, ENV-051,
ENV-053 and ENV-054 inherit the existing boundary and current-authority obligations.
