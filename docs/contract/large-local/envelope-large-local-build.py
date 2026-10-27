#!/usr/bin/env python3
"""Step 2: join the official local-tax registers to the Census figures and write envelope-large-local.csv.

Inputs : envelope-large-local-registers/*.csv (state registers, copied from the official files; see the Markdown for URLs)
         CACHE_DIR/acs.json, CACHE_DIR/lodes.json (from envelope-large-local-extract.py)
Usage  : python3 envelope-large-local-build.py CACHE_DIR
Rows   : one per taxing jurisdiction. pairs = res*r_count + work*w_count - res*work*both_count
         tier C = confirmed wage-withheld tax (in lower and upper denominators); tier U = unverified (upper denominator only)
"""
import csv, difflib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REG = os.path.join(HERE, 'envelope-large-local-registers')
OUT = os.path.join(HERE, 'envelope-large-local.csv')
COLS = ['id','jurisdiction','state','type','register','figure','basis','tier','res','work','r_count','r_geo','w_count','w_geo','both_count',
        'rate_text','rate_source_url','rate_source_date','withholding_rule','notes']

cache = sys.argv[1]
ACS = json.load(open(f'{cache}/acs.json'))
LOD = json.load(open(f'{cache}/lodes.json'))
rows, unmatched, namecheck = [], [], []
QCEW_ANCHORS = ['42101','42003','18097','24031','24033','24510','36061','36047','36005','36059','39035','39049','29510','29095','10003','26163']
Q = json.load(open(f'{cache}/qcew.json'))

def rd(name): return list(csv.DictReader(open(os.path.join(REG, name), encoding='utf-8')))
FIX = {'lagrange': 'la grange', 'middlesboro': 'middlesborough', 'hacklebug': 'hackleburg'}
def n(s):
    s = s.lower().replace('&', 'and').replace("'", '').replace('\u2019', '').replace('.', '').replace('-', ' ').replace('/', ' ')
    s = re.sub(r'\bst\b', 'saint', s); s = re.sub(r'\bmt\b', 'mount', s)
    s = re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()
    return FIX.get(s, s)
def acs_emp(g): return ACS[g][3] if g in ACS else None
def wac(st, g): return LOD[st]['wac'].get(g)
def both(st, g): return LOD[st].get('both', {}).get(g, 0)
def lv(st): return f"LODES8 {st.upper()} WAC {LOD[st]['year']}"
ACSV = 'ACS 2020-2024 5yr B23025_E004'

def add(**k):
    d = {c: '' for c in COLS}; d.update(k)
    d['id'] = f"{d['state']}-{len(rows)+1:04d}"
    rows.append(d)

# ---- geography name indexes
def idx(st, sl, strip):
    out = {}
    for g, v in ACS.items():
        if v[0] == sl and v[2] == st:
            out.setdefault(n(re.sub(strip, '', v[1])), []).append(g)
    return out
PLACE = {st: idx(st, '160', r',\s*[A-Za-z ]+$') for st in LOD}
COUNTY = {st: idx(st, '050', r',\s*[A-Za-z ]+$') for st in LOD}
def place(st, name, suffixes=('city', 'village', 'town', 'borough', 'township', 'municipality', 'urban county', 'metro government balance')):
    base = n(name)
    for s in ('',) + tuple(' ' + x for x in suffixes):
        c = PLACE[st].get(base + s)
        if c: return c[0]
    return None
def county(st, name):
    b = n(name); b = re.sub(r' county$', '', b)
    for k, v in COUNTY[st].items():
        if re.sub(r' county$', '', k) == b: return v[0]
    return None

