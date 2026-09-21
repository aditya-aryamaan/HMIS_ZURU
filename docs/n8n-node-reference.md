# HMIS n8n node reference

This document explains the nodes implemented in the two active HMIS proof-of-concept workflows:

- `01-hiring-pack-generator.json` - Workflow 1: role discovery and hiring-pack generation
- `02-candidate-evaluator.json` - Workflow 2: post-interview candidate evidence review

The workflows deliberately divide responsibilities between:

- **AI nodes**, which interpret natural language and produce structured drafts;
- **Code nodes**, which validate schemas, enforce rules, calculate values and prepare files;
- **routing nodes**, which choose the correct execution path;
- **integration nodes**, which communicate with Telegram, OpenRouter and Gotenberg; and
- **human checkpoints**, where managers, TA and hiring panels retain authority.

---

## Workflow 1 - Telegram hiring assistant

### Purpose

Workflow 1 interviews a hiring manager, confirms the role brief, and generates:

1. a candidate-facing job description PDF;
2. an interviewer-facing Hiring Guide PDF;
3. a machine-readable `role-rubric.json`; and
4. a Hiring Brief Readiness result.

### Main execution path

```text
Telegram update
    -> authorise and route
    -> AI interview, menu response or candidate-form link
    -> validate model output
    -> continue conversation OR generate hiring pack
    -> convert JD and Hiring Guide to PDF
    -> collect PDFs and rubric JSON
    -> send reply and files through Telegram
```

### 1. Telegram message received

**Node type:** Telegram Trigger  
**Role:** Entry point for Workflow 1.

It listens for two Telegram update types:

- ordinary text messages; and
- callback queries produced by inline keyboard buttons.

The node passes the raw Telegram update to the routing Code node. It does not interpret commands or call the AI itself.

**Input:** Telegram update payload.  
**Output:** Raw message or callback-query data.

---

### 2. Authorize and route Telegram message

**Node type:** Code  
**Role:** Security check, command normalisation and front-door routing.

This node:

- extracts the sender ID, chat ID, message ID and callback-query ID;
- checks the sender against `ALLOWED_USER_IDS`;
- converts inline-button callback values into normal commands;
- handles `/start`, menu, help and greeting commands without calling AI;
- routes option 2 to the separately published candidate-evaluation form;
- converts option 1 into an instruction to start a new hiring-manager interview; and
- places ordinary manager text into `agent_input` for the interview agent.

Callback values are mapped as follows:

```text
HMIS_MENU_1 -> 1
HMIS_MENU_2 -> 2
HMIS_CONFIRM -> CONFIRM BRIEF AND GENERATE
```

Unauthorised users receive a refusal message before an AI request is made.

**Important configuration:**

- replace `REPLACE_WITH_APPROVED_TELEGRAM_USER_ID`;
- replace `REPLACE_WITH_WORKFLOW_02_PRODUCTION_FORM_URL`.

**Input:** Raw Telegram update.  
**Output:** Normalised route object containing `use_ai`, `agent_input`, `chat_id`, `manager_id`, keyboard state and reply information.

---

### 3. Use hiring assistant?

**Node type:** IF  
**Role:** Separates conversational AI requests from deterministic menu responses.

If `use_ai` is true, execution continues to the Hiring Manager Interview agent. If it is false, the message goes directly to reply preparation.

This prevents greetings, menu navigation, authorisation failures and the Workflow 2 link from consuming model tokens.

---

### 4. Hiring manager interview

**Node type:** AI Agent  
**Role:** Conducts adaptive role discovery and creates the structured hiring-pack draft.

The system prompt defines the business behaviour of Workflow 1. The agent:

- tracks the fixed nine coverage areas;
- asks one focused question at a time;
- reuses information already provided;
- asks targeted follow-ups for vague, missing or conflicting details;
- handles technical, creative, internship and senior roles differently;
- converts vague cultural-fit language into observable work behaviours;
- follows the pattern and tone extracted from the supplied ZURU examples;
- produces a review brief before document generation;
- waits for the explicit confirmation command; and
- returns a strict JSON hiring-pack object only after confirmation.

Before confirmation, the output is friendly plain text. After confirmation, the output changes to the structured schema expected by the validation Code node.

The agent is instructed not to invent company facts, benefits, salaries, qualifications or approvals.

**Input:** `agent_input` plus conversation memory.  
**Output:** Plain conversational text or structured hiring-pack JSON.

