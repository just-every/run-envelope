export const catalogue = [
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