# ---- Ohio municipalities (work-site)
for r in rd('oh_muni.csv'):
    if 'JEDD' in r['type'].upper() or 'JEDZ' in r['type'].upper() or r['type'].lower() not in ('city', 'village'): continue
    g = 'p:39' + r['fips_or_id'].zfill(5)
    if r['name'].upper().startswith('WASHINGTON') and r['fips_or_id'] == '81214': g = 'p:3981718'
    g = {'Waverly City': 'p:3981935', 'West Carrollton City': 'p:3983090'}.get(r['name'], g)   # Finder code differs from Census place code; matched by name
    if g not in ACS: unmatched.append(('oh_muni', r['name'], g)); continue
    chk = n(re.sub(r'\b(city|village)\b', '', r['name'], flags=re.I)); got = n(re.sub(r',.*$', '', ACS[g][1])); got = re.sub(r' (city|village|town|cdp)$', '', got)
    if chk != got and not got.startswith(chk): namecheck.append((r['name'], r['fips_or_id'], ACS[g][1]))
    add(jurisdiction=f"{r['name']} ({r['type']}), OH", state='OH', type='municipal income tax', basis='work-site', tier='C', res=0, work=1,
        w_count=wac('oh', g) or 0, w_geo=f"{lv('oh')} place {g[2:]}", rate_text=f"{r['rate_pct']}%",
        rate_source_url=r['source_url'].split(' (')[0], rate_source_date=r['source_date'],
        withholding_rule='ORC 718.011: withhold for principal place of work (resident-city withholding not mandatory)',
        notes='Counts jobs located in the municipality (LODES place).' + (' ' + r['dq_note'] if r['dq_note'] else ''))

# ---- Ohio school districts (residence)
sd = {}
for g, v in ACS.items():
    if v[2] == 'oh' and v[0] in ('970', '950', '960'): sd.setdefault(n(v[1]), []).append(g)
def sd_key(x):
    x = x.upper()
    x = re.sub(r'\bEVSD\b', 'exempted village school district', x)
    x = re.sub(r'\bLSD\b', 'local school district', x)
    x = re.sub(r'\bCSD\b', 'city school district', x)
    return n(x)
SDIT_FIX = {}
for r in rd('oh_sdit.csv'):
    nm = r['district_name']; base = re.sub(r'\(.*?\)', '', nm).strip()
    k = sd_key(base); cands = sd.get(k)
    if not cands:
        pref = [kk for kk in sd if kk.startswith(k.split(' school')[0] + ' ') or kk.split(' (')[0] == k]
        cands = [g for kk in sd if kk.startswith(k) for g in sd[kk]]
    if not cands:
        close = difflib.get_close_matches(k, list(sd), 1, 0.85)
        cands = sd[close[0]] if close else []
    if len(cands) > 1:  # disambiguate by county named in the ACS name
        c2 = [g for g in cands if n(r['county']) in n(ACS[g][1])]
        cands = c2 or cands[:1]
    if not cands: unmatched.append(('oh_sdit', nm, '')); continue
    g = cands[0]
    add(jurisdiction=f"{nm}, OH school district", state='OH', type='school district income tax', basis='residence', tier='C', res=1, work=0,
        r_count=acs_emp(g), r_geo=f"{ACSV} school district {g[2:]}", rate_text=f"{r['rate_pct']}% ({r['base']})",
        rate_source_url=r['source_url'].split(' ; ')[0], rate_source_date=r['source_date'],
        withholding_rule='ODT employer withholding: required for employees resident in a taxing district (IT 4)',
        notes=f"Proxy: employed residents of the school district's Census boundary ({ACS[g][1]}), not only earners subject to the tax.")

# ---- Pennsylvania municipalities (EIT by residence, LST by work site)
pa_cty = {}
for g, v in ACS.items():
    if v[2] == 'pa' and v[0] == '050': pa_cty[n(re.sub(r' county, pennsylvania', '', v[1].lower()))] = g[2:]
pa_sub = {}
for g, v in ACS.items():
    if v[2] == 'pa' and v[0] == '060':
        nm = re.sub(r',\s*[^,]+ County, Pennsylvania$', '', v[1])
        pa_sub.setdefault(g[2:7], {})[n(nm)] = g
def pa_norm(m):
    m = m.upper().replace('.', '')
    m = re.sub(r'\bTWP\b', 'township', m); m = re.sub(r'\bBORO\b', 'borough', m)
    return n(m)
