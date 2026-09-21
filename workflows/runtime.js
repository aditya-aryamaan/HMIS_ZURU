// Shared validation/rendering helpers embedded in the exported n8n Code nodes.
function need(ok, message) { if (!ok) throw new Error(message); }
function txt(value, label, allowEmpty = false) {
  need(typeof value === 'string' && (allowEmpty || value.trim().length > 0) && value.length <= 20000, `Invalid ${label}`);
}
function texts(values, label, min = 0) {
  need(Array.isArray(values) && values.length >= min && values.length <= 100, `Invalid ${label}`);
  values.forEach(v => txt(v, label));
}
function parseModel(raw) {
  need(typeof raw === 'string', 'Model returned no text. Inspect its output and retry.');
  return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}
const dnaValues = ['', 'Good Humans Only', 'Shift the Needle', 'Compounding Improvement', 'Overprepare & Win', 'Radical Candour', 'Collaboration'];
const aboutZuru = 'ZURU is on a mission to disrupt industries, challenge the status quo, and catalyse change through radical innovation and advances in automation. This comes to life across three core divisions: ZURU Toys reimagines what it means to play; ZURU Tech is shaping a better future through the next building revolution; and ZURU Edge creates new-generation consumer brands to better serve modern consumers.';
const lifeAtZuru = 'At ZURU, teams work towards ambitious goals, learning and improving together. The culture emphasises ownership, collaboration and the opportunity to make a meaningful contribution.';
function validatePack(p) {
  need(p && p.kind === 'hiring_pack', 'Expected a hiring_pack object.');
  need(p.role && p.jd, 'Role and JD are required.');
  ['title','team','level','location','arrangement','contract'].forEach(k => txt(p.role[k], `role.${k}`));
  texts(p.role.outcomes, 'outcomes', 1); texts(p.role.trainable, 'trainable'); texts(p.role.open_questions, 'open_questions');
  txt(p.jd.intro,'JD introduction'); txt(p.jd.purpose,'JD purpose');
  texts(p.jd.responsibilities,'responsibilities',1); texts(p.jd.essential,'essentials',1); texts(p.jd.preferred,'preferences');
  // Optional fields preserve compatibility with the first exported rubric format.
  if(p.jd.style !== undefined) need(['standard','specialist'].includes(p.jd.style),'Unknown JD style.');
  if(p.jd.offers !== undefined) texts(p.jd.offers,'confirmed offers');
  need(Array.isArray(p.criteria) && p.criteria.length >= 4 && p.criteria.length <= 8, 'Provide 4-8 criteria.');
  const ids = new Set();
  for (const c of p.criteria) {
    need(/^C[1-9]\d*$/.test(c.id) && !ids.has(c.id), 'Criterion IDs must be unique C1, C2, etc.'); ids.add(c.id);
    txt(c.name,'criterion name'); txt(c.reason,'criterion reason');
    need(['essential','preferred'].includes(c.priority), 'Invalid criterion priority.');
    need(dnaValues.includes(c.dna), 'Unknown DNA value.');
    need(c.anchors && typeof c.anchors === 'object','Missing scoring anchors.');
    ['1','2','3','4'].forEach(k => txt(c.anchors[k], `anchor ${k}`));
    need(new Set(Object.values(c.anchors)).size === 4,'Scoring anchors must be distinct.');
    texts(c.green_flags,'green flags',1); texts(c.concerns,'concerns',1);
  }
  need(Array.isArray(p.questions) && p.questions.length >= 5 && p.questions.length <= 7, 'Provide 5-7 screening questions.');
  const qids = new Set(), covered = new Set();
  for (const q of p.questions) {
    need(/^Q[1-9]\d*$/.test(q.id) && !qids.has(q.id),'Question IDs must be unique.'); qids.add(q.id);
    txt(q.text,'question'); texts(q.criterion_ids,'question criteria',1);
    q.criterion_ids.forEach(id => { need(ids.has(id),'Question references unknown criterion.'); covered.add(id); });
  }
  need([...ids].every(id => covered.has(id)), 'Every criterion needs a screening question.');
  texts(p.human_review,'human review',1);
  return p;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function list(a) { return a.length ? '<ul>'+a.map(x => '<li>'+esc(x)+'</li>').join('')+'</ul>' : '<p>None specified.</p>'; }
function page(title, body) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{font:16px/1.55 system-ui,sans-serif;color:#20232a;max-width:900px;margin:48px auto;padding:0 24px}.document-logo{display:block;width:112px;height:auto;margin:0 0 28px}h1{border-top:8px solid #e4002b;padding-top:22px;font-size:32px}h2{margin-top:32px}h3{margin-top:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}small,.meta{color:#59616c}blockquote{border-left:3px solid #bbb;padding-left:16px} @media print{body{margin:16px;font-size:11pt}.document-logo{width:92px;margin-bottom:22px}h2,h3{break-after:avoid}tr{break-inside:avoid}}</style></head><body><img class="document-logo" src="zuru-logo.png" alt="ZURU"><h1>'+esc(title)+'</h1>'+body+'</body></html>';
}
function renderJD(p, id) {
  const specialist=p.jd.style==='specialist';
  const headings=specialist?['ROLE PURPOSE','Roles & Responsibilities','Skills & Experience']:['YOUR ROLE',"WHAT YOU'LL DO","WHAT YOU'LL BRING"];
  const known=v=>v && !/^(not specified|not decided|unknown|tbc|to be confirmed)$/i.test(v.trim());
  const details=[p.role.team,p.role.contract,p.role.arrangement].filter(known);
  const offers=[...new Set([...(p.jd.offers || []),...p.role.trainable])];
  const body='<p class="meta">DRAFT · '+esc(id)+'</p><p class="role-details">'+esc(p.role.location)+'</p><p class="role-details">'+esc(details.join(' / '))+'</p><p class="hook">'+esc(p.jd.intro)+'</p><h2>About ZURU</h2><p>'+esc(aboutZuru)+'</p><h2>'+esc(headings[0])+'</h2><p>'+esc(p.jd.purpose)+'</p><h2>'+esc(headings[1])+'</h2>'+list(p.jd.responsibilities)+'<h2>'+esc(headings[2])+'</h2><h3>Essential</h3>'+list(p.jd.essential)+(p.jd.preferred.length?'<h3>Preferred</h3>'+list(p.jd.preferred):'')+'<h2>LIFE@ZURU</h2><p>'+esc(lifeAtZuru)+'</p>'+(offers.length?'<h2>WHAT WE OFFER</h2>'+list(offers):'')+'<p class="signoff">ZURU - Reimagining tomorrow</p>';
  return page(p.role.title,body)
    .replace('</style>','.jd{max-width:760px;color:#55575b;line-height:1.8}.jd h1{border:0;font-size:34px;font-weight:500;line-height:1.2;margin:32px 0 22px;padding:0}.jd h2{font-size:18px;margin-top:36px}.jd h3{font-size:15px;margin:18px 0 8px}.jd li{padding-left:3px;margin-bottom:10px}.jd .role-details{font-weight:600;margin:4px 0;letter-spacing:.3px}.jd .hook{margin-top:38px}.jd .meta{font-size:11px}.jd .brand{display:inline-block;background:#e4002b;color:white;font-weight:800;font-size:26px;padding:10px 24px;letter-spacing:-1px}.jd .signoff{font-weight:600;margin-top:36px}@media print{.jd{font-size:10.5pt}.jd h1{font-size:25pt}.jd h2{font-size:13pt}.jd li{break-inside:avoid}} </style>')
    .replace('<body>','<body class="jd">');
}
function renderRubric(p, id) {
  p={...p,human_review:[...p.human_review,...p.role.open_questions,'Confirm company and culture wording against current approved copy before publication.',...((p.jd.offers || []).length?[]:['No role-specific benefits were confirmed. Verify applicable benefits before publication; sample benefits were not copied.'])]};
  return page('Hiring guide — '+p.role.title,'<p class="meta">DRAFT — human approval required · '+esc(id)+'</p><h2>Expected outcomes</h2>'+list(p.role.outcomes)+'<h2>Screening questions</h2>'+p.questions.map(q=>'<p><strong>'+esc(q.id)+'</strong> '+esc(q.text)+' <small>('+esc(q.criterion_ids.join(', '))+')</small></p>').join('')+'<h2>Assessment criteria</h2>'+p.criteria.map(c=>'<h3>'+esc(c.id)+' · '+esc(c.name)+' — '+esc(c.priority)+'</h3><p>'+esc(c.reason)+'</p>'+(c.dna?'<p>DNA behaviour: '+esc(c.dna)+'</p>':'')+'<table><tr><th>Score</th><th>Evidence anchor</th></tr>'+Object.entries(c.anchors).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>').join('')+'<tr><td>Not scored</td><td>Insufficient evidence; ask a follow-up.</td></tr></table><p><strong>Green flags</strong></p>'+list(c.green_flags)+'<p><strong>Concerns to clarify</strong></p>'+list(c.concerns)).join('')+'<h2>Human review</h2>'+list(p.human_review)+'<p>Missing evidence is not a red flag. Preferred skills are not rejection gates. Confidence describes evidence strength, not a probability of success. A human owns every hiring decision.</p>');
}
function docList(values) { return values.length ? values.map(x=>'• '+x).join('\n') : 'None specified.'; }
function renderGoogleJDText(p, id) {
  const specialist=p.jd.style==='specialist';
  const headings=specialist?['ROLE PURPOSE','ROLES & RESPONSIBILITIES','SKILLS & EXPERIENCE']:['YOUR ROLE',"WHAT YOU'LL DO","WHAT YOU'LL BRING"];
  const known=v=>v && !/^(not specified|not decided|unknown|tbc|to be confirmed)$/i.test(v.trim());
  const details=[p.role.location,p.role.team,p.role.contract,p.role.arrangement].filter(known).join(' · ');
  const offers=[...new Set([...(p.jd.offers || []),...p.role.trainable])];
  return [
    'ZURU',p.role.title,details,'DRAFT · '+id,'',p.jd.intro,'',
    'ABOUT ZURU',aboutZuru,'',
    headings[0],p.jd.purpose,'',headings[1],docList(p.jd.responsibilities),'',headings[2],
    'Essential',docList(p.jd.essential),...(p.jd.preferred.length?['','Preferred',docList(p.jd.preferred)]:[]),'',
    'LIFE@ZURU',lifeAtZuru,
    ...(offers.length?['','WHAT WE OFFER',docList(offers)]:[]),'','ZURU - Reimagining tomorrow'
  ].join('\n');
}
function renderGoogleRubricText(p, id) {
  const review=[...p.human_review,...p.role.open_questions,'Confirm company and culture wording against current approved copy before publication.',...((p.jd.offers || []).length?[]:['No role-specific benefits were confirmed. Verify applicable benefits before publication; sample benefits were not copied.'])];
  const criteria=p.criteria.map(c=>[
    c.id+' · '+c.name+' — '+c.priority,c.reason,...(c.dna?['DNA behaviour: '+c.dna]:[]),
    'Scoring anchors','1 — '+c.anchors['1'],'2 — '+c.anchors['2'],'3 — '+c.anchors['3'],'4 — '+c.anchors['4'],'Not scored — Insufficient evidence; ask a follow-up.',
    'Green flags',docList(c.green_flags),'Concerns to clarify',docList(c.concerns)
  ].join('\n')).join('\n\n');
  return [
    'HIRING GUIDE — '+p.role.title,'DRAFT — human approval required · '+id,
    'EDITING RULE','Wording and formatting can be adjusted here. If requirements, priorities, scoring anchors or interview questions change, update them through the hiring-manager workflow and regenerate the pack so the evaluator rubric stays aligned.','',
    'EXPECTED OUTCOMES',docList(p.role.outcomes),'','SCREENING QUESTIONS',p.questions.map(q=>q.id+' — '+q.text+' ('+q.criterion_ids.join(', ')+')').join('\n'),'','ASSESSMENT CRITERIA',criteria,'','HUMAN REVIEW',docList(review),'',
    'Missing evidence is not a red flag. Preferred skills are not rejection gates. Confidence describes evidence strength, not a probability of success. A human owns every hiring decision.'
  ].join('\n');
}
function validateEvaluation(e, p, answers) {
  need(e && Array.isArray(e.assessments) && e.assessments.length === p.criteria.length,'Evaluation must cover every criterion exactly once.');
  const ids = new Set(p.criteria.map(c=>c.id)), seen = new Set();
  for (const a of e.assessments) {
    need(ids.has(a.criterion_id) && !seen.has(a.criterion_id),'Unknown or duplicate evaluation criterion.'); seen.add(a.criterion_id);
    need(['assessed','insufficient_evidence'].includes(a.status),'Invalid evidence status.');
    need(['low','medium','high'].includes(a.confidence),'Invalid confidence.');
    if(a.status === 'insufficient_evidence') need(a.score === null && a.confidence === 'low','Missing evidence must have null score and low confidence.');
    else need(Number.isInteger(a.score) && a.score >= 1 && a.score <= 4,'Score must be 1-4.');
    txt(a.rationale,'rationale'); txt(a.confidence_basis,'confidence basis'); txt(a.review_action,'review action'); texts(a.evidence,'evidence',a.status==='assessed'?1:0);
    a.evidence.forEach(q=>need(answers.includes(q),'Evidence quote is not present in the candidate answers. Review model output.'));
    texts(a.green_flags,'green flags'); texts(a.concerns,'concerns');
  }
  return e;
}
function renderEvaluation(e,p,meta) {
  const provenance=meta.source?' · Source '+esc(meta.source)+' · Attribution '+esc(meta.attribution)+' · Confidence ceiling '+esc(meta.confidence_ceiling):'';
  return page('Candidate evidence review — '+meta.candidate,'<p class="meta">'+esc(p.role.title)+' · Rubric '+esc(meta.rubric_id)+' · Reviewer '+esc(meta.reviewer)+provenance+'</p><p>AI assessment awaiting human review. No hiring decision has been made.</p>'+e.assessments.map(a=>{const c=p.criteria.find(c=>c.id===a.criterion_id);const priority=a.review_priority || ((a.status==='insufficient_evidence' || a.confidence==='low')?'high':(a.concerns.length?'medium':'low'));const anchor=a.score===null?'No scoring anchor applied because evidence is insufficient.':c.anchors[String(a.score)];return '<h2>'+esc(c.name)+' — '+esc(c.priority)+'</h2><p><strong>'+(a.score===null?'Insufficient evidence':a.score+'/4')+'</strong> · Evidence confidence: '+esc(a.confidence)+' · Human-review priority: '+esc(priority)+'</p><p><strong>Applied rubric anchor:</strong> '+esc(anchor)+'</p><p>'+esc(a.rationale)+'</p><p><strong>Confidence basis:</strong> '+esc(a.confidence_basis)+'</p>'+a.evidence.map(q=>'<blockquote>'+esc(q)+'</blockquote>').join('')+'<p><strong>Green flags</strong></p>'+list(a.green_flags)+'<p><strong>Concerns to clarify</strong></p>'+list(a.concerns)+'<p><strong>Review-priority basis:</strong> '+esc(a.review_reason || 'Derived from evidence status, confidence and concerns.')+'</p>'+(a.review_action==='None required.'?'':'<p><strong>Reviewer action:</strong> '+esc(a.review_action)+'</p>');}).join('')+'<h2>Reviewer notes and decision</h2><p>Record corrections, additional evidence, and your decision in the review record. Confidence labels are evidence-strength categories, not calibrated probabilities or candidate-success predictions.</p>');
}
