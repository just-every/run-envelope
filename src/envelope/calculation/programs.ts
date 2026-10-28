/** Reference inventory, never an employer-specific UI rate determination.
 * DOL's January report explicitly excludes surcharges and non-UI taxes and
 * warns that industry and other factors can increase a new-employer base rate.
 */
const wageBases:Record<string,number[]>={
 AL:[8000],AK:[54200],AZ:[8000],AR:[7000],CA:[7000],CO:[30600],CT:[27000],DE:[14500],DC:[9000],FL:[7000],GA:[9500],HI:[64500],ID:[58300],IL:[14250],IN:[9500],IA:[20400],KS:[15100],KY:[12000],LA:[7000],ME:[12000],MD:[8500],MA:[15000],MI:[9000,9500],MN:[44000],MS:[14000],MO:[9000],MT:[47300],NE:[9000,24000],NV:[43700],NH:[14000],NJ:[44800],NM:[34800],NY:[17600],NC:[34200],ND:[46600],OH:[9000],OK:[25000],OR:[56700],PA:[10000],RI:[30800,32300],SC:[14000],SD:[15000],TN:[7000],TX:[9000],UT:[50700],VT:[15400],VA:[8000],WA:[78200],WV:[9500],WI:[14000],WY:[33800],
}
const newEmployerBase:Record<string,string>={
 AL:'2.70',AK:'1.00',AZ:'2.00',AR:'1.8',CA:'3.40',CO:'1.53',CT:'1.9',DE:'1.0',DC:'2.70',FL:'2.70',GA:'2.64',HI:'2.40',ID:'1.00',IL:'2.80',IN:'2.50',IA:'1.00',KS:'1.75',KY:'2.70',LA:'industry average',ME:'2.23',MD:'2.60',MA:'2.42',MI:'2.70',MN:'industry average',MS:'1.00',MO:'2.376',MT:'industry average',NE:'1.25',NV:'2.95',NH:'2.7',NJ:'2.8',NM:'industry average',NY:'4.025',NC:'1.00',ND:'1.00',OH:'2.70',OK:'1.50',OR:'2.4',PA:'3.8220',RI:'1.00',SC:'1.00',SD:'1.20',TN:'2.70',TX:'2.70',UT:'industry average',VT:'1.00',VA:'2.50',WA:'industry average',WV:'2.70',WI:'2.50',WY:'industry average',
}
const required:Record<string,string[]>={
 AK:['employee unemployment contribution'],
 CA:['SDI','employment training tax'],
 CO:['FAMLI'],CT:['paid leave'],DC:['employer paid family leave'],DE:['paid leave'],
 HI:['TDI with plan-derived employee cap','Prepaid Health Care with plan-derived employee cap'],
 ME:['paid family and medical leave'],MA:['PFML','workforce training and UI surcharges'],
 MN:['paid family and medical leave'],
 NJ:['employee UI','disability','family leave','workforce contributions'],
 NY:['DBL with separate carrier recipient','PFL','metropolitan commuter transportation mobility tax applicability'],
 NM:['workers compensation assessment'],NV:['modified business tax'],
 OR:['Workers Benefit Fund hours and cent rounding','paid leave','statewide transit','TriMet','Lane','Metro SHS','Multnomah PFA'],
 PA:['employee unemployment contribution','EIT','LST'],
 RI:['TDI and TCI','job development assessment'],
 WA:['L&I risk classes and employee and employer shares','L&I salaried hours election','PFML','WA Cares'],
 OH:['BWC applicability and reporting'],ND:['WSI applicability and reporting'],WY:['DWS compensation applicability and reporting'],
}
export function programInventory(state:string){
 if(!Object.hasOwn(wageBases,state))return null
 return {status:'unmapped',amountCents:null,
   unemploymentReference:{source:'https://oui.doleta.gov/unemploy/content/sigpros/2020-2029/January2026.pdf',retrievedAt:'2026-10-28',effectiveOn:'2026-01-01',
     wageBaseDollars:wageBases[state],newEmployerBasePercent:newEmployerBase[state],
     qualification:state==='MI'?'Higher base for delinquent employers':state==='NE'||state==='RI'?'Higher base for designated high-tax employer group':'Subject employer and current assigned or industry-based rate must be established',
     rateYear:['NH','NJ','TN','VT'].includes(state)?'July through June':'calendar year',
     limitation:'Reference base rate only. Excludes surcharges and non-UI taxes; higher industry or other state-law rates can apply. Not a current assigned-rate or complete state-law determination.'},
   requiredPrograms:['state unemployment account and current employer rate',...(required[state]??[]),'remaining state assessments and local authorities require official-source reconciliation'],
   otherPrograms:'unverified',futureYearCarry:'refused',
 }
}