seen = {}
for r in rd('pa_eit_lst.csv'):
    key = (r['municipality'], r['county'])
    d = seen.setdefault(key, dict(eit=0.0, lst=0.0, r=r))
    d['eit'] = max(d['eit'], float(r['eit_resident_pct'] or 0)); d['lst'] = max(d['lst'], float(r['lst_amount'] or 0))
pa_done = {}
for (m, c), d in seen.items():
    cf = pa_cty.get(n(c))
    nm = pa_norm(m)
    g = None
    if cf:
        subs = pa_sub.get(cf, {})
        g = subs.get(nm) or subs.get(nm.replace(' borough', ' municipality'))
        if not g:
            alt = [k for k in subs if k.split()[0] == nm.split()[0] and k.split()[-1] == nm.split()[-1]]
            close = difflib.get_close_matches(nm, list(subs), 1, 0.8)
            g = subs[alt[0]] if len(alt) == 1 else (subs[close[0]] if close else None)
    if not g: unmatched.append(('pa', m, c)); continue
    if m.upper().startswith('PHILADELPHIA'): continue
    res = 1 if d['eit'] > 0 else 0; wk = 1 if d['lst'] > 0 else 0
    r = d['r']
    add(jurisdiction=f"{m.title()}, {c.title()} Co., PA", state='PA', type='EIT (resident) + LST (work site)', basis='residence+work-site', tier='C', res=res, work=wk,
        r_count=acs_emp(g), r_geo=f"{ACSV} county subdivision {g[2:]}", w_count=wac('pa', g) or 0, w_geo=f"{lv('pa')} county subdivision {g[2:]}",
        both_count=both('pa', g), rate_text=f"EIT resident {d['eit']}% ; LST ${d['lst']:g}",
        rate_source_url=r['source_url'], rate_source_date=r['source_date'],
        withholding_rule='DCED Act 32 FAQ: employer withholds higher of resident EIT or work-site nonresident EIT, plus work-site LST',
        notes='Proxy: EIT counted for all employed residents of the municipality (school-district EIT is part of the same withholding code); out-of-state employers excluded by neither source.')

# ---- single-city rows from registers (resident and/or work-site)
def city_row(st, label, g, res, work, rate, url, date, rule, tier='C', typ='city income/earnings tax', notes=''):
    add(jurisdiction=label, state=st.upper(), type=typ, basis=('residence+work-site' if res and work else 'residence' if res else 'work-site'), tier=tier,
        res=int(res), work=int(work), r_count=acs_emp(g) if res else '', r_geo=f"{ACSV} place {g[2:]}" if res else '',
        w_count=(wac(st, g) or 0) if work else '', w_geo=f"{lv(st)} place {g[2:]}" if work else '',
        both_count=both(st, g) if (res and work) else '', rate_text=rate, rate_source_url=url, rate_source_date=date, withholding_rule=rule, notes=notes)

PHL = 'p:4260000'
city_row('pa', 'Philadelphia, PA (wage tax)', PHL, 1, 1, 'resident 3.735%, nonresident 3.425% from 2026-07-01',
         'https://www.phila.gov/services/payments-assistance-taxes/taxes/business-taxes/business-taxes-by-type/wage-tax-employers/', 'rates effective 2026-07-01',
         'City rule: withhold resident rate for residents (wherever they work) and nonresident rate for nonresident workers in the city')
NYC = 'p:3651000'
city_row('ny', 'New York City, NY (resident income tax)', NYC, 1, 0, 'NYC withholding schedule 2.05%-4.25% (2026)',
         'https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nyc.pdf', 'NYS-50-T-NYC rev. 1/26, effective 2026-01-01..2026-12-31',
         'NYS-50: all wages paid to NYC residents are subject to NYC withholding wherever services are performed; out-of-state employers with no NY nexus excluded',
         typ='city resident income tax (via NYS)', notes='Proxy: all employed NYC residents, including those whose out-of-state employer need not withhold.')
