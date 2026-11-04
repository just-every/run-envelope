const definitions = [
{
  "name": "envelope.credentials.restrict",
"sponsorEscalation": false,
  "description": "Reduce only the calling native credential scope; widening is refused and current calls are fenced by the new grant revision.",
  "properties": {"credentialId":false,
    "actions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "fields": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "locations": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [],
  "scope": "credentials:restrict",
  "readOnly": false,
  "classes": [
    "access"
  ],
  "clauses": [
    "SURFACE-006",
    "ENV-052"
  ],
  "nativeName": "credentials.restrict"
},
  {
    "name": "envelope.credentials.rotate",
    "description": "Replace only the calling native credential; deliver the new bearer encrypted to the caller\u2019s RSA-OAEP-256 public key. Scope and original expiry cannot widen.",
    "properties": {
      "publicKey": {
        "type": "object",
        "properties": {
          "kty": {
            "type": "string",
            "const": "RSA"
          },
          "n": {
            "type": "string",
            "minLength": 342,
            "maxLength": 1024
          },
          "e": {
            "type": "string",
            "const": "AQAB"
          }
        },
        "required": [
          "kty",
          "n",
          "e"
        ],
        "additionalProperties": false
      }
    },
    "required": [
      "publicKey"
    ],
    "scope": "credentials:rotate",
    "readOnly": false,
    "classes": [
      "security"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-052"
    ],
    "sponsorEscalation": false,
    "nativeName": "credentials.rotate"
  },
  {
    "name": "envelope.notices.process",
    "description": "Extract an untrusted proposal from a saved notice using only the declared OpenAI model. Never approves or invokes model tools.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "noticeId": {
        "type": "string"
      },
      "provider": false
    },
    "required": [
      "companyId",
      "noticeId"
    ],
    "scope": "notices:process",
    "readOnly": false,
    "classes": [
      "sensitive",
      "external"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-025",
      "ENV-055",
      "ENV-062"
    ],
    "nativeName": "notice.process"
  },
  {
    "name": "envelope.notices.reply",
    "description": "Dispatch only the exact latest unexpired human-approved notice reply through declared Resend. Rechecks current human and sponsor authority. Never approves, pays wages or files returns.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "replyId": {
        "type": "string"
      },
      "version": {
        "type": "integer"
      },
      "digest": {
        "type": "string"
      }
    },
    "required": [
      "companyId",
      "replyId",
      "version",
      "digest"
    ],
    "scope": "dispatch:execute",
    "readOnly": false,
    "classes": [
      "commitment",
      "external"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-025",
      "ENV-055",
      "ENV-062"
    ],
    "nativeName": "reply.dispatch"
  },
  {
    "name": "envelope.bonus.prepare",
    "description": "Prepare an immutable bonus-only earnings run. Tax and overtime remain uncalculated; never approves or dispatches.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "personId": {
        "type": "string"
      },
      "amountCents": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100000000
      },
      "periodStart": {
        "type": "string"
      },
      "periodEnd": {
        "type": "string"
      },
      "payDate": {
        "type": "string"
      },
      "sourceRef": {
        "type": "string"
      },
      "requestKey": {
        "type": "string"
      }
    },
    "required": [
      "companyId",
      "personId",
      "amountCents",
      "periodStart",
      "periodEnd",
      "payDate",
      "sourceRef",
      "requestKey"
    ],
    "scope": "drafts:prepare",
    "readOnly": false,
    "classes": [
      "standard"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-009",
      "ENV-030",
      "ENV-052"
    ],
    "nativeName": "bonus.prepare"
  },
  {
    "name": "envelope.bonus.read",
    "description": "Read this credential\u2019s exact immutable bonus earnings and outstanding calculation holds.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "runId": {
        "type": "string"
      }
    },
    "required": [
      "companyId",
      "runId"
    ],
    "scope": "drafts:read",
    "readOnly": true,
    "classes": [
      "sensitive"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-030",
      "ENV-052"
    ],
    "nativeName": "bonus.read"
  },
  {
    "name": "envelope.runs.review_link",
    "description": "Present a native exact-run review link to a separately authenticated human. Never approves.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "runId": {
        "type": "string"
      }
    },
    "required": [
      "companyId",
      "runId"
    ],
    "scope": "drafts:read",
    "readOnly": false,
    "classes": [
      "standard"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-029",
      "ENV-034"
    ],
    "nativeName": "run.review"
  },
  {
    "name": "envelope.records.list",
    "description": "Read a stable ID-ordered page of scoped person records; no private values. Use next as after.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100
      },
      "after": {
        "type": "string"
      }
    },
    "required": [
      "companyId"
    ],
    "scope": "records:read",
    "readOnly": true,
    "classes": [
      "standard"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-028",
      "ENV-052"
    ],
    "nativeName": "records.list"
  },
  {
    "name": "envelope.draft.prepare",
    "description": "Persist one uncalculated run-input proposal from a current person and reviewed effective rate. Never approves, calculates tax or dispatches.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "personId": {
        "type": "string"
      },
      "minutes": {
        "type": "integer",
        "minimum": 1,
        "maximum": 44640
      },
      "periodStart": {
        "type": "string"
      },
      "periodEnd": {
        "type": "string"
      },
      "payDate": {
        "type": "string"
      },
      "sourceRef": {
        "type": "string"
      },
      "requestKey": {
        "type": "string"
      }
    },
    "required": [
      "companyId",
      "personId",
      "minutes",
      "periodStart",
      "periodEnd",
      "payDate",
      "sourceRef",
      "requestKey"
    ],
    "scope": "drafts:prepare",
    "readOnly": false,
    "classes": [
      "standard"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-030",
      "ENV-052"
    ],
    "nativeName": "draft.prepare"
  },
  {
    "name": "envelope.reports.bonuses",
    "description": "Read a current scoped page of this credential\u2019s native bonus earnings preparations. No calculated payroll or payment claim.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100
      },
      "after": {
        "type": "string"
      }
    },
    "required": [
      "companyId"
    ],
    "scope": "drafts:read",
    "readOnly": true,
    "classes": [
      "sensitive"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-024",
      "ENV-030",
      "ENV-052"
    ],
    "nativeName": "reports.bonuses"
  },
  {
    "name": "envelope.reports.proposals",
    "description": "Read a current scoped report of this credential\u2019s retained uncalculated input proposals. No payroll totals, payments or filings.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100
      },
      "after": {
        "type": "string"
      }
    },
    "required": [
      "companyId"
    ],
    "scope": "drafts:read",
    "readOnly": true,
    "classes": [
      "sensitive"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-024",
      "ENV-030",
      "ENV-052"
    ],
    "nativeName": "reports.proposals"
  },
  {
    "name": "envelope.draft.read",
    "description": "Read scoped uncalculated proposal and source/rate references.",
    "properties": {
      "companyId": {
        "type": "string"
      },
      "draftId": {
        "type": "string"
      }
    },
    "required": [
      "companyId",
      "draftId"
    ],
    "scope": "drafts:read",
    "readOnly": true,
    "classes": [
      "sensitive"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-030",
      "ENV-052"
    ],
    "nativeName": "draft.read"
  },
  {
    "name": "envelope.workspace.snapshot",
    "scope": "records:read",
    "description": "Fingerprint this native grant\u2019s visible records and retained proposal state, for reconciliation without disclosing private values.",
    "properties": {},
    "required": [],
    "readOnly": true,
    "classes": [
      "standard"
    ],
    "clauses": [
      "SURFACE-001",
      "SURFACE-006",
      "ENV-030",
      "ENV-056"
    ],
    "nativeName": "workspace.snapshot"
  }
] as const
export const notTools = [
  {
    "clauses": [
      "ENV-053"
    ],
    "reason": "import-door"
  },
  {
    "clauses": [
      "ENV-050",
      "ENV-055",
      "ENV-057",
      "ENV-058",
      "ENV-073",
      "ENV-030"
    ],
    "reason": "installation"
  },
  {
    "clauses": [
      "ENV-022",
      "ENV-034",
      "ENV-051"
    ],
    "reason": "screen"
  },
  {
    "clauses": [
      "ENV-045"
    ],
    "reason": "device"
  },
  {
    "clauses": [
      "ENV-031",
      "ENV-040",
      "ENV-041",
      "ENV-042"
    ],
    "reason": "connector"
  }
] as const

