# Envelope ENV-066: the large-local list

Research for the Envelope contract-cleanup round (brief i). Written 28 Oct 2026. Public sources only: no licensed catalogue, account or sign-up. Every figure below is reproduced by `python3 envelope-large-local.py` from `envelope-large-local.csv` (this directory); the table in section 4 is that script's `--md` output verbatim.

## 1. Result

- **688 jurisdictions** cover **80.00%** of US local-income-tax employee-jurisdiction pairs, measured against the upper denominator of **34,235,243** pairs. Against the lower denominator (confirmed jurisdictions only, 32,861,015 pairs) the same list covers **83.35%**.
- **Published long-tail percentage: 20.00%** of pairs (6,845,987), spread over 3,171 further confirmed jurisdictions plus the unconfirmed and unmeasured pairs in section 6.
- The list is the **upper-denominator list**. Two sources disagreed or a tax was unconfirmed in 30 places; the rule is "larger denominator wins", so the denominator includes them and the list is longer (688, against 558 for the lower denominator alone).
- By state, the list holds all 24 Maryland jurisdictions, 78 of 92 Indiana counties, New York City and Yonkers, Philadelphia, Kansas City, St. Louis, Wilmington, Denver, 15 of 24 Michigan cities, 73 Kentucky jurisdictions, 169 Ohio municipalities and school districts, and 310 Pennsylvania municipalities (table in section 3).
- One sentence of caution for the contract: 688 is the smallest set the method allows, not a number a person would choose. It is a data file (`envelope-large-local.csv`) that the gating clause points to, not text in the clause.

## 2. Definitions and method as applied

**Local income tax** is as the brief defines it: a tax below the state level that an employer withholds or remits from wages (municipal and county income or earnings taxes, school-district income taxes, occupational taxes on wages, flat per-worker occupational and service fees withheld from wages). Employer-only payroll expense taxes that nothing withholds from wages are in section 7, outside the denominator.

**Pair.** An employee is counted in a jurisdiction when the employer's withholding duty attaches: by work site for work-site taxes, by residence for resident taxes, both where both apply. An employee subject to two jurisdictions counts in each. An employee who both lives and works in one jurisdiction that taxes both bases counts once in it. Per jurisdiction:

`pairs = res * residents + work * jobs − res * work * (live-and-work in the jurisdiction)`

**Share** = pairs ÷ denominator. Two denominators are kept:

- **Lower:** every confirmed row (tier C): the tax exists in an official register and an official or statutory source states the employer withholds it.
- **Upper:** tier C plus tier U (tax or withholding duty not confirmed, or sources conflict, 29 rows, 395,848 pairs) plus one unmeasured upper bound (Ohio JEDD/JEDZ districts, 978,380 pairs). The 80% line is placed against the upper denominator, so the list can only be longer than needed, never short.

**Steps.**

1. Universe from state revenue departments and administrators (registers in section 8), cross-checked against the Tax Foundation's local income tax survey (section 5).
2. Employee counts from Census tables: residents are ACS 2020-2024 5-year table B23025 line 004 (employed civilians 16+, all workplaces, so cross-border commuters count); jobs by place of work are LEHD LODES8 workplace area characteristics (all jobs, JT00); the live-and-work overlap is LODES8 origin-destination (main); Indiana's out-of-state commuters are the LODES8 OD aux file; Kentucky county work-site counts are the larger of LODES8 and BLS QCEW 2025 annual-average employment. Vintages are in section 8.
3. Rank tier C by pairs and take the smallest prefix reaching 80% of the upper denominator.
4. `envelope-large-local-extract.py` downloads the Census and BLS files, `envelope-large-local-build.py` joins them to `envelope-large-local-registers/*.csv` and writes `envelope-large-local.csv`, `envelope-large-local.py` reads that CSV and prints the list. Rerun the first two when a vintage changes.

## 3. Coverage by state (upper denominator)

| State | Rows | Pairs | Share of denominator | On the list | Pairs on the list | Covered |
|---|---:|---:|---:|---:|---:|---:|
| PA | 2,564 | 10,876,485 | 31.77% | 310 | 7,335,399 | 67.4% |
| OH | 882 | 6,278,146 | 18.34% | 169 | 3,901,963 | 62.2% |
| NY | 2 | 4,183,773 | 12.22% | 2 | 4,183,773 | 100.0% |
| IN | 92 | 3,511,965 | 10.26% | 78 | 3,437,707 | 97.9% |
| MD | 24 | 3,151,451 | 9.21% | 24 | 3,151,451 | 100.0% |
| KY | 255 | 2,673,259 | 7.81% | 73 | 2,250,563 | 84.2% |
| MI | 24 | 1,209,479 | 3.53% | 15 | 1,164,413 | 96.3% |
| CO | 5 | 816,740 | 2.39% | 4 | 643,810 | 78.8% |
| MO | 2 | 805,573 | 2.35% | 2 | 805,573 | 100.0% |
| AL | 27 | 460,139 | 1.34% | 3 | 250,410 | 54.4% |
| WV | 11 | 188,432 | 0.55% | 7 | 184,393 | 97.9% |
| DE | 1 | 79,801 | 0.23% | 1 | 79,801 | 100.0% |
| **All** | **3,889** | **34,235,243** | **100%** | **688** | **27,389,256** | **80.00%** |

(The Ohio rows include the 978,380-pair JEDD upper bound. 3,890 rows are in the CSV; the extra row is the section-6 sensitivity row, which is in neither denominator.)

## 4. The list

Columns: **Register** is the source family in section 8 (rate or rule source, URL and date; every CSV row also carries its own `rate_source_url` and `rate_source_date`). **Figure** is how the employee count was taken (ACS = employed residents, LODES = jobs at the workplace, OD = live-and-work overlap removed, QCEW = larger of LODES and QCEW). The CSV rows carry the exact table, geography code and vintage for each figure (`r_geo`, `w_geo`). Rate is as published for the current tax year.

