import type { Input } from '../records'
import { PayrollError } from '../security'

/** Bounded native file input; originals never enter URLs, hidden fields or client storage. */
export async function paperMultipart(request: Request): Promise<Input> {
  const reader=request.body?.getReader()
  if (!reader) throw new PayrollError('invalid_input')
  let length=0
  const chunks: Uint8Array[]=[]
  while (true) {
    const {done,value}=await reader.read()
    if (done) break
    length+=value.length
    if (length>1100000) { await reader.cancel();throw new PayrollError('input_too_large',413) }
    chunks.push(value)
  }
  const bytes=new Uint8Array(length)
  let offset=0
  for (const chunk of chunks) { bytes.set(chunk,offset);offset+=chunk.length }
  let form: FormData
  try { form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')!}}).formData() }
  catch { throw new PayrollError('invalid_input') }
  const values: Input={}
  for (const [key,value] of form) {
    if (Object.hasOwn(values,key)) throw new PayrollError('duplicate_input')
    values[key]=value
  }
  const original=async(prefix:string)=>{
    const file=values[prefix+'.pdf']
    if (!(file instanceof File) || !file.size || file.size>384000) throw new PayrollError('signed_pdf_required')
    const bytes=new Uint8Array(await file.arrayBuffer())
    return {signed:values[prefix+'.signed']==='true',signedBy:values[prefix+'.signedBy'],signedOn:values[prefix+'.signedOn'],pdf:btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''))}
  }
  const certificate=async(prefix:string)=>{
    const fields: Input={}
    for (const [key,value] of Object.entries(values)) if (key.startsWith(prefix+'.fields.')) {
      const name=key.slice((prefix+'.fields.').length)
      fields[name]=['allowances','dependentCreditCents','otherIncomeCents','deductionsCents','additionalCents'].includes(name)
        ? typeof value==='string' && /^\d+$/.test(value)?Number(value):null : value
    }
    return {form:values[prefix+'.form'],effectiveFrom:values[prefix+'.effectiveFrom'],fields,original:await original(prefix)}
  }
  return {version:values.version,attestTranscription:values.attestTranscription==='true',workerType:values.workerType,hiredOn:values.hiredOn,
    paymentMethod:values.paymentMethod,tin:values.tin,address:values.address,federal:await certificate('federal'),
    state:values.workerType==='contractor' && values['state.form']==='none'?null:await certificate('state')}
}