// Class proof declarations are independent of the runtime classifier classes.
const documentation = {
  "credentials.restrict": {
    "job": "Credential management",
    "step": "credentials-restrict",
    "classes": [
      "access"
    ]
  },
  "credentials.rotate": {
    "job": "Credential management",
    "step": "credentials-rotate",
    "classes": [
      "security"
    ]
  },
  "notice.process": {
    "job": "Notice correspondence",
    "step": "notice-process",
    "classes": [
      "sensitive",
      "external"
    ]
  },
  "reply.dispatch": {
    "job": "Notice correspondence",
    "step": "reply-dispatch",
    "classes": [
      "commitment",
      "external"
    ]
  },
  "bonus.prepare": {
    "job": "Bonus preparation",
    "step": "bonus",
    "classes": [
      "standard"
    ]
  },
  "bonus.read": {
    "job": "Bonus preparation",
    "step": "bonus-read",
    "classes": [
      "sensitive"
    ]
  },
  "run.review": {
    "job": "Native human review",
    "step": "run-review",
    "classes": [
      "standard"
    ]
  },
  "records.list": {
    "job": "Worker records",
    "step": "records-list",
    "classes": [
      "standard"
    ]
  },
  "draft.prepare": {
    "job": "Hourly preparation",
    "step": "draft",
    "classes": [
      "standard"
    ]
  },
  "draft.read": {
    "job": "Hourly preparation",
    "step": "draft-read",
    "classes": [
      "sensitive"
    ]
  },
  "reports.bonuses": {
    "job": "Bonus preparation",
    "step": "reports-bonuses",
    "classes": [
      "sensitive"
    ]
  },
  "reports.proposals": {
    "job": "Hourly preparation",
    "step": "reports-proposals",
    "classes": [
      "sensitive"
    ]
  },
  "workspace.snapshot": {
    "job": "Reconciliation",
    "step": "workspace-snapshot",
    "classes": [
      "standard"
    ]
  }
} as const
export const catalogue = definitions.map(entry => {
  const proof = documentation[entry.nativeName]
  return {...entry, job:proof.job, classTests:proof.classes.map(cls => ({
    class:cls, path:'src/modules/agent-door/conformance/journey.mjs',
    test:'BASE-AGENT-006.2.<policy>.'+proof.step, step:proof.step,
  }))}
})
export const capacityLimits = {requestsPerMinute:600, maxBodyBytes:1048576} as const
export const resourceDeclarations: import('../../modules/agent-door/index.ts').ResourceDefinition[] = []
export const unfinishedJobs = [
  'Complete payroll tool coverage, specialist prompts and the stranger-agent payroll week remain unfinished.',
  'Full Base conformance and the remaining Agent surface acceptance journeys remain unproved.',
  'Hourly and bonus preparations remain uncalculated; no funded payment, tax remittance, agency filing or accepted provider outcome is claimed.',
  'Calculation catalogue licensing, authorized employer and rail access, provider accounts and mandates remain required for their target jobs.',
  'Scoped delegation, exact human approvals, statutory custody, device proof and the existing policy and visual-correction holds remain required.',
] as const

