import type { Bindings } from '../auth.server'
import type { OperatorAuth } from '../modules/operator-auth/index.mjs'
import { Records, type Input } from './records'
import { AgentSettings, AgentTools } from './agents'
import { agentsPage, issuedAgentPage, draftsPage } from './agent-pages'
import { CompanySetup } from './setup'
import { WorkspaceStore } from './workspace/store'
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
import { PayItems } from './workspace/pay-items'
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
  if (!request.body) throw new PayrollError('invalid_input')
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [],
    limit = 64000
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
  const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    type = request.headers.get('content-type')?.split(';')[0]
  if (type === 'application/x-www-form-urlencoded') {
    const params = new URLSearchParams(body),
      result: Input = {}
    for (const key of new Set(params.keys())) {
      const values = params.getAll(key)
      result[key] = ['actions', 'fields', 'locations', 'people'].includes(key)
        ? values
        : values.length === 1
          ? values[0]
          : (() => {
              throw new PayrollError('duplicate_input')
            })()
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
              name: 'records.list',
              action: 'records:read',
              description: 'Read up to 100 scoped person records; no private values.',
              properties: { companyId: { type: 'string' } },
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
              name: 'draft.read',
              action: 'drafts:read',
              description:
                'Read scoped uncalculated proposal and source/rate references.',
              properties: { companyId: { type: 'string' }, draftId: { type: 'string' } },
              required: ['companyId', 'draftId'],
            },
          ]
            .filter((t) => scopes.includes(t.action))
            .map(({ name, description, properties, required }) => ({
              name,
              description,
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
        const value =
          params.name === 'records.list'
            ? await agent.records(args)
            : params.name === 'draft.prepare'
              ? await agent.prepare(args)
              : params.name === 'draft.read'
                ? await agent.readDraft(args)
                : (() => {
                    throw new PayrollError('agent_tool_denied', 403)
                  })()
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
    let response: Response
    if (ui && parts.join('/') === 'workspace' && !post)
      return workspacePage(session, companies)
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
      if (!tail.length && !post) {
        const company = await records.company(actor),
          locations = await records.locations(actor),
          people =
            actor.grant.role === 'owner' || actor.grant.actions.includes('records:read')
              ? await records.people(actor)
              : []
        response = ui
          ? companyPage(session, companies, company, actor, locations, people)
          : json({ company, locations, people })
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
          pay = new PayItems(store)
        if (!post && tail.length === 1) {
          const result = await pay.read(actor)
          response = ui
            ? paySettingsPage(
                session,
                companies,
                actor,
                await records.people(actor),
                result,
              )
            : json(result)
        } else if (
          post &&
          tail.length === 2 &&
          ['group', 'pay-item', 'pay-change'].includes(tail[1])
        ) {
          const saved =
            tail[1] === 'group'
              ? await pay.group(actor, value)
              : tail[1] === 'pay-item'
                ? await pay.item(actor, value)
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
        } else if (
          !post &&
          tail.length === 4 &&
          tail[1] === 'review' &&
          ['group', 'pay-item', 'pay-change'].includes(tail[2])
        ) {
          const row = await store.review(actor, tail[2] as Kind, tail[3])
          response = ui ? exactReviewPage(session, companies, actor, row) : json(row)
        } else if (
          post &&
          tail.length === 4 &&
          ['group', 'pay-item', 'pay-change'].includes(tail[1]) &&
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
      } else if (tail[0] === 'agents') {
        const agents = new AgentSettings(records)
        if (tail.length === 1 && post) {
          const issued = await agents.issue(actor, value)
          response = ui
            ? issuedAgentPage(session, companies, actor, issued)
            : json(issued, 201)
        } else if (tail.length === 1 && !post) {
          const grants = await agents.list(actor),
            access = await agents.access(actor)
          response = ui
            ? agentsPage(
                session,
                companies,
                actor,
                await records.locations(actor),
                grants,
              )
            : json({ grants, access })
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
              )
            : json(grants)
        }
      } else if (tail.join('/') === 'people' && post) {
        const person = await records.createPerson(actor, value)
        response = ui ? redirect(`${base}/people/${person.id}`) : json(person, 201)
      } else if (tail[0] === 'people' && tail[2] === 'allocations') {
        const allocations = new Allocations(new WorkspaceStore(records)),
          personId = tail[1]
        if (!post && tail.length === 3) {
          const person = await records.person(actor, personId)
          const preview = url.searchParams.has('from')
            ? await allocations.preview(actor, personId, {
                from: url.searchParams.get('from'),
                through: url.searchParams.get('through'),
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
          ['residence', 'work', 'election'].includes(tail[3])
        ) {
          const saved = await allocations.save(
            actor,
            personId,
            tail[3] as 'residence' | 'work' | 'election',
            value,
          )
          response = ui
            ? redirect(base + '/people/' + personId + '/allocations')
            : json(saved, 201)
        } else throw new PayrollError('not_found', 404)
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
            'content-type': 'text/csv; charset=utf-8',
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
          error: { code: status === 400 ? -32602 : -32000, message: code },
        },
        status,
      )
    if (ui && session) {
      const response = errorPage(session, code)
      return new Response(request.method === 'HEAD' ? null : response.body, {
        status,
        headers: response.headers,
      })
    }
    return request.method === 'HEAD'
      ? new Response(null, { status, headers })
      : json({ error: code }, status)
  }
}
