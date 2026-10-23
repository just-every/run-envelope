import { PortabilityError } from '@runeditrun/rer/modules/portability';
import { decryptArchivedRecord } from './encryption.mjs';
import { quote } from './relationships.mjs';

const refuse = () => { throw new PortabilityError('archive_relationship_invalid', 409); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9][-A-Za-z0-9]{0,79}$/.test(value);
const version = value => Number.isSafeInteger(value) && value > 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);

/** Check historical references without requiring their sources to remain active today. */
export async function validateIndustryHistory(staged, row, data, key) {
  if (!['industry-check', 'industry-return'].includes(row.kind)) return;
  if (!object(data) || !staged.tables.env_workspace_versions || !staged.tables.env_workspace_decisions) refuse();
  const versions = quote(staged.tables.env_workspace_versions), decisions = quote(staged.tables.env_workspace_decisions);
  const find = async (kind, reference, revision, person, before, earlierRevision) => {
    if (!id(reference) || (revision !== undefined && !version(revision)) || !Number.isSafeInteger(before)) refuse();
    const args = [row.company_id, kind, reference, before];
    let where = 'company_id=? AND kind=? AND object_id=? AND created_at<=?';
    if (revision !== undefined) { where += ' AND version=?'; args.push(revision); }
    if (earlierRevision !== undefined) { where += ' AND version<?'; args.push(earlierRevision); }
    if (person !== undefined) { if (!id(person)) refuse(); where += ' AND person_id=?'; args.push(person); }
    const found = await staged.db.prepare(`SELECT * FROM ${versions} WHERE ${where} ORDER BY version DESC LIMIT 1`).bind(...args).first();
    if (!found) refuse();
    return found;
  };
  const unpack = async target => {
    let value;
    try { value = JSON.parse(await decryptArchivedRecord(key, 'env_workspace_versions', target, 'cipher')); }
    catch { refuse(); }
    if (!object(value)) refuse();
    return value;
  };
  const approved = async (target, before) => {
    const approval = await staged.db.prepare(`SELECT 1 FROM ${decisions} WHERE company_id=? AND kind=? AND object_id=? AND version=? AND decision='approved' AND occurred_at<=?`).bind(
      target.company_id, target.kind, target.object_id, target.version, before).first();
    const withdrawal = await staged.db.prepare(`SELECT 1 FROM ${decisions} WHERE company_id=? AND kind=? AND object_id=? AND version=? AND decision='withdrawn' AND occurred_at<=?`).bind(
      target.company_id, target.kind, target.object_id, target.version, before).first();
    if (!approval || withdrawal) refuse();
  };
  if (row.kind === 'industry-check') {
    if (data.personId !== row.person_id || !id(row.person_id)
      || !version(data.runVersion) || !version(data.classificationVersion)) refuse();
    const run = await find('earnings-run', data.runId, data.runVersion, undefined, row.created_at);
    const runData = await unpack(run);
    if (!Array.isArray(runData.people) || !runData.people.some(person => person.id === row.person_id)) refuse();
    const classification = await find('industry-classification', data.classificationId, data.classificationVersion, row.person_id, row.created_at);
    await approved(classification, row.created_at);
  } else {
    if (!Array.isArray(data.checks) || !data.checks.length || data.checks.length > 200
      || !['941', '943'].includes(data.form) || !Number.isSafeInteger(data.taxYear)
      || (data.form === '941' && ![1, 2, 3, 4].includes(data.quarter))) refuse();
    const seen = new Set();
    for (const selection of data.checks) {
      if (!object(selection) || !id(selection.personId) || !version(selection.version)) refuse();
      const check = await find('industry-check', selection.id, selection.version, selection.personId, row.created_at);
      await approved(check, row.created_at);
      const value = await unpack(check), result = value.result;
      const payment = JSON.stringify([selection.personId, value.runId, value.runVersion]);
      if (value.personId !== selection.personId || !object(result) || result.taxYear !== data.taxYear
        || typeof result.payDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(result.payDate)
        || (data.form === '941' && Math.floor((Number(result.payDate.slice(5, 7)) - 1) / 3) + 1 !== data.quarter)
        || seen.has(payment)) refuse();
      seen.add(payment);
    }
  }
  const visited = new Set([JSON.stringify([row.object_id, row.version])]);
  let current = row, value = data;
  for (;;) {
    if (typeof value.corrects !== 'string') refuse();
    if (!value.corrects) break;
    const prior = await find(row.kind, value.corrects, undefined,
      row.kind === 'industry-check' ? row.person_id : undefined, current.created_at,
      value.corrects === current.object_id ? current.version : undefined);
    const identity = JSON.stringify([prior.object_id, prior.version]);
    if (visited.has(identity)) refuse();
    visited.add(identity);
    await approved(prior, current.created_at);
    const previous = await unpack(prior);
    if (row.kind === 'industry-check') {
      if (previous.personId !== row.person_id || previous.runId !== value.runId || previous.runVersion !== value.runVersion) refuse();
    } else if (previous.form !== value.form || previous.taxYear !== value.taxYear || previous.quarter !== value.quarter) refuse();
    current = prior; value = previous;
  }
}
