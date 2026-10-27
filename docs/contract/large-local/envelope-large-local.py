#!/usr/bin/env python3
"""Envelope ENV-066 large-local list. Reads envelope-large-local.csv and prints the list, shares and cumulative share.

  python3 envelope-large-local.py          full list + summary (this is what the Markdown reproduces)
  python3 envelope-large-local.py --md     the list as a Markdown table (pasted into envelope-large-local.md)
  python3 envelope-large-local.py --summary  summary only

pairs = res*r_count + work*w_count - res*work*both_count        (an employee-jurisdiction pair is counted once)
tier C  confirmed, wage-withheld: ranked, and the only rows eligible for the list
tier U  unverified (tax or withholding duty not confirmed): upper denominator only
tier UB unmeasured bound (no official geography): upper denominator only
tier S  sensitivity only: in neither denominator; the summary shows what happens if it were added
Denominator used for the 80% line = upper denominator (C + U + UB), because the larger denominator makes the longer list.
"""
import csv, os, sys
from collections import defaultdict

TARGET = 0.80
HERE = os.path.dirname(os.path.abspath(__file__))

def load(path=None):
    rows = list(csv.DictReader(open(path or os.path.join(HERE, 'envelope-large-local.csv'), encoding='utf-8')))
    for r in rows:
        f = lambda k: int(float(r[k])) if r[k] not in ('', None) else 0
        r['res'], r['work'] = f('res'), f('work')
        r['pairs'] = r['res'] * f('r_count') + r['work'] * f('w_count') - r['res'] * r['work'] * f('both_count')
    return rows

def compute(rows):
    c = sorted([r for r in rows if r['tier'] == 'C'], key=lambda r: (-r['pairs'], r['jurisdiction']))
    d_low = sum(r['pairs'] for r in c)
    d_up = d_low + sum(r['pairs'] for r in rows if r['tier'] in ('U', 'UB'))
    out, cum = [], 0
    for r in c:
        if cum >= TARGET * d_up: break
        cum += r['pairs']; out.append((r, r['pairs'] / d_up, cum / d_up))
    return c, d_low, d_up, out, cum

def main():
    rows = load(); c, d_low, d_up, out, cum = compute(rows)
    md = '--md' in sys.argv
    if '--summary' not in sys.argv:
        if md:
            print('| # | Jurisdiction | State | Tax type | Basis | Rate | Register | Figure | Pairs | Share | Cumulative |')
            print('|---|---|---|---|---|---|---|---|---:|---:|---:|')
        for i, (r, s, cs) in enumerate(out, 1):
            if md: print(f"| {i} | {r['jurisdiction']} | {r['state']} | {r['type']} | {r['basis']} | {r['rate_text'].replace('|', '/')} | {r['register']} | {r['figure']} | {r['pairs']:,} | {s*100:.3f}% | {cs*100:.2f}% |")
            else: print(f"{i:4d}  {r['jurisdiction'][:58]:58s} {r['state']}  {r['pairs']:>10,}  {s*100:6.3f}%  cum {cs*100:6.2f}%")
        if md: return
    n_c = len(c)
    print()
    print(f"rows: {len(rows)}  tier C {n_c}  tier U {sum(r['tier']=='U' for r in rows)}  tier UB {sum(r['tier']=='UB' for r in rows)}")
    print(f"lower denominator (tier C only)        : {d_low:>12,}")
    print(f"upper denominator (C + U + UB)         : {d_up:>12,}")
    print(f"list length for {TARGET*100:.0f}% of upper denominator : {len(out)} jurisdictions")
    print(f"cumulative share, upper denominator    : {cum/d_up*100:.2f}%")
    print(f"cumulative share, lower denominator    : {cum/d_low*100:.2f}%")
    print(f"long tail (upper denominator)          : {100-cum/d_up*100:.2f}%  ({d_up-cum:,} pairs)")
    sens = sum(r['pairs'] for r in rows if r['tier'] == 'S')
    if sens:
        d2 = d_up + sens; k2 = 0; n2 = 0
        for r in c:
            if k2 >= TARGET * d2: break
            k2 += r['pairs']; n2 += 1
        print(f"sensitivity: adding tier S ({sens:,} pairs, all Oregon Metro-county jobs) -> list {n2} jurisdictions, long tail {100-k2/d2*100:.2f}%")
    low_list = []; k = 0
    for r in c:
        if k >= TARGET * d_low: break
        k += r['pairs']; low_list.append(r)
    print(f"list length for 80% of lower denominator: {len(low_list)} (for comparison only; the upper-denominator list above is the one to adopt)")
    st = defaultdict(lambda: [0, 0, 0, 0])
    inlist = {id(r) for r, _, _ in out}
    for r in rows:
        if r['tier'] == 'S': continue
        s = st[r['state']]
        s[0] += 1; s[1] += r['pairs']
        if id(r) in inlist: s[2] += 1; s[3] += r['pairs']
    print('\nstate   rows      pairs   share_of_upper  in_list  listed_pairs  covered')
    for k, (nrow, p, nl, lp) in sorted(st.items(), key=lambda kv: -kv[1][1]):
        print(f"{k:5s} {nrow:6d} {p:>10,}  {p/d_up*100:12.2f}%  {nl:7d} {lp:>12,}  {lp/p*100 if p else 0:6.1f}%")

if __name__ == '__main__':
    main()