city_row('ny', 'Yonkers, NY (resident surcharge + nonresident earnings tax)', 'p:3684000', 1, 1, 'resident 16.75% of NYS tax; nonresident earnings 0.50%',
         'https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_y.pdf', 'NYS-50-T-Y rev. 1/26, effective 2026-01-01..2026-12-31',
         'NYS-50: employers withhold resident surcharge and the nonresident earnings tax on wages for work in Yonkers')
city_row('de', 'Wilmington, DE (earned income tax)', 'p:1077580', 1, 1, '1.25% resident and nonresident (earned in city)',
         'https://www.wilmingtonde.gov/home/showpublisheddocument/462/638206223264700000', 'regs revised 2023-05-25; statute 22 Del. C. 901-902',
         'Employers with a Wilmington presence withhold for residents and in-city nonresidents; employers outside withhold for residents')
city_row('mo', 'Kansas City, MO (earnings tax)', 'p:2938000', 1, 1, '1.0% residents (all earnings) and nonresidents (earnings in city)',
         'https://www.kcmo.gov/city-hall/departments/finance/earnings-tax', 'city page via web archive 2026-06-18',
         'Employers with a KC location or work must withhold for residents and nonresidents working in the city; outside employers may withhold voluntarily')
city_row('mo', 'St. Louis, MO (earnings tax)', 'p:2965000', 1, 1, '1.0% residents and nonresidents working in the city',
         'https://www.stlouis-mo.gov/government/departments/collector/earnings-tax/payroll-tax-info.cfm', 'page fetched 2026-10-28 (undated)',
         'Every employer with employees working in the city withholds; city-resident employers withhold for all employees')

# ---- Michigan cities
for r in rd('mi_city.csv'):
    nm = r['jurisdiction']; g = place('mi', nm)
    if not g: unmatched.append(('mi', nm, '')); continue
    wh = r['withheld_by_employer(yes/no/unknown)']
    city_row('mi', f"{nm}, MI (city income tax)", g, 1, 1, f"resident {r['rate_resident_pct']}%, nonresident {r['rate_nonresident_pct']}%",
             r['source_url'].split(' ; ')[0], r['source_date'], (r.get('note') or '')[:240], tier='C' if wh.startswith('yes') else 'U',
             typ='city income tax', notes='Michigan LODES latest year is 2021 (LODES8 has no MI 2022/2023).')

# ---- Indiana counties (residence on Jan 1; out-of-state workers by work county)
for r in rd('in_county.csv'):
    nm = re.sub(r'\s*\(code.*$', '', r['jurisdiction']); g = county('in', nm)
    if not g: unmatched.append(('in', nm, '')); continue
    add(jurisdiction=f"{nm}, IN (county income tax)", state='IN', type='county income tax', basis='residence (+ out-of-state workers by work county)', tier='C', res=1, work=1,
        r_count=acs_emp(g), r_geo=f"{ACSV} county {g[2:]}", w_count=LOD['in']['aux_cty'].get(g, 0), w_geo=f"LODES8 IN OD aux {LOD['in']['aux_year']} workplace county {g[2:]} (residence outside IN)",
        both_count=0, rate_text=f"{r['rate_resident_pct']}%", rate_source_url=r['source_url'], rate_source_date=r['source_date'],
        withholding_rule='IN DOR DN#1: withhold for county of residence on Jan 1; out-of-state residents at county of principal work',
        notes='Proxy: all employed county residents (ACS), plus out-of-state commuters by work county (LODES aux).')

# ---- Maryland counties
for r in rd('md_county.csv'):
    nm = r['jurisdiction']; g = 'c:24510' if nm.lower() == 'baltimore city' else county('md', nm)
    if not g: unmatched.append(('md', nm, '')); continue
    rate = r['rate_resident_pct'].split(' ')[0] if r['rate_resident_pct'][:1].isdigit() else r['rate_resident_pct']
    add(jurisdiction=f"{nm}, MD (local income tax)", state='MD', type='county/city income tax (state-collected piggyback)', basis='residence', tier='C', res=1, work=0,
        r_count=acs_emp(g), r_geo=f"{ACSV} county {g[2:]}", rate_text=r['rate_resident_pct'][:80] + '%' if rate[:1].isdigit() else rate,
        rate_source_url=r['source_url'], rate_source_date=r['source_date'],
        withholding_rule='Comptroller Withholding Tax Facts: withhold by county of residence on MW507; nonresidents pay no local tax',
        notes='Proxy: all employed residents; employers outside MD with no MD presence excluded by neither source.')

