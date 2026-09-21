# JD style reference

Sources supplied by the user in `examples/`:

- `Community Manager - ZURU JD copy.pdf`, pages 1-3.
- `Senior Performance Specialist - ZURU JD copy.pdf`, pages 1-4.

These are archived job advertisements printed on 1 September 2025. Use them to guide writing and layout, not as automatically applicable requirements or current company statistics.

## Structure adopted

The examples share a fixed content spine, while the labels and amount of detail vary by role seniority. The prototype preserves that spine rather than treating either archived advertisement as a universal template.

1. ZURU name, role title, location, and team/contract/working arrangement.
2. Short, energetic candidate invitation.
3. About ZURU company context.
4. YOUR ROLE or ROLE PURPOSE.
5. WHAT YOU'LL DO or Roles & Responsibilities.
6. WHAT YOU'LL BRING or Skills & Experience. Keep essential and preferred clearly distinguished within this section.
7. LIFE@ZURU culture paragraph.
8. WHAT WE OFFER, only when role-specific benefits or supported learning have been confirmed.
9. ZURU - Reimagining tomorrow.

### Shared and variable elements

| Element | Community Manager example | Senior Performance Specialist example | Prototype rule |
|---|---|---|---|
| Header | Title, Auckland location, division/team, fixed-term and onsite metadata | Title, Auckland location, division/team and onsite metadata | Always show confirmed title and location; show only confirmed team, contract and arrangement |
| Opening | Energetic social/community invitation | Energetic media-performance invitation | Generate a short role-specific candidate invitation |
| Company context | About ZURU near the beginning | Company context near the beginning | Use concise approved/reference-derived company context |
| Purpose | `YOUR ROLE` | `ROLE PURPOSE` | Standard or specialist heading based on role type and seniority |
| Work | `WHAT YOU'LL DO` | `Roles & Responsibilities` | Action-led responsibilities tied to outcomes |
| Requirements | `WHAT YOU'LL BRING` | `Skills & Experience` | Separate essential and preferred evidence explicitly |
| Culture | Later company/culture section labelled `ABOUT ZURU` | Later culture section labelled `LIFE@ZURU` | Normalise the later section to `LIFE@ZURU` in the generated template |
| Benefits and close | `WHAT WE OFFER`, then ZURU sign-off | `WHAT WE OFFER`, then ZURU sign-off | Include only confirmed offers or support, then use the shared sign-off |

The renderer offers `standard` and `specialist` heading variants. Both use a restrained white page, grey body text, clear title and metadata, bold section headings, generous spacing and readable responsibility bullets.

The PDF renderer uses the web-sized `resources/zuru-logo.png` asset. It is bundled with every Gotenberg conversion request and placed at the top of the JD, hiring guide, and candidate evidence report.

## Writing conventions

- Speak to the candidate using you/your and we/our where natural.
- Open with an invitation tied to the actual work; explain scope and impact in the purpose paragraph.
- Begin responsibilities with concrete action verbs and describe what the person will deliver or own.
- Use concise paragraphs, specific bullets and British/New Zealand spelling.
- Show seniority through scope and independence, not generic superlatives.
- Use restrained emojis only when useful; they are not mandatory.
- Maintain distinctions such as experience in at least one advertising platform, rather than accidentally requiring all platforms.
- Do not introduce degree requirements, years of experience or fixed-term dates merely because a sample contains them.

## Company and benefits content

The renderer supplies one fixed **About ZURU** paragraph based on the mission and three-division language shared by the supplied examples. The model cannot rewrite this block for individual roles. A fixed, concise `LIFE@ZURU` paragraph follows the role-specific requirements.

This reference-derived prototype copy must still be checked by TA before publication. It deliberately excludes historical employee counts, location counts, rankings, brand lists, founders and unsupported growth claims that could become stale.

Benefits must come from the manager's confirmed facts. Health benefits, office refreshments, global opportunities and remuneration language in the senior example are not automatically applicable to an internship. When benefits are unconfirmed, omit the offer section unless confirmed training/support is present, and put a reminder in the internal guide.

## Deliberate cleanup

- Do not reproduce browser print timestamps, page counters, Lever links, recruiter tracking tags, repeated company introductions or source typos.
- Do not copy the Community Manager sample's conflicting Toys/Edge header without clarification.
- Do not copy the senior sample's Performance Specialist/Media Specialist title inconsistency.
- Keep unresolved questions and publication checks in the internal guide. The candidate-facing draft retains a small draft label only.

The prompts and formatting rules are embedded in the exported workflows. n8n does not reread the reference PDFs at runtime. If the approved examples or writing rules change, update and re-export the affected n8n workflow.