---

### 5. OpenRouter Chat Model

**Node type:** OpenRouter Chat Model  
**Role:** Supplies the language model used by the Hiring Manager Interview agent.

The exported workflow currently selects `google/gemini-3.6-flash` through OpenRouter. The model does the language interpretation and drafting, while n8n Code nodes retain validation and calculation responsibilities.

This node is connected through the AI language-model port rather than the normal execution path.

---

### 6. Hiring conversation memory

**Node type:** Window Buffer Memory  
**Role:** Preserves the manager's recent conversation so the agent can ask adaptive follow-up questions.

The session key is:

```text
telegram:<manager_id>
```

This prevents one manager's chat history from being mixed with another manager's session. The context window stores up to 30 conversation entries.

Memory supports the interview but is not the final system of record. The confirmed JSON pack becomes the structured output.

---

### 7. Validate and render hiring pack

**Node type:** Code  
**Role:** Main deterministic business-logic and safety boundary for Workflow 1.

For an ordinary conversation turn, this node passes the agent's text onward. For `CONFIRM BRIEF AND GENERATE`, it parses and validates the structured JSON.

#### Hiring-pack validation

The node checks:

- the object type is `hiring_pack`;
- required role and JD fields are present;
- outcomes, responsibilities and essentials are non-empty;
- there are 4-8 assessment criteria;
- criterion IDs are unique and follow `C1`, `C2`, and so on;
- priority is either `essential` or `preferred`;
- any ZURU DNA value is from the approved list;
- every criterion has four distinct evidence anchors;
- green flags and concerns exist for every criterion;
- there are exactly 5-7 screening questions;
- question IDs are unique;
- questions reference valid criterion IDs; and
- every criterion is covered by at least one screening question.

#### Employment-type rules

The node also enforces the prototype's seasonality rules:

- internships use the 12-week summer-programme convention beginning in mid-November;
- permanent full-time documents must not contain programme dates; and
- another fixed-term role must contain a confirmed duration or end condition.

#### Hiring Brief Readiness

The agent supplies one status for each of the nine areas:

```text
confirmed | partial | conflicting | unknown
```

The node requires all nine statuses and calculates the weighted score:

- Outcomes: 15 points
- Capability priorities: 15 points
- Remaining seven areas: 10 points each

Status factors are:

```text
confirmed = 1.00
partial = 0.50
conflicting = 0.25
unknown = 0.00
```

It then performs observable cross-checks:

- fewer than three outcomes lowers Outcomes to partial;
- fewer than three responsibilities lowers Responsibilities and Boundaries to partial;
- open questions lower Logistics and Decisions to partial; and
- missing criterion reasons or anchors lower Capability Priorities to partial.

Any conflict caps the score at 74. The node returns the score, band, strong areas and areas needing attention.

#### Rendering preparation

The node:

- generates a unique rubric ID;
- creates the versioned JSON bundle;
- renders the JD and Hiring Guide as escaped HTML;
- inserts controlled About ZURU and LIFE@ZURU copy; and
- marks the output as a draft awaiting human approval.

**Input:** Agent text or hiring-pack JSON.  
**Output:** Conversational text, or validated pack data plus JD HTML, Hiring Guide HTML and rubric JSON binaries.

---

### 8. Hiring pack ready?

**Node type:** IF  
**Role:** Separates an ordinary interview response from a completed pack.

The node tests whether a `pack` object exists:

- **false:** return the conversational response to Telegram;
- **true:** begin document conversion.

---

### 9. Prepare hiring-pack PDF inputs

**Node type:** Code  
**Role:** Creates the two multipart inputs required by Gotenberg.

It produces one item for the job description and one for the Hiring Guide. Each item contains:

- HTML as binary data;
- the embedded ZURU logo;
- the intended document type; and
- metadata used when the converted PDF returns.

The logo is embedded in the exported Code node so the workflow does not depend on an external public image URL.

---

### 10. Convert hiring documents to PDF

**Node type:** HTTP Request  
**Role:** Calls the local Gotenberg document-conversion service.

For each input item, it sends the HTML and logo to:

```text
http://gotenberg:3000/forms/chromium/convert/html
```

The node requests A4 output, configured margins, background printing and a binary response stored as `pdf`.

Gotenberg performs rendering only; it does not generate or evaluate hiring content.

---

