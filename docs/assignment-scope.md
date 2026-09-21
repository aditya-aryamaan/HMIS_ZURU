# Assignment scope and implementation boundary

## Goal

Demonstrate that conversational AI can extract clearer hiring requirements, generate useful hiring documents, and support consistent evidence-based candidate review without replacing human judgment.

## Implemented in the POC

| Assignment requirement | Demonstrated implementation |
|---|---|
| Interactive hiring-manager tool | Telegram conversation orchestrated by n8n |
| Basic information and intelligent follow-ups | Nine-area discovery framework with adaptive questioning and explicit unresolved items |
| Technical and creative roles | Synthetic technical and creative review scenarios |
| Vague, excessive, and culture-heavy requests | Prompt rules that clarify vague claims, prioritise long skill lists, and translate culture into observable behaviour |
| ZURU-style job description | Generated and locally converted PDF |
| Five to seven screening questions | Validated hiring-guide output |
| Evaluation rubric and flags | Human-readable hiring guide plus machine-readable rubric JSON |
| Seasonality awareness | Internships use the 12-week summer programme commencing mid-November; permanent full-time packs omit employment dates |
| Hiring-manager readiness | Deterministic brief-readiness score, area statuses, strengths, and clarification areas |
| Candidate evaluation | Separate post-interview evaluator form |
| Confidence and human review | Per-criterion evidence confidence, missing-evidence handling, transparent review priority, and conditional reviewer actions |
| Human judgment | No automatic hire, reject, rank, or progression decision |

## Demonstration boundary

The take-home demo uses one Telegram bot, one local n8n instance, temporary conversation memory, synthetic candidate data, and a Cloudflare Quick Tunnel. The tunnel is needed only for Telegram webhook delivery during the demo.

The evaluator accepts pasted answers and TXT/VTT transcripts after an interview. It does not listen to a live call. Offline interviews can use structured interviewer notes through the same evaluator.

## Future integration points

The architecture can later add:

- Google Docs or Microsoft Word for editable documents;
- WhatsApp as another conversation adapter;
- Microsoft Graph for Teams transcript retrieval;
- PostgreSQL or n8n Data Tables for concurrent managers and role state;
- ATS and identity-provider integration;
- a stable company subdomain and production webhook;
- organisation-specific access, retention, audit, and legal controls.

These extensions are described to show deployment awareness. They are deliberately excluded from the live POC so the review can focus on conversation quality, output usefulness, fairness, and human oversight.

## Presentation claim

The prototype validates the workflow and user experience. It does not claim production security, scale, legal approval, calibrated hiring predictions, or autonomous hiring decisions.