// Shared door and native prerequisite refusal vocabulary; unknown effects stay held.
export const stableErrors = [
  "agent_authentication_required",
  "agent_authority_revoked",
  "agent_rate_limited",
  "agent_scope_denied",
  "agent_tool_denied",
  "agents_paused",
  "ambiguous_authentication",
  "answer_every_agent_class",
  "approval_already_dispatched_or_changed",
  "approval_evidence_changed",
  "approval_expired",
  "approval_rejected",
  "approval_required",
  "audit_missing",
  "authority_changed",
  "authority_or_proof_changed",
  "bonus_idempotency_conflict",
  "bonus_input_or_authority_changed",
  "bonus_or_authority_unavailable",
  "budget_exhausted",
  "call_in_progress",
  "capability_not_declared",
  "classification_invalid",
  "compensation_scope_required",
  "consent_revoked",
  "credential_or_authority_changed",
  "decision_busy",
  "dispatch_provider_scope_required",
  "draft_input_or_authority_changed",
  "draft_or_authority_unavailable",
  "exact_approval_or_authority_changed",
  "exact_approved_reply_required",
  "exact_notice_custody_consent_required",
  "exact_review_or_authority_changed",
  "exact_review_required",
  "execution_failed",
  "idempotency_conflict",
  "idempotency_key_required",
  "insufficient_scope",
  "invalid_agent_scope",
  "invalid_arguments",
  "invalid_audit_period",
  "invalid_bonus_input",
  "invalid_class_policy",
  "invalid_draft_input",
  "invalid_draft_period",
  "invalid_effective_date",
  "invalid_input",
  "invalid_notice_input",
  "invalid_notice_text",
  "invalid_operation_query",
  "invalid_origin",
  "invalid_record_query",
  "invalid_report_query",
  "invalid_review_date",
  "invalid_rotation_key",
  "narrowing_contract_violation",
  "native_agent_admission_changed",
  "native_agent_grant_required",
  "native_agent_grant_revoked",
  "native_owner_required",
  "native_proof_required",
  "notice_model_unavailable",
  "notice_or_authority_changed",
  "notice_provider_scope_required",
  "notice_unavailable",
  "operation_mismatch",
  "output_invalid",
  "owner_required",
  "payroll_record_key_required",
  "policy_blocked",
  "policy_or_authority_changed",
  "policy_unavailable",
  "policy_unset",
  "presenting_client_revoked",
  "private_record_unavailable",
  "provider_not_declared",
  "provider_or_authority_changed",
  "rate_limited",
  "record_unavailable",
  "reply_or_authority_changed",
  "reply_unavailable",
  "resource_changed",
  "resource_unavailable",
  "review_required",
  "review_unavailable",
  "revision_conflict",
  "self_escalation",
  "sponsor_scope_denied",
  "sponsor_unavailable",
  "summary_invalid",
  "target_invalid",
  "tool_not_found",
  "unauthenticated",
  "undeclared_arguments",
  "unsupported_cipher",
  "unsupported_content_type"
] as const
