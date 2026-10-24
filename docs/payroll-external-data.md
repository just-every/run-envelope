# Installed external data boundaries

The installation owner chooses hosting, native mail and optional linked identity.
Company owners separately authorize optional notice providers. A company notice
credential does not configure installation sign-in mail. Missing configuration
refuses the affected operation; it never selects another provider.

The metadata in `seed.json` describes these existing boundaries. This inventory
appears in the owner’s native sign-in settings and first-run review, before setup
confirmation. Those documents share the seed metadata and show the selected
native mail transport and linked identity issuer without credentials. ENV-073
remains partial: the full payroll, worker portal and future connector journeys
remain owed.

| Recipient | Purpose and permitted data | Credential and custody |
| --- | --- | --- |
| Owner Cloudflare account | Worker hosting, HTTP requests, D1 company records, identity and sessions. Private payroll identifiers and notice originals use application encryption. | The owner controls deployment authority, Worker bindings and D1. The independent record key is held separately from exported history. Hosting necessarily processes requests and stored records. |
| Configured Resend | Native sign-in, invitations and sensitive-change confirmation: sender, intended email recipient and a single-use link. Optional company notice correspondence sends the exact approved recipient, sender, subject and redacted reply. | Native mail uses the installation credential in owner Worker bindings. Company notice credentials use encrypted company storage. Messages and delivery metadata are processed under the owner's Resend terms. |
| Configured SendGrid | Alternative native authentication mail with the same intended recipient, sender and single-use link. Destination: `https://api.sendgrid.com/v3/mail/send`. | The owner supplies the installation credential. SendGrid processes messages and delivery metadata under owner terms. |
| Configured Cloudflare mail | Alternative native authentication mail through the owner's configured account at `https://api.cloudflare.com`, using its account-specific email sending endpoint. | The installation holds the account identifier and scoped mail credential; the owner account and mail service process the message. |
| Owner-linked identity issuer | Discovery and public keys; installation origin and callbacks; a single-use link or authorization code; client identifier, signed assertion, PKCE verifier, requested scopes and nonce. Authentication returns the issuer's identity assertions. No payroll record is needed. | Native owner settings select the issuer. Discovery and link endpoints are confined to that origin. The installation's private signing key stays in D1; signed assertions are sent. The selected identity service applies its own identity retention terms. |
| Opted-in OpenAI | Redacted notice text for an untrusted summary and proposed reply at `https://api.openai.com/v1/responses`. No payroll calculation, approval, raw SSN or bank value. | Company credential encrypted with the independent record key. Requests use `store:false`; provider processing terms still apply. See [notice controls](./payroll-notices.md). |

Local and demo authentication suppress real mail. Library mail transports that
need relay or messaging configuration are unavailable through the current native
mail adapter, which does not supply that configuration. No author relay or
telemetry service is required. Payroll rails, agency submissions, recordkeepers,
carriers and further connected systems remain future ENV-073 inventory work;
metadata is not an authorization or a connected-state claim for those services.

## Native authentication mail

Only explicitly configured Resend, SendGrid and Cloudflare native transports
can send. Local and demo modes suppress real mail. Missing credentials, rejected
requests and uncertain responses never select an alternate transport and cannot
leave a usable sign-in link. API acceptance does not establish mailbox delivery.
The installation credential is sent only in the selected provider's Authorization
header. No attachments, payroll records, SSNs or bank values are needed.

Cloudflare uses the configured owner's exact account endpoint:
`https://api.cloudflare.com/client/v4/accounts/{owner-account-id}/email/sending/send`.
The account identifier is a path selector, not a payroll identifier. SendGrid and
Resend use the fixed endpoints listed above. Subject, text and HTML contain only
the authentication ceremony, intended recipient and single-use link; native
anti-auto-reply headers and a delivery identifier support that ceremony.

No bank rail, account-verification service, tax or identity agency, recordkeeper,
carrier, HR, time, POS, ledger, Inkwell, SMS, chat or push outbound connection is
activated by this inventory. Reviewed source uploads and manual SIDES portal
handoff do not create a live connector. Future implementations must declare each
exact destination, minimum fields, credential custody and data retention before
the first request, under ENV-073 and their own connector clauses. No provider
agreement, live payroll settlement or complete deterministic payroll is claimed.