# ---- Kentucky occupational license taxes (work-site)
for r in rd('ky_occupational.csv'):
    t, nm = r['type'], r['jurisdiction']
    if not r['wage_tax'].startswith('yes'): continue
    g = None
    if t == 'city' and nm in ('Louisville', 'Lexington'): continue   # consolidated governments: counted once, on the county row (Jefferson / Fayette)
    if t == 'city':
        g = place('ky', 'Louisville/Jefferson County metro government (balance)' if nm == 'Louisville' else 'Lexington-Fayette urban county' if nm == 'Lexington' else nm)
        if nm == 'Louisville': g = place('ky', 'Louisville Jefferson County metro government balance')
    elif t == 'county': g = county('ky', nm)
    else: continue
    if not g: unmatched.append(('ky', nm, t)); continue
    ce = r['payer_withheld_by_employer']
    gk = g if t == 'city' else g
    wc = wac('ky', g)
    q = Q['emp'].get(g[2:]) if t == 'county' else None
    qn = ''
    if q and q > (wc or 0): qn = f' QCEW {Q["year"]} annual-average employment {q:,} exceeds LODES {wc:,}; larger used.'; wc = q
    elif q: qn = f' QCEW {Q["year"]} {q:,} <= LODES; LODES used.'
    if wc is None: unmatched.append(('ky-nodata', nm, g)); continue
    label = {'Jefferson County': 'Louisville Metro Government / Jefferson County (consolidated)', 'Fayette County': 'Lexington-Fayette Urban County Government (consolidated)'}.get(nm, f"{nm} ({t})")
    add(jurisdiction=f"{label}, KY", state='KY', type=f'occupational license tax ({t})', basis='work-site', tier='C', res=0, work=1,
        w_count=wc, w_geo=(f"{lv('ky')} place {g[2:]}" if t=='city' else f"max(LODES8 KY WAC {LOD['ky']['year']}, BLS QCEW {Q['year']}) county {g[2:]}"), rate_text=f"{r['rate_pct']}% ({r['base']})",
        rate_source_url=r['source_url'], rate_source_date=r['source_date'],
        withholding_rule='KRS 67.780 / ordinance: employer withholds on compensation for work in the district (statute not fetched; secondary KyCPA)',
        notes=((r['notes'] or '') + (' Louisville Metro nonresident total 1.45%, resident 2.2%.' if nm == 'Louisville' else '') + qn).strip())

# ---- Alabama
for r in rd('al_occupational.csv'):
    nm, t = r['jurisdiction'], r['type']
    if not r['wage_tax'].startswith('yes'): 
        if nm in ('Montgomery',): pass
        else: continue
    st = 'al'; g = place(st, nm) if t == 'city' else county(st, nm)
    if not g: unmatched.append(('al', nm, t)); continue
    wh = r['payer_withheld_by_employer']
    tier = 'C' if wh.startswith('yes') and r['evidence_level'].startswith('official') else 'U'
    add(jurisdiction=f"{nm} ({t}), AL", state='AL', type='occupational tax', basis='work-site', tier=tier, res=0, work=1,
        w_count=wac(st, g) or 0, w_geo=f"{lv(st)} {'place' if t=='city' else 'county'} {g}", rate_text=f"{r['rate_pct']}%",
        rate_source_url=r['source_url'].split(' ; ')[0], rate_source_date=r['source_date'],
        withholding_rule=wh[:200], notes='Tier U: tax listed by ALM survey but employer withholding not confirmed in an ordinance.' if tier=='U' else '')

