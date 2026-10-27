#!/usr/bin/env python3
"""Step 1 of the Envelope large-local computation: download the official figures and cache aggregates.

Sources (all public, no key):
  ACS 2020-2024 5-year table B23025 (employment status), Census table-based summary file
    https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b23025.dat
    https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/documentation/Geos20245YR.txt
  LEHD LODES8 workplace area characteristics (WAC), origin-destination (OD) and crosswalk files
    https://lehd.ces.census.gov/data/lodes/LODES8/<st>/...
Usage: python3 envelope-large-local-extract.py CACHE_DIR   (writes CACHE_DIR/acs.json, CACHE_DIR/lodes.json)
"""
import csv, gzip, io, json, os, subprocess, sys

STATES = {'al':'01','co':'08','de':'10','in':'18','ky':'21','md':'24','mi':'26','mo':'29','ny':'36','oh':'39','pa':'42','wv':'54','nj':'34','or':'41'}
OD_MAIN = ['pa','mi','mo','de','ny','oh']   # union (live-and-work) counts for resident+work-site taxes
OD_AUX = ['in']                              # workers living outside the state, by work county
PFX = {'050': 'c', '160': 'p', '060': 's', '970': 'd', '950': 'd', '960': 'd'}   # county, place, county subdivision, school district
ACS_B = 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF'
LODES = 'https://lehd.ces.census.gov/data/lodes/LODES8'
UA = 'Mozilla/5.0 (research; Run Edit Run contract cleanup)'

def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    r = subprocess.run(['curl', '-fsSL', '-A', UA, '-o', path, url])
    if r.returncode:
        if os.path.exists(path): os.remove(path)
        return None
    return path

def acs(cache):
    d = os.path.join(cache, 'raw'); os.makedirs(d, exist_ok=True)
    fb = fetch(f'{ACS_B}/data/5YRData/acsdt5y2024-b23025.dat', f'{d}/b23025.dat')
    fg = fetch(f'{ACS_B}/documentation/Geos20245YR.txt', f'{d}/Geos.txt')
    keep = {'050','060','160','970','950','960'}
    geo = {}
    with open(fg, encoding='latin-1') as f:
        hdr = f.readline().rstrip('\n').split('|'); ix = {k:i for i,k in enumerate(hdr)}
        for line in f:
            p = line.rstrip('\n').split('|')
            if p[ix['SUMLEVEL']] in keep and p[ix['STUSAB']].lower() in STATES:
                gid = p[ix['GEO_ID']]
                geo[gid] = (p[ix['SUMLEVEL']], p[ix['NAME']], p[ix['STUSAB']].lower())
    out = {}
    with open(fb, encoding='latin-1') as f:
        hdr = f.readline().rstrip('\n').split('|'); ix = {k:i for i,k in enumerate(hdr)}
        for line in f:
            p = line.rstrip('\n').split('|')
            g = p[0]
            if g in geo:
                sl, nm, st = geo[g]
                try: e = int(p[ix['B23025_E004']]); m = int(p[ix['B23025_M004']])
                except ValueError: continue
                out[PFX[sl] + ':' + g.split('US')[1]] = [sl, nm, st, e, m]   # key = prefix:FIPS geoid (place and school-district ids can collide)
    json.dump(out, open(f'{cache}/acs.json', 'w'))
    print('acs rows', len(out))

def lodes_year(st, kind, name):
    for y in (2023, 2022, 2021):
        url = f'{LODES}/{st}/{kind}/{st}_{name}_{y}.csv.gz'
        r = subprocess.run(['curl','-sI','-A',UA,url], capture_output=True, text=True)
        if ' 200' in r.stdout.split('\n')[0]: return y, url
    return None, None

