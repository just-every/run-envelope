# Private inputs and retained originals

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

## Other native document boundaries

Private tax and documentary bank records download as plain text attachments with
MIME sniffing disabled and no storage in shared browser caches. Their values are
limited to 16,000 characters. A replacement must name the current version; an old
version cannot overwrite the new value. Reads require the current native session
and company grant. Native sign-out revokes subsequent downloads. Documentary bank
custody does not verify an account or authorize a payment.

Tax notice bodies are limited to 12,000 characters and rendered as escaped text,
including any script tags or remote image references. The ordinary native JSON
request boundary rejects invalid UTF-8, malformed objects, unsupported content
types and requests exceeding 64,000 bytes before any business write. Claim inputs
retain the distinct limits above. These limits do not certify a valid HRIS or
earning import; each door still validates its own business schema and authority.

Invitation and email-confirmation previews do not establish a session. An explicit
confirmation action consumes the token; a preview alone grants no company access.
Linked identity-provider verification starts without granting a native session.
Verified callbacks redirect to the requested native document; callback responses
are non-cacheable and do not contain private payroll text. Human screen-reader
review remains a separate obligation. Keyboard focus and automated accessibility checks cover
specific interactions, not the full WCAG 2.2 AA target.

## Structured source revisions and interaction proof

The native safe-input journey also imports hostile text in Willow hire evidence,
HR changes, job earnings and industry classification evidence. It checks escaped
rendering at 1440 and 390, no script execution or remote image request, retained
original revisions after correction, and write-free stale-version refusals.
Unrequested source fields are discarded before payroll storage. Invalid numeric
source values and malformed structured exports cannot create a private revision.

The claims browser journey records automated findings and accessibility trees
for empty, loaded, held, prepared, signed, handoff, confirmed and follow-up
screens. It checks visible focus, keyboard checkbox state and native keyboard
submission. This is bounded interaction evidence, with contrast findings kept
visible. ENV-057 remains partial. ENV-074 preserves the approved split’s scripted
accessibility-tree announcement assertions and the owner’s recorded VoiceOver
or NVDA pre-release pass. No human screen-reader pass is claimed here.

Notice-reply text remains plain text through exact human review and dispatch;
stale edits cannot replace the current reply. Protected-response requesters
receive selected facts and opaque provenance identifiers, never private source
evidence. The native verification source review and restored company history
use the existing evidence wrapping for long imported text at phone widths.
The archive journey carries hostile person text through a real CLI export and
restore and verifies that native rendering remains inert under restricted
current authority. These checks extend the exercised cases; exhaustive input
and interaction coverage remains open in ENV-057.
