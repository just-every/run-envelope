/** Business history travels. Installation authority and provider secrets never do. */
export default {
  product:'just-every/envelope',
  includeTables:['oa_operators','oa_bootstrap','oa_auth_audit','oa_invitation_cancellations'],
  excludeTables:[
    'env_external_providers','env_grants','env_agent_grants','env_agent_credentials','env_agent_policy',
    'env_notice_reviews','env_rate_reviews','env_workspace_reviews',
    'rer_dependency_link','rer_dependency_installation',
  ],
  requiredConfiguration:['ENVELOPE_RECORD_KEY','OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
  // Historical decisions remain evidence. No review/session/grant or live
  // approval eligibility is imported; all restored company mutations are fenced.
  exportRow(table,row) {
    if(table==='env_companies') return {...row,restored:1}
    if(table==='env_notice_approvals') return {...row,expires_at:1,revoked_at:1}
    return row
  },
  importSafety:{env_companies:{restored:[1]},env_notice_approvals:{expires_at:[1],revoked_at:[1]}},
  importRow(table,row) {
    if(table==='env_companies') return {...row,restored:1}
    if(table==='env_notice_approvals') return {...row,expires_at:1,revoked_at:1}
    return row
  },
  async validateStaged({read,tables}) {
    // A table introduced by a later feature stays in the archive automatically.
    // Its data still cannot create an active restored installation.
    if(!tables.env_companies || !tables.env_agent_history) return false
    return (await read('env_companies')).every(row=>row.restored===1)
  },
}