| # | Jurisdiction | State | Tax type | Basis | Rate | Register | Figure | Pairs | Share | Cumulative |
|---|---|---|---|---|---|---|---|---:|---:|---:|
| 1 | New York City, NY (resident income tax) | NY | city resident income tax (via NYS) | residence | NYC withholding schedule 2.05%-4.25% (2026) | NYC | ACS | 4,039,236 | 11.798% | 11.80% |
| 2 | Philadelphia, PA (wage tax) | PA | city income/earnings tax | residence+work-site | resident 3.735%, nonresident 3.425% from 2026-07-01 | PHL | ACS + LODES OD | 1,106,096 | 3.231% | 15.03% |
| 3 | Montgomery County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 561,656 | 1.641% | 16.67% |
| 4 | Columbus (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 559,751 | 1.635% | 18.30% |
| 5 | Denver, CO (occupational privilege tax) | CO | occupational privilege tax (flat monthly) | work-site | $5.75/mo employee + $4.00/mo employer, earnings over $500/mo | CO-OPT | LODES | 557,853 | 1.629% | 19.93% |
| 6 | Marion County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.02% | IN-DN1 | ACS + LODES aux | 511,956 | 1.495% | 21.43% |
| 7 | Louisville Metro Government / Jefferson County (consolidated), KY | KY | occupational license tax (county) | work-site | 1.45% nonresident (1.25% Metro + 0.20% TARC); residents 2.2% (adds 0.75% school boards) | KY-KACO-KLC | LODES + QCEW (larger) | 503,996 | 1.472% | 22.90% |
| 8 | Prince George’s County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 498,060 | 1.455% | 24.36% |
| 9 | Kansas City, MO (earnings tax) | MO | city income/earnings tax | residence+work-site | 1.0% residents (all earnings) and nonresidents (earnings in city) | KC | ACS + LODES OD | 479,992 | 1.402% | 25.76% |
| 10 | Baltimore County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 428,901 | 1.253% | 27.01% |
| 11 | Detroit, MI (city income tax) | MI | city income tax | residence+work-site | resident 2.4%, nonresident 1.2% | MI-CITY | ACS + LODES OD | 404,322 | 1.181% | 28.19% |
| 12 | Pittsburgh City, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 3.0% ; LST $52 | PA-DCED | ACS + LODES OD | 390,758 | 1.141% | 29.33% |
| 13 | St. Louis, MO (earnings tax) | MO | city income/earnings tax | residence+work-site | 1.0% residents and nonresidents working in the city | STL | ACS + LODES OD | 325,581 | 0.951% | 30.29% |
| 14 | Anne Arundel County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 2.70% ($1-50,000) / 2.94% ($50,001-400,000) / 3.20% (over 400,000) single,MFS,de% | MD-WTF | ACS | 306,806 | 0.896% | 31.18% |
| 15 | Cleveland (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 293,245 | 0.857% | 32.04% |
| 16 | Baltimore City, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 274,907 | 0.803% | 32.84% |
| 17 | Lake County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.5% | IN-DN1 | ACS + LODES aux | 249,880 | 0.730% | 33.57% |
| 18 | Cincinnati (city), OH | OH | municipal income tax | work-site | 1.8% | OH-MUNI | LODES | 241,759 | 0.706% | 34.28% |
| 19 | Grand Rapids, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.50%, nonresident 0.75% | MI-CITY | ACS + LODES OD | 210,465 | 0.615% | 34.89% |
| 20 | Lexington-Fayette Urban County Government (consolidated), KY | KY | occupational license tax (county) | work-site | 2.25% (compensation and net profits) | KY-KACO-KLC | LODES + QCEW (larger) | 208,353 | 0.609% | 35.50% |
| 21 | Allen County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.59% | IN-DN1 | ACS + LODES aux | 201,972 | 0.590% | 36.09% |
| 22 | Hamilton County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.1% | IN-DN1 | ACS + LODES aux | 199,245 | 0.582% | 36.67% |
| 23 | Birmingham (city), AL | AL | occupational tax | work-site | 1% | AL-ALM | LODES | 190,989 | 0.558% | 37.23% |
| 24 | Howard County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 175,641 | 0.513% | 37.74% |
| 25 | Frederick County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 2.25% ($1-25,000) / 2.75% (25,001-50,000) / 2.96% (50,001-150,000) / 3.20% (150,% | MD-WTF | ACS | 152,168 | 0.444% | 38.19% |
| 26 | Yonkers, NY (resident surcharge + nonresident earnings tax) | NY | city income/earnings tax | residence+work-site | resident 16.75% of NYS tax; nonresident earnings 0.50% | YKR | ACS + LODES OD | 144,537 | 0.422% | 38.61% |
| 27 | St. Joseph County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.75% | IN-DN1 | ACS + LODES aux | 144,340 | 0.422% | 39.03% |
| 28 | Lansing, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 138,770 | 0.405% | 39.44% |
| 29 | Harford County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.06% | MD-WTF | ACS | 136,174 | 0.398% | 39.83% |
| 30 | Toledo (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 122,420 | 0.358% | 40.19% |
| 31 | Elkhart County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.0% | IN-DN1 | ACS + LODES aux | 114,231 | 0.334% | 40.53% |
| 32 | Boone County (county), KY | KY | occupational license tax (county) | work-site | 0.80% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 107,951 | 0.315% | 40.84% |
| 33 | Vanderburgh County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.25% | IN-DN1 | ACS + LODES aux | 99,552 | 0.291% | 41.13% |
| 34 | Akron (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 99,137 | 0.290% | 41.42% |
| 35 | Hendricks County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.7% | IN-DN1 | ACS + LODES aux | 97,866 | 0.286% | 41.71% |
| 36 | Tippecanoe County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.28% | IN-DN1 | ACS + LODES aux | 97,504 | 0.285% | 41.99% |
| 37 | Allentown City, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.975% ; LST $52 | PA-DCED | ACS + LODES OD | 96,190 | 0.281% | 42.27% |
| 38 | Carroll County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.03% | MD-WTF | ACS | 91,941 | 0.269% | 42.54% |
| 39 | Porter County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 0.5% | IN-DN1 | ACS + LODES aux | 88,820 | 0.259% | 42.80% |
| 40 | Charles County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.03% | MD-WTF | ACS | 87,682 | 0.256% | 43.06% |
| 41 | Johnson County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.4% | IN-DN1 | ACS + LODES aux | 85,928 | 0.251% | 43.31% |
| 42 | Dayton (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 81,194 | 0.237% | 43.55% |
| 43 | Wilmington, DE (earned income tax) | DE | city income/earnings tax | residence+work-site | 1.25% resident and nonresident (earned in city) | DE-WIL | ACS + LODES OD | 79,801 | 0.233% | 43.78% |
| 44 | Clark County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.0% | IN-DN1 | ACS + LODES aux | 76,016 | 0.222% | 44.00% |
| 45 | Kenton County (county), KY | KY | occupational license tax (county) | work-site | 0.70% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 75,385 | 0.220% | 44.22% |
| 46 | Erie City, Erie Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.65% ; LST $52 | PA-DCED | ACS + LODES OD | 75,289 | 0.220% | 44.44% |
| 47 | Monroe County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.14% | IN-DN1 | ACS + LODES aux | 73,504 | 0.215% | 44.66% |
| 48 | Harrisburg City, Dauphin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.0% ; LST $156 | PA-DCED | ACS + LODES OD | 72,170 | 0.211% | 44.87% |
| 49 | Warren County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 71,839 | 0.210% | 45.08% |
| 50 | Washington County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 2.95% | MD-WTF | ACS | 71,392 | 0.209% | 45.28% |
| 51 | Greenwood Village, CO (occupational privilege tax) | CO | occupational privilege tax (flat monthly) | work-site | $2.00/mo employee + $2.00/mo employer, earnings over $250/mo | CO-OPT | LODES | 66,889 | 0.195% | 45.48% |
| 52 | Bensalem Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 65,372 | 0.191% | 45.67% |
| 53 | Upper Merion Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 64,701 | 0.189% | 45.86% |
| 54 | Lancaster City, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.6% ; LST $52 | PA-DCED | ACS + LODES OD | 62,111 | 0.181% | 46.04% |
| 55 | Bowling Green (city), KY | KY | occupational license tax (city) | work-site | 2.00% (payroll+net profits) | KY-KACO-KLC | LODES | 61,726 | 0.180% | 46.22% |
| 56 | Madison County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.25% | IN-DN1 | ACS + LODES aux | 61,519 | 0.180% | 46.40% |
| 57 | Upper Darby Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 60,350 | 0.176% | 46.58% |
| 58 | Reading City, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 3.6% ; LST $52 | PA-DCED | ACS + LODES OD | 60,201 | 0.176% | 46.75% |
| 59 | Flint, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.00%, nonresident 0.50% | MI-CITY | ACS + LODES OD | 59,097 | 0.173% | 46.93% |
| 60 | Pontiac, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 58,840 | 0.172% | 47.10% |
| 61 | Scranton City, Lackawanna Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 3.4% ; LST $156 | PA-DCED | ACS + LODES OD | 58,561 | 0.171% | 47.27% |
| 62 | St. Mary’s County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 57,216 | 0.167% | 47.44% |
| 63 | Charleston, WV (municipal service fee) | WV | municipal service fee (flat per week) | work-site | $3.00/per | WV-FEE | LODES | 56,673 | 0.166% | 47.60% |
| 64 | WESTERVILLE CSD, OH school district | OH | school district income tax | residence | 0.75% (earned income) | OH-SDIT | ACS | 54,753 | 0.160% | 47.76% |
| 65 | Delaware County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.5% | IN-DN1 | ACS + LODES aux | 54,622 | 0.160% | 47.92% |
| 66 | Lower Merion Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 53,551 | 0.156% | 48.08% |
| 67 | Dublin (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 52,653 | 0.154% | 48.23% |
| 68 | Wicomico County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 52,357 | 0.153% | 48.38% |
| 69 | Lower Paxton Twp, Dauphin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.0% ; LST $52 | PA-DCED | ACS + LODES OD | 51,779 | 0.151% | 48.54% |
| 70 | Bethlehem City, Northampton Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 51,745 | 0.151% | 48.69% |
| 71 | LaPorte County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.45% | IN-DN1 | ACS + LODES aux | 51,264 | 0.150% | 48.84% |
| 72 | Tredyffrin Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 51,104 | 0.149% | 48.99% |
| 73 | Upper Macungie Twp, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 50,805 | 0.148% | 49.13% |
| 74 | East Lansing, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.00%, nonresident 0.50% | MI-CITY | ACS + LODES OD | 50,782 | 0.148% | 49.28% |
| 75 | Abington Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 50,648 | 0.148% | 49.43% |
| 76 | Vigo County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.0% | IN-DN1 | ACS + LODES aux | 50,071 | 0.146% | 49.58% |
| 77 | Cecil County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 2.74% | MD-WTF | ACS | 49,805 | 0.145% | 49.72% |
| 78 | Hardin County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 48,702 | 0.142% | 49.86% |
| 79 | Manheim Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 47,982 | 0.140% | 50.00% |
| 80 | Daviess County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 47,804 | 0.140% | 50.14% |
| 81 | Calvert County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 47,678 | 0.139% | 50.28% |
| 82 | Derry Twp, Dauphin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 47,625 | 0.139% | 50.42% |
| 83 | Horsham Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 45,389 | 0.133% | 50.55% |
| 84 | Millcreek Twp, Erie Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 45,290 | 0.132% | 50.69% |
| 85 | Hancock County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.94% | IN-DN1 | ACS + LODES aux | 45,151 | 0.132% | 50.82% |
| 86 | Floyd County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.89% | IN-DN1 | ACS + LODES aux | 44,783 | 0.131% | 50.95% |
| 87 | Battle Creek, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.00%, nonresident 0.50% | MI-CITY | ACS + LODES OD | 44,205 | 0.129% | 51.08% |
| 88 | Blue Ash (city), OH | OH | municipal income tax | work-site | 1.25% | OH-MUNI | LODES | 43,897 | 0.128% | 51.21% |
| 89 | Bartholomew County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.75% | IN-DN1 | ACS + LODES aux | 43,876 | 0.128% | 51.34% |
| 90 | Cranberry Twp, Butler Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 43,750 | 0.128% | 51.46% |
| 91 | Bristol Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.5% ; LST $52 | PA-DCED | ACS + LODES OD | 43,680 | 0.128% | 51.59% |
| 92 | Middletown Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 43,496 | 0.127% | 51.72% |
| 93 | York City, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 42,594 | 0.124% | 51.84% |
| 94 | Kosciusko County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.0% | IN-DN1 | ACS + LODES aux | 41,682 | 0.122% | 51.96% |
| 95 | McCracken County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 40,975 | 0.120% | 52.08% |
| 96 | Wilkes Barre City, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 3.0% ; LST $52 | PA-DCED | ACS + LODES OD | 40,520 | 0.118% | 52.20% |
| 97 | Canton (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 40,323 | 0.118% | 52.32% |
| 98 | Boone County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.71% | IN-DN1 | ACS + LODES aux | 40,140 | 0.117% | 52.44% |
| 99 | Plymouth Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.1% ; LST $52 | PA-DCED | ACS + LODES OD | 38,693 | 0.113% | 52.55% |
| 100 | Jeffersontown (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES | 38,527 | 0.113% | 52.66% |
| 101 | Howard County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.35% | IN-DN1 | ACS + LODES aux | 37,822 | 0.110% | 52.77% |
| 102 | Walker, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 37,759 | 0.110% | 52.88% |
| 103 | Hempfield Twp, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 37,423 | 0.109% | 52.99% |
| 104 | West Goshen Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 37,227 | 0.109% | 53.10% |
| 105 | Susquehanna Twp, Dauphin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 36,899 | 0.108% | 53.21% |
| 106 | Saginaw, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.5%, nonresident 0.75% | MI-CITY | ACS + LODES OD | 36,892 | 0.108% | 53.32% |
| 107 | Madison County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 36,855 | 0.108% | 53.42% |
| 108 | Hampden Twp, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.6% ; LST $52 | PA-DCED | ACS + LODES OD | 36,040 | 0.105% | 53.53% |
| 109 | Jackson, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 36,019 | 0.105% | 53.64% |
| 110 | Franklin County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 35,970 | 0.105% | 53.74% |
| 111 | Florence (city), KY | KY | occupational license tax (city) | work-site | 2.00% (payroll+gross receipts) | KY-KACO-KLC | LODES | 35,766 | 0.104% | 53.84% |
| 112 | Owensboro (city), KY | KY | occupational license tax (city) | work-site | 1.78% (payroll+net profits) | KY-KACO-KLC | LODES | 35,391 | 0.103% | 53.95% |
| 113 | Monroeville Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 35,376 | 0.103% | 54.05% |
| 114 | Springettsbury Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 35,283 | 0.103% | 54.15% |
| 115 | East Hempfield Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 34,854 | 0.102% | 54.26% |
| 116 | Morgan County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.72% | IN-DN1 | ACS + LODES aux | 34,804 | 0.102% | 54.36% |
| 117 | Morgantown, WV (municipal service fee) | WV | municipal service fee (flat per week) | work-site | $3.00/per | WV-FEE | LODES | 34,756 | 0.102% | 54.46% |
| 118 | Westerville (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 34,526 | 0.101% | 54.56% |
| 119 | Warrick County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.0% | IN-DN1 | ACS + LODES aux | 34,321 | 0.100% | 54.66% |
| 120 | Mentor (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 33,807 | 0.099% | 54.76% |
| 121 | Huntington, WV (municipal service fee) | WV | municipal service fee (flat per week) | work-site | $5.00/per | WV-FEE | LODES | 33,794 | 0.099% | 54.86% |
| 122 | Upper Dublin Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 33,723 | 0.099% | 54.96% |
| 123 | Altoona City, Blair Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 33,431 | 0.098% | 55.05% |
| 124 | Muskegon, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 33,198 | 0.097% | 55.15% |
| 125 | Cheltenham Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 33,182 | 0.097% | 55.25% |
| 126 | Campbell County (county), KY | KY | occupational license tax (county) | work-site | 0.90% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 33,174 | 0.097% | 55.34% |
| 127 | Moon Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 33,040 | 0.097% | 55.44% |
| 128 | Auburn (city), AL | AL | occupational tax | work-site | 1% | AL-ALM | LODES | 32,830 | 0.096% | 55.54% |
| 129 | Wayne County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.25% | IN-DN1 | ACS + LODES aux | 32,751 | 0.096% | 55.63% |
| 130 | Swatara Twp, Dauphin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.0% ; LST $52 | PA-DCED | ACS + LODES OD | 32,472 | 0.095% | 55.73% |
| 131 | Falls Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 31,747 | 0.093% | 55.82% |
| 132 | Ross Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 31,518 | 0.092% | 55.91% |
| 133 | Scott County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 31,432 | 0.092% | 56.00% |
| 134 | Springfield (city), OH | OH | municipal income tax | work-site | 2.4% | OH-MUNI | LODES | 31,350 | 0.092% | 56.10% |
| 135 | East Whiteland Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.8% ; LST $52 | PA-DCED | ACS + LODES OD | 31,061 | 0.091% | 56.19% |
| 136 | Paducah (city), KY | KY | occupational license tax (city) | work-site | 2.00% (payroll+gross receipts) | KY-KACO-KLC | LODES | 30,856 | 0.090% | 56.28% |
| 137 | Upper Providence Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 30,739 | 0.090% | 56.37% |
| 138 | Warminster Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 30,674 | 0.090% | 56.46% |
| 139 | Robinson Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 30,610 | 0.089% | 56.55% |
| 140 | Grant County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.75% | IN-DN1 | ACS + LODES aux | 30,378 | 0.089% | 56.63% |
| 141 | Montgomery Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 30,326 | 0.089% | 56.72% |
| 142 | Findlay (city), OH | OH | municipal income tax | work-site | 1% | OH-MUNI | LODES | 30,256 | 0.088% | 56.81% |
| 143 | PICKERINGTON LSD, OH school district | OH | school district income tax | residence | 1% (traditional) | OH-SDIT | ACS | 29,945 | 0.087% | 56.90% |
| 144 | Kettering (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 29,865 | 0.087% | 56.99% |
| 145 | Mason (city), OH | OH | municipal income tax | work-site | 1.12% | OH-MUNI | LODES | 29,759 | 0.087% | 57.07% |
| 146 | Whitpain Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.06% ; LST $52 | PA-DCED | ACS + LODES OD | 29,419 | 0.086% | 57.16% |
| 147 | Mccandless Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 29,277 | 0.086% | 57.24% |
| 148 | Lower Macungie Twp, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.15% ; LST $52 | PA-DCED | ACS + LODES OD | 29,221 | 0.085% | 57.33% |
| 149 | Westlake (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 29,163 | 0.085% | 57.41% |
| 150 | Sharonville (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 29,042 | 0.085% | 57.50% |
| 151 | Northampton Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 28,882 | 0.084% | 57.58% |
| 152 | Laurel County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 28,658 | 0.084% | 57.67% |
| 153 | Fairfield (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 28,642 | 0.084% | 57.75% |
| 154 | Bethel Park Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.75% ; LST $52 | PA-DCED | ACS + LODES OD | 28,571 | 0.083% | 57.84% |
| 155 | Elizabethtown (city), KY | KY | occupational license tax (city) | work-site | 1.95% (payroll+net profits) | KY-KACO-KLC | LODES | 28,531 | 0.083% | 57.92% |
| 156 | Williamsport City, Lycoming Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.0% ; LST $52 | PA-DCED | ACS + LODES OD | 28,423 | 0.083% | 58.00% |
| 157 | Upper Moreland Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 28,330 | 0.083% | 58.08% |
| 158 | College Twp, Centre Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.45% ; LST $52 | PA-DCED | ACS + LODES OD | 28,239 | 0.082% | 58.17% |
| 159 | Dearborn County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.4% | IN-DN1 | ACS + LODES aux | 28,044 | 0.082% | 58.25% |
| 160 | Bethlehem Twp, Northampton Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 27,837 | 0.081% | 58.33% |
| 161 | Saint Matthews (city), KY | KY | occupational license tax (city) | work-site | 0.75% (payroll) | KY-KACO-KLC | LODES | 27,822 | 0.081% | 58.41% |
| 162 | South Whitehall Twp, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.1% ; LST $52 | PA-DCED | ACS + LODES OD | 27,714 | 0.081% | 58.49% |
| 163 | Spring Twp, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 27,549 | 0.080% | 58.57% |
| 164 | West Whiteland Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 27,484 | 0.080% | 58.65% |
| 165 | York Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 27,431 | 0.080% | 58.73% |
| 166 | Queen Anne’s County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 27,361 | 0.080% | 58.81% |
| 167 | Penn Hills Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.75% ; LST $52 | PA-DCED | ACS + LODES OD | 27,355 | 0.080% | 58.89% |
| 168 | Solon (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 27,194 | 0.079% | 58.97% |
| 169 | Youngstown (city), OH | OH | municipal income tax | work-site | 2.75% | OH-MUNI | LODES | 26,997 | 0.079% | 59.05% |
| 170 | Lower Allen Twp, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.8% ; LST $52 | PA-DCED | ACS + LODES OD | 26,851 | 0.078% | 59.13% |
| 171 | Allegany County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 26,769 | 0.078% | 59.21% |
| 172 | Pulaski County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 26,767 | 0.078% | 59.29% |
| 173 | West Manchester Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 26,620 | 0.078% | 59.36% |
| 174 | Opelika (city), AL | AL | occupational tax | work-site | 1.5% | AL-ALM | LODES | 26,591 | 0.078% | 59.44% |
| 175 | Frankfort (city), KY | KY | occupational license tax (city) | work-site | 1.95% (payroll+net profits+gross receipts) | KY-KACO-KLC | LODES | 26,514 | 0.077% | 59.52% |
| 176 | Boyd County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 26,451 | 0.077% | 59.60% |
| 177 | State College Boro, Centre Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.25% ; LST $52 | PA-DCED | ACS + LODES OD | 26,263 | 0.077% | 59.67% |
| 178 | Grove City (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 26,168 | 0.076% | 59.75% |
| 179 | Whitehall Twp, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 25,973 | 0.076% | 59.82% |
| 180 | Upper Gwynedd Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 25,859 | 0.076% | 59.90% |
| 181 | Norristown Boro, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.1% ; LST $52 | PA-DCED | ACS + LODES OD | 25,821 | 0.075% | 59.98% |
| 182 | Carlisle Boro, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.6% ; LST $52 | PA-DCED | ACS + LODES OD | 25,728 | 0.075% | 60.05% |
| 183 | East Lampeter Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 25,640 | 0.075% | 60.13% |
| 184 | Independence (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 25,507 | 0.075% | 60.20% |
| 185 | Whitemarsh Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 25,301 | 0.074% | 60.27% |
| 186 | Muhlenberg Twp, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 25,182 | 0.074% | 60.35% |
| 187 | Uwchlan Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 25,044 | 0.073% | 60.42% |
| 188 | Worcester County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 2.25% | MD-WTF | ACS | 24,921 | 0.073% | 60.49% |
| 189 | Chambersburg Boro, Franklin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 24,897 | 0.073% | 60.57% |
| 190 | North Huntingdon Twp, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 24,631 | 0.072% | 60.64% |
| 191 | Hatfield Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 24,545 | 0.072% | 60.71% |
| 192 | Bethlehem City, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 24,176 | 0.071% | 60.78% |
| 193 | Parma (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 24,153 | 0.071% | 60.85% |
| 194 | Lower Southampton Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 24,016 | 0.070% | 60.92% |
| 195 | DeKalb County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.13% | IN-DN1 | ACS + LODES aux | 23,994 | 0.070% | 60.99% |
| 196 | Georgetown (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll+net profits) | KY-KACO-KLC | LODES | 23,896 | 0.070% | 61.06% |
| 197 | Noble County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.75% | IN-DN1 | ACS + LODES aux | 23,683 | 0.069% | 61.13% |
| 198 | Radnor Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 23,586 | 0.069% | 61.20% |
| 199 | Mt Lebanon Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.3% ; LST $52 | PA-DCED | ACS + LODES OD | 23,476 | 0.069% | 61.27% |
| 200 | NEWARK CSD, OH school district | OH | school district income tax | residence | 1% (traditional) | OH-SDIT | ACS | 23,448 | 0.068% | 61.34% |
| 201 | Dubois County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.2% | IN-DN1 | ACS + LODES aux | 23,399 | 0.068% | 61.40% |
| 202 | Mansfield (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 23,371 | 0.068% | 61.47% |
| 203 | Jackson County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.1% | IN-DN1 | ACS + LODES aux | 23,357 | 0.068% | 61.54% |
| 204 | Warrington Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 23,272 | 0.068% | 61.61% |
| 205 | Springfield Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 23,069 | 0.067% | 61.68% |
| 206 | Port Huron, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 23,038 | 0.067% | 61.74% |
| 207 | Findlay Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 23,027 | 0.067% | 61.81% |
| 208 | Marshall County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.25% | IN-DN1 | ACS + LODES aux | 23,016 | 0.067% | 61.88% |
| 209 | Elyria (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 22,998 | 0.067% | 61.95% |
| 210 | Limerick Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 22,904 | 0.067% | 62.01% |
| 211 | LANCASTER CSD, OH school district | OH | school district income tax | residence | 1.5% (earned income) | OH-SDIT | ACS | 22,868 | 0.067% | 62.08% |
| 212 | Silver Spring Twp, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 22,781 | 0.067% | 62.15% |
| 213 | Lower Providence Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 22,736 | 0.066% | 62.21% |
| 214 | Richmond (city), KY | KY | occupational license tax (city) | work-site | 2.00% (payroll+net profits) | KY-KACO-KLC | LODES | 22,733 | 0.066% | 62.28% |
| 215 | Manchester Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 22,694 | 0.066% | 62.35% |
| 216 | Shelby County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.7% | IN-DN1 | ACS + LODES aux | 22,658 | 0.066% | 62.41% |
| 217 | West Mifflin Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 22,586 | 0.066% | 62.48% |
| 218 | East Pennsboro Twp, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.6% ; LST $52 | PA-DCED | ACS + LODES OD | 22,507 | 0.066% | 62.54% |
| 219 | New Albany (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 22,502 | 0.066% | 62.61% |
| 220 | Hilliard (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 22,350 | 0.065% | 62.67% |
| 221 | REYNOLDSBURG CSD, OH school district | OH | school district income tax | residence | 0.5% (traditional) | OH-SDIT | ACS | 22,164 | 0.065% | 62.74% |
| 222 | Gahanna (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 22,057 | 0.064% | 62.80% |
| 223 | Strongsville (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 22,001 | 0.064% | 62.87% |
| 224 | FAIRBORN CSD, OH school district | OH | school district income tax | residence | 0.5% (traditional) | OH-SDIT | ACS | 21,957 | 0.064% | 62.93% |
| 225 | Lawrence County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.75% | IN-DN1 | ACS + LODES aux | 21,833 | 0.064% | 63.00% |
| 226 | Chester City, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 3.75% ; LST $52 | PA-DCED | ACS + LODES OD | 21,788 | 0.064% | 63.06% |
| 227 | Hamilton (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 21,779 | 0.064% | 63.12% |
| 228 | Newtown Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 21,776 | 0.064% | 63.19% |
| 229 | Salisbury Twp, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 21,756 | 0.064% | 63.25% |
| 230 | Cuyahoga Falls (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 21,532 | 0.063% | 63.31% |
| 231 | Wooster (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 21,408 | 0.063% | 63.38% |
| 232 | Henry County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.02% | IN-DN1 | ACS + LODES aux | 21,325 | 0.062% | 63.44% |
| 233 | Easton City, Northampton Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.95% ; LST $52 | PA-DCED | ACS + LODES OD | 21,316 | 0.062% | 63.50% |
| 234 | Newark (city), OH | OH | municipal income tax | work-site | 1.75% | OH-MUNI | LODES | 21,302 | 0.062% | 63.56% |
| 235 | Palmer Twp, Northampton Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.2% ; LST $52 | PA-DCED | ACS + LODES OD | 21,233 | 0.062% | 63.62% |
| 236 | Hopkinsville (city), KY | KY | occupational license tax (city) | work-site | 1.95% (payroll+net profits) | KY-KACO-KLC | LODES | 21,226 | 0.062% | 63.69% |
| 237 | Cecil Twp, Washington Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 21,203 | 0.062% | 63.75% |
| 238 | Exeter Twp, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 20,794 | 0.061% | 63.81% |
| 239 | West Chester Boro, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 20,709 | 0.060% | 63.87% |
| 240 | FINDLAY CSD, OH school district | OH | school district income tax | residence | 1% (earned income) | OH-SDIT | ACS | 20,475 | 0.060% | 63.93% |
| 241 | Wheeling, WV (municipal service fee) | WV | municipal service fee (flat per week) | work-site | $2.00/per | WV-FEE | LODES | 20,299 | 0.059% | 63.99% |
| 242 | Beachwood (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 20,269 | 0.059% | 64.05% |
| 243 | LaGrange County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.65% | IN-DN1 | ACS + LODES aux | 20,173 | 0.059% | 64.11% |
| 244 | Pike County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 20,166 | 0.059% | 64.17% |
| 245 | Harrison County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.0% | IN-DN1 | ACS + LODES aux | 20,151 | 0.059% | 64.22% |
| 246 | Euclid (city), OH | OH | municipal income tax | work-site | 2.85% | OH-MUNI | LODES | 20,128 | 0.059% | 64.28% |
| 247 | Steuben County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.99% | IN-DN1 | ACS + LODES aux | 19,918 | 0.058% | 64.34% |
| 248 | Parkersburg, WV (municipal service fee) | WV | municipal service fee (flat per week) | work-site | $2.50/per | WV-FEE | LODES | 19,899 | 0.058% | 64.40% |
| 249 | Plum Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 19,627 | 0.057% | 64.46% |
| 250 | Lima (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 19,609 | 0.057% | 64.51% |
| 251 | Montgomery County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.65% | IN-DN1 | ACS + LODES aux | 19,605 | 0.057% | 64.57% |
| 252 | Jessamine County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 19,582 | 0.057% | 64.63% |
| 253 | Hanover Boro, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 19,558 | 0.057% | 64.69% |
| 254 | Covington (city), KY | KY | occupational license tax (city) | work-site | 2.45% (payroll+net profits) | KY-KACO-KLC | LODES | 19,534 | 0.057% | 64.74% |
| 255 | Peters Twp, Washington Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 19,411 | 0.057% | 64.80% |
| 256 | North Fayette Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 19,343 | 0.057% | 64.86% |
| 257 | Knox County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.7% | IN-DN1 | ACS + LODES aux | 19,292 | 0.056% | 64.91% |
| 258 | Murrysville Boro, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.2% ; LST $52 | PA-DCED | ACS + LODES OD | 19,252 | 0.056% | 64.97% |
| 259 | Middleburg Heights (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 19,223 | 0.056% | 65.02% |
| 260 | Pottstown Boro, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 19,202 | 0.056% | 65.08% |
| 261 | Upper Allen Twp, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 19,187 | 0.056% | 65.14% |
| 262 | Wyomissing Boro, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 19,172 | 0.056% | 65.19% |
| 263 | Doylestown Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 19,155 | 0.056% | 65.25% |
| 264 | Lebanon City, Lebanon Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.9% ; LST $52 | PA-DCED | ACS + LODES OD | 18,973 | 0.055% | 65.30% |
| 265 | Hanover Twp, Northampton Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 18,882 | 0.055% | 65.36% |
| 266 | Shaler Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 18,813 | 0.055% | 65.41% |
| 267 | Hazle Twp, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 18,756 | 0.055% | 65.47% |
| 268 | Gibson County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.3% | IN-DN1 | ACS + LODES aux | 18,671 | 0.055% | 65.52% |
| 269 | Henderson County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 18,611 | 0.054% | 65.58% |
| 270 | Huntington County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.95% | IN-DN1 | ACS + LODES aux | 18,568 | 0.054% | 65.63% |
| 271 | Hazleton City, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.125% ; LST $52 | PA-DCED | ACS + LODES OD | 18,462 | 0.054% | 65.69% |
| 272 | Lancaster (city), OH | OH | municipal income tax | work-site | 2.3% | OH-MUNI | LODES | 18,461 | 0.054% | 65.74% |
| 273 | Nelson County (county), KY | KY | occupational license tax (county) | work-site | 0.50% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 18,432 | 0.054% | 65.79% |
| 274 | Somerset (city), KY | KY | occupational license tax (city) | work-site | 0.60% (payroll+net profits) | KY-KACO-KLC | LODES | 18,418 | 0.054% | 65.85% |
| 275 | Conshohocken Boro, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 18,187 | 0.053% | 65.90% |
| 276 | Zanesville (city), OH | OH | municipal income tax | work-site | 1.9% | OH-MUNI | LODES | 18,181 | 0.053% | 65.95% |
| 277 | Greensburg City, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.65% ; LST $52 | PA-DCED | ACS + LODES OD | 18,047 | 0.053% | 66.01% |
| 278 | Butler Twp, Butler Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 18,035 | 0.053% | 66.06% |
| 279 | BOWLING GREEN CSD, OH school district | OH | school district income tax | residence | 1.25% (traditional) | OH-SDIT | ACS | 18,033 | 0.053% | 66.11% |
| 280 | West Norriton Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 17,917 | 0.052% | 66.16% |
| 281 | Lower Swatara Twp, Dauphin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.75% ; LST $52 | PA-DCED | ACS + LODES OD | 17,903 | 0.052% | 66.22% |
| 282 | Middletown (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 17,897 | 0.052% | 66.27% |
| 283 | Whitley County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.6829% | IN-DN1 | ACS + LODES aux | 17,892 | 0.052% | 66.32% |
| 284 | Cass County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.95% | IN-DN1 | ACS + LODES aux | 17,886 | 0.052% | 66.37% |
| 285 | South Middleton Twp, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.6% ; LST $52 | PA-DCED | ACS + LODES OD | 17,686 | 0.052% | 66.42% |
| 286 | Scott Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 17,574 | 0.051% | 66.48% |
| 287 | Upper Saucon Twp, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.1% ; LST $52 | PA-DCED | ACS + LODES OD | 17,574 | 0.051% | 66.53% |
| 288 | Ohara Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.3% ; LST $52 | PA-DCED | ACS + LODES OD | 17,564 | 0.051% | 66.58% |
| 289 | East Norriton Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 17,544 | 0.051% | 66.63% |
| 290 | Upper Southampton Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 17,399 | 0.051% | 66.68% |
| 291 | Hopkins County (county), KY | KY | occupational license tax (county) | work-site | 0.50% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 17,329 | 0.051% | 66.73% |
| 292 | Troy (city), OH | OH | municipal income tax | work-site | 1.75% | OH-MUNI | LODES | 17,324 | 0.051% | 66.78% |
| 293 | Putnam County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.3% | IN-DN1 | ACS + LODES aux | 17,304 | 0.051% | 66.83% |
| 294 | Unity Twp, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 17,301 | 0.051% | 66.88% |
| 295 | KINGS LSD, OH school district | OH | school district income tax | residence | 1% (earned income) | OH-SDIT | ACS | 17,261 | 0.050% | 66.93% |
| 296 | Talbot County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 2.40% | MD-WTF | ACS | 17,158 | 0.050% | 66.98% |
| 297 | Phoenixville Boro, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.1% ; LST $52 | PA-DCED | ACS + LODES OD | 17,157 | 0.050% | 67.03% |
| 298 | Lansdale Boro, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 17,031 | 0.050% | 67.08% |
| 299 | Ferguson Twp, Centre Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.35% ; LST $52 | PA-DCED | ACS + LODES OD | 16,976 | 0.050% | 67.13% |
| 300 | Maumee (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 16,927 | 0.049% | 67.18% |
| 301 | Shepherdsville (city), KY | KY | occupational license tax (city) | work-site | 2.00% (payroll) | KY-KACO-KLC | LODES | 16,917 | 0.049% | 67.23% |
| 302 | South Fayette Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 16,896 | 0.049% | 67.28% |
| 303 | PERRYSBURG EVSD, OH school district | OH | school district income tax | residence | 0.5% (traditional) | OH-SDIT | ACS | 16,885 | 0.049% | 67.33% |
| 304 | Bowling Green (city), OH | OH | municipal income tax | work-site | 2.15% | OH-MUNI | LODES | 16,861 | 0.049% | 67.38% |
| 305 | North Strabane Twp, Washington Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 16,861 | 0.049% | 67.43% |
| 306 | Delaware (city), OH | OH | municipal income tax | work-site | 1.85% | OH-MUNI | LODES | 16,855 | 0.049% | 67.48% |
| 307 | Pine Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 16,851 | 0.049% | 67.53% |
| 308 | Plains Twp, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 16,821 | 0.049% | 67.58% |
| 309 | Adams County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.6% | IN-DN1 | ACS + LODES aux | 16,783 | 0.049% | 67.63% |
| 310 | Manor Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 16,745 | 0.049% | 67.67% |
| 311 | Johnstown City, Cambria Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 16,705 | 0.049% | 67.72% |
| 312 | Warwick Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.15% ; LST $52 | PA-DCED | ACS + LODES OD | 16,701 | 0.049% | 67.77% |
| 313 | Fairview Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.45% ; LST $52 | PA-DCED | ACS + LODES OD | 16,638 | 0.049% | 67.82% |
| 314 | XENIA COMMUNITY CSD, OH school district | OH | school district income tax | residence | 0.5% (traditional) | OH-SDIT | ACS | 16,622 | 0.049% | 67.87% |
| 315 | Hermitage City, Mercer Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.25% ; LST $52 | PA-DCED | ACS + LODES OD | 16,585 | 0.048% | 67.92% |
| 316 | Dunmore Boro, Lackawanna Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 16,564 | 0.048% | 67.97% |
| 317 | Springfield Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 16,525 | 0.048% | 68.01% |
| 318 | Shelby County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 16,522 | 0.048% | 68.06% |
| 319 | Clinton County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.65% | IN-DN1 | ACS + LODES aux | 16,454 | 0.048% | 68.11% |
| 320 | Stroud Twp, Monroe Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 16,447 | 0.048% | 68.16% |
| 321 | Green (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 16,383 | 0.048% | 68.21% |
| 322 | Twinsburg (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 16,371 | 0.048% | 68.25% |
| 323 | Jefferson County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.03% | IN-DN1 | ACS + LODES aux | 16,362 | 0.048% | 68.30% |
| 324 | ATHENS CSD, OH school district | OH | school district income tax | residence | 1% (earned income) | OH-SDIT | ACS | 16,252 | 0.047% | 68.35% |
| 325 | Penn Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 16,147 | 0.047% | 68.40% |
| 326 | Upper St Clair Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.3% ; LST $52 | PA-DCED | ACS + LODES OD | 16,094 | 0.047% | 68.44% |
| 327 | Massillon (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 16,093 | 0.047% | 68.49% |
| 328 | Marysville (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 16,064 | 0.047% | 68.54% |
| 329 | White Twp, Indiana Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 16,057 | 0.047% | 68.58% |
| 330 | Worthington (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 16,010 | 0.047% | 68.63% |
| 331 | Medina (city), OH | OH | municipal income tax | work-site | 1.25% | OH-MUNI | LODES | 15,998 | 0.047% | 68.68% |
| 332 | Caroline County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 15,959 | 0.047% | 68.72% |
| 333 | Newtown Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 15,859 | 0.046% | 68.77% |
| 334 | Jasper County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.864% | IN-DN1 | ACS + LODES aux | 15,852 | 0.046% | 68.82% |
| 335 | Washington City, Washington Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 15,805 | 0.046% | 68.86% |
| 336 | Norwood (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 15,722 | 0.046% | 68.91% |
| 337 | Daviess County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.5% | IN-DN1 | ACS + LODES aux | 15,613 | 0.046% | 68.96% |
| 338 | Richland Twp, Cambria Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 15,597 | 0.046% | 69.00% |
| 339 | Ashland (city), KY | KY | occupational license tax (city) | work-site | 2.00% (payroll+net profits) | KY-KACO-KLC | LODES | 15,429 | 0.045% | 69.05% |
| 340 | Media Boro, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 15,426 | 0.045% | 69.09% |
| 341 | TROY CSD, OH school district | OH | school district income tax | residence | 1.5% (earned income) | OH-SDIT | ACS | 15,374 | 0.045% | 69.14% |
| 342 | Spring Garden Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 15,333 | 0.045% | 69.18% |
| 343 | Willoughby (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 15,264 | 0.045% | 69.23% |
| 344 | Buckingham Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $10 | PA-DCED | ACS + LODES OD | 15,234 | 0.044% | 69.27% |
| 345 | Springdale (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 15,219 | 0.044% | 69.31% |
| 346 | Miami County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.54% | IN-DN1 | ACS + LODES aux | 15,187 | 0.044% | 69.36% |
| 347 | Mayfield Heights (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 15,161 | 0.044% | 69.40% |
| 348 | New Castle City, Lawrence Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.075% ; LST $52 | PA-DCED | ACS + LODES OD | 15,152 | 0.044% | 69.45% |
| 349 | Ripley County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.38% | IN-DN1 | ACS + LODES aux | 15,105 | 0.044% | 69.49% |
| 350 | West Hempfield Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 15,096 | 0.044% | 69.54% |
| 351 | Wabash County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.9% | IN-DN1 | ACS + LODES aux | 15,020 | 0.044% | 69.58% |
| 352 | Boyle County (county), KY | KY | occupational license tax (county) | work-site | 1.25% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 14,969 | 0.044% | 69.62% |
| 353 | East Goshen Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,964 | 0.044% | 69.67% |
| 354 | Wells County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.1% | IN-DN1 | ACS + LODES aux | 14,899 | 0.044% | 69.71% |
| 355 | Towamencin Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,882 | 0.043% | 69.75% |
| 356 | Whitley County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 14,880 | 0.043% | 69.80% |
| 357 | Lower Salford Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,826 | 0.043% | 69.84% |
| 358 | Dorchester County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.30% | MD-WTF | ACS | 14,753 | 0.043% | 69.88% |
| 359 | Cumru Twp, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,725 | 0.043% | 69.93% |
| 360 | Penn Twp, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,668 | 0.043% | 69.97% |
| 361 | Lorain (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 14,522 | 0.042% | 70.01% |
| 362 | Hampton Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,469 | 0.042% | 70.05% |
| 363 | Pocono Twp, Monroe Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,414 | 0.042% | 70.10% |
| 364 | TALAWANDA CSD, OH school district | OH | school district income tax | residence | 1% (traditional) | OH-SDIT | ACS | 14,399 | 0.042% | 70.14% |
| 365 | Lyndon (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES | 14,378 | 0.042% | 70.18% |
| 366 | Mahoning Twp, Montour Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.65% ; LST $52 | PA-DCED | ACS + LODES OD | 14,374 | 0.042% | 70.22% |
| 367 | Forks Twp, Northampton Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,368 | 0.042% | 70.26% |
| 368 | Hilltown Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 14,367 | 0.042% | 70.31% |
| 369 | Baldwin Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,362 | 0.042% | 70.35% |
| 370 | Guilford Twp, Franklin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 14,323 | 0.042% | 70.39% |
| 371 | SOUTHWEST LSD, OH school district | OH | school district income tax | residence | 0.75% (earned income) | OH-SDIT | ACS | 14,279 | 0.042% | 70.43% |
| 372 | Hanover Twp, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,263 | 0.042% | 70.47% |
| 373 | Sidney (city), OH | OH | municipal income tax | work-site | 1.75% | OH-MUNI | LODES | 14,261 | 0.042% | 70.51% |
| 374 | Bardstown (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll+net profits) | KY-KACO-KLC | LODES | 14,170 | 0.041% | 70.56% |
| 375 | Groveport (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 14,164 | 0.041% | 70.60% |
| 376 | Plumstead Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,140 | 0.041% | 70.64% |
| 377 | Greene County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.35% | IN-DN1 | ACS + LODES aux | 14,127 | 0.041% | 70.68% |
| 378 | SOUTHWEST LICKING LSD, OH school district | OH | school district income tax | residence | 0.75% (traditional) | OH-SDIT | ACS | 14,078 | 0.041% | 70.72% |
| 379 | Marshall Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 14,017 | 0.041% | 70.76% |
| 380 | Lebanon (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 13,941 | 0.041% | 70.80% |
| 381 | Avon (city), OH | OH | municipal income tax | work-site | 1.95% | OH-MUNI | LODES | 13,882 | 0.041% | 70.84% |
| 382 | Huber Heights (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 13,817 | 0.040% | 70.88% |
| 383 | Obetz (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 13,779 | 0.040% | 70.92% |
| 384 | BIG WALNUT LSD, OH school district | OH | school district income tax | residence | 0.75% (traditional) | OH-SDIT | ACS | 13,772 | 0.040% | 70.96% |
| 385 | Patton Twp, Centre Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.45% ; LST $52 | PA-DCED | ACS + LODES OD | 13,754 | 0.040% | 71.00% |
| 386 | Decatur County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.45% | IN-DN1 | ACS + LODES aux | 13,747 | 0.040% | 71.04% |
| 387 | Dover Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.4% ; LST $52 | PA-DCED | ACS + LODES OD | 13,699 | 0.040% | 71.08% |
| 388 | Washington County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.0% | IN-DN1 | ACS + LODES aux | 13,692 | 0.040% | 71.12% |
| 389 | Moraine (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 13,628 | 0.040% | 71.16% |
| 390 | Maxatawny Twp, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,598 | 0.040% | 71.20% |
| 391 | Upper Chichester Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,598 | 0.040% | 71.24% |
| 392 | Posey County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.45% | IN-DN1 | ACS + LODES aux | 13,594 | 0.040% | 71.28% |
| 393 | Chillicothe (city), OH | OH | municipal income tax | work-site | 1.8% | OH-MUNI | LODES | 13,540 | 0.040% | 71.32% |
| 394 | Clark County (county), KY | KY | occupational license tax (county) | work-site | 1.50% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 13,539 | 0.040% | 71.36% |
| 395 | Garrett County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 2.65% | MD-WTF | ACS | 13,430 | 0.039% | 71.40% |
| 396 | Green Tree Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,380 | 0.039% | 71.44% |
| 397 | Danville (city), KY | KY | occupational license tax (city) | work-site | 1.90% (payroll+net profits) | KY-KACO-KLC | LODES | 13,372 | 0.039% | 71.48% |
| 398 | Doylestown Boro, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,301 | 0.039% | 71.52% |
| 399 | Ashland (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 13,287 | 0.039% | 71.56% |
| 400 | Nicholasville (city), KY | KY | occupational license tax (city) | work-site | 1.50% (payroll+net profits) | KY-KACO-KLC | LODES | 13,282 | 0.039% | 71.60% |
| 401 | Reynoldsburg (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 13,258 | 0.039% | 71.64% |
| 402 | Fountain Hill Boro, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,250 | 0.039% | 71.67% |
| 403 | Perrysburg (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 13,217 | 0.039% | 71.71% |
| 404 | Jennings County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.5% | IN-DN1 | ACS + LODES aux | 13,210 | 0.039% | 71.75% |
| 405 | North Whitehall Twp, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,194 | 0.039% | 71.79% |
| 406 | Richland Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.6% ; LST $52 | PA-DCED | ACS + LODES OD | 13,188 | 0.039% | 71.83% |
| 407 | Collier Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,158 | 0.038% | 71.87% |
| 408 | Hudson (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 13,110 | 0.038% | 71.91% |
| 409 | Caln Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,098 | 0.038% | 71.94% |
| 410 | Warren (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 13,079 | 0.038% | 71.98% |
| 411 | Lancaster Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $10 | PA-DCED | ACS + LODES OD | 13,076 | 0.038% | 72.02% |
| 412 | North Olmsted (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 13,060 | 0.038% | 72.06% |
| 413 | Upper Leacock Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,055 | 0.038% | 72.10% |
| 414 | Ephrata Boro, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,015 | 0.038% | 72.13% |
| 415 | Butler City, Butler Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 13,002 | 0.038% | 72.17% |
| 416 | Shaker Heights (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 12,990 | 0.038% | 72.21% |
| 417 | Miamisburg (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 12,980 | 0.038% | 72.25% |
| 418 | Antrim Twp, Franklin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,973 | 0.038% | 72.29% |
| 419 | Upper Arlington (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 12,896 | 0.038% | 72.32% |
| 420 | Portsmouth (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 12,891 | 0.038% | 72.36% |
| 421 | Greene Twp, Franklin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $10 | PA-DCED | ACS + LODES OD | 12,859 | 0.038% | 72.40% |
| 422 | Brooklyn (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 12,843 | 0.038% | 72.44% |
| 423 | FREMONT CSD, OH school district | OH | school district income tax | residence | 1.25% (traditional) | OH-SDIT | ACS | 12,842 | 0.038% | 72.47% |
| 424 | Concord Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 12,813 | 0.037% | 72.51% |
| 425 | Pottsville City, Schuylkill Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,800 | 0.037% | 72.55% |
| 426 | Glasgow (city), KY | KY | occupational license tax (city) | work-site | 1.75% (payroll+net profits) | KY-KACO-KLC | LODES | 12,765 | 0.037% | 72.59% |
| 427 | Fairlawn (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 12,764 | 0.037% | 72.62% |
| 428 | Franconia Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 12,764 | 0.037% | 72.66% |
| 429 | Stow (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 12,759 | 0.037% | 72.70% |
| 430 | Logan Twp, Blair Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,713 | 0.037% | 72.73% |
| 431 | Athens (city), OH | OH | municipal income tax | work-site | 1.95% | OH-MUNI | LODES | 12,670 | 0.037% | 72.77% |
| 432 | Lower Moreland Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,634 | 0.037% | 72.81% |
| 433 | Warwick Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,603 | 0.037% | 72.85% |
| 434 | West Lampeter Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,563 | 0.037% | 72.88% |
| 435 | Clay County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.35% | IN-DN1 | ACS + LODES aux | 12,554 | 0.037% | 72.92% |
| 436 | East Cocalico Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,538 | 0.037% | 72.96% |
| 437 | Lower Gwynedd Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,408 | 0.036% | 72.99% |
| 438 | Vandalia (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 12,288 | 0.036% | 73.03% |
| 439 | Madisonville (city), KY | KY | occupational license tax (city) | work-site | 2.50% (payroll+net profits) | KY-KACO-KLC | LODES | 12,242 | 0.036% | 73.06% |
| 440 | Kingston Boro, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.175% ; LST $52 | PA-DCED | ACS + LODES OD | 12,240 | 0.036% | 73.10% |
| 441 | Haverford Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 12,221 | 0.036% | 73.13% |
| 442 | Indiana Boro, Indiana Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 12,151 | 0.035% | 73.17% |
| 443 | Lower Nazareth Twp, Northampton Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.45% ; LST $52 | PA-DCED | ACS + LODES OD | 12,114 | 0.035% | 73.21% |
| 444 | White County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.32% | IN-DN1 | ACS + LODES aux | 12,051 | 0.035% | 73.24% |
| 445 | CANAL WINCHESTER LSD, OH school district | OH | school district income tax | residence | 0.75% (traditional) | OH-SDIT | ACS | 12,046 | 0.035% | 73.28% |
| 446 | Henderson (city), KY | KY | occupational license tax (city) | work-site | 1.65% (payroll+net profits) | KY-KACO-KLC | LODES | 12,044 | 0.035% | 73.31% |
| 447 | Harborcreek Twp, Erie Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,035 | 0.035% | 73.35% |
| 448 | Willistown Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 12,000 | 0.035% | 73.38% |
| 449 | Whitehall Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 11,953 | 0.035% | 73.42% |
| 450 | Graves County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 11,949 | 0.035% | 73.45% |
| 451 | PIQUA CSD, OH school district | OH | school district income tax | residence | 1.25% (traditional) | OH-SDIT | ACS | 11,894 | 0.035% | 73.49% |
| 452 | SIDNEY CSD, OH school district | OH | school district income tax | residence | 0.75% (earned income) | OH-SDIT | ACS | 11,892 | 0.035% | 73.52% |
| 453 | Lakewood (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 11,809 | 0.034% | 73.56% |
| 454 | Kent (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 11,798 | 0.034% | 73.59% |
| 455 | Fairborn (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 11,766 | 0.034% | 73.62% |
| 456 | Coolbaugh Twp, Monroe Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 11,684 | 0.034% | 73.66% |
| 457 | New Britain Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.125% ; LST $52 | PA-DCED | ACS + LODES OD | 11,646 | 0.034% | 73.69% |
| 458 | Pikeville (city), KY | KY | occupational license tax (city) | work-site | 2.00% (payroll+net profits) | KY-KACO-KLC | LODES | 11,639 | 0.034% | 73.73% |
| 459 | Centerville (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 11,595 | 0.034% | 73.76% |
| 460 | Meadville City, Crawford Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 11,588 | 0.034% | 73.79% |
| 461 | Lapeer, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 11,580 | 0.034% | 73.83% |
| 462 | Scott County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.16% | IN-DN1 | ACS + LODES aux | 11,575 | 0.034% | 73.86% |
| 463 | Randolph County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 3.0% | IN-DN1 | ACS + LODES aux | 11,570 | 0.034% | 73.90% |
| 464 | Ridley Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 11,567 | 0.034% | 73.93% |
| 465 | Taylor County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 11,564 | 0.034% | 73.96% |
| 466 | Bloomsburg Town, Columbia Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.56% ; LST $52 | PA-DCED | ACS + LODES OD | 11,516 | 0.034% | 74.00% |
| 467 | Franklin Park Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 11,516 | 0.034% | 74.03% |
| 468 | Marshall County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 11,471 | 0.034% | 74.06% |
| 469 | TEAYS VALLEY LSD, OH school district | OH | school district income tax | residence | 1.5% (earned income) | OH-SDIT | ACS | 11,471 | 0.034% | 74.10% |
| 470 | Erlanger (city), KY | KY | occupational license tax (city) | work-site | 1.50% (payroll+gross receipts) | KY-KACO-KLC | LODES | 11,470 | 0.034% | 74.13% |
| 471 | Monroe (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 11,460 | 0.033% | 74.16% |
| 472 | Franklin County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.7% | IN-DN1 | ACS + LODES aux | 11,459 | 0.033% | 74.20% |
| 473 | Perry County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 11,440 | 0.033% | 74.23% |
| 474 | Center Twp, Beaver Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 11,396 | 0.033% | 74.26% |
| 475 | Mount Vernon (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 11,321 | 0.033% | 74.30% |
| 476 | Emmaus Boro, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 11,301 | 0.033% | 74.33% |
| 477 | Winchester (city), KY | KY | occupational license tax (city) | work-site | 2.15% (payroll) | KY-KACO-KLC | LODES | 11,253 | 0.033% | 74.36% |
| 478 | Mckeesport City, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 11,248 | 0.033% | 74.40% |
| 479 | Newberry Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.45% ; LST $52 | PA-DCED | ACS + LODES OD | 11,208 | 0.033% | 74.43% |
| 480 | Jenkintown Boro, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 11,165 | 0.033% | 74.46% |
| 481 | Marple Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 11,155 | 0.033% | 74.49% |
| 482 | Whitehall (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 11,151 | 0.033% | 74.53% |
| 483 | New Garden Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.125% ; LST $52 | PA-DCED | ACS + LODES OD | 11,125 | 0.032% | 74.56% |
| 484 | Spencer County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 0.8% | IN-DN1 | ACS + LODES aux | 11,111 | 0.032% | 74.59% |
| 485 | Windsor Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 11,044 | 0.032% | 74.62% |
| 486 | Fremont (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 11,039 | 0.032% | 74.66% |
| 487 | Evendale (village), OH | OH | municipal income tax | work-site | 1.2% | OH-MUNI | LODES | 11,016 | 0.032% | 74.69% |
| 488 | Sandusky (city), OH | OH | municipal income tax | work-site | 1.25% | OH-MUNI | LODES | 10,985 | 0.032% | 74.72% |
| 489 | TIFFIN CSD, OH school district | OH | school district income tax | residence | 0.75% (earned income) | OH-SDIT | ACS | 10,979 | 0.032% | 74.75% |
| 490 | Marietta (city), OH | OH | municipal income tax | work-site | 1.85% | OH-MUNI | LODES | 10,974 | 0.032% | 74.78% |
| 491 | Montgomery (city), OH | OH | municipal income tax | work-site | 1% | OH-MUNI | LODES | 10,949 | 0.032% | 74.82% |
| 492 | Valley View (village), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 10,894 | 0.032% | 74.85% |
| 493 | Summit Twp, Erie Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,883 | 0.032% | 74.88% |
| 494 | South Strabane Twp, Washington Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,819 | 0.032% | 74.91% |
| 495 | Adams Twp, Butler Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $10 | PA-DCED | ACS + LODES OD | 10,794 | 0.032% | 74.94% |
| 496 | Hanover Twp, Lehigh Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,768 | 0.031% | 74.97% |
| 497 | Fayette County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.82% | IN-DN1 | ACS + LODES aux | 10,733 | 0.031% | 75.01% |
| 498 | Richland Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,685 | 0.031% | 75.04% |
| 499 | Glendale, CO (occupational privilege tax) | CO | occupational privilege tax (flat monthly) | work-site | $5.00/mo employee + $5.00/mo employer, earnings over $750/mo | CO-OPT | LODES | 10,676 | 0.031% | 75.07% |
| 500 | South Lebanon Twp, Lebanon Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,663 | 0.031% | 75.10% |
| 501 | Wilkinsburg Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,646 | 0.031% | 75.13% |
| 502 | Rowan County (county), KY | KY | occupational license tax (county) | work-site | 1.50% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 10,626 | 0.031% | 75.16% |
| 503 | Wilmington (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 10,602 | 0.031% | 75.19% |
| 504 | West Reading Boro, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,592 | 0.031% | 75.22% |
| 505 | Upper Uwchlan Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,591 | 0.031% | 75.25% |
| 506 | Warrensville Heights (city), OH | OH | municipal income tax | work-site | 2.6% | OH-MUNI | LODES | 10,567 | 0.031% | 75.29% |
| 507 | CLOVERLEAF LSD, OH school district | OH | school district income tax | residence | 1% (earned income) | OH-SDIT | ACS | 10,451 | 0.031% | 75.32% |
| 508 | Montgomery County (county), KY | KY | occupational license tax (county) | work-site | 2.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 10,428 | 0.030% | 75.35% |
| 509 | Garfield Heights (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 10,410 | 0.030% | 75.38% |
| 510 | Carroll County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.4733% | IN-DN1 | ACS + LODES aux | 10,382 | 0.030% | 75.41% |
| 511 | Loyalsock Twp, Lycoming Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.65% ; LST $52 | PA-DCED | ACS + LODES OD | 10,375 | 0.030% | 75.44% |
| 512 | Owen County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.5% | IN-DN1 | ACS + LODES aux | 10,333 | 0.030% | 75.47% |
| 513 | Middlesex Twp, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.6% ; LST $52 | PA-DCED | ACS + LODES OD | 10,295 | 0.030% | 75.50% |
| 514 | Pittston Twp, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,268 | 0.030% | 75.53% |
| 515 | Murray (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES | 10,243 | 0.030% | 75.56% |
| 516 | NORTHEASTERN LSD (CLARK CO.), OH school district | OH | school district income tax | residence | 1% (earned income) | OH-SDIT | ACS | 10,237 | 0.030% | 75.59% |
| 517 | Woodford County (county), KY | KY | occupational license tax (county) | work-site | 1.50% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 10,169 | 0.030% | 75.62% |
| 518 | Starke County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.71% | IN-DN1 | ACS + LODES aux | 10,150 | 0.030% | 75.65% |
| 519 | Sylvania (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 10,111 | 0.030% | 75.68% |
| 520 | North Union Twp, Fayette Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,068 | 0.029% | 75.71% |
| 521 | Ephrata Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,056 | 0.029% | 75.74% |
| 522 | St Marys City, Elk Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 10,042 | 0.029% | 75.76% |
| 523 | Downingtown Boro, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,033 | 0.029% | 75.79% |
| 524 | Fairmont, WV (municipal service fee) | WV | municipal service fee (flat per week) | work-site | $2.00/per | WV-FEE | LODES | 10,018 | 0.029% | 75.82% |
| 525 | Jefferson Hills Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,017 | 0.029% | 75.85% |
| 526 | Steubenville (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 10,015 | 0.029% | 75.88% |
| 527 | West Donegal Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 10,015 | 0.029% | 75.91% |
| 528 | Bedford Heights (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,958 | 0.029% | 75.94% |
| 529 | South Union Twp, Fayette Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,932 | 0.029% | 75.97% |
| 530 | Chartiers Twp, Washington Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,928 | 0.029% | 76.00% |
| 531 | Marion (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,927 | 0.029% | 76.03% |
| 532 | East Stroudsburg Boro, Monroe Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,914 | 0.029% | 76.06% |
| 533 | Hamtramck, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 9,902 | 0.029% | 76.08% |
| 534 | Pleasant Hills Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,902 | 0.029% | 76.11% |
| 535 | Kennett Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 9,868 | 0.029% | 76.14% |
| 536 | GREENVILLE CSD, OH school district | OH | school district income tax | residence | 0.5% (traditional) | OH-SDIT | ACS | 9,857 | 0.029% | 76.17% |
| 537 | Rapho Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,763 | 0.029% | 76.20% |
| 538 | BUCKEYE VALLEY LSD, OH school district | OH | school district income tax | residence | 1% (traditional) | OH-SDIT | ACS | 9,756 | 0.028% | 76.23% |
| 539 | Tiffin (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,738 | 0.028% | 76.26% |
| 540 | Kent County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.30% | MD-WTF | ACS | 9,735 | 0.028% | 76.29% |
| 541 | Perry County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.4% | IN-DN1 | ACS + LODES aux | 9,735 | 0.028% | 76.31% |
| 542 | Lower Pottsgrove Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,714 | 0.028% | 76.34% |
| 543 | Orange County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.75% | IN-DN1 | ACS + LODES aux | 9,698 | 0.028% | 76.37% |
| 544 | Warren City, Warren Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.8% ; LST $52 | PA-DCED | ACS + LODES OD | 9,677 | 0.028% | 76.40% |
| 545 | Penn Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,674 | 0.028% | 76.43% |
| 546 | Amity Twp, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,661 | 0.028% | 76.46% |
| 547 | Wadsworth (city), OH | OH | municipal income tax | work-site | 1.4% | OH-MUNI | LODES | 9,633 | 0.028% | 76.48% |
| 548 | Allegheny Twp, Blair Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,616 | 0.028% | 76.51% |
| 549 | Defiance (city), OH | OH | municipal income tax | work-site | 1.8% | OH-MUNI | LODES | 9,609 | 0.028% | 76.54% |
| 550 | CELINA CSD, OH school district | OH | school district income tax | residence | 1% (earned income) | OH-SDIT | ACS | 9,571 | 0.028% | 76.57% |
| 551 | Moosic Boro, Lackawanna Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,564 | 0.028% | 76.60% |
| 552 | Derry  Twp, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,559 | 0.028% | 76.62% |
| 553 | Rostraver Twp, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,549 | 0.028% | 76.65% |
| 554 | Ionia, MI (city income tax) | MI | city income tax | residence+work-site | resident 1.0%, nonresident 0.5% | MI-CITY | ACS + LODES OD | 9,544 | 0.028% | 76.68% |
| 555 | Hopewell Twp, Beaver Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,500 | 0.028% | 76.71% |
| 556 | Shelbyville (city), KY | KY | occupational license tax (city) | work-site | 1.50% (payroll+net profits) | KY-KACO-KLC | LODES | 9,485 | 0.028% | 76.73% |
| 557 | Newport (city), KY | KY | occupational license tax (city) | work-site | 2.50% (payroll+gross receipts) | KY-KACO-KLC | LODES | 9,472 | 0.028% | 76.76% |
| 558 | Alliance (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,464 | 0.028% | 76.79% |
| 559 | Middle Smithfield Twp, Monroe Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,427 | 0.028% | 76.82% |
| 560 | Middletown Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 9,409 | 0.027% | 76.84% |
| 561 | North Lebanon Twp, Lebanon Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,401 | 0.027% | 76.87% |
| 562 | Simpson County (county), KY | KY | occupational license tax (county) | work-site | 1.25% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 9,389 | 0.027% | 76.90% |
| 563 | Sullivan County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 1.7% | IN-DN1 | ACS + LODES aux | 9,382 | 0.027% | 76.93% |
| 564 | Brecksville (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,381 | 0.027% | 76.95% |
| 565 | Jay County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.5% | IN-DN1 | ACS + LODES aux | 9,379 | 0.027% | 76.98% |
| 566 | East Caln Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,350 | 0.027% | 77.01% |
| 567 | West Bradford Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $10 | PA-DCED | ACS + LODES OD | 9,326 | 0.027% | 77.04% |
| 568 | Streetsboro (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,309 | 0.027% | 77.06% |
| 569 | WAPAKONETA CSD, OH school district | OH | school district income tax | residence | 0.75% (traditional) | OH-SDIT | ACS | 9,309 | 0.027% | 77.09% |
| 570 | Washington Twp, Franklin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,294 | 0.027% | 77.12% |
| 571 | Salisbury Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,290 | 0.027% | 77.15% |
| 572 | Brook Park (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,237 | 0.027% | 77.17% |
| 573 | Elizabethtown Boro, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,234 | 0.027% | 77.20% |
| 574 | North Canton (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,170 | 0.027% | 77.23% |
| 575 | North Middleton Twp, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.6% ; LST $52 | PA-DCED | ACS + LODES OD | 9,155 | 0.027% | 77.25% |
| 576 | Gettysburg Boro, Adams Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 9,146 | 0.027% | 77.28% |
| 577 | Fairview Twp, Erie Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,076 | 0.027% | 77.31% |
| 578 | New Philadelphia (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 9,072 | 0.026% | 77.33% |
| 579 | East Manchester Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,070 | 0.026% | 77.36% |
| 580 | Dickson City Boro, Lackawanna Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 9,054 | 0.026% | 77.39% |
| 581 | Sharon City, Mercer Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.25% ; LST $52 | PA-DCED | ACS + LODES OD | 9,041 | 0.026% | 77.41% |
| 582 | Norwalk (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 9,040 | 0.026% | 77.44% |
| 583 | Marion County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 9,028 | 0.026% | 77.46% |
| 584 | Oxford (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 9,001 | 0.026% | 77.49% |
| 585 | Somerset County, MD (local income tax) | MD | county/city income tax (state-collected piggyback) | residence | 3.20% | MD-WTF | ACS | 8,981 | 0.026% | 77.52% |
| 586 | Fulton County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.88% | IN-DN1 | ACS + LODES aux | 8,978 | 0.026% | 77.54% |
| 587 | Upper Providence Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,978 | 0.026% | 77.57% |
| 588 | Lititz Boro, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.15% ; LST $52 | PA-DCED | ACS + LODES OD | 8,974 | 0.026% | 77.60% |
| 589 | Somerset Twp, Somerset Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $5 | PA-DCED | ACS + LODES OD | 8,966 | 0.026% | 77.62% |
| 590 | Weirton, WV (municipal service fee) | WV | municipal service fee (flat per week) | work-site | $5.00/per | WV-FEE | LODES | 8,954 | 0.026% | 77.65% |
| 591 | South Park Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,943 | 0.026% | 77.67% |
| 592 | Springboro (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 8,917 | 0.026% | 77.70% |
| 593 | NORWALK CSD, OH school district | OH | school district income tax | residence | 0.5% (traditional) | OH-SDIT | ACS | 8,898 | 0.026% | 77.73% |
| 594 | Piqua (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 8,893 | 0.026% | 77.75% |
| 595 | Conewago Twp, York Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,888 | 0.026% | 77.78% |
| 596 | Waynesboro Boro, Franklin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,887 | 0.026% | 77.80% |
| 597 | Maidencreek Twp, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,885 | 0.026% | 77.83% |
| 598 | Brunswick (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 8,855 | 0.026% | 77.86% |
| 599 | Westtown Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.08% ; LST $52 | PA-DCED | ACS + LODES OD | 8,846 | 0.026% | 77.88% |
| 600 | Logan County (county), KY | KY | occupational license tax (county) | work-site | 0.75% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 8,835 | 0.026% | 77.91% |
| 601 | Knox County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 8,810 | 0.026% | 77.93% |
| 602 | Bern Twp, Berks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,801 | 0.026% | 77.96% |
| 603 | Mt Joy Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $5 | PA-DCED | ACS + LODES OD | 8,794 | 0.026% | 77.98% |
| 604 | Aston Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $0 | PA-DCED | ACS | 8,785 | 0.026% | 78.01% |
| 605 | East Huntingdon Twp, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,780 | 0.026% | 78.04% |
| 606 | West Jefferson (village), OH | OH | municipal income tax | work-site | 1% | OH-MUNI | LODES | 8,738 | 0.026% | 78.06% |
| 607 | New Kensington City, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,686 | 0.025% | 78.09% |
| 608 | Tallmadge (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 8,665 | 0.025% | 78.11% |
| 609 | Forest Park (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 8,648 | 0.025% | 78.14% |
| 610 | Quakertown Boro, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 8,647 | 0.025% | 78.16% |
| 611 | Dubois City, Clearfield Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,637 | 0.025% | 78.19% |
| 612 | Uniontown City, Fayette Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,612 | 0.025% | 78.21% |
| 613 | Canonsburg  Boro, Washington Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,590 | 0.025% | 78.24% |
| 614 | Douglass Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,540 | 0.025% | 78.26% |
| 615 | West Hanover Twp, Dauphin Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,538 | 0.025% | 78.29% |
| 616 | Cambridge (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 8,530 | 0.025% | 78.31% |
| 617 | Ontario (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 8,490 | 0.025% | 78.34% |
| 618 | Cleveland Heights (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 8,455 | 0.025% | 78.36% |
| 619 | Oregon (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 8,454 | 0.025% | 78.39% |
| 620 | Hazard (city), KY | KY | occupational license tax (city) | work-site | 1.25% (payroll+net profits) | KY-KACO-KLC | LODES | 8,449 | 0.025% | 78.41% |
| 621 | Mechanicsburg Boro, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.7% ; LST $52 | PA-DCED | ACS + LODES OD | 8,440 | 0.025% | 78.44% |
| 622 | South Abington Twp, Lackawanna Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,440 | 0.025% | 78.46% |
| 623 | Berea (city), KY | KY | occupational license tax (city) | work-site | 2.00% (payroll+net profits) | KY-KACO-KLC | LODES | 8,435 | 0.025% | 78.49% |
| 624 | West Rockhill Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.75% ; LST $52 | PA-DCED | ACS + LODES OD | 8,432 | 0.025% | 78.51% |
| 625 | Niles (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 8,415 | 0.025% | 78.53% |
| 626 | Sheridan, CO (occupational privilege tax) | CO | occupational privilege tax (flat monthly) | work-site | $3.00/mo employee + $3.00/mo employer, earnings over $500/mo | CO-OPT | LODES | 8,392 | 0.025% | 78.56% |
| 627 | Avon Lake (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 8,372 | 0.024% | 78.58% |
| 628 | Worcester Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $10 | PA-DCED | ACS + LODES OD | 8,359 | 0.024% | 78.61% |
| 629 | Aurora (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 8,348 | 0.024% | 78.63% |
| 630 | Perkasie Boro, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 8,336 | 0.024% | 78.66% |
| 631 | Heath (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 8,325 | 0.024% | 78.68% |
| 632 | Fountain County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.1% | IN-DN1 | ACS + LODES aux | 8,324 | 0.024% | 78.71% |
| 633 | Franklin (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll+gross receipts) | KY-KACO-KLC | LODES | 8,314 | 0.024% | 78.73% |
| 634 | Neshannock Twp, Lawrence Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,296 | 0.024% | 78.75% |
| 635 | Harrison Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,265 | 0.024% | 78.78% |
| 636 | Xenia (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 8,249 | 0.024% | 78.80% |
| 637 | Greenville (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 8,244 | 0.024% | 78.83% |
| 638 | Berea (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 8,243 | 0.024% | 78.85% |
| 639 | Wilkes Barre Twp, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 8,231 | 0.024% | 78.87% |
| 640 | Tinicum Twp, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,210 | 0.024% | 78.90% |
| 641 | DEFIANCE CSD, OH school district | OH | school district income tax | residence | 0.5% (traditional) | OH-SDIT | ACS | 8,174 | 0.024% | 78.92% |
| 642 | New Hanover Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.15% ; LST $52 | PA-DCED | ACS + LODES OD | 8,163 | 0.024% | 78.95% |
| 643 | Bedford Twp, Bedford Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.5% ; LST $52 | PA-DCED | ACS + LODES OD | 8,161 | 0.024% | 78.97% |
| 644 | West Conshohocken Boro, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,156 | 0.024% | 78.99% |
| 645 | Latrobe Boro, Westmoreland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.4% ; LST $52 | PA-DCED | ACS + LODES OD | 8,106 | 0.024% | 79.02% |
| 646 | Chestnuthill Twp, Monroe Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $0 | PA-DCED | ACS | 8,095 | 0.024% | 79.04% |
| 647 | Rush County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.15% | IN-DN1 | ACS + LODES aux | 8,084 | 0.024% | 79.06% |
| 648 | Carnegie Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,083 | 0.024% | 79.09% |
| 649 | Bellefontaine (city), OH | OH | municipal income tax | work-site | 1.6% | OH-MUNI | LODES | 8,061 | 0.024% | 79.11% |
| 650 | West Deer Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,054 | 0.024% | 79.14% |
| 651 | Sunbury City, Northumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.45% ; LST $52 | PA-DCED | ACS + LODES OD | 8,049 | 0.024% | 79.16% |
| 652 | Camp Hill Boro, Cumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 2.0% ; LST $52 | PA-DCED | ACS + LODES OD | 8,039 | 0.023% | 79.18% |
| 653 | GOSHEN LSD, OH school district | OH | school district income tax | residence | 1% (traditional) | OH-SDIT | ACS | 8,033 | 0.023% | 79.21% |
| 654 | Van Wert (city), OH | OH | municipal income tax | work-site | 1.72% | OH-MUNI | LODES | 8,029 | 0.023% | 79.23% |
| 655 | Barberton (city), OH | OH | municipal income tax | work-site | 2.25% | OH-MUNI | LODES | 8,018 | 0.023% | 79.25% |
| 656 | Lower Makefield Twp, Bucks Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 0.0% ; LST $52 | PA-DCED | LODES | 8,009 | 0.023% | 79.28% |
| 657 | New Holland Boro, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,999 | 0.023% | 79.30% |
| 658 | Dover (city), OH | OH | municipal income tax | work-site | 1.5% | OH-MUNI | LODES | 7,997 | 0.023% | 79.32% |
| 659 | North Randall (village), OH | OH | municipal income tax | work-site | 2.75% | OH-MUNI | LODES | 7,989 | 0.023% | 79.35% |
| 660 | Upper Hanover Twp, Montgomery Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $10 | PA-DCED | ACS + LODES OD | 7,937 | 0.023% | 79.37% |
| 661 | Mount Joy Boro, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,933 | 0.023% | 79.39% |
| 662 | Schuylkill Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.35% ; LST $52 | PA-DCED | ACS + LODES OD | 7,932 | 0.023% | 79.42% |
| 663 | Fairview Park (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 7,902 | 0.023% | 79.44% |
| 664 | Carroll County (county), KY | KY | occupational license tax (county) | work-site | 1.50% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 7,875 | 0.023% | 79.46% |
| 665 | Mason County (county), KY | KY | occupational license tax (county) | work-site | 1.00% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 7,872 | 0.023% | 79.48% |
| 666 | Milton Boro, Northumberland Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.8% ; LST $52 | PA-DCED | ACS + LODES OD | 7,872 | 0.023% | 79.51% |
| 667 | Earl Twp, Lancaster Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,871 | 0.023% | 79.53% |
| 668 | Kennedy Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,856 | 0.023% | 79.55% |
| 669 | Salem (city), OH | OH | municipal income tax | work-site | 1.25% | OH-MUNI | LODES | 7,849 | 0.023% | 79.58% |
| 670 | Berwick Boro, Columbia Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,841 | 0.023% | 79.60% |
| 671 | Jenkins Twp, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,818 | 0.023% | 79.62% |
| 672 | Campbellsville (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll+net profits) | KY-KACO-KLC | LODES | 7,802 | 0.023% | 79.65% |
| 673 | Brown County, IN (county income tax) | IN | county income tax | residence (+ out-of-state workers by work county) | 2.5234% | IN-DN1 | ACS + LODES aux | 7,797 | 0.023% | 79.67% |
| 674 | Dallas Twp, Luzerne Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,782 | 0.023% | 79.69% |
| 675 | East Bradford Twp, Chester Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.25% ; LST $52 | PA-DCED | ACS + LODES OD | 7,770 | 0.023% | 79.71% |
| 676 | Lebanon (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll+net profits) | KY-KACO-KLC | LODES | 7,770 | 0.023% | 79.74% |
| 677 | LONDON CSD, OH school district | OH | school district income tax | residence | 1% (traditional) | OH-SDIT | ACS | 7,717 | 0.023% | 79.76% |
| 678 | Grayson County (county), KY | KY | occupational license tax (county) | work-site | 0.50% (payroll) | KY-KACO-KLC | LODES + QCEW (larger) | 7,694 | 0.022% | 79.78% |
| 679 | Lansdowne Boro, Delaware Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,649 | 0.022% | 79.80% |
| 680 | ROSS LSD, OH school district | OH | school district income tax | residence | 1.25% (earned income) | OH-SDIT | ACS | 7,647 | 0.022% | 79.83% |
| 681 | Morehead (city), KY | KY | occupational license tax (city) | work-site | 1.50% (payroll+net profits) | KY-KACO-KLC | LODES | 7,632 | 0.022% | 79.85% |
| 682 | Grandview Heights (city), OH | OH | municipal income tax | work-site | 2.5% | OH-MUNI | LODES | 7,620 | 0.022% | 79.87% |
| 683 | Elizabeth Twp, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,619 | 0.022% | 79.89% |
| 684 | Corbin (city), KY | KY | occupational license tax (city) | work-site | 1.00% (payroll+net profits) | KY-KACO-KLC | LODES | 7,568 | 0.022% | 79.91% |
| 685 | Rocky River (city), OH | OH | municipal income tax | work-site | 2% | OH-MUNI | LODES | 7,563 | 0.022% | 79.94% |
| 686 | Brentwood Boro, Allegheny Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,557 | 0.022% | 79.96% |
| 687 | North Cornwall Twp, Lebanon Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.0% ; LST $52 | PA-DCED | ACS + LODES OD | 7,552 | 0.022% | 79.98% |
| 688 | Northampton Boro, Northampton Co., PA | PA | EIT (resident) + LST (work site) | residence+work-site | EIT resident 1.2% ; LST $52 | PA-DCED | ACS + LODES OD | 7,543 | 0.022% | 80.00% |

## 5. Universe cross-check

The Tax Foundation's "Local Income Taxes: A Primer" (Fiscal Fact 808, published 23 Feb 2023, updated 13 Jun 2024; https://taxfoundation.org/research/all/state/local-income-taxes-2023/) names 16 states with local income taxes and counts 5,055 jurisdictions. Each is placed below.

| State | Tax Foundation says | Treatment here |
|---|---|---|
| AL, CO, DE, IN, KY, MD, MI, MO, NY, OH, PA, WV | local income, earnings, occupational or service-fee taxes | In the denominator (sections 3 and 4). |
| IA | "Local Income Surtax", state-collected piggyback | Excluded: computed on the IA 1040, not employer-withheld (Iowa DOR, https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions/school-district-surtaxemergency, fetched 2026-10-27). |
| KS | local tax on interest and dividends only | Excluded: no wage tax. |
| NJ | Payroll Tax, locally collected (Newark 1.00%) | Employer-only, section 7. Jersey City's ordinance bars withholding. |
| OR | hybrid: Portland-area taxes plus transit taxes | TriMet, Lane Transit: employer-only (section 7). Metro SHS and Multnomah PFA: withheld only for employees earning $200,000 or more, sensitivity row (section 6). The 0.1% Statewide Transit Tax is a state-level withheld tax and belongs to the state matrix. |
| DC | appears only in a revenue table | A state-equivalent in the all-state set, not local. |

Pennsylvania cross-check: Tax Foundation (2019 report) counted 2,978 PA jurisdictions (2,506 municipalities, 472 school districts); the DCED register fetched 2026-10-27 holds 2,627 municipality and school-district pairings covering 2,564 municipalities and 500 school districts, and the DCED relationship export lists the same pairs. Three DCED municipalities have no register rows (Sandy Twp, Clearfield; South New Castle Boro, Lawrence; Callimont Boro, Somerset) and are not counted.

## 6. Unconfirmed and unmeasured pairs (in the upper denominator, not on the list)

- **Tier U, 29 rows, 395,848 pairs.** Above the list's cutoff of 7,543 pairs: Aurora CO 172,930 (source conflict, below), Montgomery AL 123,369 (1% ordinance approved Feb 2020 by news report only), Bessemer AL 26,403 and Gadsden AL 21,879 (ALM list shows the tax; no ordinance read that confirms employer withholding), Big Rapids MI 10,138 (no employer rule stated). Below the cutoff: 20 more Alabama cities, Macon County AL, Montgomery, Chester and Romney WV (secondary sources only). These join the gating list when the withholding duty is confirmed.
- **Tier UB, Ohio JEDD/JEDZ, 978,380 pairs.** 153 joint economic development districts levy a withheld income tax (ODT JEDD rate table, 2026-10-27) but no official geography is published. The bound is every Ohio job outside a Census place.
- **Sensitivity, Oregon Metro SHS and Multnomah PFA.** Withholding is mandatory only for employees working in the district who earn $200,000 or more (https://www.portland.gov/revenue/withholding, fetched 2026-10-27). Earner counts at that cut are not published, so the row uses every job in Clackamas, Multnomah and Washington counties (1,031,561). Even then the list becomes 810 jurisdictions and the long tail stays at 19.99%. It is in neither denominator.
- **Not counted, with the reason:** Kentucky special districts and school districts whose rows are net-profits only or have no rate (7 rows), and the Hardin County Industrial Tax District (base not stated); Colorado Metro cities that the Metro Denver table says levy no OPT, and six mountain towns with no source; West Virginia cities with no fee found (8); Mobile and Gulf Shores AL (absence from the ALM list is not proof, no document found); Jefferson County AL (ceased 2011, no later levy found).

## 7. Employer-only local taxes (listed apart, outside the denominator)

Nothing withholds these from wages. They are payroll cost and join the gating set as employer-cost cases (ENV-076).

| Tax | Authority | Rate | Source and date |
|---|---|---|---|
| Employer payroll tax | Newark NJ | 1% of payroll | https://nj-newark.civicplus.com/647/Payroll-Tax, fetched 2026-10-27 |
| Employer payroll tax | Jersey City NJ | 1% of payroll; ordinance bars withholding | https://www.jerseycitynj.gov/cityhall/finance/taxes/payrolltaxfaq, fetched 2026-10-27 |
| Payroll expense tax | St. Louis MO | 0.5%, Form P-10 | https://www.stlouis-mo.gov/government/departments/collector/earnings-tax/payroll-tax-info.cfm, fetched 2026-10-28 |
| Payroll expense tax | Pittsburgh PA | 0.55% | https://www.pittsburghpa.gov/City-Government/Finance-Budget/Taxes, page updated 2026-03-05 |
| MCTMT | New York MCTD | up to 0.895%, payroll over $312,500 a quarter | https://www.tax.ny.gov/bus/mctmt/emp.htm, updated 2026-07-02 |
| TriMet transit payroll tax | Portland OR district | 0.8237% | https://www.oregon.gov/dor/forms/formspubs/transit-payroll-taxes_211-503.pdf, rev. 11-18-25 |
| Lane Transit District payroll tax | Eugene-Springfield OR | 0.80% | https://www.oregon.gov/dor/programs/businesses/pages/lane-county-transit-district-payroll-tax.aspx, fetched 2026-10-27 |
| Canby Area Transit payroll tax | Canby OR | 0.6% | https://canbyoregon.gov/node/2041, fetched 2026-10-27 |
| Administrative Office Tax | San Francisco CA | 1.47% of payroll expense (2025) | https://sftreasurer.org/business/taxes-fees/administrative-office-tax-aot-0, fetched 2026-10-28 |
| JumpStart Payroll Expense Tax | Seattle WA | tiered by payroll and compensation | https://seattle.gov/license-and-tax-administration/payroll-expense-tax, fetched 2026-10-28 |

Not classified: Seattle's Social Housing Tax (withholding status unconfirmed), Wilsonville, Sandy and South Clackamas transit taxes (rates not found).

## 8. Proxies, every one

1. **Residents for resident taxes** (NYC, Yonkers, Philadelphia, Michigan cities, Kansas City, St. Louis, Wilmington, Indiana, Maryland, Pennsylvania EIT, Ohio school districts, Detroit): ACS employed civilians by residence. It counts employees whose employer need not withhold (for example NJ-based employers of NYC residents, out-of-state employers of Maryland, Pennsylvania and Indiana residents). The denominator is therefore an upper bound for those taxes.
2. **Jobs for work-site taxes:** LODES jobs, not employees. Self-employed and military are absent; a person with two jobs counts twice, which matches an employee-employer pair.
3. **Mixed vintages:** ACS 2020-2024, LODES 2023, Michigan LODES 2021 (LODES8 publishes no Michigan 2022 or 2023), QCEW 2025.
4. **Ohio school districts:** employed residents of the district's Census boundary. Withholding needs the employee's IT 4, and earned-income districts tax a narrower base. Employer duty is by residence, not workplace.
5. **Ohio municipalities:** jobs located in the municipality. The 20-day rule, the small-employer rule and optional resident-municipality withholding are ignored. Townships and JEDDs have no geography (tier UB).
6. **Pennsylvania:** EIT counts every employed resident of the municipality (the school-district EIT is part of the same PSD withholding code); LST counts jobs in municipalities with a nonzero combined LST; the $12,000 low-income exemption and the nonresident-EIT-higher case are ignored; 61 municipalities in several school districts are counted once.
7. **Indiana:** employed county residents plus out-of-state commuters by work county (LODES OD aux). The Jan 1 residence date and the 30-day exemption are ignored.
8. **Maryland:** employed county residents. Nonresidents pay the state special rate, no local tax.
9. **Colorado OPT, West Virginia fees:** all jobs in the city; wage thresholds are ignored; Fairmont taxes only nonresidents, so its count is an upper bound.
10. **Kentucky:** jobs in the city or county; Louisville Metro and Lexington-Fayette are consolidated and counted once, on the county; a city and its county each count where both levy; KY county counts use the larger of LODES and QCEW. City rates are the KLC FY2023 list (PDF created 30 Jul 2024), older than the county rates (KACo, Jan 2026).
11. **Union of bases:** for Philadelphia, Yonkers, Wilmington, Kansas City, St. Louis, Michigan cities and Pennsylvania municipalities, residents plus jobs minus live-and-work, with the overlap from LODES OD within the state.
12. **NYC:** the NYS DTF dataset https://data.ny.gov/resource/73iw-kuxv.json shows 4,146,433 full-year resident returns for the five NYC counties, tax year 2024. A return is not an employee, so the ACS count of employed residents (4,039,236) is kept.
13. **Name matches:** three Ohio ODT codes differ from the Census place code (Washington Court House 81214, Waverly 81942, West Carrollton 83111) and were matched by name.

## 9. Source conflicts and how each was settled

| Conflict | Settled as |
|---|---|
| Kentucky: the Secretary of State occupational-tax spreadsheet (https://web.sos.ky.gov/occupationaltax/default.aspx, mostly last changed 2018, mixed units) against KLC FY2023 and KACo 2026 on 36 city and county rows (for example Ashland 2.375% against 2.00%). | A row counts as a wage tax if either says so; the KLC or KACo rate is shown. Counts unaffected. |
| Kentucky work-site counts: LODES 2023 against QCEW 2025 for the same county. | QCEW is larger in 73 of 120 counties, so the larger is used on the 87 county rows with a payroll tax. |
| Anchor counties, LODES against QCEW: Marion IN 0.943, Philadelphia 0.972, Allegheny 0.921, Cuyahoga 0.922, Franklin OH 0.972, Wayne MI 1.078, New York County 0.993, Kings 1.046 (QCEW over LODES). | Place-level counts have no QCEW equivalent, so LODES stands. Differences are within 8%. |
| Aurora CO: the city's page says the OPT was repealed effective 1 Jan 2025; the Metro Denver table and State Controller list still show it. | Larger denominator wins: Aurora is tier U (172,930). |
| Ohio school districts: ODT's overview page says 210 districts; the ODT list dated 2025-12-30, the 2026 PDF and the Finder rate table all show 214. | 214. |
| Ohio municipalities: the Finder file has 667 rated rows (plus 11 at 0%); the City of Columbus compilation 658; a fiscal-note search snippet 674; ten rates differ between Finder and Columbus. | Finder, 667, as the current ODT tool. Rates only. |
| Pennsylvania: DCED Official register (as of 15 Jun 2026) against the Real-Time register. Philadelphia 3.74/3.43 against 3.735/3.425; Lancaster City LST $47 against $52. | Real-Time register; Philadelphia's own page confirms the 1 Jul 2026 rates. Counts unaffected. |
| West Virginia flat fees in different units: Charleston $3 a week (city page) against $6 a pay period (Tax Foundation); Huntington $5 a week against $10 a pay period (2018 federal bulletin). | Same fees; the weekly city figure is shown. |
| Alabama: Opelika's own pages say 1% and 1.5%. | The ALM list's 1.5%. Rate only. |
| Michigan: Muskegon Heights booklet shows 1%/0.5% and 1.5%/0.75% in different places. | 1.0%/0.5%. Rate only. |
| Ohio SDIT page: the helper's cited ODT page https://tax.ohio.gov/business/employer-withholding/employer-withholding now returns 404 (re-fetched 28 Oct). | Withholding rule rests on the ODT IT 4 instructions (the employee names the district; no IT 4 means no school-district withholding) and the ODT FAQ https://tax.ohio.gov/help-center/faqs/income-school-district. |

## 10. Sources

Employee figures (all public, no key):

- ACS 2020-2024 5-year table B23025, Census table-based summary file: https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b23025.dat with geographies in https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/documentation/Geos20245YR.txt (line E004, employed civilians 16+; retrieved 2026-10-28).
- LEHD LODES8 workplace area characteristics, origin-destination and crosswalk files: https://lehd.ces.census.gov/data/lodes/LODES8/ (year 2023, Michigan 2021; technical document LODESTechDoc8.4.pdf in that directory; retrieved 2026-10-28).
- BLS QCEW annual averages 2025, all ownerships, all industries: https://data.bls.gov/cew/data/api/2025/a/area/<fips>.csv (retrieved 2026-10-28).

Registers by code (the CSV row repeats the URL and the date for each jurisdiction; register files copied unchanged into `envelope-large-local-registers/`):

| Code | Rate and rule source | Date |
|---|---|---|
| OH-MUNI | ODT The Finder muni rate table, https://thefinder.tax.ohio.gov/?tab=fileDownloads (file OHMuniRateTable.csv); rule ORC 718.011, https://codes.ohio.gov/ohio-revised-code/section-718.011 | rates effective through 2026-01-01; retrieved 2026-10-27 |
| OH-SDIT | ODT list of districts, https://dam.assets.ohio.gov/image/upload/tax.ohio.gov/tax_analysis/tax_data_series/school_district_data/sdit_list.pdf, and Finder SD rate table | list dated 2025-12-30 (tax year 2026) |
| OH-JEDD | ODT Finder JEDTaxRates.csv | retrieved 2026-10-27 |
| PA-DCED | DCED munstats Real-Time EIT/LST register, https://apps.dced.pa.gov/munstats-public/ReportInformation2.aspx?report=EitWithCollector_Dyn_Excel&type=R; rule https://dced.pa.gov/local-government/local-income-tax-information/local-withholding-tax-faqs/ | register retrieved 2026-10-27; FAQ undated, read 2026-10-28 |
| PHL | City of Philadelphia, https://www.phila.gov/services/payments-assistance-taxes/taxes/business-taxes/business-taxes-by-type/wage-tax-employers/ | rates effective 2026-07-01 |
| NYC | NYS-50-T-NYC, https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nyc.pdf; NYS-50 https://www.tax.ny.gov/forms/publications/wt/nys50.htm | rev. 1/26, effective 2026-01-01 to 2026-12-31; page updated 2026-08-14 |
| YKR | NYS-50-T-Y, https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_y.pdf | rev. 1/26, effective 2026 |
| IN-DN1 | Indiana DOR Departmental Notice #1, https://www.in.gov/dor/files/dn01.pdf | effective 2026-10-01 |
| MD-WTF | Comptroller of Maryland, Withholding Tax Facts, https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/facts/withholding-tax-facts-2026.pdf | COM RAD 098 rev. 12/25; rates for payments on or after 2026-01-01 |
| MI-CITY | Michigan Treasury city list, https://www.michigan.gov/taxes/citytax/what-cities-impose-an-income-tax; Detroit guide form 5469 TY2025; other cities' own pages | list read 2026-10-27; city pages 2018-2026, some by web archive |
| DE-WIL | Wilmington Earned Income Tax Regulations, https://www.wilmingtonde.gov/home/showpublisheddocument/462/638206223264700000; 22 Del. C. 901-902 | revised 2023-05-25 |
| KC | https://www.kcmo.gov/city-hall/departments/finance/earnings-tax | web archive 2026-06-18 |
| STL | https://www.stlouis-mo.gov/government/departments/collector/earnings-tax/payroll-tax-info.cfm | fetched 2026-10-28, undated |
| KY-KACO-KLC | KACo 2026 data brief https://kaco.org/media/7051/2026-databrief-occupationaltaxes.pdf; KLC FY2023 city list (SharePoint PDF, path in the CSV rows); Secretary of State sheet https://web.sos.ky.gov/occupationaltax/default.aspx; Louisville https://louisvilleky.gov/sites/default/files/2022-12/W-1_instructions_20221201.pdf; Lexington https://www.lexingtonky.gov/working/business-licensing-taxes/occupational-license-fee-rates-current-forms | KACo Jan 2026; KLC PDF created 2024-07-30 |
| AL-ALM | Alabama League of Municipalities, https://alalm.sophicity.com/TaxRates.aspx; licensing document https://alalm.sophicity.com/Assets/Files/34.%20License-Exemptions-and-Limitations_REVISED-01-2026.pdf | page 2026, fetched 2026-10-27 |
| CO-OPT | Denver, Glendale, Greenwood Village, Sheridan city pages (URLs in CSV rows) | fetched 2026-10-27 |
| WV-FEE | City pages and ordinances (URLs in CSV rows); basis W. Va. Code 8-13-13 | fetched 2026-10-27 |
| OR-SHS | https://www.portland.gov/revenue/withholding | fetched 2026-10-27 |

The state registers were pulled by four research helpers; their raw downloads are not kept here. I recomputed every join and count myself and re-read the Tax Foundation article, the DCED FAQ and the ORC 718.011 search results. I did not independently re-fetch every state register, and several municipal and ordinance pages were readable only through web archives or secondary sources, as the register notes say.

## 11. Proposed ENV-066 split for the round

The old ENV-066 text becomes three clauses (ids are suggestions; the round takes the next free ids). State-level coverage (all 50 states and DC, the named wage-linked assessments, FUTA status, NY DBL beside PFL) moves unchanged into the gating clause. The licensed Symmetry catalogue stops being an input and becomes an optional Field proof register row.

#### ENV-066 — Coverage ledger and fail-closed location rule

*Tier:* Core · *From:* ENV-066

**Requirement.** Envelope keeps a versioned, exportable coverage ledger of every payroll tax authority it knows, drawn from official jurisdiction lists and published rules, each entry with source references, retrieved-at and effective dates, and its calculation and filing cases. A work or resident location that matches no mapped ledger entry blocks payroll for that employee; it is never treated as zero tax. Each entry is in the gating set (ENV-076) or the tracked long tail (ENV-077).

**Acceptance.** Through the coverage export, the preview and the run:
1. The export lists every entry with authority, source URL, retrieved-at date, effective date, status (mapped, unmapped, not applicable) and case ids; each applicable mapped entry has a cent-level golden paycheck case and, where filing or remittance applies, an official-schema case.
2. Each cited none or exemption has a cited rule and a refusal or applicability test.
3. An employee whose work or resident location has no mapped entry is held in the preview with the location and the reason, and the run refuses that employee with a next action (assign a location, or mark it unsupported); no paycheck shows zero tax for it.
4. An authority found after release is added as an unmapped entry and blocks affected employees until mapped.
5. A refresh runs before a rule's effective date, and superseded source editions stay retrievable.
6. Directories (FTA, NASWA, federal OCSS, DOL State Labor Offices, PA DCED, Ohio DOR/The Finder, Indiana DOR, Michigan Treasury, Kentucky DOR/DLG) locate authorities; rates, deadlines and content come from that authority's current statute or instructions.

#### ENV-076 — Gating coverage: federal, all states, DC and large locals

*Tier:* Core · *From:* ENV-066

**Requirement.** ENV-006, ENV-012, ENV-015, ENV-017 and ENV-022 are judged against the gating set: federal; all 50 states and DC with every state-level entry; the large-local file (the versioned list of local income-tax jurisdictions that together cover at least 80% of US local-tax employee-jurisdiction pairs, 688 at release baseline, regenerated by the published script); and the named employer-only local taxes. Passing those clauses never requires the long tail.

**Acceptance.** Through the coverage export and the preview, filing, termination and stub doors:
1. For every state and DC: withholding or cited no-income-tax status, SUI account, PFML/disability/long-term-care programs or cited none, new-hire directory, final-pay and paid-vacation rule, pay-frequency and stub-content rule including NY WTPA, and each tax year's FUTA credit-reduction status.
2. State wage-linked assessments are entries: WA L&I, Oregon WBF, Ohio BWC, ND WSI, WY DWS, Hawaii TDI and Prepaid Health Care, and NY DBL beside PFL.
3. Every entry in the large-local file has a golden case and, where filing applies, a schema case, with its work or residence boundary, incidence, credits and exemptions.
4. Each employer-only tax in section 7 has a case showing employer cost and no employee deduction.
5. The export marks each entry gating or long tail and carries the large-local file's vintage (Census table, year, URL).
6. Rerunning the script on newer vintages yields a new file; added and removed entries show in the export, and an added entry is unmapped until cased.
7. A gating entry without a case fails this clause; an entry outside the gating set never does.

#### ENV-077 — Long-tail coverage, published

*Tier:* Core · *From:* ENV-066

**Requirement.** Local tax authorities outside the gating set are tracked in the ledger, and their coverage is published as a percentage of local-tax employee-jurisdiction pairs. At release baseline the long tail is 20.00% of pairs (3,171 confirmed jurisdictions and the unconfirmed ones in section 6), and ENV-066's fail-closed rule applies to all of it. No licensed vendor catalogue is required.

**Acceptance.** Through the coverage page and the preview:
1. The page publishes pairs mapped, pairs unmapped and the long-tail percentage, computed by the published script from the ledger, with Census vintages.
2. Every long-tail entry shows mapped, unmapped or not applicable with source and date; a mapped entry has the same cases as a gating entry.
3. An employee in an unmapped long-tail jurisdiction is blocked per ENV-066 with a next action; the employer can request mapping, which is recorded.
4. Mapping an entry updates the published percentage; a test adds an entry and checks the percentage and the blocked employee.
5. Unconfirmed jurisdictions (tax or withholding duty not confirmed) are listed apart, counted in the denominator and never treated as zero tax.

Field proof register row: **R-n** | Reconcile the ledger against a licensed vendor tax catalogue (Symmetry Payroll Point/Tax Engine or similar) and add any official taxes it lists beyond the ledger | ENV-066, ENV-077 | not run.

One sentence each for the five dependent clauses:

- **ENV-006:** "Calculation covers federal, all 50 states, DC and the large-local file in ENV-076; any other location follows ENV-066's fail-closed rule."
- **ENV-012:** "Final-pay and paid-vacation rules are executed for every state and DC entry in the ENV-076 gating set; California is one case, not the denominator."
- **ENV-015:** "Filing and remittance schema cases are required for every entry in the ENV-076 gating set, and for ENV-077 long-tail entries once mapped; an unmapped location blocks under ENV-066."
- **ENV-017:** "Hire and rehire reporting covers all 50 state directories and DC in the ENV-076 gating set, with the federal OCSS directory as the denominator."
- **ENV-022:** "Portal and printed stubs meet the state and DC content and language rules in the ENV-076 gating set, including NY WTPA, and expose the exemption certificates ENV-003 collects for the large-local jurisdictions in it."

## 12. Files and reproduction

- `envelope-large-local.md` (this file); `envelope-large-local.csv`, one row per jurisdiction with the figures, geography codes, sources and notes; `envelope-large-local.py`, the reader.
- `envelope-large-local-extract.py` and `envelope-large-local-build.py` rebuild the CSV from the Census and BLS files and `envelope-large-local-registers/`.
- `python3 envelope-large-local.py` prints the list and summary; `--md` prints the section 4 table; `--summary` prints only the summary.
