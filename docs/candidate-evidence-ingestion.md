# Candidate evidence ingestion — online and offline interviews

## Decision

Candidate evaluation runs after the interview. The evaluator does not need to listen to a live call. It accepts evidence from several interview formats, normalizes that evidence, and applies the approved role rubric criterion by criterion.

Telegram is the demonstrated menu and notification channel. Interview evidence is submitted through the separate n8n evaluator form rather than retained in a chat conversation. A production deployment could replace Telegram with WhatsApp or an internal company channel and use authenticated storage or Microsoft 365 retrieval.

## Common evaluation pipeline

```text
Teams TXT/VTT ──────────┐
Offline TXT/VTT ────────┤
Pasted answers ─────────┼─> validate provenance ─> normalize evidence
Structured notes ───────┘                              │
                                                       v
approved role rubric ─────────────────────────> criterion assessment
                                                       │
                                                       v
                                        human-review report and actions
```

A production implementation should normalize every supported source to an evidence object such as:

```json
{
  "interview_id": "INT-1042",
  "candidate_reference": "CANDIDATE-A",
  "role_id": "HMIS-1042",
  "rubric_id": "RUBRIC-3",
  "source_type": "teams_transcript",
  "captured_by": "reviewer identity",
  "consent_confirmed": true,
  "speaker_attribution": "verified",
  "evidence_quality": "high",
  "content": "timestamped or question-labelled interview text"
}
```

The production ingestion contract should validate the role/rubric version, candidate identity, source, organisational consent record, file type, file size, and readable text before making an AI request.

The implemented POC collects a candidate name and checks source consistency. For transcript sources, it requires a speaker-labelled TXT/VTT file and extracts only turns labelled with the entered candidate name, `Candidate`, or `Interviewee`; unmatched transcripts stop before the model. Pasted answers must use the text field. Structured notes and pasted answers have a medium confidence ceiling. The form does not collect separate consent or speaker-attribution selections; the uploader is instructed to submit only evidence they are authorised to use.

## Online Microsoft Teams path

### POC

1. The interviewer downloads the Teams transcript after the meeting.
2. In Telegram, the interviewer selects **Candidate evaluation**.
3. The bot returns an authenticated evaluator upload link for the selected role.
4. The interviewer enters the candidate name as it appears in the transcript and uploads the file. Evidence authorisation remains an organisational prerequisite rather than a POC form field.
5. n8n matches speaker labels, keeps only candidate turns, and then calls the candidate evaluator. A missing or ambiguous name match stops processing before any model request.

Accept `.vtt` or `.txt` first because they preserve text and are simple to validate. Add `.docx` after a controlled document-extraction step is tested. A Word document must be parsed before it is sent to the model; binary DOCX data should never be placed directly in the prompt.

### Production Microsoft 365 integration

Microsoft Graph can list and retrieve Teams meeting transcripts after a meeting. This removes the manual download/upload step. It requires tenant administrator approval, transcript-access settings, suitable Graph permissions, meeting-to-role mapping, and retention controls. Speaker-attributed WebVTT should be used when permitted; when speaker attribution is unavailable, the workflow must lower evidence confidence and request human confirmation.

## Offline interview paths

### Path A — consented recording and transcription

1. The interviewer obtains and records the required consent.
2. Audio is recorded on an approved company device or meeting-room system.
3. The file is uploaded through the secure evaluator form or company storage.
4. An asynchronous transcription step produces timestamped text.
5. The interviewer checks speaker attribution and obvious transcription errors before evaluation.

Because transcription happens after the interview, it does not consume live-call resources. The evaluator should assess the words and examples supplied by the candidate. It must not infer competence from accent, voice, emotion, appearance, or other biometric/protected characteristics.

### Path B — structured interviewer notes

When recording is unavailable or inappropriate, the interviewer completes a question-by-question evidence form. Each answer should distinguish:

- a direct candidate quote or close contemporaneous note;
- the interviewer's factual observation;
- the interviewer's interpretation;
- missing or unclear evidence requiring reviewer attention.

The report must label this source as `structured_notes`. It may still map evidence to the rubric, but confidence should normally be lower than for a verified attributed transcript.

### Path C — short summary only

A general interview summary is the weakest input. The evaluator should extract possible evidence, mark most criterion confidence as low, avoid filling gaps, and generate targeted human-review questions. It should not convert a short summary into a confident candidate score.

## Scoring and confidence

Keep three concepts separate:

1. **Criterion score** — how strongly the supplied evidence matches the approved 1–4 rubric anchor.
2. **Evidence confidence** — how reliable and complete the source is for that criterion.
3. **Human-review priority** — where a person should verify attribution, resolve contradictions, or collect missing evidence.

Confidence is categorical rather than numeric. The source establishes the maximum permitted label, and the evaluator applies the following evidence-strength rules within that ceiling:

| Evidence condition | Maximum confidence |
|---|---|
| Attributed transcript plus direct, specific and sufficiently complete criterion evidence | High |
| Relevant criterion evidence with a meaningful gap in detail, scope, result or consistency | Medium |
| Indirect, vague or contradictory criterion evidence | Low |
| Missing or unreadable criterion evidence | Low; no score |

The report should show criterion scores and confidence, not an automatic hire/reject verdict or a single unexplained candidate ranking.

The POC report also shows the exact rubric anchor, the confidence basis and a deterministic human-review priority. Missing evidence, low confidence, or a score of 1 on an essential criterion receives high priority. A score of 2 on an essential criterion or any evidence-backed concern receives medium priority. Otherwise it receives low priority. This priority organises review and is not a candidate-risk probability or progression decision.

Because evaluation occurs after the interview, the report does not automatically create a follow-up question for every criterion. It shows a reviewer action only for missing, contradictory, low-confidence or verification-sensitive evidence. Clear evidence requires no extra action.

## Messaging-channel boundary

For the presentation, Telegram demonstrates this conversation:

```text
2 — Candidate evaluation
Choose role: HMIS-1042
Choose evidence source: Teams transcript / Offline recording / Interview notes
Open secure upload form
Evaluation ready — review criterion evidence and flagged areas
```

Direct chat attachment intake is technically possible, but it adds sensitive-data retention, file validation, and access-control work. The POC uses Telegram only to initiate the evaluator and deliver its form link. The transcript is submitted through the evaluator form.

## Current implementation and production backlog

The POC already accepts pasted answers, structured notes, and `.txt`/`.vtt` transcript uploads. It records the evidence source, extracts turns attributed to the entered candidate name, applies source-based confidence ceilings, and routes Telegram option 2 to the separate evaluator form. The reviewer uploads the approved `role-rubric.json`, which provides the role and rubric context without relying on the earlier Telegram session.

The form deliberately omits a separate consent selector, role ID, and candidate ID. Evidence authorisation is stated as an organisational prerequisite, the candidate is identified by name for speaker matching, and the uploaded rubric carries the role context. Synthetic online and offline fixtures support the demonstration.

Production work would add authenticated identity, durable role and rubric IDs, an organisational consent record, Microsoft Graph transcript retrieval, DOCX extraction, audio transcription, malware scanning, retention automation, and ATS write-back. A production form could preselect an approved rubric from a controlled role list instead of requiring JSON upload.