# ---- Colorado OPT, West Virginia fees
for r in rd('co_opt.csv'):
    if r['status'] not in ('active', 'repealed'): continue
    g = place('co', r['city'])
    if not g: unmatched.append(('co', r['city'], '')); continue
    sec = r['source_type'].startswith('secondary') or r['status'] == 'repealed'   # source conflict (Aurora): larger denominator wins -> tier U
    add(jurisdiction=f"{r['city']}, CO (occupational privilege tax)", state='CO', type='occupational privilege tax (flat monthly)', basis='work-site', tier='U' if sec else 'C', res=0, work=1,
        w_count=wac('co', g) or 0, w_geo=f"{lv('co')} place {g[2:]}", rate_text=f"${r['employee_amount_per_month']}/mo employee + ${r['employer_amount_per_month']}/mo employer, earnings over ${r['monthly_wage_threshold']}/mo",
        rate_source_url=r['source_url'].split(' | ')[0], rate_source_date=r['source_date_or_fetch_date'],
        withholding_rule='City page: employer withholds employee share from pay and remits both shares',
        notes=('SOURCE CONFLICT: city page says repealed effective 2025-01-01, Metro Denver and State Controller lists still show it; larger denominator used (tier U). ' if r['status'] == 'repealed' else '') + 'Proxy: all jobs in the city (earnings threshold ignored).')
for r in rd('wv_municipal.csv'):
    if r['city'] == 'LEGAL BASIS' or r['source_type'] == 'none': continue
    g = place('wv', r['city'])
    if not g: unmatched.append(('wv', r['city'], '')); continue
    sec = r['source_type'].startswith('secondary')
    add(jurisdiction=f"{r['city']}, WV (municipal service fee)", state='WV', type='municipal service fee (flat per week)', basis='work-site', tier='U' if sec else 'C', res=0, work=1,
        w_count=wac('wv', g) or 0, w_geo=f"{lv('wv')} place {g[2:]}", rate_text=f"${r['amount']}/{r['period'].split(' ')[0] if r['period'] else ''}",
        rate_source_url=r['source_url'].split(' | ')[0].split(' ; ')[0], rate_source_date=r['source_date_or_fetch_date'],
        withholding_rule=r['employer_pays_or_withholds_notes'][:200],
        notes='Fairmont: nonresident workers only (count is an upper bound).' if r['city'] == 'Fairmont' else '')

# ---- sensitivity (tier S, in neither denominator): Oregon Metro SHS / Multnomah PFA withholding, mandatory only for employees earning >= $200,000
orw = sum(LOD['or']['wac'].get('c:' + f, 0) for f in ('41005', '41051', '41067'))
add(jurisdiction='Portland Metro SHS + Multnomah PFA withholding (earners of $200,000 or more), OR', state='OR', type='personal income tax withholding (high earners)', basis='work-site', tier='S', res=0, work=1,
    w_count=orw, w_geo=f"{lv('or')} Clackamas+Multnomah+Washington counties (upper bound: all jobs)", rate_text='Metro SHS 1% over $128,000/$205,000 (2026); PFA 1.5% (+1.5% over $250,000/$400,000)',
    rate_source_url='https://www.portland.gov/revenue/withholding', rate_source_date='page fetched 2026-10-27',
    withholding_rule='Mandatory only for employees working in the district who earn $200,000 or more and employers with a location there',
    notes='Sensitivity row only: earnings-band counts are not published at this cut, so the whole jobs total is used as an absurdly high bound.')

# ---- unmeasured bound: Ohio JEDD/JEDZ (153 rows, no geography published)
oh = LOD['oh']
placed = sum(v for k, v in oh['wac'].items() if k.startswith('p:'))
add(jurisdiction='Ohio JEDD/JEDZ districts (153), OH', state='OH', type='joint economic development district income tax', basis='work-site', tier='UB', res=0, work=1,
    w_count=oh['wac_total'] - placed, w_geo=f"{lv('oh')} jobs outside any Census place (upper bound)", rate_text='per ODT JEDD table',
    rate_source_url='https://api.thefinder.tax.ohio.gov/finder/api/v1/tax-rates/downloads/Muni/JEDTaxRates.csv', rate_source_date='retrieved 2026-10-27',
    withholding_rule='ORC 718: JEDD tax withheld by employers in the district',
    notes='UNMEASURED: no official geography. Upper bound = all Ohio jobs outside Census places; used only in the upper denominator.')

