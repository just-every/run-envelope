import type { AgentDoorOptions } from '../../modules/agent-door/index.ts'
import { registry, describeTool } from '../../modules/agent-door/registry.ts'
import { capabilitySet } from '../../modules/agent-door/capabilities.mjs'
import { fontHead } from '../../base/font-head'
import { iconHead } from '../../base/icon-head'
import { catalogue, stableErrors, unfinishedJobs } from './catalogue'

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))

/** Public declarations only. Never read the database, request identity or bindings. */
export function agentReference(options: AgentDoorOptions) {
  const tools = registry(options).map(tool => {
    const entry = catalogue.find(entry => entry.name === tool.name)!
    return {...describeTool(tool), job: entry.job, classTests: entry.classTests}
  })
  return {
    specialist: options.specialist,
    tools,
    resourceTemplates: (options.resources ?? []).map(({uriTemplate,name,description,mimeType,scope,classes}) => ({uriTemplate,name,description,mimeType,scope,classes})).sort((a,b) => a.uriTemplate.localeCompare(b.uriTemplate)),
    prompts: (options.prompts ?? []).map(({messages,...prompt}) => ({...prompt,messages:messages({})})).sort((a,b) => a.name.localeCompare(b.name)),
    capabilities: capabilitySet(options.capabilities),
    eventTypes: [],
    limits: options.limits!,
    errors: stableErrors,
    unfinishedJobs,
  }
}
type Reference = ReturnType<typeof agentReference>

export function agentInstructions(reference: Reference) {
  return `Envelope: tools for the ${reference.specialist} specialist. Act for the sponsoring person under their current authority and company policy; people decide approvals at the supplied URL. Installed jobs: ${reference.tools.map(tool => `${tool.title} (${tool.name}; scope ${tool._meta['com.runeditrun/scope']}; classes ${tool._meta['com.runeditrun/classes'].join(', ')})`).join('; ')}. Specialist job prompts: ${reference.prompts.map(prompt=>prompt.name).join(', ')}. Generated reference: /docs/agents. Unavailable capabilities: ${reference.capabilities.refused.join(', ')}. These preparation tools do not complete paid payroll, remittance or filing.`
}