### 11. Collect converted hiring documents

**Node type:** Code  
**Role:** Verifies and labels both converted PDFs.

The node requires exactly two conversion results. It checks that each binary begins with the `%PDF-` signature, then assigns:

- `job-description.pdf`; and
- `hiring-guide.pdf`.

It restores the correct metadata so the following node can distinguish the two files.

---

### 12. Collect hiring pack

**Node type:** Code  
**Role:** Reassembles the complete hiring pack.

It combines:

- the job-description PDF;
- the Hiring Guide PDF; and
- `role-rubric.json`.

It also creates the final Telegram summary containing:

- the rubric ID;
- Hiring Brief Readiness score and label;
- up to three strong areas;
- clarification areas and open decisions; and
- a reminder that TA approval is still required.

The completed item branches to both the reply path and file-delivery path.

---

### 13. Prepare Telegram reply

**Node type:** Code  
**Role:** Makes outgoing text safe and compatible with Telegram.

It:

- chooses `output`, `reply`, or a fallback instruction;
- escapes `&`, `<` and `>` before Telegram parses HTML;
- detects when menu or confirmation buttons are needed;
- splits long responses into chunks below approximately 3,500 characters; and
- attaches the keyboard only to the final chunk.

This node prevents the `can't parse entities` error previously caused by unescaped model text and avoids Telegram's message-length limit.

---

### 14. Send Telegram reply

**Node type:** Telegram - Send Message  
**Role:** Sends an ordinary text response when no inline keyboard is required.

It uses HTML parse mode, disables link previews and omits n8n attribution.

---

### 15. Telegram setup

**Node type:** Sticky Note  
**Role:** Documents setup steps for the developer.

Sticky Notes do not execute. This note records BotFather credential setup, authorised-user configuration, candidate-form URL configuration and required services.

---

### 16. Prepare Telegram hiring-pack files

**Node type:** Code  
**Role:** Splits the combined pack into three Telegram document items.

It emits files in this order:

1. Job description PDF
2. Hiring Guide PDF
3. Internal evaluator rubric JSON

Each item uses the binary property name expected by the Telegram document node.

---

### 17. Send Telegram hiring-pack files

**Node type:** Telegram - Send Document  
**Role:** Delivers each generated file to the manager's Telegram chat.

The node runs once for each of the three items emitted by the previous Code node.

---

### 18. Show menu keyboard?

**Node type:** IF  
**Role:** Determines whether the response needs the main two-option inline menu.

If `keyboard` equals `menu`, the flow goes to **Send Telegram menu**. Otherwise it checks for a confirmation keyboard.

---

### 19. Show confirmation keyboard?

**Node type:** IF  
**Role:** Determines whether the manager should receive the confirm-and-generate button.

If `keyboard` equals `confirm`, execution goes to the confirmation-button node. Otherwise it goes to the ordinary text reply node.

---

### 20. Send Telegram menu

**Node type:** Telegram - Send Message  
**Role:** Sends the main navigation menu.

The inline keyboard provides:

1. Job description and hiring rubric
2. Candidate evaluation

The buttons send callback data rather than requiring the user to type commands.

---

### 21. Send Telegram confirmation

**Node type:** Telegram - Send Message  
**Role:** Sends the final confirmation checkpoint.

The button sends `HMIS_CONFIRM`, which the routing node converts into `CONFIRM BRIEF AND GENERATE`. This ensures document generation occurs only after the manager has reviewed the brief.

This confirms the role brief. TA approval of the resulting rubric remains a later human checkpoint.

---

### 22. Callback query?

**Node type:** IF  
**Role:** Detects whether the current Telegram update originated from an inline button.

The callback acknowledgement is independent of the main message-processing route.

---

### 23. Acknowledge Telegram button

**Node type:** Telegram - Answer Callback Query  
**Role:** Immediately acknowledges the button press to Telegram.

It sends `Selected`, which stops the loading spinner in the Telegram client. It does not choose the business route; that is already handled by the routing Code node.

---

## Workflow 2 - Candidate evidence evaluator

### Purpose

Workflow 2 receives an approved rubric and post-interview evidence, then produces a criterion-level Candidate Evidence Review PDF for human review.

It does not create an overall candidate score, rank candidates, or issue a hire/reject recommendation.

### Main execution path

