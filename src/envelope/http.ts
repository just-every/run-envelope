import { HiPlanShares, type HiPreviewRequest } from './benefits/hi-plan-shares'
import { ExtendedRetirement } from './benefits/extended-retirement'
import { RetirementRecords } from './benefits/retirement-records'
import { NyDbl } from './benefits/ny-dbl'
import { calculationPreview, type PreviewInput } from './calculation/preview'
import { stateCoverage } from './calculation/states'
import { accountingResponse } from './accounting/http'
import type { Bindings } from '../auth.server'
import type { OperatorAuth } from '../modules/operator-auth/index.mjs'
import { prepareBonus, readBonus, bonusReport } from './bonus-runs'
import { presentReview } from './review-presentation'
import { HumanProof } from './human-proof'
import { Records, type Input } from './records'
import { CompanyPayroll, combinedLaborReport } from './companies'
import { ArchiveHistory } from './archive-history'
import { privacyPage } from './privacy-pages'
import { WorkerPrivacy } from './worker-privacy'
import { ProviderPrivacy } from './provider-privacy'
import { automationResponse } from './automation/http'
import { firmResponse } from './firm/http'
import { industryResponse } from './industry/http'
import { claimsResponse } from './claims/http'
import { claimsMultipartInput } from './claims/form-input'
import { NewHireReporting, coverage as newHireCoverage } from './people/new-hire-reporting'
import { newHirePage, coveragePage, electionContent } from './people/new-hire-pages'
import { PaperOnboarding } from './people/onboarding'
import { paperMultipart } from './people/onboarding-input'
import { paperOnboardingPage } from './people/onboarding-pages'
import { HrisHires } from './people/hris-hires'
import { hirePage } from './people/hire-pages'
import { VerificationRequests, ownerOnly, retentionDeadline } from './income-verification/requests'
import { ProtectedResponses } from './disclosures/protected'
import { verificationPage, protectedResponsePage, verificationErrorPage } from './income-verification/pages'
import { SourceIntake } from './intake/sources'
import { sourcePage } from './intake/pages'
import { LeaveLedger, leaveBucket, leaveId } from './leave/ledger'
import { leavePage } from './leave/pages'
import { AgentPolicy, AgentPolicyError, policyCall, toolClasses } from './agent-policy'
import { AgentSettings, AgentTools } from './agents'
import { Lifecycle } from './lifecycle'
import { Providers } from './providers'
import { Notices, processNotice, dispatchReply } from './notices'
import { WithholdingInstructions } from './withholding-instructions'
import { withholdingInstructionPage } from './withholding-instruction-pages'
import { TaxNoticeCases } from './tax-notices'
import { taxNoticeMultipart } from './tax-notice-input'
import { taxNoticeCasePage } from './tax-notice-pages'
import { providersPage, noticesPage, noticePage, replyReviewPage } from './notice-pages'
import { agentsPage, issuedAgentPage, draftsPage } from './agent-pages'
import { CompanySetup } from './setup'
import { WorkspaceStore } from './workspace/store'
import { TaxElections } from './workspace/tax-elections'
import { LocalTaxInputs } from './workspace/local-tax-inputs'
import { Allocations } from './workspace/allocations'
import {
  allocationsPage,
  schedulesPage,
  workspacePage,
  paySettingsPage,
  exactReviewPage,
  rulesPage,
  ruleReviewPage,
  weeklyFrequencyRefusalPage,
} from './workspace/pages'
import { Schedules } from './workspace/schedules'
import { RunInputs, earningsMultipart, earningsTemplate } from './workspace/run-input'
import { PayItems } from './workspace/pay-items'
import { PayPolicies } from './workspace/pay-policies'
import { RunApprovals, type ApprovalPolicy } from './workspace/run-approvals'
import { Tips } from './workspace/tips'
import { RunIntake, intakeTemplate, runInputMultipart, type RunInput } from './intake/run-input'
import { runIntakePage } from './intake/run-pages'
import { TipIntake, tipTemplate } from './intake/tips'
import { runReviewPage, releaseRefusalPage } from './workspace/run-approval-pages'
import { Rules } from './workspace/rules'
import type { Kind } from './workspace/store'
import { PayrollError } from './security'
import {
  setupPage,
  companyIndex,
  companyPage,
  grantsPage,
  personPage,
  ratePage,
  errorPage,
  companyPath,
} from './pages'
const headers = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
  'content-security-policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
}
const json = (value: unknown, status = 200) => Response.json(value, { status, headers })
const redirect = (location: string) =>
  new Response(null, { status: 303, headers: { ...headers, location } })