function referenceHtml(reference: Reference) {
  const jobs: string[] = [...new Set(reference.tools.map(tool => tool.job))]
  const jobId = (job: string) => 'job-' + jobs.indexOf(job)
  const toolHtml = (tool: Reference['tools'][number]) => `<article data-tool="${escape(tool.name)}" id="${escape(tool.name)}">
    <h3>${escape(tool.title)}</h3><p><code>${escape(tool.name)}</code></p><p>${escape(tool.description)}</p>
    <dl><div><dt>Scope</dt><dd data-scope>${escape(tool._meta['com.runeditrun/scope'])}</dd></div><div><dt>Effect</dt><dd>${tool.annotations.readOnlyHint ? 'Read only' : 'Mutation: idempotency_key required; expected_revision supported'}</dd></div></dl>
    <h4>Possible classes and computed-class tests</h4><ul>${tool._meta['com.runeditrun/classes'].map(cls => `<li data-class="${escape(cls)}"><strong>${escape(cls)}</strong>${tool.classTests.filter(test => test.class === cls).map(test => `<p data-proof="${escape(test.step)}"><code>${escape(test.path)}</code> · <code>${escape(test.test)}</code><br>Fixture: <code>agent-surface.json</code>, step <code>${escape(test.step)}</code>. The harness checks this computed class under autonomous and held policies.</p>`).join('')}</li>`).join('')}</ul>
    <details><summary>Input and output schemas</summary><h4>Input</h4><pre>${escape(JSON.stringify(tool.inputSchema,null,2))}</pre><h4>Output</h4><pre>${escape(JSON.stringify(tool.outputSchema,null,2))}</pre></details>
  </article>`
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent reference · Envelope</title>' + iconHead + '<link rel="stylesheet" href="/rer-theme.css">' + fontHead + '<link rel="stylesheet" href="/look/agent-docs.css"></head><body class="app agent-docs">'
    + '<a class="skip" href="#main">Skip to agent reference</a><div class="app-wrap"><header class="bar"><a class="lockup" href="/"><img src="/brand/mark.svg" alt="" width="40" height="40"><span>Envelope</span></a><nav aria-label="Documentation"><a class="bar-link" href="/docs">Docs</a><a class="bar-link" href="/agents">Agents</a></nav></header>'
    + `<main id="main" tabindex="-1"><div class="docs-heading"><h1>Agent reference</h1><p>Specialist: <strong>${escape(reference.specialist)}</strong>. These are the jobs this installation currently offers, generated from its native registry.</p><p>Every call needs current scoped authority and an answered company policy. Agent attribution reads <code>${escape('<agent> for <person>')}</code>. Policy approval never supplies native payroll approval.</p></div>`
    + `<nav class="card" aria-label="Reference sections"><h2>Find a job</h2><ul>${jobs.map(job => `<li><a href="#${jobId(job)}">${escape(job)}</a></li>`).join('')}<li><a href="#prompts">Specialist job prompts</a></li><li><a href="#resources">Resources and events</a></li><li><a href="#limits">Capacity limits</a></li><li><a href="#errors">Stable errors</a></li><li><a href="#availability">Availability and unfinished jobs</a></li></ul></nav>`
    + jobs.map(job => `<section class="card" id="${jobId(job)}"><h2>${escape(job)}</h2>${reference.tools.filter(tool => tool.job === job).map(toolHtml).join('')}</section>`).join('')
    + `<section class="card" id="prompts"><h2>Specialist job prompts</h2><p>Retrieve these jobs through MCP prompts. They describe the installed subset and supply no authority or private records.</p>${reference.prompts.map(prompt=>`<article data-prompt="${escape(prompt.name)}"><h3>${escape(prompt.title ?? prompt.name)}</h3><p><code>${escape(prompt.name)}</code></p><p>${escape(prompt.description)}</p><details><summary>Job instructions</summary>${prompt.messages.map(message=>`<pre>${escape((message as {content:{text:string}}).content.text)}</pre>`).join('')}</details></article>`).join('')}</section>`
    + `<section class="card" id="resources"><h2>Resources and events</h2>${reference.resourceTemplates.length ? `<ul>${reference.resourceTemplates.map(resource => `<li data-resource="${escape(resource.uriTemplate)}"><code>${escape(resource.uriTemplate)}</code> · ${escape(resource.name)} · ${escape(resource.description ?? '')}</li>`).join('')}</ul>` : '<p>No resource templates are currently offered. Resource reads are unavailable.</p>'}<p>No event types, event feed or subscriptions are currently offered.</p></section>`
    + `<section class="card" id="limits"><h2>Capacity limits</h2><dl><div><dt>Requests per minute per agent</dt><dd>${reference.limits.requestsPerMinute}</dd></div><div><dt>Maximum request body in bytes</dt><dd>${reference.limits.maxBodyBytes}</dd></div></dl><p>A rate overrun returns HTTP 429 with Retry-After. These installation protections are separate from business policy. Tool schemas above specify page, field and input limits. Lists have private cache scope and no reusable TTL.</p></section>`
    + `<section class="card" id="errors"><h2>Stable errors</h2><p>Read the code in JSON-RPC error data or tool metadata <code>com.runeditrun/error</code>. A tool refusal can use HTTP 200 with isError; it is never a successful effect. Protocol errors include HeaderMismatch (-32020) and UnsupportedProtocolVersion (-32022); malformed requests use -32700 or -32600, unknown methods -32601 and invalid tool names -32602. HTTP 401 challenges authentication, 403 challenges scope, 413 refuses oversized bodies and 429 includes Retry-After.</p><ul class="error-codes">${reference.errors.map(code => `<li><code>${escape(code)}</code></li>`).join('')}</ul><p>On conflict or uncertain provider outcome, reconcile the retained operation. Do not automatically repeat an outbound action or attempt destructive recovery.</p></section>`
    + `<section class="card" id="availability"><h2>Availability and unfinished jobs</h2><p>Offered capabilities: ${escape(reference.capabilities.declared.join(', '))}.</p><p>Unavailable capabilities: ${escape(reference.capabilities.refused.join(', '))}.</p><ul>${reference.unfinishedJobs.map(job => `<li>${escape(job)}</li>`).join('')}</ul><p>Reference-event sends remain configured-native-owner-only with explicit consent. Company policy cannot widen a grant, supply an exact human approval or release a hold.</p></section></main></div></body></html>`
}

export function agentDocs(request: Request, reference: Reference) {
  const headers = {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'", 'vary':'Accept'}
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}})
  const json = request.headers.get('accept')?.includes('application/json')
  return new Response(request.method === 'HEAD' ? null : json ? JSON.stringify(reference) : referenceHtml(reference),{headers:{...headers,'content-type':json?'application/json':'text/html; charset=utf-8'}})
}
