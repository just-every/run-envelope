import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { read, utils, write } from '@e965/xlsx'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes, createHash } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { localCookieName } from '../src/modules/operator-auth/http.mjs'

/** Run intake through the same native HTTP and built screens used by employers. */
export async function runIntakeCases({ origin, cookie, sql, settings }) {
  const call = (path, body, who = cookie) =>
    fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'manual',
      headers: { cookie: who, origin, 'content-type': ['application', 'json'].join('/') },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  const data = async (path, body, status = 200, who = cookie) => {
    const r = await call(path, body, who)
    assert.equal(r.status, status, await r.clone().text())
    return r.json()
  }
  const company = await data(
      '/api/envelope/companies',
      { name: 'Synthetic run intake employer', ein: '00-0000800' },
      201
    ),
    api = '/api/envelope/companies/' + company.id
  const location = await data(
    api + '/locations',
    { name: 'Intake workplace', state: 'CO' },
    201
  )
  const people = []
  for (const name of [
    'Synthetic server one',
    'Synthetic server two',
    'Synthetic worker three',
  ])
    people.push(
      await data(api + '/people', { name, locationId: location.id }, 201)
    )
  const pay = api + '/pay-settings',
    door = pay + '/intake',
    runId = 'synthetic-envelope-800',
    namespace = 'synthetic-envelope-801'
  const setup = async (kind, id, body) => {
    await data(pay + '/' + kind, { id, version: 0, ...body }, 201)
    const r = await data(pay + '/review/' + kind + '/' + id)
    await data(pay + '/' + kind + '/' + id + '/approve', {
      version: r.version,
      reviewToken: r.reviewToken,
    })
  }
  await setup('group', 'synthetic-envelope-802', {
    name: 'Intake group',
    people: people.map((p) => p.id),
  })
  await setup('pay-change', 'synthetic-envelope-803', {
    name: 'Reviewed hourly rates',
    groupId: 'synthetic-envelope-802',
    effectiveDate: '2026-01-01',
    items: people.map((p) => ({
      personId: p.id,
      personVersion: p.version,
      rateCents: 1000,
      basis: 'hourly',
      employmentFrom: '2026-01-01',
      employmentThrough: '2027-12-31',
      unpaidDates: [],
    })),
  })
  const base = {
    day: '2026-11-02',
    workweek: '2026-11-02',
    code: 'regular',
    minutes: 0,
    amountCents: 0,
    settlement: '',
    evidence: 'synthetic-envelope-804',
    state: '',
    riskClass: '',
  }
  const rows = people.map((p, i) => ({
    ...base,
    sourceId: 'synthetic-envelope-' + (810 + i),
    personId: p.id,
    minutes: [480, 60, 120][i],
  }))
  rows.push(
    {
      ...base,
      sourceId: 'synthetic-envelope-813',
      personId: people[0].id,
      code: 'tip',
      amountCents: 60000,
      settlement: 'cash',
    },
    {
      ...base,
      sourceId: 'synthetic-envelope-814',
      personId: people[1].id,
      code: 'tip',
      amountCents: 30000,
      settlement: 'paycheck',
    },
    {
      ...base,
      sourceId: 'synthetic-envelope-815',
      personId: people[2].id,
      code: 'bonus',
      amountCents: 10000,
    },
    {
      ...base,
      sourceId: 'synthetic-envelope-816',
      personId: people[2].id,
      code: 'reimbursement',
      amountCents: 2500,
    }
  )
  const preview = (body) =>
    data(door + '/preview', { id: runId, namespace, ...body })
  const apply = (p) =>
    data(
      door + '/apply',
      {
        id: p.id,
        version: p.version,
        namespace: p.data.namespace,
        rows: p.data.rows,
        digest: p.digest,
        fileDigest: p.data.fileDigest,
        format: p.data.format,
      },
      201
    )
  const approve = async (version) => {
    const r = await data(door + '/' + runId + '/review')
    assert.equal(r.version, version)
    await data(door + '/' + runId + '/approve', {
      version,
      reviewToken: r.reviewToken,
    })
  }
  const run = (version) =>
    data(
      pay + '/earnings-run',
      {
        id: runId,
        version,
        groupId: 'synthetic-envelope-802',
        periodStart: '2026-11-02',
        periodEnd: '2026-11-15',
        payDate: '2026-11-16',
        frequency: 'biweekly',
      },
      201
    )
  await data(
    door + '/preview',
    {
      id: runId,
      namespace,
      version: 0,
      rows: [{ ...rows[3], settlement: '' }],
    },
    409
  )
  await data(
    door + '/preview',
    {
      id: runId,
      namespace,
      version: 0,
      rows: [{ ...rows[0], personId: 'synthetic-envelope-unknown' }],
    },
    409
  )
  await data(
    door + '/preview',
    { id: runId, namespace, version: 0, rows: [rows[0], rows[0]] },
    400
  )
  const initial = await preview({ version: 0, rows })
  assert.equal(
    initial.cells.filter((c) => c.field === 'amountCents' && c.after === 60000)
      .length,
    1
  )
  await apply(initial)
  await data(
    pay + '/earnings-run',
    {
      id: runId,
      version: 0,
      groupId: 'synthetic-envelope-802',
      periodStart: '2026-11-02',
      periodEnd: '2026-11-15',
      payDate: '2026-11-16',
      frequency: 'biweekly',
    },
    409
  )
  await approve(1)
  const first = await run(0)
  assert.equal(
    first.preview.grossCashCents,
    53500,
    'already-held tips add no second payout'
  )
  assert.deepEqual(
    first.preview.people.map((p) => [
      p.earningsCents,
      p.cashTipsCents,
      p.paycheckTipsCents,
      p.reimbursementCents,
    ]),
    [
      [8000, 60000, 0, 0],
      [1000, 0, 30000, 0],
      [12000, 0, 0, 2500],
    ]
  )
  assert.equal(first.preview.taxAmounts, null)
  assert.equal(first.preview.paymentReady, false)
  const replay = await apply(await preview({ version: 1, rows }))
  assert.equal(replay.replayed, true)
  assert.equal(replay.version, 1)
  await data(
    door + '/preview',
    {
      id: 'synthetic-envelope-duplicate-run',
      namespace,
      version: 0,
      rows: [rows[0]],
    },
    409
  )
  await data(
    pay + '/earnings-run',
    {
      id: 'synthetic-envelope-second-run',
      intakeRunId: runId,
      version: 0,
      groupId: 'synthetic-envelope-802',
      periodStart: '2026-11-02',
      periodEnd: '2026-11-15',
      payDate: '2026-11-16',
      frequency: 'biweekly',
    },
    409
  )

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'],
  })
  try {
    const context = await browser.newContext(),
      [name, value] = cookie.split('=')
    await context.addCookies([{ name, value, url: origin }])
    const page = await context.newPage()
    const folder = process.env.ENVELOPE_PROOF_DIR ?? './test-results/envelope'
    await mkdir(folder, { recursive: true })
    const capture = async (label) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          ),
          true,
          label
        )
        for (const c of await page.locator('button,a,summary').all())
          assert.ok((await c.innerText()).trim(), label)
        await page.screenshot({
          path: join(folder, label + '-' + width + '.png'),
          fullPage: true,
        })
      }
    }
    await page.goto(origin + door.replace('/api/', '/app/'))
    await capture('run-intake-entry')
    // The grid is a native form. Its three rows use the same diff and apply door as files.
    await page.setViewportSize({ width: 1440, height: 1000 })
    const grid = page
      .locator('form')
      .filter({
        has: page.getByRole('button', {
          name: 'Preview exact cell changes',
          exact: true,
        }),
      })
    await grid.locator('[name="id"]').fill(runId)
    await grid.locator('[name="version"]').fill('1')
    await grid.locator('[name="namespace"]').fill(namespace)
    for (let i = 0; i < 3; i++) {
      await page.getByText('Manual row ' + (i + 1), { exact: true }).click()
      for (const field of [
        'sourceId',
        'day',
        'workweek',
        'minutes',
        'evidence',
      ])
        await page
          .locator(`[name="row${i}.${field}"]`)
          .fill(String(rows[i][field]))
      await page.locator(`[name="row${i}.personId"]`).selectOption(people[i].id)
    }
    await page
      .getByRole('button', { name: 'Preview exact cell changes', exact: true })
      .click()
    await page
      .getByRole('heading', {
        name: 'Exact changes before applying',
        exact: true,
      })
      .waitFor()
    assert.match(
      await page.locator('main').innerText(),
      /Unchanged; replay creates no new earnings/
    )
    await capture('run-intake-cell-diff')
    await page
      .getByRole('button', { name: 'Apply these exact changes', exact: true })
      .click()
    await page.waitForURL(origin + door.replace('/api/', '/app/'))

    let version = 1
    for (const [i, format] of ['csv', 'xls', 'xlsx'].entries()) {
      const response = await call(door + '/template?format=' + format)
      assert.equal(response.status, 200)
      const book = read(new Uint8Array(await response.arrayBuffer()), {
          type: 'array',
        }),
        sheet = book.Sheets[book.SheetNames[0]],
        headers = utils.sheet_to_json(sheet, { header: 1 })[0]
      // An independent expected set exercises changed, preserved and zeroed values.
      const patches = [
        { sourceId: rows[0].sourceId, minutes: 481 + i },
        { sourceId: rows[3].sourceId, amountCents: '' },
        { sourceId: rows[5].sourceId, amountCents: 0 },
      ]
      const customHeaders = headers.map((h) =>
        h === 'minutes' ? 'Worked minutes' : h
      )
      book.Sheets[book.SheetNames[0]] = utils.aoa_to_sheet([
        customHeaders,
        ...patches.map((p) => headers.map((h) => p[h] ?? '')),
      ])
      const bytes = write(book, {
        type: 'array',
        bookType: format === 'xls' ? 'biff8' : format,
      })
      const form = new FormData()
      form.set('id', runId)
      form.set('version', String(version))
      form.set('namespace', namespace)
      form.set('columnMap', JSON.stringify({ minutes: 'Worked minutes' }))
      form.set('file', new File([bytes], 'synthetic-envelope-820.' + format))
      const uploaded = await fetch(origin + door + '/preview', {
        method: 'POST',
        headers: { cookie, origin },
        body: form,
      })
      assert.equal(uploaded.status, 200, await uploaded.clone().text())
      const diff = await uploaded.json()
      assert.equal(
        diff.data.rows.find((r) => r.sourceId === rows[3].sourceId).amountCents,
        60000,
        'blank preserves held tips'
      )
      assert.equal(
        diff.data.rows.find((r) => r.sourceId === rows[5].sourceId).amountCents,
        0,
        'explicit zero removes the bonus'
      )
      assert.ok(
        diff.cells.some(
          (c) =>
            c.sourceId === rows[0].sourceId &&
            c.field === 'minutes' &&
            c.status === 'change' &&
            c.after === 481 + i
        )
      )
      assert.equal(diff.data.fileDigest, createHash('sha256').update(new Uint8Array(bytes)).digest('hex'), 'provenance hashes the exact uploaded bytes')
      if (i === 0) {
        await page.goto(origin + door.replace('/api/', '/app/'))
        await page.setViewportSize({ width: 1440, height: 1000 })
        const upload = page
          .locator('form')
          .filter({
            has: page.getByRole('button', {
              name: 'Preview exact cell changes',
              exact: true,
            }),
          })
        await upload.locator('[name="id"]').fill(runId)
        await upload.locator('[name="version"]').fill(String(version))
        await upload.locator('[name="namespace"]').fill(namespace)
        await page.getByText('Map spreadsheet columns', { exact: true }).click()
        await upload.locator('[name="map.minutes"]').fill('Worked minutes')
        await upload
          .locator('[name="file"]')
          .setInputFiles({
            name: 'synthetic-envelope-820.csv',
            mimeType: ['text', 'csv'].join('/'),
            buffer: Buffer.from(bytes),
          })
        await page
          .getByRole('button', {
            name: 'Preview exact cell changes',
            exact: true,
          })
          .click()
        await page
          .getByRole('heading', {
            name: 'Exact changes before applying',
            exact: true,
          })
          .waitFor()
        assert.match(await page.locator('main').innerText(), /480 → 481/)
        assert.match(await page.locator('main').innerText(), /10000 → 0/)
        await capture('run-intake-file-diff')
        await page
          .getByRole('button', {
            name: 'Apply these exact changes',
            exact: true,
          })
          .click()
        await page.waitForURL(origin + door.replace('/api/', '/app/'))
      } else await apply(diff)
      version++
      assert.equal(
        (await data(pay)).runs.find((r) => r.id === runId && r.version === 1)
          .sourceStatus,
        'changed-repreview-required'
      )
      await approve(version)
      const retained = await data(door)
      assert.equal(
        retained.find((r) => r.version === version).data.fileDigest,
        diff.data.fileDigest
      )
      const same = await apply(await preview({ version, rows: diff.data.rows }))
      assert.equal(same.replayed, true)
      assert.equal(same.version, version)
    }
    const correction = await preview({
      version,
      rows: [{ sourceId: rows[3].sourceId, settlement: 'paycheck' }],
    })
    assert.ok(
      correction.cells.some(
        (c) =>
          c.field === 'settlement' &&
          c.before === 'cash' &&
          c.after === 'paycheck' &&
          c.status === 'change'
      )
    )
    await apply(correction)
    version++
    await page.goto(
      origin + (door + '/' + runId + '/review').replace('/api/', '/app/')
    )
    await capture('run-intake-exact-review')
    await approve(version)
    const revised = await run(1)
    assert.equal(revised.preview.people[0].cashTipsCents, 0)
    assert.equal(revised.preview.people[0].paycheckTipsCents, 60000)
    assert.equal(
      revised.preview.grossCashCents,
      103550,
      'settlement edit changes only actual new cash plus corrected regular hours'
    )
    const retainedRuns = (await data(pay)).runs
    assert.equal(
      retainedRuns.find((r) => r.version === 1 && r.id === runId).data
        .grossCashCents,
      53500,
      'frozen prior version retained'
    )
    await page.goto(origin + door.replace('/api/', '/app/'))
    await capture('run-intake-reviewed-history')
    await data(door + '/' + runId + '/withdraw', { version })
    await data(
      pay + '/earnings-run',
      {
        id: runId,
        version: 2,
        groupId: 'synthetic-envelope-802',
        periodStart: '2026-11-02',
        periodEnd: '2026-11-15',
        payDate: '2026-11-16',
        frequency: 'biweekly',
      },
      409
    )
    assert.equal((await call(door, undefined, '')).status, 401)
    const foreign = await data(
      '/api/envelope/companies',
      { name: 'Synthetic foreign intake company', ein: '00-0000801' },
      201
    )
    await data(
      '/api/envelope/companies/' + foreign.id + '/pay-settings/intake/preview',
      { id: runId, version: 0, namespace, rows: [rows[0]] },
      409
    )
    const raceRow = { ...rows[0], sourceId: 'synthetic-envelope-raced-source' }
    const candidates = await Promise.all(
      ['synthetic-envelope-race-one', 'synthetic-envelope-race-two'].map((id) =>
        data(door + '/preview', { id, namespace, version: 0, rows: [raceRow] })
      )
    )
    const raced = await Promise.all(
      candidates.map((p) =>
        call(door + '/apply', {
          id: p.id,
          version: 0,
          namespace,
          rows: p.data.rows,
          digest: p.digest,
          format: p.data.format,
        })
      )
    )
    assert.deepEqual(
      raced.map((r) => r.status).sort(),
      [201, 409],
      'concurrent runs cannot claim the same source'
    )
    assert.equal(
      (await data(door)).filter((r) => candidates.some((c) => c.id === r.id))
        .length,
      1
    )
    const currentRows = await data(door),
      stale = await preview({
        version,
        rows: [{ sourceId: rows[0].sourceId, minutes: 480 }],
      })
    await data(
      door + '/apply',
      {
        id: runId,
        namespace,
        version,
        rows: stale.data.rows,
        digest: 'synthetic-envelope-not-the-preview',
        format: 'grid',
      },
      409
    )
    assert.deepEqual(
      await data(door),
      currentRows,
      'a changed preview digest writes no source version'
    )
    const staff = {}
    for (const name of ['preparer', 'reviewer']) {
      const id = 'synthetic-envelope-intake-' + name,
        token = randomBytes(32).toString('base64url'),
        hash = await hashToken(settings.SESSION_SECRET, 'session', token)
      await sql(
        `INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('${id}','intake-${name}@example.com','Synthetic ${name}','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('${id}-session','${hash}','${id}',1,'native',${Date.now()},${Date.now() + 3600000})`
      )
      staff[name] = {
        id,
        cookie: localCookieName('operator_session_local', origin) + '=' + token,
      }
      await data(api + '/grants', {
        operatorId: id,
        version: 0,
        role: 'payroll-admin',
        locations: ['*'],
        fields: ['compensation'],
        actions: [
          'records:read',
          name === 'preparer' ? 'rates:propose' : 'rates:approve',
        ],
      })
    }
    const staffId = 'synthetic-envelope-staff-run',
      staffBody = {
        id: staffId,
        version: 0,
        namespace,
        rows: [{ ...rows[0], sourceId: 'synthetic-envelope-staff-source' }],
      }
    const staffDiff = await data(
      door + '/preview',
      staffBody,
      200,
      staff.preparer.cookie
    )
    await data(
      door + '/apply',
      {
        ...staffBody,
        rows: staffDiff.data.rows,
        digest: staffDiff.digest,
        format: 'grid',
      },
      201,
      staff.preparer.cookie
    )
    await data(
      door + '/' + staffId + '/review',
      undefined,
      403,
      staff.preparer.cookie
    )
    await data(
      door + '/preview',
      { ...staffBody, version: 1 },
      403,
      staff.reviewer.cookie
    )
    const reviewed = await data(
      door + '/' + staffId + '/review',
      undefined,
      200,
      staff.reviewer.cookie
    )
    await data(
      door + '/' + staffId + '/approve',
      { version: 1, reviewToken: reviewed.reviewToken },
      200,
      staff.reviewer.cookie
    )
    const attributed = (await data(door)).find((r) => r.id === staffId)
    assert.equal(attributed.createdBy, staff.preparer.id)
    assert.equal(attributed.approvedBy, staff.reviewer.id)
    const pending = await data(
      door + '/preview',
      {
        ...staffBody,
        version: 1,
        rows: [{ ...staffBody.rows[0], minutes: 10 }],
      },
      200,
      staff.preparer.cookie
    )
    await data(api + '/grants', {
      operatorId: staff.preparer.id,
      version: 1,
      revoke: true,
    })
    await data(
      door + '/apply',
      {
        ...staffBody,
        version: 1,
        rows: pending.data.rows,
        digest: pending.digest,
        format: 'grid',
      },
      401,
      staff.preparer.cookie
    )
    assert.equal(
      (
        await call(
          door + '/template?format=xlsx',
          undefined,
          staff.preparer.cookie
        )
      ).status,
      401
    )
    assert.equal((await data(door)).filter((r) => r.id === staffId).length, 1)
    await setup('group', 'synthetic-envelope-week-group', {
      name: 'Actual workweeks',
      people: [people[2].id],
    })
    await setup('pay-change', 'synthetic-envelope-week-rate', {
      name: 'Reviewed nonexempt weekly rate',
      groupId: 'synthetic-envelope-week-group',
      effectiveDate: '2026-01-01',
      items: [
        {
          personId: people[2].id,
          personVersion: people[2].version,
          rateCents: 1000,
          basis: 'hourly',
          salaryType: 'nonexempt',
          employmentFrom: '2026-01-01',
          employmentThrough: '2027-12-31',
          unpaidDates: [],
        },
      ],
    })
    const weekly = []
    for (const [week, dates, hours] of [
      ['2026-11-02', ['02', '03', '04', '05', '06'], 9],
      ['2026-11-09', ['09', '10', '11', '12', '13'], 7],
    ]) {
      for (const day of dates)
        weekly.push({
          ...base,
          sourceId: 'synthetic-envelope-week-' + day,
          personId: people[2].id,
          day: '2026-11-' + day,
          workweek: week,
          minutes: hours * 60,
        })
    }
    weekly.push(
      {
        ...base,
        sourceId: 'synthetic-envelope-week-bonus',
        personId: people[2].id,
        code: 'nondiscretionary-bonus',
        amountCents: 9000,
      },
      {
        ...base,
        sourceId: 'synthetic-envelope-wa-one',
        personId: people[2].id,
        code: 'wa-assessment-hours',
        minutes: 75.5,
        state: 'WA',
        riskClass: 'synthetic-envelope-class-one',
      },
      {
        ...base,
        sourceId: 'synthetic-envelope-wa-two',
        personId: people[2].id,
        code: 'wa-assessment-hours',
        minutes: 120.25,
        state: 'WA',
        riskClass: 'synthetic-envelope-class-two',
      },
      {
        ...base,
        sourceId: 'synthetic-envelope-or-partial',
        personId: people[2].id,
        code: 'or-assessment-hours',
        minutes: 0.125,
        state: 'OR',
      }
    )
    const weekId = 'synthetic-envelope-week-run',
      weekBody = { id: weekId, version: 0, namespace, rows: weekly }
    const weekDiff = await data(door + '/preview', weekBody)
    await data(
      door + '/apply',
      {
        ...weekBody,
        rows: weekDiff.data.rows,
        digest: weekDiff.digest,
        format: 'grid',
      },
      201
    )
    const weekReview = await data(door + '/' + weekId + '/review')
    await data(door + '/' + weekId + '/approve', {
      version: 1,
      reviewToken: weekReview.reviewToken,
    })
    const weeklyResult = await data(
      pay + '/earnings-run',
      {
        id: weekId,
        version: 0,
        groupId: 'synthetic-envelope-week-group',
        periodStart: '2026-11-02',
        periodEnd: '2026-11-15',
        payDate: '2026-11-16',
        frequency: 'biweekly',
      },
      201
    )
    // Independently: week one $450 wages + $90 bonus, rate $12, half-time $6 * 5 = $30;
    // week two $350 wages. Averaging the 80 hours would wrongly omit that $30.
    assert.equal(weeklyResult.preview.grossCashCents, 92000)
    assert.ok(
      weeklyResult.preview.people[0].details.some(
        (d) =>
          d.includes('2026-11-02: 45 hours, 5 overtime hours') &&
          d.includes('3000 cents additional half-time')
      )
    )
    const preserved = (await data(door)).find((r) => r.id === weekId).data.rows
    assert.deepEqual(
      preserved
        .filter((r) => r.code.endsWith('assessment-hours'))
        .map((r) => [r.code, r.minutes, r.riskClass]),
      [
        ['or-assessment-hours', 0.125, ''],
        ['wa-assessment-hours', 75.5, 'synthetic-envelope-class-one'],
        ['wa-assessment-hours', 120.25, 'synthetic-envelope-class-two'],
      ]
    )
    assert.equal(
      (
        await data(
          door + '/apply',
          {
            ...weekBody,
            version: 1,
            digest: (await data(door + '/preview', { ...weekBody, version: 1 }))
              .digest,
            format: 'grid',
          },
          201
        )
      ).replayed,
      true
    )
    const formula = utils.book_new()
    utils.book_append_sheet(
      formula,
      utils.aoa_to_sheet([['sourceId'], [{ f: '1+1', v: 2, t: 'n' }]]),
      'Earnings'
    )
    const badForm = new FormData()
    badForm.set('id', runId)
    badForm.set('version', String(version))
    badForm.set('namespace', namespace)
    badForm.set(
      'file',
      new File(
        [write(formula, { type: 'array', bookType: 'xlsx' })],
        'synthetic-envelope-formula.xlsx'
      )
    )
    const refusedFile = await fetch(origin + door + '/preview', {
      method: 'POST',
      headers: { cookie, origin },
      body: badForm,
    })
    assert.equal(refusedFile.status, 400)
    assert.deepEqual(await refusedFile.json(), {
      error: 'intake_formula_or_link_refused',
    })
  } finally {
    await browser.close()
  }
  console.log(
    'RUN-INTAKE passed: native three-worker grid, mapped CSV XLS XLSX changes, blank and zero, source claims, replay, typed tips, retained history, current review and refusal; no calculated tax or payment claim'
  )
}
