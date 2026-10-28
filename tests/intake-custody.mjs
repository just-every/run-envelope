import assert from 'node:assert/strict'

/** Populate actual reviewed intake before archive export, including its signed source history. */
export async function intakeCustodyFixture(payroll, company, personId, tag) {
  const door = company.base + '/pay-settings/intake', captures = []
  const approval = {by:'synthetic-envelope-source-owner',at:'2026-10-26T12:00:00Z',reason:'Reviewed payroll source'}
  for (const provider of ['lanyard','toast']) {
    const id = 'synthetic-envelope-custody-' + tag + '-' + provider
    const source = id + '-time', worker = id + '-worker'
    const mapping = {sourcePersonId:worker,personId,day:'2026-10-19',workweek:'2026-10-19',settlement:'cash',
      settlements:{declaredCashTips:'cash',nonCashTips:'cash',nonCashGratuityServiceCharges:'paycheck'}}
    const payload = provider === 'lanyard' ? {id:id+'-batch',revision:2,status:'exported',exportedBy:approval.by,exportedAt:approval.at,
      lines:[{rootId:source,timeId:source,revision:1,payrollId:worker,start:'2026-10-19T09:00:00Z',
        end:'2026-10-19T17:00:00Z',minutes:480,job:'Retained kitchen'},
        {payInputId:id+'-PTO',revision:1,payrollId:worker,start:'2026-10-19T12:00:00Z',minutes:480,costCents:8000,payCode:'PTO',approval}]} :
      [{guid:source,employeeReference:{guid:worker},inDate:'2026-10-19T09:00:00Z',outDate:'2026-10-19T17:00:00Z',
        businessDate:'20261019',deleted:false,autoClockedOut:false,regularHours:8,overtimeHours:0,
        declaredCashTips:0,nonCashTips:600,nonCashGratuityServiceCharges:90}]
    const original = {provider,account:id,payload,mappings:{[source]:mapping,[id+'-PTO']:mapping},
      evidence:'synthetic-envelope-retained-source',...(provider==='lanyard'?{reconciliation:'signed-exports'}:{})}
    const correction = structuredClone(original)
    if (provider === 'lanyard') {
      correction.payload.id = id+'-correction-batch'
      correction.payload.lines = [{...payload.lines[0],timeId:id+'-correction',corrects:source,revision:2,minutes:-60},
        {...payload.lines[1],revision:2,minutes:-240,costCents:-4000}]
      correction.mappings[id+'-correction'] = mapping
    } else {
      correction.payload[0].regularHours = 7
      correction.payload[0].nonCashTips = 500
      correction.payload[0].nonCashGratuityServiceCharges = 45
    }
    for (const [version,providerCapture] of [[0,original],[1,correction]]) {
      const body = {id,version,providerCapture}
      const preview = await payroll.data(door+'/preview',body)
      await payroll.data(door+'/apply',{...body,digest:preview.digest},201)
      const review = await payroll.data(door+'/'+id+'/review')
      await payroll.data(door+'/'+id+'/approve',{version:version+1,reviewToken:review.reviewToken})
    }
    const history = (await payroll.data(door)).filter(row=>row.id===id)
    assert.equal(history.length,2)
    assert.equal(history.find(row=>row.version===1).data.rows.find(row=>row.code==='regular').minutes,480)
    assert.equal(history.find(row=>row.version===2).data.rows.find(row=>row.code==='regular').minutes,420)
    captures.push({id,original,history})
  }
  return captures
}