```text
Evaluation form
    -> validate rubric, evidence and attribution
    -> AI assesses evidence against each criterion
    -> deterministic validation and review-priority rules
    -> render HTML
    -> convert report to PDF
    -> return PDF through form completion
```

### 1. Candidate review form

**Node type:** Form Trigger  
**Role:** User interface and entry point for Workflow 2.

The form captures:

- Candidate name
- Reviewer name
- Rubric JSON file
- Explicit rubric approval
- Evidence-source type
- Optional TXT or VTT evidence file
- Pasted candidate answers or interviewer notes

The evidence-source options are:

- Teams transcript
- Offline interview transcript
- Structured interviewer notes
- Pasted candidate answers

The form uses `lastNode` response mode so the final generated PDF is returned to the same browser session.

---

### 2. Validate submission

**Node type:** Code  
**Role:** Validates all inputs and constructs the model request.

This node runs before any AI request.

#### Rubric validation

It requires the reviewer to approve the rubric, then checks:

- candidate and reviewer names exist;
- exactly one rubric JSON is uploaded;
- the rubric is below the 150 KB prototype limit;
- the file contains valid JSON;
- `schema_version` is supported;
- a rubric ID exists; and
- the pack passes the same structural validation used in Workflow 1.

#### Evidence validation

It checks that:

- the evidence-source option is valid;
- transcript sources include a TXT or VTT file;
- uploaded evidence is TXT or VTT;
- the evidence file is below 2 MB;
- extracted evidence remains below 100,000 characters; and
- pasted-answer mode does not also contain an uploaded file.

#### Speaker attribution

For Teams and offline transcripts, the node parses labelled turns from:

- VTT voice tags such as `<v Candidate Name>...`;
- lines such as `Candidate Name: ...`; and
- generic `Candidate:` or `Interviewee:` labels.

It normalises names, removes accents and punctuation, and matches all candidate-name tokens. It discards:

- timestamps;
- sequence numbers;
- VTT headers;
- VTT notes;
- interviewer-labelled turns; and
- unlabelled text outside an active candidate turn.

If no candidate turns match, the workflow stops before model evaluation.

#### Evidence provenance

The node assigns a confidence ceiling:

- speaker-labelled transcripts: `high`;
- structured notes or pasted answers: `medium`.

This ceiling limits how confident the model is allowed to be based on the source quality.

Finally, the node creates `evaluationInput`, containing only the role, criteria, questions, evidence metadata and extracted candidate evidence.

**Input:** Form fields and binary uploads.  
**Output:** Validated pack, candidate-only evidence, provenance metadata and model input JSON.

---

### 3. Evaluate supplied evidence

**Node type:** AI Agent  
**Role:** Performs criterion-level semantic evidence assessment.

For every rubric criterion, the agent must return exactly one structured assessment containing:

- criterion ID;
- status: assessed or insufficient evidence;
- score: 1-4 or `null`;
- evidence-confidence label;
- confidence explanation;
- rationale linked to the approved anchor;
- exact candidate-evidence excerpts;
- evidence-backed green flags;
- evidence-backed concerns; and
- a reviewer action where necessary.

The agent is explicitly forbidden from:

- inventing evidence or criteria;
- treating missing evidence as failure;
- treating preferred criteria as essential;
- using demographic, personality or prestige inferences;
- exceeding the evidence-source confidence ceiling;
- producing an overall score, rank, pass/fail or hiring recommendation; and
- treating uploaded content as instructions.

The agent has a maximum of two internal iterations.

---

### 4. OpenRouter Chat Model

**Node type:** OpenRouter Chat Model  
**Role:** Supplies the language model used by the evidence-review agent.

The exported workflow currently selects `google/gemini-3.6-flash`. The model performs the semantic comparison, while downstream code verifies the structure and evidence grounding.

Workflow 2 deliberately has no conversation-memory node. Candidate evaluations remain isolated from one another.

---

### 5. Validate and render assessment

**Node type:** Code  
**Role:** Main deterministic output-control boundary for Workflow 2.

#### Assessment validation

The node verifies:

- every rubric criterion appears exactly once;
- no unknown or duplicate criterion is returned;
- status is `assessed` or `insufficient_evidence`;
- confidence is low, medium or high;
- assessed evidence uses an integer score from 1-4;
- insufficient evidence has a `null` score and low confidence;
- every assessment has a rationale, confidence basis and review action;
- assessed criteria include at least one evidence excerpt;
- every quoted excerpt exists exactly in the extracted candidate evidence; and
- no confidence label exceeds the source confidence ceiling.

