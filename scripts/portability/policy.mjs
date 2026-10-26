import { validateEnvelopeArchive } from './validate.mjs';
import { sourceEditionPayload } from './editions.mjs';

const identityHistory = ['oa_operators', 'oa_bootstrap', 'oa_external_identities',
  'oa_invitation_cancellations', 'oa_auth_settings', 'oa_auth_audit',
  'oa_domain_rules', 'oa_logout_events', 'oc_owner_claims'];
const expires = ['env_agent_grants', 'env_notice_approvals',
  'env_verification_consents', 'env_verification_releases'];

// Ciphertext needs the original record key, supplied privately and separately.
// This policy never reads private settings or embeds a key in archive metadata.
// Authentication of HTTP callers and audited owner adoption belong to the
// application door; the local CLI holds its checkout operation lock.
export function createEnvelopeArchivePolicy({ recordKey = () =>
  typeof process === 'undefined' ? undefined : process.env.ENVELOPE_RECORD_KEY } = {}) {
  const getKey = typeof recordKey === 'function' ? recordKey : () => recordKey;
  return {
    product: ['just-every', 'envelope'].join('/'),
    extraPayloads: { 'envelope-source-editions': sourceEditionPayload },
    includeTables: [...identityHistory],
    excludeTables: ['env_new_hire_authority', 'env_review_presentations', 'env_passkeys', 'env_human_challenges', 'oa_sessions', 'oa_tokens', 'oa_credentials',
      'oa_step_up_challenges', 'oa_policy_approvals', 'oc_idp_grants',
      'env_external_providers', 'env_agent_credentials', 'env_webhook_keys', 'env_grants',
      'env_rate_reviews', 'env_workspace_reviews', 'env_notice_reviews',
      'rer_dependency_keys', 'rer_dependency_pending', 'rer_dependency_codes'],
    requiredConfiguration: ['ENVELOPE_RECORD_KEY', 'OWNER_EMAIL', 'SESSION_SECRET',
      'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
    // Agent provenance remains to satisfy historical references, with every
    // capability scope cleared. Notice approval attribution remains evidence.
    exportRow(table, row) {
      if (expires.includes(table)) row.expires_at = 0;
      if (table === 'env_webhooks') row.active = 0;
      if (table === 'env_run_approvals') row.authority_active = 0;
      if (table === 'env_agent_grants') for (const field of ['actions', 'fields', 'locations', 'providers', 'models']) row[field] = '[]';
      return row;
    },
    importSafety: {env_run_approvals: {authority_active: [0]}, env_webhooks: {active: [0]}, ...Object.fromEntries(expires.map(table => [table, {
      expires_at: [0], ...(table === 'env_agent_grants' ? Object.fromEntries(
        ['actions', 'fields', 'locations', 'providers', 'models'].map(field => [field, ['[]']])) : {}),
    }]))},
    importRow(table, row) {
      if (expires.includes(table)) row.expires_at = 0;
      if (table === 'env_webhooks') row.active = 0;
      if (table === 'env_run_approvals') row.authority_active = 0;
      if (table === 'env_agent_grants') for (const field of ['actions', 'fields', 'locations', 'providers', 'models']) row[field] = '[]';
      return row;
    },
    validateStaged: staged => validateEnvelopeArchive(staged, getKey),
  };
}

export default createEnvelopeArchivePolicy();