# consolidated governments: use the city's own rate source
OVR = {'Louisville Metro Government / Jefferson County (consolidated), KY': dict(rate_text='1.45% nonresident (1.25% Metro + 0.20% TARC); residents 2.2% (adds 0.75% school boards)',
          rate_source_url='https://louisvilleky.gov/sites/default/files/2022-12/W-1_instructions_20221201.pdf ; https://louisvilleky.gov/sites/default/files/2024-12/ol-3d_instructions_2025.pdf', rate_source_date='W-1 instructions file dated 2022-12-01; OL-3D instructions for 2025'),
       'Lexington-Fayette Urban County Government (consolidated), KY': dict(rate_text='2.25% (compensation and net profits)',
          rate_source_url='https://www.lexingtonky.gov/working/business-licensing-taxes/occupational-license-fee-rates-current-forms', rate_source_date='page fetched 2026-10-27')}
for r in rows:
    if r['jurisdiction'] in OVR: r.update(OVR[r['jurisdiction']])

print('QCEW anchor check (county, QCEW %d annual avg emp, LODES county jobs):' % Q['year'])
for f, e in sorted(Q['emp'].items()):
    st = {'42': 'pa', '18': 'in', '24': 'md', '36': 'ny', '39': 'oh', '29': 'mo', '10': 'de', '26': 'mi'}.get(f[:2])
    if st and f in QCEW_ANCHORS:
        lo = LOD[st]['wac'].get('c:' + f)
        print(f'  {f} {ACS["c:"+f][1] if "c:"+f in ACS else ""}: QCEW {e:,}  LODES {lo:,}  ratio {e/lo:.3f}')
ky_n = sum(1 for f in Q['emp'] if f.startswith('21')); ky_q = sum(1 for f, e in Q['emp'].items() if f.startswith('21') and e > (LOD['ky']['wac'].get('c:' + f) or 0))
print(f'  Kentucky counties: {ky_n}; QCEW larger than LODES in {ky_q} (larger used on the county rows)')

def register(r):
    j, st, t = r['jurisdiction'], r['state'], r['type']
    if j.startswith('Philadelphia, PA'): return 'PHL'
    if j.startswith('New York City, NY'): return 'NYC'
    if j.startswith('Yonkers, NY'): return 'YKR'
    if st == 'DE': return 'DE-WIL'
    if j.startswith('Kansas City, MO'): return 'KC'
    if j.startswith('St. Louis, MO'): return 'STL'
    if j.startswith('Ohio JEDD'): return 'OH-JEDD'
    return {'OH': 'OH-SDIT' if 'school' in t else 'OH-MUNI', 'PA': 'PA-DCED', 'IN': 'IN-DN1', 'MD': 'MD-WTF', 'MI': 'MI-CITY', 'MO': 'KC', 'KY': 'KY-KACO-KLC',
            'AL': 'AL-ALM', 'CO': 'CO-OPT', 'WV': 'WV-FEE', 'OR': 'OR-SHS'}[st]
def figure(r):
    if r['state'] == 'IN': return 'ACS + LODES aux'
    if r['state'] == 'KY' and 'county' in r['type']: return 'LODES + QCEW (larger)'
    if r['res'] and r['work']: return 'ACS + LODES OD'
    return 'ACS' if r['res'] else 'LODES'
for r in rows:
    r['register'] = register(r); r['figure'] = figure(r)
with open(OUT, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, COLS); w.writeheader(); w.writerows(rows)
print('rows', len(rows)); print('unmatched', len(unmatched)); print('oh namecheck', len(namecheck))
for x in namecheck: print('  ', x)
for u in unmatched: print('  ', u)