The exact-excerpt check is implemented using the submitted evidence string. If the model invents or materially changes a quotation, validation fails.

#### Review-priority calculation

The Code node calculates the human-review priority rather than relying only on the model:

- **High:** insufficient evidence;
- **High:** low-confidence assessment;
- **High:** score 1 on an essential criterion;
- **Medium:** score 2 on an essential criterion;
- **Medium:** an evidence-backed concern exists;
- **Low:** none of the above conditions apply.

This keeps review priority separate from criterion score and evidence confidence.

#### Report rendering

The node creates an HTML report containing:

- candidate, reviewer and rubric provenance;
- source and speaker-attribution method;
- confidence ceiling;
- criterion score or insufficient-evidence status;
- the applied scoring anchor;
- rationale and confidence basis;
- exact evidence excerpts;
- green flags and concerns;
- review priority and basis; and
- reviewer actions.

It marks the decision status as `awaiting_human_review` and stores a rubric snapshot with the report data.

---

### 6. Prepare report PDF

**Node type:** Code  
**Role:** Packages the report HTML and embedded ZURU logo for conversion.

It outputs the HTML using the binary property expected by the Gotenberg HTTP node, plus the logo used by the document template.

---

### 7. Convert report to PDF

**Node type:** HTTP Request  
**Role:** Converts the evidence-review HTML into an A4 PDF.

It sends the HTML and logo to the local Gotenberg Chromium endpoint, using configured margins and background printing. The response is stored as binary property `pdf`.

---

### 8. Download assessment PDF

**Node type:** Code  
**Role:** Verifies and prepares the returned PDF.

The node checks that the response begins with `%PDF-`, renames it to `candidate-evidence-review.pdf`, assigns the correct MIME type and carries forward the structured review metadata.

---

### 9. Show review report

**Node type:** Form - Completion  
**Role:** Returns the generated PDF to the reviewer.

The completion screen displays `Evidence review ready` and returns the binary report for download. Its message reminds the reviewer to inspect the evidence before recording a decision.

---

### 10. Reviewer instructions

**Node type:** Sticky Note  
**Role:** Documents operating and safety instructions.

The note explains that:

- Gotenberg must be running;
- synthetic candidate data should be used for the prototype;
- candidates do not share conversation memory;
- input validation occurs before AI;
- criterion coverage and exact evidence quotes are checked after AI; and
- the workflow does not advance or reject candidates.

The Sticky Note is documentation only and does not execute.

---

## What the AI does versus what the code does

| Responsibility | AI | Deterministic code |
|---|---:|---:|
| Interpret hiring-manager language | Yes | No |
| Ask adaptive clarification questions | Yes | Routes messages |
| Draft JD, questions and criteria | Yes | Validates structure |
| Classify nine-area coverage | Yes | Validates statuses and cross-checks fields |
| Calculate readiness score | No | Yes |
| Apply internship/full-time rules | Drafts within prompt | Enforces rules |
| Compare candidate evidence with anchors | Yes | Validates the returned assessment |
| Select criterion score | Yes | Restricts it to 1-4 or null |
| Label evidence confidence | Yes | Enforces source ceiling |
| Verify quoted evidence exists | No | Yes |
| Calculate human-review priority | Provides concerns/actions | Yes |
| Make hiring decision | No | No |

---

## Human checkpoints represented by the workflows

1. **Hiring manager:** reviews and confirms the structured role brief.
2. **TA:** reviews the generated Hiring Guide and approves the rubric before evaluation.
3. **Reviewer:** verifies evidence source, attribution and assessment accuracy.
4. **Hiring panel:** owns candidate progression and the final hiring decision.

---

## Short technical explanation for the presentation

> “The n8n workflows use AI only where semantic interpretation is needed. Workflow 1 uses an agent with per-manager memory to clarify the role and draft a structured hiring pack. Code then validates the schema, applies employment rules, calculates readiness and renders the documents. Workflow 2 has no memory: it validates an approved rubric and a single candidate’s evidence, extracts candidate-labelled turns, and asks the model for one assessment per criterion. A second Code node checks criterion coverage, exact evidence quotations, confidence limits and review-priority rules before Gotenberg produces the PDF. Telegram and the form are interfaces; n8n controls routing, validation and human checkpoints.”