async function input(request: Request): Promise<Input> {
  if (/^\/(?:app|api)\/envelope\/companies\/[-a-zA-Z0-9]+\/people\/[-a-zA-Z0-9]+\/withholding-instructions$/.test(new URL(request.url).pathname) && request.headers.get('content-type')?.startsWith(['multipart','form-data'].join('/'))) return taxNoticeMultipart(request)
  if (/^\/(?:app|api)\/envelope\/companies\/[-a-zA-Z0-9]+\/notices\/[-a-zA-Z0-9]+\/case(?:\/evidence)?$/.test(new URL(request.url).pathname) && request.headers.get('content-type')?.startsWith(['multipart','form-data'].join('/'))) return taxNoticeMultipart(request)
  if (/^\/(?:app|api)\/envelope\/companies\/[-a-zA-Z0-9]+\/pay-settings\/intake\/preview$/.test(new URL(request.url).pathname) && request.headers.get('content-type')?.startsWith(['multipart','form-data'].join('/'))) return runInputMultipart(request)
  if (/\/pay-settings\/intake(?:-preview)?$/.test(new URL(request.url).pathname) && request.headers.get('content-type')?.startsWith('multipart/form-data')) return earningsMultipart(request)
  if (/^\/(?:app|api)\/envelope\/companies\/[-a-zA-Z0-9]+\/people\/[-a-zA-Z0-9]+\/paper-onboarding$/.test(new URL(request.url).pathname) && request.headers.get('content-type')?.startsWith(['multipart','form-data'].join('/'))) return paperMultipart(request)
  const claims = /^\/(?:app|api)\/envelope\/companies\/[-a-zA-Z0-9]+\/claims(?:\/|$)/.test(new URL(request.url).pathname)
  if (claims && request.headers.get('content-type')?.startsWith('multipart/form-data')) return claimsMultipartInput(request)
  if (!request.body) throw new PayrollError('invalid_input')
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [],
    limit = claims ? 3 * 1024 * 1024 : /(?:\/pay-settings\/intake\/(?:apply|preview)|\/people\/[-a-zA-Z0-9]+\/(?:privacy\/(?:retain|release)|erase))$/.test(new URL(request.url).pathname) ? 2 * 1024 * 1024 : new URL(request.url).pathname.endsWith('/paper-onboarding') ? 1100000 : 64000
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new PayrollError('input_too_large', 413)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let pos = 0
  for (const c of chunks) {
    bytes.set(c, pos)
    pos += c.length
  }
  let body: string
  try { body = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { throw new PayrollError('invalid_input') }
  const type = request.headers.get('content-type')?.split(';')[0]
  if (type === 'application/x-www-form-urlencoded') {
    const params = new URLSearchParams(body),
      result: Input = {}
    for (const key of new Set(params.keys())) {
      const values = params.getAll(key)
      result[key] = ['actions', 'fields', 'locations', 'people', 'providers', 'models', 'selections', 'claimKinds', 'checks', 'certifications', 'records'].includes(key)
        ? values
        : values.length === 1
          ? values[0]
          : (() => {
              throw new PayrollError('duplicate_input')
            })()
    }
    if (new URL(request.url).pathname.endsWith('/pay-settings/intake')) {
      result.rows = [0,1,2].flatMap(index => {
        const prefix=`row${index}.`
        if (!result[prefix+'rowId']) return []
        const row=Object.fromEntries(Object.entries(result).filter(([key])=>key.startsWith(prefix)).map(([key,value])=>[key.slice(prefix.length),value]))
        row.sourceRef='manual:'+row.rowId
        return [row]
      })
    }
    return result
  }
  if (type !== 'application/json') throw new PayrollError('unsupported_content_type', 415)
  try {
    const parsed = JSON.parse(body)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw 0
    return parsed
  } catch {
    throw new PayrollError('invalid_input')
  }
}
/** Only real records are exposed. No placeholder bank-change/payroll endpoints. */
export async function payrollResponse(
  request: Request,
  env: Bindings,
  auth: OperatorAuth,
): Promise<Response | null> {
  const url = new URL(request.url),
    ui = url.pathname === '/app/envelope' || url.pathname.startsWith('/app/envelope/'),
    api = url.pathname.startsWith('/api/envelope/')
  if (!ui && !api) return null
  let session
  let verificationLanguage: 'en' | 'es' = (url.searchParams.get('lang') ?? (request.headers.get('accept-language')?.startsWith('es') ? 'es' : 'en')) === 'es' ? 'es' : 'en'
  let rpcId: string | number | null = null
  try {
    if (
      url.origin !== env.AUTH_ORIGIN ||
      (request.headers.has('host') &&
        request.headers.get('host')?.toLowerCase() !== url.host.toLowerCase())
    )
      throw new PayrollError('invalid_host', 403)
    if (!['GET', 'HEAD', 'POST'].includes(request.method))
      return new Response(null, {
        status: 405,
        headers: { ...headers, allow: 'GET, HEAD, POST' },
      })
    if (url.pathname.startsWith('/api/envelope/v1/')) {
      if (request.headers.has('cookie'))
        throw new PayrollError('ambiguous_authentication', 403)
      if (request.headers.get('sec-fetch-site') === 'cross-site' ||
          (request.headers.has('origin') && request.headers.get('origin') !== env.AUTH_ORIGIN))
        throw new PayrollError('invalid_origin', 403)
      const bearer = request.headers.get('authorization')
      if (!bearer?.startsWith('Bearer '))
        throw new PayrollError('agent_authentication_required', 401)
      const agent = await AgentTools.authenticate(env, bearer.slice(7))
      const opened = await agent.log('transport.rest.v1', agent.grant.id).run()
      if (!opened.meta.changes) throw new PayrollError('agent_authority_revoked', 403)
      const reportRoute = /^\/api\/envelope\/v1\/companies\/([-a-zA-Z0-9]+)\/reports\/(proposals|bonus-runs)$/.exec(url.pathname)
      if (reportRoute && request.method !== 'POST') {
        if ([...url.searchParams.keys()].some(k=>!['limit','after'].includes(k) || url.searchParams.getAll(k).length!==1)) throw new PayrollError('invalid_report_query')
        const result=await policyCall<unknown>(agent,reportRoute[2]==='bonus-runs' ? 'reports.bonuses' : 'reports.proposals','rest',()=> (reportRoute[2]==='bonus-runs' ? bonusReport.bind(null,agent) : agent.proposalReport.bind(agent))({companyId:reportRoute[1],
          ...(url.searchParams.has('limit') ? {limit:url.searchParams.get('limit')} : {}),
          ...(url.searchParams.has('after') ? {after:url.searchParams.get('after')} : {}),
        }))
        return request.method==='HEAD' ? new Response(null,{headers}) : json(result)
      }
      const route = /^\/api\/envelope\/v1\/companies\/([-a-zA-Z0-9]+)\/(records|drafts|bonus-runs)(?:\/([-a-zA-Z0-9]+))?$/.exec(url.pathname)
      if (!route) throw new PayrollError('agent_tool_denied', 403)
      const [, companyId, resource, draftId] = route
      if (resource === 'bonus-runs') {
        if (url.search) throw new PayrollError('invalid_bonus_input')
        if (!draftId && request.method === 'POST') {
          if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new PayrollError('unsupported_content_type',415)
          const value=await input(request)
          if (Object.hasOwn(value,'companyId')) throw new PayrollError('invalid_bonus_input')
          return json(await policyCall(agent,'bonus.prepare','rest',()=>prepareBonus(agent,{...value,companyId})),201)
        }
        if (draftId && request.method !== 'POST') {
          const result=await policyCall(agent,'bonus.read','rest',()=>readBonus(agent,{companyId,runId:draftId}))
          return request.method==='HEAD' ? new Response(null,{headers}) : json(result)
        }
        throw new PayrollError('agent_tool_denied',403)
      }
      if (resource === 'records' && !draftId && request.method !== 'POST') {
        if ([...url.searchParams.keys()].some(k => !['limit', 'after'].includes(k)) ||
            [...url.searchParams.keys()].some(k => url.searchParams.getAll(k).length !== 1))
          throw new PayrollError('invalid_record_query')
        const result = await policyCall(agent,'records.list','rest',()=>agent.records({companyId,
          ...(url.searchParams.has('limit') ? {limit: url.searchParams.get('limit')} : {}),
          ...(url.searchParams.has('after') ? {after: url.searchParams.get('after')} : {}),
        }))
        return request.method === 'HEAD' ? new Response(null, {headers}) : json(result)
      }
      if (resource === 'drafts' && !draftId && request.method === 'POST') {
        if (url.search) throw new PayrollError('invalid_draft_input')
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
          throw new PayrollError('unsupported_content_type', 415)
        const value = await input(request)
        if (Object.hasOwn(value, 'companyId')) throw new PayrollError('invalid_draft_input')
        return json(await policyCall(agent,'draft.prepare','rest',()=>agent.prepare({...value, companyId})), 201)
      }
      if (resource === 'drafts' && draftId && request.method !== 'POST') {
        if (url.search) throw new PayrollError('invalid_draft_input')
        const result = await policyCall(agent,'draft.read','rest',()=>agent.readDraft({companyId, draftId}))
        return request.method === 'HEAD' ? new Response(null, {headers}) : json(result)
      }
      throw new PayrollError('agent_tool_denied', 403)
    }
    if (url.pathname === '/api/envelope/mcp') {
      if (request.method !== 'POST')
        return new Response(null, { status: 405, headers: { ...headers, allow: 'POST' } })
      if (
        request.headers.get('sec-fetch-site') === 'cross-site' ||
        (request.headers.has('origin') &&
          request.headers.get('origin') !== env.AUTH_ORIGIN)
      )
        throw new PayrollError('invalid_origin', 403)
      if (request.headers.has('cookie'))
        throw new PayrollError('ambiguous_authentication', 403)
      const bearer = request.headers.get('authorization')
      if (!bearer?.startsWith('Bearer '))
        throw new PayrollError('agent_authentication_required', 401)
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
        throw new PayrollError('unsupported_content_type', 415)
      const agent = await AgentTools.authenticate(env, bearer.slice(7))
      const opened = await agent.log('transport.open', agent.grant.id).run()
      if (!opened.meta.changes) throw new PayrollError('agent_authority_revoked', 403)
      const message = await input(request)
      if (
        message.jsonrpc === '2.0' &&
        message.method === 'notifications/initialized' &&
        !Object.hasOwn(message, 'id')
      )
        return new Response(null, { status: 202, headers })
      if (
        message.jsonrpc !== '2.0' ||
        !(typeof message.id === 'string' || typeof message.id === 'number') ||
        !Number.isFinite(typeof message.id === 'number' ? message.id : 0)
      )
        throw new PayrollError('invalid_mcp_request')
      rpcId = message.id as string | number
      let result: unknown
      if (message.method === 'initialize')
        result = {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'envelope', version: '0.1.0' },
        }
      else if (message.method === 'tools/list') {
        const scopes = JSON.parse(agent.grant.actions)
        result = {
          tools: [
            {
              name: 'credentials.rotate', action: 'rotate', description: 'Replace the current secret, only while the sponsored grant remains current. Old bearer stops immediately.',
              properties: {}, required: [],
            },
            {
              name: 'notice.process', action: 'notices:process', description: 'Extract an untrusted proposal from a saved notice using only the declared OpenAI model. Never approves or invokes model tools.',
              properties: {companyId:{type:'string'},noticeId:{type:'string'}}, required:['companyId','noticeId'],
            },
            {
              name: 'reply.dispatch', action: 'dispatch:execute', description: 'Dispatch only the exact latest unexpired human-approved notice reply through declared Resend. Rechecks current human and sponsor authority. Never approves, pays wages or files returns.',
              properties: {companyId:{type:'string'},replyId:{type:'string'},version:{type:'integer'},digest:{type:'string'}}, required:['companyId','replyId','version','digest'],
            },
            {
              name: 'bonus.prepare', action:'drafts:prepare', description:'Prepare an immutable bonus-only earnings run. Tax and overtime remain uncalculated; never approves or dispatches.',
              properties:{companyId:{type:'string'},personId:{type:'string'},amountCents:{type:'integer',minimum:1,maximum:100000000},periodStart:{type:'string'},periodEnd:{type:'string'},payDate:{type:'string'},sourceRef:{type:'string'},requestKey:{type:'string'}},
              required:['companyId','personId','amountCents','periodStart','periodEnd','payDate','sourceRef','requestKey'],
            },
            {
              name:'bonus.read',action:'drafts:read',description:'Read this credential’s exact immutable bonus earnings and outstanding calculation holds.',
              properties:{companyId:{type:'string'},runId:{type:'string'}},required:['companyId','runId'],
            },
            {
              name: 'run.review', action:'drafts:read', description:'Present a native exact-run review link to a separately authenticated human. Never approves.',
              properties:{companyId:{type:'string'},runId:{type:'string'}},required:['companyId','runId'],
            },
            {
              name: 'records.list',
              action: 'records:read',
              description: 'Read a stable ID-ordered page of scoped person records; no private values. Use next as after.',
              properties: { companyId: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 }, after: { type: 'string' } },
              required: ['companyId'],
            },
            {
              name: 'draft.prepare',
              action: 'drafts:prepare',
              description:
                'Persist one uncalculated run-input proposal from a current person and reviewed effective rate. Never approves, calculates tax or dispatches.',
              properties: {
                companyId: { type: 'string' },
                personId: { type: 'string' },
                minutes: { type: 'integer', minimum: 1, maximum: 44640 },
                periodStart: { type: 'string' },
                periodEnd: { type: 'string' },
                payDate: { type: 'string' },
                sourceRef: { type: 'string' },
                requestKey: { type: 'string' },
              },
              required: [
                'companyId',
                'personId',
                'minutes',
                'periodStart',
                'periodEnd',
                'payDate',
                'sourceRef',
                'requestKey',
              ],
            },
            {
              name:'reports.bonuses',action:'drafts:read',description:'Read a current scoped page of this credential’s native bonus earnings preparations. No calculated payroll or payment claim.',
              properties:{companyId:{type:'string'},limit:{type:'integer',minimum:1,maximum:100},after:{type:'string'}},required:['companyId'],
            },
            {
              name: 'reports.proposals', action: 'drafts:read',
              description: 'Read a current scoped report of this credential’s retained uncalculated input proposals. No payroll totals, payments or filings.',
              properties: {companyId:{type:'string'},limit:{type:'integer',minimum:1,maximum:100},after:{type:'string'}}, required:['companyId'],
            },
            {
              name: 'draft.read',
              action: 'drafts:read',
              description:
                'Read scoped uncalculated proposal and source/rate references.',
              properties: { companyId: { type: 'string' }, draftId: { type: 'string' } },
              required: ['companyId', 'draftId'],
            },
          ]
            .filter((t) => t.action === 'rotate' || scopes.includes(t.action))
            .map(({ name, description, properties, required }) => ({
              name,
              description,
              _meta: {classes: toolClasses[name]},
              inputSchema: {
                type: 'object',
                properties,
                required,
                additionalProperties: false,
              },
            })),
        }
      } else if (message.method === 'tools/call') {
        const params = message.params as Input
        if (
          !params ||
          typeof params !== 'object' ||
          Array.isArray(params) ||
          Object.keys(params).some((k) => !['name', 'arguments'].includes(k))
        )
          throw new PayrollError('invalid_mcp_request')
        const args = params.arguments as Input
        if (!args || typeof args !== 'object' || Array.isArray(args))
          throw new PayrollError('invalid_mcp_request')
        const value = await policyCall(agent,String(params.name),'mcp',async()=>
          params.name === 'credentials.rotate'
            ? Object.keys(args).length ? (() => {throw new PayrollError('invalid_input')})() : await agent.rotate()
            : params.name === 'notice.process'
              ? await processNotice(agent,args)
              : params.name === 'reply.dispatch'
                ? await dispatchReply(agent,args)
                : params.name === 'run.review'
                  ? await presentReview(agent,args)
                  : params.name === 'records.list'
            ? await agent.records(args)
            : params.name === 'reports.bonuses'
              ? await bonusReport(agent,args)
            : params.name === 'bonus.prepare'
              ? await prepareBonus(agent,args)
              : params.name === 'bonus.read'
                ? await readBonus(agent,args)
            : params.name === 'draft.prepare'
              ? await agent.prepare(args)
              : params.name === 'reports.proposals'
                ? await agent.proposalReport(args)
              : params.name === 'draft.read'
                ? await agent.readDraft(args)
                : (() => {
                    throw new PayrollError('agent_tool_denied', 403)
                  })())
        result = { content: [{ type: 'text', text: JSON.stringify(value) }] }
      } else throw new PayrollError('agent_tool_denied', 403)
      return json({ jsonrpc: '2.0', id: message.id, result })
    }
    if (request.headers.has('authorization'))
      throw new PayrollError('human_session_required', 403)
    session = await auth.getSession(request)
    if (!session)
      return ui && request.method !== 'POST'
        ? redirect('/signin?returnTo=%2Fapp%2Fenvelope')
        : json({ error: 'authentication_required' }, 401)
    if (!['native', 'oidc', 'dev'].includes(session.kind))
      throw new PayrollError('human_session_required', 403)
    if (
      !(await env.DB.prepare(
        'SELECT singleton FROM oa_first_run WHERE singleton=1',
      ).first())
    )
      throw new PayrollError('finish_setup_required', 409)
    if (
      request.method === 'POST' &&
      (request.headers.get('origin') !== env.AUTH_ORIGIN ||
        request.headers.get('sec-fetch-site') === 'cross-site')
    )
      throw new PayrollError('invalid_origin', 403)
    const parts = (
      ui
        ? url.pathname.slice('/app/envelope'.length) || '/companies'
        : url.pathname.slice('/api/envelope'.length)
    )
      .split('/')
      .filter(Boolean)
    if (parts.some((p) => !/^[-a-zA-Z0-9]+$/.test(p)))
      throw new PayrollError('not_found', 404)
    const records = new Records(env, session),
      post = request.method === 'POST',
      value = post ? await input(request) : {},
      companies = ui ? await records.companies() : []
    verificationLanguage = (url.searchParams.get('lang') ?? value.lang ?? (request.headers.get('accept-language')?.startsWith('es') ? 'es' : 'en')) === 'es' ? 'es' : 'en'
    const claim = await claimsResponse({ ui, post, parts, value, records, session, companies })
    if (claim) return claim
    const industry = await industryResponse({ ui, post, parts, value, records, session, companies })
    if (industry) return industry
    const accounting = await accountingResponse({ ui, post, parts, value, records, session, companies })
    if (accounting) return accounting
    const automation = await automationResponse({ ui, post, parts, value, records, session, companies })
    if (automation) return automation
    const firm = await firmResponse({ url, ui, post, parts, value, records, session, companies })
    if (firm) return firm
    if (!ui && parts[0]==='companies' && parts.length===3 && ['calculation-preview','calculation-coverage'].includes(parts[2])) {
      const actor=await records.actor(parts[1])
      ownerOnly(actor)
      await records.company(actor)
      if(parts[2]==='calculation-coverage' && !post) return json(stateCoverage())
      if(parts[2]==='calculation-preview' && post){
        let result
        try {
          let retirement
          if (value.extendedRetirement) {
            const selection=value.extendedRetirement as Record<string,unknown>
            if (Object.keys(selection).some(k=>!['personId','setupId','setupVersion','request'].includes(k))) throw new PayrollError('unsupported_retirement_input')
            retirement=(await new ExtendedRetirement(new WorkspaceStore(records)).preview(actor,String(selection.personId),{setupId:selection.setupId,setupVersion:selection.setupVersion,request:selection.request},false)).result
          }
          const ref = value.nyDbl as {personId:string;proposalId:string;version:number} | undefined
          const dbl = ref ? await new NyDbl(new WorkspaceStore(records)).calculation(actor,ref.personId,ref.proposalId,ref.version) : undefined
          result=calculationPreview(value as unknown as PreviewInput,retirement,dbl)
        }
        catch(error){ if(error instanceof PayrollError)throw error; throw new PayrollError(error instanceof Error?error.message:'invalid_calculation_input') }
        if (value.hiBenefits) {
          const benefits = await new HiPlanShares(new WorkspaceStore(records)).preview(actor,value.hiBenefits as HiPreviewRequest,{from:String(value.from),through:String(value.through),payDate:String(value.payDate),grossCents:result.grossCashCents,workState:String(value.workState),weeks:result.earnings?.weeks})
          result = { ...result, hiBenefits:benefits }
        }
        // Repeat current authority immediately before returning the private result.
        await records.company(await records.actor(parts[1]))
        return json(result)
      }
      throw new PayrollError('not_found',404)
    }
    if (!ui && parts[0]==='companies' && parts[2]==='people' && parts[4]==='benefits' && parts[5]==='extended-retirement') {
      const actor=await records.actor(parts[1]),benefits=new ExtendedRetirement(new WorkspaceStore(records)),personId=parts[3]
      if (parts.length===6) return json(post ? await benefits.save(actor,personId,value) : await benefits.list(actor,personId),post?201:200)
      if (parts.length===7 && parts[6]==='preview' && post) return json(await benefits.preview(actor,personId,value),201)
      if (parts.length===8 && parts[6]==='review' && !post) return json(await benefits.review(actor,personId,parts[7]))
      if (parts.length===8 && parts[6]==='decision' && post) return json(await benefits.decide(actor,personId,parts[7],value))
      throw new PayrollError('not_found',404)
    }
    let response: Response
    if (ui && parts.join('/') === 'workspace' && !post)
      return workspacePage(session, companies)
    if (parts[0] === 'protected-response') {
      if (ui && !post && parts.length===1) return protectedResponsePage(session,undefined,undefined,verificationLanguage)
      if (post && parts.length===2 && ['read','ack'].includes(parts[1])) {
        const result=await new ProtectedResponses(new WorkspaceStore(records)).retrieve(String(value.id),value,parts[1]==='ack')
        return ui?protectedResponsePage(session,result,{id:String(value.id),token:String(value.token)},verificationLanguage):json(result)
      }
      throw new PayrollError('not_found',404)
    }
    if (!ui && parts.length === 3 && parts[0] === 'recovery' && parts[2] === 'tax-history' && !post)
      return json(await new ArchiveHistory(records).taxHistory(parts[1]))
    if (!ui && parts.length === 2 && parts[0] === 'recovery' && parts[1] === 'consents' && !post)
      return json(await new ArchiveHistory(records).consents())
    if (!ui && parts.length === 1 && parts[0] === 'recovery') {
      const history = new ArchiveHistory(records)
      return json(post ? await history.adopt(value) : await history.list(), post ? 201 : 200)
    }
    if (!ui && parts.length === 2 && parts[0] === 'reports' && parts[1] === 'combined-labor' && !post) return json(await combinedLaborReport(records))
    if (parts[0] !== 'companies') throw new PayrollError('not_found', 404)
    if (parts.length === 1) {
      if (post) {
        const company = await records.createCompany(value)
        response = ui ? redirect(companyPath(company.id)) : json(company, 201)
      } else
        response = ui ? companyIndex(session, companies) : json(await records.companies())
    } else {
      const companyId = parts[1],
        actor = await records.actor(companyId),
        tail = parts.slice(2),
        base = companyPath(companyId)
      if (!ui && tail[0] === 'people' && tail[2] === 'hi-benefits') {
        const benefits = new HiPlanShares(new WorkspaceStore(records)), personId = tail[1]
        await benefits.scope(actor,personId)
        if (tail.length===3 && !post) response=json(await benefits.list(actor,personId))
        else if (tail.length===4 && tail[3]==='plans' && post) response=json(await benefits.save(actor,personId,value),201)
        else if (tail.length===4 && tail[3]==='preview' && post) {
          if (value.personId !== personId) throw new PayrollError('hi_person_mismatch',409)
          response=json(await benefits.preview(actor,value as unknown as HiPreviewRequest),201)
        }
        else if (tail.length===6 && tail[3]==='plans' && tail[5]==='review' && !post) response=json(await benefits.review(actor,personId,tail[4]))
        else if (tail.length===6 && tail[3]==='plans' && tail[5]==='approve' && post) response=json(await benefits.approve(actor,personId,tail[4],value))
        else throw new PayrollError('not_found',404)
      } else if (!ui && tail[0]==='people' && tail[2]==='retirement') {
        const retirement=new RetirementRecords(new WorkspaceStore(records)),personId=tail[1]
        if (tail.length===3) response=json(post?await retirement.save(actor,personId,value):await retirement.list(actor,personId),post?201:200)
        else if (tail.length===4 && tail[3]==='review' && !post) response=json(await retirement.review(actor,personId))
        else if (tail.length===4 && tail[3]==='approve' && post) response=json(await retirement.approve(actor,personId,value))
        else if (tail.length===4 && tail[3]==='preview' && post) response=json(await retirement.preview(actor,personId,value),201)
        else throw new PayrollError('not_found',404)
      } else if (!ui && tail[0] === 'ny-dbl-plans') {
        const dbl = new NyDbl(new WorkspaceStore(records)), store = dbl.store
        await dbl.scope(actor)
        if (tail.length===1) response=json(post?await dbl.savePlan(actor,value):await dbl.plans(actor),post?201:200)
        else if(tail.length===3 && tail[2]==='review' && !post) response=json(await store.review(actor,'ny-dbl-plan',tail[1]))
        else if(tail.length===3 && tail[2]==='approve' && post) response=json(await store.decide(actor,'ny-dbl-plan',tail[1],value))
        else throw new PayrollError('not_found',404)
      } else if (!ui && tail[0]==='people' && tail[2]==='ny-dbl') {
        const dbl = new NyDbl(new WorkspaceStore(records)), person=tail[1]
        await dbl.scope(actor,person)
        if(tail.length===3 && !post) response=json(await dbl.history(actor,person))
        else if(tail.length===4 && tail[3]==='evidence' && post) response=json(await dbl.saveEvidence(actor,person,value),201)
        else if(tail.length===5 && tail[3]==='evidence' && tail[4]==='review' && !post) response=json(await dbl.store.review(actor,'ny-dbl-evidence',person,person))
        else if(tail.length===5 && tail[3]==='evidence' && tail[4]==='approve' && post) response=json(await dbl.store.decide(actor,'ny-dbl-evidence',person,value,person))
        else if(tail.length===4 && tail[3]==='proposals' && post) response=json(await dbl.prepare(actor,person,value),201)
        else if(tail.length===4 && tail[3]==='remittance' && post) throw new PayrollError('dbl_carrier_remittance_unavailable',409)
        else throw new PayrollError('not_found',404)
      } else if (!ui && tail[0] === 'funding-accounts' && tail.length === 1) {
        const payroll = new CompanyPayroll(records)
        response = json(post ? await payroll.account(actor, value) : await payroll.accounts(actor), post ? 201 : 200)
      } else if (!ui && tail[0] === 'funding-plans') {
        const payroll = new CompanyPayroll(records)
        if (tail.length === 1) response = json(post ? await payroll.plan(actor, value) : await payroll.plans(actor), post ? 201 : 200)
        else if (tail.length === 3 && tail[2] === 'release' && post) response = json(await payroll.release(actor, tail[1], value))
        else throw new PayrollError('not_found', 404)
      } else if (tail.join('/') === 'new-hire-coverage' && !post) {
        const reporting=new NewHireReporting(new WorkspaceStore(records));reporting.owner(actor)
        const result=newHireCoverage()
        response=ui?coveragePage(session,companies,actor,result):json(result)
      } else if (tail[0]==='new-hire-elections') {
        const reporting=new NewHireReporting(new WorkspaceStore(records)), store=reporting.store
        reporting.owner(actor)
        if(tail.length===1 && post) {const result=await reporting.election(actor,value);response=ui?redirect(base+'/new-hire-elections'):json(result,201)}
        else if(tail.length===3 && tail[2]==='review' && !post) {const result=await store.review(actor,'new-hire-election',tail[1]);response=ui?electionContent(session,companies,actor,await reporting.elections(actor),result):json(result)}
        else if(tail.length===3 && tail[2]==='approve' && post) {const result=await store.decide(actor,'new-hire-election',tail[1],value);response=ui?redirect(base+'/new-hire-elections'):json(result)}
        else if(tail.length===1 && !post) response=ui?electionContent(session,companies,actor,await reporting.elections(actor)):json(await reporting.elections(actor))
        else throw new PayrollError('not_found',404)
      } else if (tail[0]==='people' && tail[2]==='withholding-instructions') {
        const instructions=new WithholdingInstructions(new WorkspaceStore(records)),person=tail[1],door=base+'/people/'+person+'/withholding-instructions'
        if(tail.length===3 && !post) {
          const history=await instructions.history(actor,person)
          response=ui?withholdingInstructionPage(session,companies,actor,person,history):json(history)
        } else if(tail.length===3 && post) {
          const result=await instructions.save(actor,person,value)
          response=ui?redirect(door):json(result,201)
        } else if(tail.length===4 && !post && tail[3]==='review') {
          const review=await instructions.review(actor,person)
          response=ui?withholdingInstructionPage(session,companies,actor,person,review.history,review):json(review)
        } else if(tail.length===4 && post && tail[3]==='approve') {
          const result=await instructions.approve(actor,person,value)
          response=ui?redirect(door):json(result)
        } else if(tail.length===5 && !post && tail[3]==='original' && /^\d+$/.test(tail[4])) {
          response=new Response(await instructions.original(actor,person,Number(tail[4])),{headers:{...headers,'content-type':['application','pdf'].join('/'),'content-disposition':'attachment; filename="withholding-instruction.pdf"','x-content-type-options':'nosniff'}})
        } else throw new PayrollError('not_found',404)
      } else if (tail[0]==='people' && tail[2]==='new-hire-reports') {
        const reporting=new NewHireReporting(new WorkspaceStore(records)),person=await records.person(actor,tail[1]),id=tail[3], action=tail[4],back=base+'/people/'+person.id+'/new-hire-reports'
        if(tail.length===3 && !post) response=ui?newHirePage(session,companies,actor,person,await reporting.reports(actor,person.id),undefined,undefined,url.searchParams.get('directory') ?? 'OH',url.searchParams.get('repair') ?? undefined):json(await reporting.reports(actor,person.id))
        else if(tail.length===3 && post) {const result=await reporting.save(actor,person.id,value);response=ui?redirect(back):json(result,201)}
        else if(tail.length===5 && action==='review' && !post) {const review=await reporting.review(actor,person.id,id);response=ui?newHirePage(session,companies,actor,person,await reporting.reports(actor,person.id),review):json(review)}
        else if(tail.length===5 && post) {
          const result=action==='approve'?await reporting.approve(actor,person.id,id,value):action==='repair'?await reporting.save(actor,person.id,value,id):action==='response'?await reporting.response(actor,person.id,id,value):action==='transfer'?await reporting.transfer(actor,person.id,id,value):(()=>{throw new PayrollError('not_found',404)})()
          response=ui?(action==='transfer'?newHirePage(session,companies,actor,person,await reporting.reports(actor,person.id),undefined,result as Awaited<ReturnType<NewHireReporting['transfer']>>):redirect(back)):json(result)
        } else throw new PayrollError('not_found',404)
      } else if (!ui && tail.length === 1 && tail[0] === 'operations' && !post) {
        response = json(await new Lifecycle(records).health(actor))
      } else if (!ui && tail.length === 2 && tail[0] === 'operations' && tail[1] === 'diagnose' && post) {
        response = json(await new Lifecycle(records).diagnose(actor,value))
      } else if (!ui && tail[0] === 'webhooks') {
        const lifecycle = new Lifecycle(records)
        if (tail.length === 1) response = json(post ? await lifecycle.subscribe(actor,value) : await lifecycle.read(actor),post ? 201 : 200)
        else if (tail.length === 3 && post && tail[2] === 'revoke') response = json(await lifecycle.revoke(actor,tail[1]))
        else if (tail.length === 3 && post && tail[2] === 'deliver') response = json(await lifecycle.deliver(actor,tail[1],value))
        else if (tail.length === 3 && post && tail[2] === 'recover') response = json(await lifecycle.recover(actor,tail[1]))
        else throw new PayrollError('not_found',404)
      } else if (!tail.length && !post) {
        const company = await records.company(actor),
          locations = await records.locations(actor),
          people =
            actor.grant.role === 'owner' || actor.grant.actions.includes('records:read')
              ? await records.people(actor)
              : []
        response = ui
          ? companyPage(session, companies, company, actor, locations, people)
          : json({ company, locations, people })
      } else if (tail[0]==='hris-hires') {
        const store=new WorkspaceStore(records),hires=new HrisHires(store),back=base+'/hris-hires'
        if(tail.length===1 && !post){const rows=await hires.read(actor);response=ui?hirePage(session,companies,actor,rows):json(rows)}
        else if(tail.length===1 && post){const result=await hires.save(actor,value);response=ui?redirect(back):json(result,201)}
        else if(tail.length===3 && tail[2]==='review' && !post){const result=await store.review(actor,'hris-hire',tail[1]);response=ui?hirePage(session,companies,actor,await hires.read(actor),result as unknown as import('./workspace/store').Revision<import('./intake/sources').SourceEvent>&{reviewToken:string}):json(result)}
        else if(tail.length===3 && tail[2]==='approve' && post){const result=await store.decide(actor,'hris-hire',tail[1],value);response=ui?redirect(back):json(result)}
        else if(tail.length===3 && tail[2]==='apply' && post){const result=await hires.apply(actor,tail[1],value);response=ui?redirect(base+'/people/'+result.id):json(result,result.created?201:200)}
        else throw new PayrollError('not_found',404)
      } else if (tail.join('/') === 'workspace' && !post) {
        response = ui
          ? workspacePage(session, companies, actor, await records.people(actor))
          : json({ preparation: 'available', payments: 'unavailable' })
      } else if (tail.join('/') === 'schedules') {
        const schedules = new Schedules(new WorkspaceStore(records))
        if (post) {
          try {
            const saved = await schedules.save(actor, value)
            response = ui ? redirect(base + '/schedules') : json(saved, 201)
          } catch (error) {
            if (
              !(error instanceof PayrollError) ||
              error.code !== 'ny_manual_weekly_required'
            )
              throw error
            response = ui
              ? weeklyFrequencyRefusalPage(session, companies, actor)
              : json({ error: error.code, alternative: { frequency: 'weekly' } }, 400)
          }
        } else {
          const result = await schedules.read(actor)
          response = ui
            ? schedulesPage(
                session,
                companies,
                actor,
                await records.people(actor),
                result,
                url.searchParams.get('edit') ?? undefined,
              )
            : json(result)
        }
      } else if (tail[0] === 'rules') {
        const store = new WorkspaceStore(records),
          rules = new Rules(store)
        if (!post && tail.length === 1) {
          const result = await rules.read(
            actor,
            url.searchParams.get('asOf') ?? undefined,
          )
          response = ui ? rulesPage(session, companies, actor, result) : json(result)
        } else if (post && tail.length === 1) {
          const saved = await rules.save(actor, value)
          response = ui ? redirect(base + '/rules') : json(saved, 201)
        } else if (!post && tail.length === 3 && tail[1] === 'review') {
          const row = await store.review(actor, 'rule', tail[2])
          response = ui ? ruleReviewPage(session, companies, actor, row) : json(row)
        } else if (
          post &&
          tail.length === 3 &&
          ['approve', 'withdraw'].includes(tail[2])
        ) {
          const result = await store.decide(
            actor,
            'rule',
            tail[1],
            value,
            undefined,
            tail[2] === 'withdraw',
          )
          response = ui ? redirect(base + '/rules') : json(result)
        } else throw new PayrollError('not_found', 404)
      } else if (tail[0] === 'pay-settings') {
        const store = new WorkspaceStore(records),
          pay = new PayItems(store),
          approvals = new RunApprovals(store, pay),
          setupKinds = ['group', 'pay-item', 'pay-change', 'proration-policy', 'approval-policy', 'run-input']
        // The two-person threshold is the owner's own policy, end to end.
        if ((tail[1] === 'review' ? tail[2] : tail[1]) === 'approval-policy' && actor.grant.role !== 'owner')
          throw new PayrollError('owner_required', 403)
        if (tail[1] === 'intake' && (!post || tail.length > 2)) {
          const intake=new RunIntake(store), back=base+'/pay-settings/intake', intakeSession=session
          const render=async(preview?:Awaited<ReturnType<RunIntake['preview']>>,review?:import('./workspace/store').Revision<RunInput>&{reviewToken:string})=>runIntakePage(intakeSession,companies,actor,await records.people(actor),await intake.rows(actor),preview,review)
          if(!post && tail.length===2)response=ui?await render():json(await intake.rows(actor))
          else if(!post && tail.length===3 && tail[2]==='template'){
            await store.authority(actor,'records:read',undefined,true)
            const format=url.searchParams.get('format') || 'csv'
            response=new Response(intakeTemplate(format),{headers:{...headers,'content-type':['application','octet-stream'].join('/'),'content-disposition':`attachment; filename="earnings-template.${format}"`}})
          } else if(post && tail.length===3 && tail[2]==='preview'){
            const result=await intake.preview(actor,value);response=ui?await render(result):json(result)
          } else if(post && tail.length===3 && tail[2]==='apply'){
            const result=await intake.apply(actor,value);response=ui?redirect(back):json(result,201)
          } else if(!post && tail.length===4 && tail[3]==='review'){
            const result=await store.review<RunInput>(actor,'run-intake',tail[2]);response=ui?await render(undefined,result):json(result)
          } else if(post && tail.length===4 && ['approve','withdraw'].includes(tail[3])){
            const result=await store.decide(actor,'run-intake',tail[2],value,undefined,tail[3]==='withdraw');response=ui?redirect(back):json(result)
          } else throw new PayrollError('not_found',404)
        } else if (!post && tail.length === 1) {
          const result = await pay.read(actor),
            statuses = await approvals.statuses(actor, result.runs),
            policies = await store.list<ApprovalPolicy>(actor, 'approval-policy', undefined, true, false)
          response = ui
            ? paySettingsPage(
                session,
                companies,
                actor,
                await records.people(actor),
                result,
                undefined,
                { statuses, policies },
              )
            : json({ ...result, approvals: statuses, approvalPolicies: policies })
        } else if (!post && tail.length === 3 && tail[1] === 'earnings-template') {
          await store.authority(actor,'records:read',undefined,true)
          response = earningsTemplate(tail[2])
        } else if (post && tail.join('/') === 'pay-settings/intake-preview') {
          response = json((await new RunInputs(store).prepare(actor,value)).data)
        } else if (post && tail.join('/') === 'pay-settings/intake') {
          const saved = await new RunInputs(store).save(actor,value)
          response = ui ? redirect(base + '/pay-settings/review/run-input/'+saved.id) : json(saved,201)
        } else if (post && tail.length === 2 && setupKinds.includes(tail[1])) {
          if(tail[1]==='run-input') throw new PayrollError('use_run_intake_door',400)
          const saved =
            tail[1] === 'group'
              ? await pay.group(actor, value)
              : tail[1] === 'pay-item'
                ? await pay.item(actor, value)
                : tail[1] === 'proration-policy'
                  ? await new PayPolicies(store, pay).save(actor, value)
                  : tail[1] === 'approval-policy'
                    ? await approvals.savePolicy(actor, value)
                    : await pay.change(actor, value)
          response = ui ? redirect(base + '/pay-settings') : json(saved, 201)
        } else if (post && tail.join('/') === 'pay-settings/preview') {
          const result = await pay.preview(actor, value)
          response = ui
            ? paySettingsPage(
                session,
                companies,
                actor,
                await records.people(actor),
                await pay.read(actor),
                result,
              )
            : json(result)
        } else if (post && tail.join('/') === 'pay-settings/earnings-run') {
          const result = await pay.preview(actor, value, true)
          response = ui ? redirect(base + '/pay-settings') : json(result, 201)
        } else if (post && tail.join('/') === 'pay-settings/passkeys/options') {
          response = json(await new HumanProof(store).registration(actor))
        } else if (post && tail.join('/') === 'pay-settings/passkeys/register') {
          response = json(await new HumanProof(store).register(actor,String(value.id),value.response as never))
        } else if (!post && tail.length === 4 && tail[1] === 'earnings-run' && tail[3] === 'review') {
          const row = await approvals.review(actor, tail[2],url.searchParams.get('presentation') ?? undefined)
          response = ui ? runReviewPage(session, companies, actor, row) : json(row)
        } else if (post && tail.length === 4 && tail[1] === 'earnings-run' && tail[3] === 'approve') {
          const result = await approvals.approve(actor, tail[2], value)
          response = ui ? redirect(base + '/pay-settings') : json(result)
        } else if (post && tail.length === 4 && tail[1] === 'earnings-run' && tail[3] === 'release') {
          // Release always ends in a named refusal today; the screen says why nothing was sent.
          try {
            await approvals.release(actor, tail[2], value)
            throw new PayrollError('run_not_payable', 409)
          } catch (error) {
            if (!ui || !(error instanceof PayrollError) || error.status !== 409) throw error
            const refused = releaseRefusalPage(session, companies, actor, tail[2], error.code)
            response = new Response(refused.body, { status: 409, headers: refused.headers })
          }
        } else if (
          !post &&
          tail.length === 4 &&
          tail[1] === 'review' &&
          setupKinds.includes(tail[2])
        ) {
          const row = await store.review(actor, tail[2] as Kind, tail[3])
          response = ui ? exactReviewPage(session, companies, actor, row) : json(row)
        } else if (
          post &&
          tail.length === 4 &&
          setupKinds.includes(tail[1]) &&
          ['approve', 'withdraw'].includes(tail[3])
        ) {
          const result = await store.decide(
            actor,
            tail[1] as Kind,
            tail[2],
            value,
            undefined,
            tail[3] === 'withdraw',
          )
          response = ui ? redirect(base + '/pay-settings') : json(result)
        } else throw new PayrollError('not_found', 404)
      } else if (tail.join('/') === 'providers') {
        const providers = new Providers(records)
        if (post) {
          const result = await providers.save(actor,value)
          response = ui ? redirect(base+'/providers') : json(result,201)
        } else {
          providers.owner(actor)
          const result = await providers.list(actor)
          response = ui ? providersPage(session,companies,actor,result) : json(result)
        }
      } else if (tail[0] === 'notices') {
        const notices = new Notices(records)
        if (tail.length===3 && tail[2]==='people' && post) {
          response=json(await notices.linkWorker(actor,tail[1],value),201)
        } else if (tail.length===1 && post) {
          const result = await notices.create(actor,value)
          response = ui ? redirect(base+'/notices/'+result.id) : json(result,201)
        } else if (tail.length===1 && !post) {
          const result = await notices.list(actor)
          response = ui ? noticesPage(session,companies,actor,await records.locations(actor),result) : json(result)
        } else if (tail.length===2 && !post) {
          const result = await notices.details(actor,tail[1])
          response = ui ? noticePage(session,companies,actor,result) : json(result)
        } else if (tail[2]==='case' && tail.length>=3) {
          const cases=new TaxNoticeCases(new WorkspaceStore(records)),id=tail[1],action=tail[3]
          if(!post && tail.length===3) {
            const history=await cases.history(actor,id)
            response=ui?taxNoticeCasePage(session,companies,actor,id,history):json(history)
          } else if(post && tail.length===3) {
            const result=await cases.save(actor,id,value)
            response=ui?redirect(base+'/notices/'+id+'/case'):json(result,201)
          } else if(!post && tail.length===4 && action==='review') {
            const review=await cases.review(actor,id)
            response=ui?taxNoticeCasePage(session,companies,actor,id,review.history,review):json(review)
          } else if(post && tail.length===4 && ['approve','evidence','link-rate'].includes(action)) {
            const result=await (action==='approve'?cases.approve(actor,id,value):action==='evidence'?cases.evidence(actor,id,value):cases.linkRate(actor,id,value))
            response=ui?redirect(base+'/notices/'+id+'/case'):json(result)
          } else if(!post && tail.length===6 && action==='original' && /^\d+$/.test(tail[4]) && /^\d+$/.test(tail[5])) {
            response=new Response(await cases.original(actor,id,Number(tail[4]),Number(tail[5])),{headers:{...headers,'content-type':['application','pdf'].join('/'),'content-disposition':'attachment; filename="tax-notice.pdf"','x-content-type-options':'nosniff'}})
          } else throw new PayrollError('not_found',404)
        } else if (tail.length===3 && tail[2]==='replies' && post) {
          const result = await notices.saveReply(actor,tail[1],value)
          response = ui ? redirect(base+'/notices/'+tail[1]) : json(result,201)
        } else throw new PayrollError('not_found',404)
      } else if (tail[0] === 'notice-replies' && tail.length===3) {
        const notices = new Notices(records)
        if (tail[2]==='review' && !post) {
          const result = await notices.review(actor,tail[1])
          response = ui ? replyReviewPage(session,companies,actor,result) : json(result)
        } else if (tail[2]==='approve' && post) {
          const result = await notices.approve(actor,tail[1],value)
          response = ui ? redirect(base+'/notices') : json(result)
        } else if (tail[2]==='withdraw' && post) {
          const result = await notices.withdraw(actor,tail[1],value)
          response = ui ? redirect(base+'/notices') : json(result)
        } else throw new PayrollError('not_found',404)
      } else if (tail[0] === 'agents') {
        const agents = new AgentSettings(records)
        if (tail.length === 1 && post) {
          const issued = await agents.issue(actor, value)
          response = ui
            ? issuedAgentPage(session, companies, actor, issued)
            : json(issued, 201)
        } else if (tail.length === 1 && !post) {
          const grants = await agents.list(actor),
            access = await agents.access(actor),
            classPolicy = await new AgentPolicy(records).read(actor),
            activity = await new AgentPolicy(records).activity(actor,url.searchParams.get('from') ?? undefined,url.searchParams.get('through') ?? undefined)
          response = ui
            ? agentsPage(
                session,
                companies,
                actor,
                await records.locations(actor),
                grants,
                await agents.policy(actor),
                await new Providers(records).list(actor),
                classPolicy,activity,
              )
            : json({ grants, access, classPolicy, activity })
        } else if (tail.length === 2 && tail[1] === 'class-policy' && post) {
          const result = await new AgentPolicy(records).save(actor,value)
          response = ui ? redirect(base+'/agents#class-policy') : json(result)
        } else if (tail.length === 2 && tail[1] === 'pause' && post) {
          const result = await new AgentPolicy(records).save(actor,value,true)
          response = ui ? redirect(base+'/agents#class-policy') : json(result)
        } else if (tail.join('/') === 'agents/policy' && post) {
          const result = await agents.setPolicy(actor,value)
          response = ui ? redirect(base+'/agents') : json(result)
        } else if (tail.join('/') === 'agents/access' && !post) {
          response = json(await agents.access(actor))
          response.headers.set(
            'content-disposition',
            'attachment; filename="agent-access.json"',
          )
        } else if (tail.length === 3 && tail[2] === 'revoke' && post) {
          const revoked = await agents.revoke(actor, tail[1], value)
          response = ui ? redirect(base + '/agents') : json(revoked)
        } else throw new PayrollError('not_found', 404)
      } else if (tail.join('/') === 'drafts' && !post) {
        const drafts = await new AgentSettings(records).drafts(actor)
        response = ui ? draftsPage(session, companies, actor, drafts) : json(drafts)
      } else if (tail[0] === 'setup') {
        const setup = new CompanySetup(records)
        if (!post && tail.length === 1) {
          const register = await setup.read(
            actor,
            url.searchParams.get('asOf') ?? new Date().toISOString().slice(0, 10),
          )
          response = ui ? setupPage(session, companies, actor, register) : json(register)
        } else if (post && tail.join('/') === 'setup/profile') {
          const saved = await setup.saveProfile(actor, value)
          response = ui ? redirect(base + '/setup') : json(saved, 201)
        } else if (post && tail.join('/') === 'setup/jurisdictions') {
          const saved = await setup.saveJurisdiction(actor, value)
          response = ui ? redirect(base + '/setup') : json(saved, 201)
        } else throw new PayrollError('not_found', 404)
      } else if (tail.join('/') === 'locations' && post) {
        const location = await records.createLocation(actor, value)
        response = ui ? redirect(base) : json(location, 201)
      } else if (tail.join('/') === 'case-policy' && post) {
        const result=await new TaxNoticeCases(new WorkspaceStore(records)).setPolicy(actor,value)
        response=ui?redirect(base+'/grants'):json(result)
      } else if (tail.join('/') === 'paper-policy' && post) {
        const result=await new PaperOnboarding(new WorkspaceStore(records)).setPolicy(actor,value)
        response=ui?redirect(base+'/grants'):json(result)
      } else if (tail.join('/') === 'grants') {
        if (post) {
          const grant = await records.setGrant(actor, value)
          response = ui ? redirect(`${base}/grants`) : json(grant)
        } else {
          const grants = await records.grants(actor)
          response = ui
            ? grantsPage(
                session,
                companies,
                actor,
                await records.locations(actor),
                grants,
                await auth.listOperators(request),
                url.searchParams.get('operator') ?? undefined,
                await new WorkspaceStore(records).paperPolicy(actor),
                await new WorkspaceStore(records).casePolicy(actor),
              )
            : json(grants)
        }
      } else if (tail.join('/') === 'people' && post) {
        const person = await records.createPerson(actor, value)
        response = ui ? redirect(`${base}/people/${person.id}`) : json(person, 201)
      } else if (tail[0]==='people' && tail[2]==='paper-onboarding') {
        const onboarding=new PaperOnboarding(new WorkspaceStore(records)), personId=tail[1]
        const back=base+'/people/'+personId+'/paper-onboarding',viewer=session
        const screen=async(review?:Awaited<ReturnType<PaperOnboarding['review']>>)=>{
          const rows=await onboarding.history(actor,personId),person=await records.person(actor,personId)
          const workerType=url.searchParams.get('workerType')==='contractor'?'contractor':url.searchParams.has('workerType')?'employee':rows[0]?.data.workerType ?? 'employee'
          const federalForm=workerType==='contractor'?'W-9':url.searchParams.get('federalForm')==='W-4-pre2020'?'W-4-pre2020':'W-4'
          const stateForm=workerType==='contractor'?'none':url.searchParams.get('stateForm')==='PA-residency'?'PA-residency':'OH-IT-4'
          return paperOnboardingPage(viewer,companies,actor,person,rows,{workerType,federalForm,stateForm},review)
        }
        if (tail.length===3) {
          if (post) {const result=await onboarding.save(actor,personId,value);response=ui?redirect(back):json(result,201)}
          else response=ui?await screen():json(await onboarding.history(actor,personId))
        }
        else if (tail.length===4 && tail[3]==='review' && !post) {const result=await onboarding.review(actor,personId);response=ui?await screen(result):json(result)}
        else if (tail.length===4 && ['approve','withdraw'].includes(tail[3]) && post) {const result=await onboarding.decide(actor,personId,value,tail[3]==='withdraw');response=ui?redirect(back):json(result)}
        else if (tail.length===6 && tail[3]==='original' && !post) {
          const original=await onboarding.original(actor,personId,tail[4],tail[5])
          response=new Response(original,{headers:{...headers,'content-type':['application','octet-stream'].join('/'),'content-disposition':'attachment; filename="signed-paper.pdf"',
            'content-security-policy':"sandbox; default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'x-download-options':'noopen'}})
        } else throw new PayrollError('not_found',404)
      } else if (tail[0]==='people' && tail[2]==='verification') {
        const store=new WorkspaceStore(records), verification=new VerificationRequests(store), personId=tail[1], self=actor.grant.role!=='owner', back=base+'/people/'+personId+'/verification'+(verificationLanguage==='es'?'?lang=es':'')
        const view=async()=>{
          const history=await verification.history(actor,personId,self)
          const disclosures=self?[]:await store.list<import('./income-verification/requests').ProtectedDisclosure>(actor,'disclosure',personId,true)
          return {history,bindings:self?[]:await store.list<import('./income-verification/requests').WorkerBinding>(actor,'verification-worker',personId,true),income:self?[]:await store.list<import('./income-verification/requests').IncomeSource>(actor,'income-source',personId,true),disclosures:disclosures.map(r=>{
            const consent=history.consents.find(c=>c.id===r.data.consentId)
            return consent && retentionDeadline(consent.retentionUntil)>=Date.now()?r:{...r,data:{...r.data,response:{retention:'restricted-after-selected-date'},provenance:[]}}
          })}
        }
        if(!post && tail.length===3){
          const result=await view()
          response=ui?verificationPage(session,companies,actor,await records.person(actor,personId),result,self,undefined,undefined,verificationLanguage):json(result)
        } else if(post && tail.length===4 && ['worker','income','consents','disclosures'].includes(tail[3])){
          const result=tail[3]==='worker'?await verification.bind(actor,personId,value):tail[3]==='income'?await verification.income(actor,personId,value):tail[3]==='consents'?await verification.consent(actor,personId,value):await verification.propose(actor,personId,value)
          response=ui?redirect(back):json(result,201)
        } else if(post && tail.length===6 && tail[3]==='consents' && ['revoke','corrections'].includes(tail[5])){
          const result=tail[5]==='revoke'?await verification.revoke(actor,personId,tail[4]):await verification.correction(actor,personId,tail[4],value)
          response=ui?redirect(back):json(result)
        } else if(tail.length===6 && ['verification-worker','income-source','disclosure'].includes(tail[3])){
          ownerOnly(actor)
          const kind=tail[3] as 'verification-worker'|'income-source'|'disclosure'
          if(!post && tail[5]==='review'){
            const result=await store.review(actor,kind,tail[4],personId)
            response=ui?verificationPage(session,companies,actor,await records.person(actor,personId),await view(),false,result,undefined,verificationLanguage):json(result)
          } else if(post && ['approve','withdraw'].includes(tail[5])){
            const result=await store.decide(actor,kind,tail[4],value,personId,tail[5]==='withdraw')
            response=ui?redirect(back):json(result)
          } else if(post && kind==='disclosure' && tail[5]==='release'){
            const result=await new ProtectedResponses(store).release(actor,personId,tail[4],value)
            response=ui?verificationPage(session,companies,actor,await records.person(actor,personId),await view(),false,undefined,result,verificationLanguage):json(result,201)
          } else throw new PayrollError('not_found',404)
        } else throw new PayrollError('not_found',404)
      } else if (tail.join('/') === 'labor-actuals' && !post) {
        await new WorkspaceStore(records).authority(actor, 'records:read', undefined, true)
        throw new PayrollError('reconciled_labor_actuals_unavailable', 409)
      } else if (tail[0] === 'people' && ['hris','earnings-sources'].includes(tail[2])) {
        const store = new WorkspaceStore(records), intake = new SourceIntake(store), personId=tail[1], kind=tail[2]==='hris'?'hris-event':'source-earning'
        const back=base+'/people/'+personId+'/'+tail[2]
        if (!post && tail.length===3) {
          const result=await intake.read(actor,personId,kind)
          response=ui?sourcePage(session,companies,actor,await records.person(actor,personId),kind,result):json(result)
        } else if (post && tail.length===3) {
          const result=await intake.save(actor,personId,kind,value)
          response=ui?redirect(back):json(result,201)
        } else if (!post && tail.length===5 && tail[4]==='review') {
          const result=await store.review(actor,kind,tail[3],personId)
          response=ui?sourcePage(session,companies,actor,await records.person(actor,personId),kind,await intake.read(actor,personId,kind),result as unknown as import('./workspace/store').Revision<import('./intake/sources').SourceEvent> & {reviewToken:string}):json(result)
        } else if (post && kind==='hris-event' && tail.length===5 && tail[4]==='location-handoff') {
          const result=await intake.location(actor,personId,tail[3],value)
          response=ui?redirect(back):json(result)
        } else if (post && kind==='hris-event' && tail.length===5 && tail[4]==='leave-handoff') {
          const result=await intake.leave(actor,personId,tail[3],value)
          response=ui?redirect(base+'/people/'+personId+'/leave'):json(result,201)
        } else if (post && tail.length===5 && ['approve','withdraw'].includes(tail[4])) {
          const result=await store.decide(actor,kind,tail[3],value,personId,tail[4]==='withdraw')
          response=ui?redirect(back):json(result)
        } else throw new PayrollError('not_found',404)
      } else if (tail[0] === 'people' && tail[2] === 'leave') {
        const store = new WorkspaceStore(records), ledger = new LeaveLedger(store), personId = tail[1], bucket = leaveBucket(post ? value.bucket : url.searchParams.get('bucket') ?? undefined), id = leaveId(personId, bucket)
        const back = base + '/people/' + personId + '/leave' + (bucket === 'combined' ? '' : '?bucket=' + bucket)
        if (!post && tail.length === 3) {
          const rows = await ledger.read(actor, personId)
          response = ui ? leavePage(session, companies, actor, await records.person(actor, personId), rows, undefined, bucket) : json(rows)
        } else if (post && tail.length === 3) {
          const result = await ledger.open(actor, personId, value)
          response = ui ? redirect(back) : json(result, 201)
        } else if (post && tail.length === 4 && tail[3] === 'entries') {
          const result = await ledger.record(actor, personId, value)
          response = ui ? redirect(back) : json(result, 201)
        } else if (!post && tail.length === 4 && tail[3] === 'review') {
          const result = await store.review(actor, 'leave-account', id, personId)
          response = ui ? leavePage(session, companies, actor, await records.person(actor, personId), await ledger.read(actor, personId), result as unknown as import('./workspace/store').Revision<import('./leave/ledger').LeaveAccount> & {reviewToken: string}, bucket) : json(result)
        } else if (post && tail.length === 4 && ['approve','withdraw'].includes(tail[3])) {
          const result = await store.decide(actor, 'leave-account', id, value, personId, tail[3] === 'withdraw')
          response = ui ? redirect(back) : json(result)
        } else throw new PayrollError('not_found', 404)
      } else if (tail[0] === 'people' && tail[2] === 'allocations') {
        const allocations = new Allocations(new WorkspaceStore(records)),
          personId = tail[1]
        if (!post && !ui && tail.length === 4 && tail[3] === 'tip-intake') {
          response = json(await allocations.store.list(actor, 'tip', personId, true))
        } else if (!post && !ui && tail.length === 4 && tail[3] === 'tip-template') {
          await allocations.store.authority(actor, 'rates:propose', personId, true)
          response = new Response(tipTemplate, { headers: { ...headers, 'content-type': ['text', 'csv'].join('/') + '; charset=utf-8', 'content-disposition': 'attachment; filename="tip-intake.csv"' } })
        } else if (post && !ui && tail.length === 4 && tail[3] === 'tip-intake') {
          response = json(await new TipIntake(allocations.store).record(actor, personId, value))
        } else if (!post && tail.length === 3) {
          const person = await records.person(actor, personId)
          const preview = url.searchParams.has('from')
            ? await allocations.preview(actor, personId, {
                from: url.searchParams.get('from'),
                through: url.searchParams.get('through'),
                payDate:url.searchParams.get('payDate'),frequency:url.searchParams.get('frequency'),
              })
            : undefined
          const history = preview?.history ?? (await allocations.read(actor, personId))
          response = ui
            ? allocationsPage(session, companies, actor, person, history, preview, {
                kind: url.searchParams.get('edit') ?? '',
                id: url.searchParams.get('id') ?? '',
              })
            : json(preview ?? history)
        } else if (
          post &&
          tail.length === 4 &&
          ['residence', 'work', 'election', 'tax-election', 'local-tax-input', 'tip'].includes(tail[3])
        ) {
          const saved = tail[3] === 'tax-election' ? await new TaxElections(allocations.store).save(actor,personId,value) :
            tail[3] === 'local-tax-input' ? await new LocalTaxInputs(allocations.store).save(actor,personId,value) :
            tail[3] === 'tip' ? await new Tips(allocations.store).save(actor,personId,value) : await allocations.save(
            actor,
            personId,
            tail[3] as 'residence' | 'work' | 'election',
            value,
          )
          response = ui
            ? redirect(base + '/people/' + personId + '/allocations')
            : json(saved, 201)
        } else throw new PayrollError('not_found', 404)
      } else if (!ui && tail[0] === 'privacy-provider-requests') {
        const privacy=new ProviderPrivacy(new WorkspaceStore(records))
        if (!post && tail.length===1) response=json(await privacy.read(actor))
        else if (post && tail.length<=2) response=json(await privacy.save(actor,value,tail[1]),201)
        else throw new PayrollError('not_found',404)
      } else if (tail[0] === 'privacy-requests' && tail.length===1 && !post) {
        const rows=await new WorkerPrivacy(records).requests(actor)
        response=ui?privacyPage(session,companies,actor,undefined,rows):json(rows)
      } else if (tail[0] === 'people' && tail[2] === 'privacy') {
        const privacy = new WorkerPrivacy(records)
        if (!post && tail.length === 3) {const state=await privacy.read(actor,tail[1]);response=ui?privacyPage(session,companies,actor,state,await privacy.requests(actor)):json(state)}
        else if (post && tail.length === 4 && ['request','retain','release'].includes(tail[3])) {const state=tail[3]==='request'?await privacy.request(actor,tail[1],value):await privacy.review(actor,tail[1],value,tail[3]==='release');response=ui?redirect(base+'/people/'+tail[1]+'/privacy'):json(state)}
        else throw new PayrollError('not_found', 404)
      } else if (tail[0] === 'people' && tail[2] === 'erase' && tail.length === 3 && post) {
        const receipt=await new WorkerPrivacy(records).erase(actor,tail[1],value)
        response=ui?redirect(base+'/privacy-requests'):json(receipt)
      } else if (tail[0] === 'people' && tail.length === 2 && !post) {
        const person = await records.details(actor, tail[1])
        response = ui ? personPage(session, companies, actor, person) : json(person)
      } else if (
        tail[0] === 'people' &&
        tail[2] === 'private' &&
        tail.length === 3 &&
        post
      ) {
        const stored = await records.savePrivate(actor, tail[1], value)
        response = ui ? redirect(`${base}/people/${tail[1]}`) : json(stored, 201)
      } else if (
        !ui &&
        tail[0] === 'people' &&
        tail[2] === 'private' &&
        tail.length === 4 &&
        !post
      ) {
        const privateValue = await records.readPrivate(actor, tail[1], tail[3])
        response = new Response(privateValue, {
          headers: {
            ...headers,
            'content-type': 'text/plain; charset=utf-8',
            'content-disposition': 'attachment; filename="private-record.txt"',
          },
        })
      } else if (
        tail[0] === 'people' &&
        tail[2] === 'rates' &&
        tail.length === 3 &&
        post
      ) {
        const proposal = await records.proposeRate(actor, tail[1], value)
        response = ui
          ? redirect(
              actor.grant.role === 'owner' ||
                actor.grant.actions.includes('rates:approve')
                ? `${base}/rates/${proposal.id}`
                : `${base}/people/${tail[1]}`,
            )
          : json(proposal, 201)
      } else if (tail[0] === 'rates' && tail.length === 2 && !post) {
        const proposal = await records.reviewRate(actor, tail[1])
        response = ui ? ratePage(session, companies, actor, proposal) : json(proposal)
      } else if (
        tail[0] === 'rates' &&
        tail[2] === 'approve' &&
        tail.length === 3 &&
        post
      ) {
        const approved = await records.approveRate(actor, tail[1], value)
        response = ui ? redirect(base) : json(approved)
      } else if (!ui && tail.join('/') === 'audit' && !post) {
        response = json(await records.audit(actor))
        response.headers.set(
          'content-disposition',
          'attachment; filename="payroll-audit.json"',
        )
      } else if (!ui && tail.join('/') === 'export' && !post) {
        response = new Response(await records.export(actor), {
          headers: {
            ...headers,
            'content-type': ['text', 'csv'].join('/') + '; charset=utf-8',
            'content-disposition': 'attachment; filename="record-register.csv"',
          },
        })
      } else throw new PayrollError('not_found', 404)
    }
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response
  } catch (error) {
    const known = error instanceof PayrollError,
      code = known ? error.code : 'payroll_unavailable',
      status = known ? error.status : 503
    if (url.pathname === '/api/envelope/mcp')
      return json(
        {
          jsonrpc: '2.0',
          id: rpcId,
          error: { code: status === 400 ? -32602 : -32000, message: code, ...(error instanceof AgentPolicyError ? {data:{setupLink:error.setupLink}} : {}) },
        },
        status,
      )
    if (ui && session) {
      const verificationDoor = url.pathname.includes('/verification') || url.pathname.includes('/protected-response')
      const response = verificationDoor ? verificationErrorPage(session, code, verificationLanguage) : errorPage(session, code)
      return new Response(request.method === 'HEAD' ? null : response.body, {
        status,
        headers: response.headers,
      })
    }
    return request.method === 'HEAD'
      ? new Response(null, { status, headers })
      : json({ error: code, ...(error instanceof AgentPolicyError ? {setupLink:error.setupLink} : {}) }, status)
  }
}