def lodes(cache):
    d = os.path.join(cache, 'raw'); out = {}
    for st in STATES:
        xw = fetch(f'{LODES}/{st}/{st}_xwalk.csv.gz', f'{d}/{st}_xwalk.csv.gz')
        blk = {}; names = {}
        with gzip.open(xw, 'rt', encoding='utf-8') as f:
            r = csv.DictReader(f)
            for row in r:
                key = ('c:' + row['cty'], 'p:' + row['stplc'], 's:' + row['ctycsub'], 'd:' + row['stschool'])
                blk[row['tabblk2020']] = key
                names[key[0]] = row['ctyname']
                if row['stplc'] != '9999999': names[key[1]] = row['stplcname']
                if row['ctycsub'] != '9999999999': names[key[2]] = row['ctycsubname']
                if row['stschool'] != '9999999': names[key[3]] = row['stschoolname']
        y, url = lodes_year(st, 'wac', 'wac_S000_JT00')
        wf = fetch(url, f'{d}/{st}_wac_{y}.csv.gz')
        agg = {}; total = 0
        with gzip.open(wf, 'rt') as f:
            r = csv.reader(f); h = next(r); ic = h.index('C000')
            for row in r:
                n = int(row[ic]); total += n
                k = blk.get(row[0])
                if not k: continue
                for g in k:
                    if not g[2:].strip('9'): continue
                    agg[g] = agg.get(g, 0) + n
        rec = {'year': y, 'wac_url': url, 'wac_total': total, 'wac': agg, 'names': names}
        if st in OD_MAIN:
            yo, uo = lodes_year(st, 'od', 'od_main_JT00')
            of = fetch(uo, f'{d}/{st}_od_main_{yo}.csv.gz')
            both = {}
            with gzip.open(of, 'rt') as f:
                r = csv.reader(f); h = next(r); iw, ih, ic = h.index('w_geocode'), h.index('h_geocode'), h.index('S000')
                for row in r:
                    a = blk.get(row[iw]); b = blk.get(row[ih])
                    if not a or not b: continue
                    n = int(row[ic])
                    for i in range(3):          # county, place, county subdivision
                        if a[i] == b[i] and a[i][2:].strip('9'):
                            both[a[i]] = both.get(a[i], 0) + n
            rec.update({'od_year': yo, 'od_url': uo, 'both': both})
        if st in OD_AUX:
            yo, uo = lodes_year(st, 'od', 'od_aux_JT00')
            of = fetch(uo, f'{d}/{st}_od_aux_{yo}.csv.gz')
            aux = {}
            with gzip.open(of, 'rt') as f:
                r = csv.reader(f); h = next(r); iw, ic = h.index('w_geocode'), h.index('S000')
                for row in r:
                    a = blk.get(row[iw])
                    if a: aux[a[0]] = aux.get(a[0], 0) + int(row[ic])
            rec.update({'aux_year': yo, 'aux_url': uo, 'aux_cty': aux})
        out[st] = rec
        print(st, y, total, len(agg), flush=True)
    json.dump(out, open(f'{cache}/lodes.json', 'w'))

QCEW_YEAR = 2025
QCEW_EXTRA = ['42101','42003','18097','24031','24033','24510','36061','36047','36005','36059','39035','39049','29510','29095','10003','26163']  # anchor counties for the cross-check

def qcew(cache):
    """BLS QCEW annual average employment (all ownerships, all industries) for every Kentucky county plus anchor counties."""
    acs_ = json.load(open(f'{cache}/acs.json'))
    fips = sorted({g[2:] for g, v in acs_.items() if v[0] == '050' and v[2] == 'ky'} | set(QCEW_EXTRA))
    d = os.path.join(cache, 'raw', 'qcew'); os.makedirs(d, exist_ok=True)
    out = {}
    for f in fips:
        p = fetch(f'https://data.bls.gov/cew/data/api/{QCEW_YEAR}/a/area/{f}.csv', f'{d}/{f}.csv')
        if not p: continue
        for r in csv.DictReader(open(p)):
            if r['own_code'] == '0' and r['industry_code'] == '10' and r['agglvl_code'] in ('70', '71'):
                out[f] = int(r['annual_avg_emplvl'])
    json.dump({'year': QCEW_YEAR, 'url': 'https://data.bls.gov/cew/data/api/%d/a/area/<fips>.csv' % QCEW_YEAR, 'emp': out}, open(f'{cache}/qcew.json', 'w'))
    print('qcew counties', len(out))

if __name__ == '__main__':
    cache = sys.argv[1]; os.makedirs(cache, exist_ok=True)
    only = sys.argv[2] if len(sys.argv) > 2 else None
    if only in (None, 'acs'): acs(cache)
    if only in (None, 'lodes'): lodes(cache)
    if only in (None, 'qcew'): qcew(cache)
