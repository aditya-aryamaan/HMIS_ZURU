import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=fs.readFileSync(path.join(root,'workflows/runtime.js'),'utf8');
const hiringPrompt=fs.readFileSync(path.join(root,'prompts/hiring-manager.md'),'utf8');
const api=vm.runInNewContext(runtime+';({validatePack,validateEvaluation,renderJD,renderRubric,renderEvaluation,renderGoogleJDText,renderGoogleRubricText})');
const readWorkflow=f=>JSON.parse(fs.readFileSync(path.join(root,'workflows',f),'utf8'));
const evaluator=readWorkflow('02-candidate-evaluator.json');
const telegram=readWorkflow('01-hiring-pack-generator.json');
function fixture(){return {kind:'hiring_pack',role:{title:'Marketing Intern',team:'Marketing',level:'Intern',location:'Auckland, New Zealand',arrangement:'Onsite',contract:'12 weeks',outcomes:['Three video drafts weekly'],trainable:['Brand templates'],open_questions:['Start date']},jd:{intro:'Create content with us.',purpose:'Support summer campaigns.',responsibilities:['Draft videos'],essential:['Basic editing'],preferred:['Design software']},criteria:Array.from({length:4},(_,i)=>({id:'C'+(i+1),name:['Editing','Experimentation','Collaboration','Design'][i],priority:i===3?'preferred':'essential',reason:'Supports content delivery',dna:'',anchors:{'1':'Below agreed standard','2':'Partial demonstration','3':'Meets agreed standard','4':'Exceeds agreed standard'},green_flags:['Explains contribution'],concerns:['Contradictory description needing clarification']})),questions:Array.from({length:5},(_,i)=>({id:'Q'+(i+1),criterion_ids:['C'+(i%4+1)],text:'Describe example '+(i+1)})),human_review:['TA must approve rubric']};}
function assessment(){return {assessments:Array.from({length:4},(_,i)=>({criterion_id:'C'+(i+1),status:'assessed',score:3,confidence:'medium',confidence_basis:'Direct evidence is relevant but lacks outcome detail.',rationale:'Specific action but limited measurement',evidence:['I edited three videos.'],green_flags:['Completed work'],concerns:[],review_action:'None required.'}))};}
const answers='Q1: I edited three videos. Q2: I asked for feedback.';
const asBuffer=async(buf,fileName,mimeType)=>({data:buf.toString('base64'),fileName,mimeType});
async function runCode(w,name,item,upstream={},helperOverrides={}) {
 const script=w.nodes.find(n=>n.name===name).parameters.jsCode;
 const inputItems=Array.isArray(item)?item:[item];
 const asItems=value=>Array.isArray(value)?value:(value && (value.json || value.binary)?[value]:[{json:value}]);
 const ctx={Buffer,Date,$input:{first:()=>inputItems[0],all:()=>inputItems},$execution:{id:'test-execution'},$:name=>({first:()=>asItems(upstream[name])[0],all:()=>asItems(upstream[name])})};
 const fn=vm.runInNewContext('(async function(){'+script+'\n})',ctx);
 return fn.call({helpers:{prepareBinaryData:asBuffer,...helperOverrides}});
}
test('pack validation accepts a complete consistent contract',()=>assert.equal(api.validatePack(fixture()).role.title,'Marketing Intern'));
test('unknown question references and uncovered criteria fail',()=>{
 const p=fixture();p.questions[0].criterion_ids=['C99'];assert.throws(()=>api.validatePack(p),/unknown criterion/);
 const q=fixture();q.questions.forEach(x=>x.criterion_ids=['C1']);assert.throws(()=>api.validatePack(q),/Every criterion/);
});
test('invalid priorities, repeated anchors, and wrong question count fail',()=>{
 const p=fixture();p.criteria[0].priority='nice';assert.throws(()=>api.validatePack(p),/priority/);
 const q=fixture();q.criteria[0].anchors['2']=q.criteria[0].anchors['1'];assert.throws(()=>api.validatePack(q),/distinct/);
 const r=fixture();r.questions.pop();assert.throws(()=>api.validatePack(r),/5-7/);
});
test('HTML rendering escapes malicious model or candidate text',()=>{
 const p=fixture();p.role.title='<script>alert(1)</script>';const html=api.renderJD(p,'test');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
 const e=assessment();e.assessments[0].rationale='<img src=x onerror=alert(1)>';assert.ok(!api.renderEvaluation(e,p,{candidate:'A',reviewer:'TA',rubric_id:'test'}).includes('<img src=x'));
});
test('all rendered PDF documents reference the bundled ZURU logo',()=>{
 assert.match(api.renderJD(fixture(),'test'),/<img class="document-logo" src="zuru-logo\.png" alt="ZURU">/);
 assert.match(api.renderRubric(fixture(),'test'),/<img class="document-logo" src="zuru-logo\.png" alt="ZURU">/);
 assert.match(api.renderEvaluation(assessment(),fixture(),{candidate:'A',reviewer:'TA',rubric_id:'test'}),/<img class="document-logo" src="zuru-logo\.png" alt="ZURU">/);
 const logo=fs.readFileSync(path.join(root,'resources/zuru-logo.png'));
 assert.equal(logo.subarray(1,4).toString(),'PNG');assert.ok(logo.length<100000);
});
test('JD follows reference section order and keeps internal issues in the guide',()=>{
 const p=fixture();p.jd.style='standard';p.jd.offers=['Weekly mentoring'];
 const html=api.renderJD(p,'test');
 const titles=['About ZURU','YOUR ROLE',"WHAT YOU&#39;LL DO","WHAT YOU&#39;LL BRING",'LIFE@ZURU','WHAT WE OFFER'];
 let previous=-1;for(const title of titles){const index=html.indexOf('<h2>'+title+'</h2>');assert.ok(index>previous,title);previous=index;}
 assert.ok(!html.includes('Start date'));assert.ok(!html.includes('Before publication'));
 assert.ok(api.renderRubric(p,'test').includes('Start date'));
 assert.ok(html.includes('Weekly mentoring'));assert.ok(!html.includes('Health &amp; Well'));
 const editable=api.renderGoogleJDText(p,'test');assert.ok(editable.includes('ABOUT ZURU'));assert.ok(editable.includes('Weekly mentoring'));assert.ok(!editable.includes('Start date'));
 const guide=api.renderGoogleRubricText(p,'test');assert.ok(guide.includes('Start date'));assert.ok(guide.includes('EDITING RULE'));
});
test('About ZURU is fixed across standard and specialist job descriptions',()=>{
 const standard=fixture();standard.jd.style='standard';
 const specialist=fixture();specialist.jd.style='specialist';specialist.jd.intro='Different role-specific hook';
 const fixed='ZURU is on a mission to disrupt industries, challenge the status quo, and catalyse change through radical innovation and advances in automation.';
 const a=api.renderJD(standard,'A'),b=api.renderJD(specialist,'B');
 assert.ok(a.includes(fixed));assert.ok(b.includes(fixed));
 assert.ok(!a.includes('5,000'));assert.ok(!a.includes('30 international locations'));assert.ok(!a.includes('Nick and Mat'));
});
test('specialist headings and absent benefits work with earlier rubric bundles',()=>{
 const p=fixture();p.jd.style='specialist';p.role.trainable=[];
 const html=api.renderJD(p,'test');assert.ok(html.includes('ROLE PURPOSE'));assert.ok(html.includes('Roles &amp; Responsibilities'));assert.ok(html.includes('Skills &amp; Experience'));assert.ok(!html.includes('WHAT WE OFFER'));assert.ok(api.renderRubric(p,'test').includes('No role-specific benefits'));
 p.jd.style='invented';assert.throws(()=>api.validatePack(p),/Unknown JD style/);
});
test('evaluation requires real quotes, valid scores, and unique full coverage',()=>{
 assert.equal(api.validateEvaluation(assessment(),fixture(),answers).assessments.length,4);
 const e=assessment();e.assessments[0].evidence=['I managed 100 people.'];assert.throws(()=>api.validateEvaluation(e,fixture(),answers),/not present/);
 const f=assessment();f.assessments[0].score=5;assert.throws(()=>api.validateEvaluation(f,fixture(),answers),/1-4/);
 const g=assessment();g.assessments[1].criterion_id='C1';assert.throws(()=>api.validateEvaluation(g,fixture(),answers),/duplicate/);
});
test('missing evidence must be unscored with low confidence',()=>{
 const e=assessment();Object.assign(e.assessments[0],{status:'insufficient_evidence',score:null,confidence:'low',evidence:[]});api.validateEvaluation(e,fixture(),answers);
 e.assessments[0].score=1;assert.throws(()=>api.validateEvaluation(e,fixture(),answers),/null score/);
});
function formItem(approved=true){return {json:{'Candidate name':'Demo Candidate',Reviewer:'Demo TA','Rubric approval':approved?'I reviewed and approve this rubric':'Not approved','Evidence source':'Pasted candidate answers','Candidate answers or interviewer notes':answers},binary:{Rubric_file:{fileName:'role-rubric.json'}}};}
test('evaluator stops unapproved and invalid files before model',async()=>{
 await assert.rejects(runCode(evaluator,'Validate submission',formItem(false)),/approve this rubric/);
 await assert.rejects(runCode(evaluator,'Validate submission',formItem(),{},{getBinaryDataBuffer:async()=>Buffer.from('invalid')}),/not valid JSON/);
});
test('evaluator accepts rubric bundle and records reviewer plus snapshot',async()=>{
 const out=await runCode(evaluator,'Validate submission',formItem(),{},{getBinaryDataBuffer:async()=>Buffer.from(JSON.stringify({schema_version:1,rubric_id:'DEMO-1',pack:fixture()}))});
 assert.equal(out[0].json.reviewed.candidate,'Demo Candidate');assert.equal(out[0].json.reviewed.reviewer,'Demo TA');assert.equal(out[0].json.pack.criteria.length,4);assert.ok(out[0].json.evaluationInput.includes('I edited three videos.'));
 assert.equal(out[0].json.reviewed.confidence_ceiling,'medium');
});
test('evaluator extracts only candidate-labelled VTT turns and sets source confidence',async()=>{
 const item=formItem();item.json['Evidence source']='Teams transcript';item.json['Candidate answers or interviewer notes']='';item.binary.Interview_evidence_file={fileName:'teams-transcript.vtt'};
 const rubric=Buffer.from(JSON.stringify({schema_version:1,rubric_id:'DEMO-1',pack:fixture()}));
 const transcript='WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<v Interviewer>What did you create?</v>\n\n00:00:03.000 --> 00:00:05.000\n<v Demo Candidate>I edited three videos.</v>\n\n00:00:06.000 --> 00:00:08.000\nCandidate: I asked for feedback.';
 const out=await runCode(evaluator,'Validate submission',item,{},{getBinaryDataBuffer:async(_i,key)=>key==='Rubric_file'?rubric:Buffer.from(transcript)});
 assert.equal(out[0].json.reviewed.source,'Teams transcript');assert.equal(out[0].json.reviewed.confidence_ceiling,'high');assert.match(out[0].json.reviewed.attribution,/Automatically matched/);
 assert.match(out[0].json.answers,/I edited three videos/);assert.match(out[0].json.answers,/I asked for feedback/);assert.doesNotMatch(out[0].json.answers,/What did you create/);
});
test('evaluator rejects evidence-source mismatches before AI',async()=>{
 const rubric=Buffer.from(JSON.stringify({schema_version:1,rubric_id:'DEMO-1',pack:fixture()}));
 const transcriptWithoutFile=formItem();transcriptWithoutFile.json['Evidence source']='Teams transcript';
 await assert.rejects(runCode(evaluator,'Validate submission',transcriptWithoutFile,{},{getBinaryDataBuffer:async()=>rubric}),/require a TXT or VTT/);
 const wrongSpeaker=formItem();wrongSpeaker.json['Evidence source']='Teams transcript';wrongSpeaker.binary.Interview_evidence_file={fileName:'teams-transcript.vtt'};
 await assert.rejects(runCode(evaluator,'Validate submission',wrongSpeaker,{},{getBinaryDataBuffer:async(_i,key)=>key==='Rubric_file'?rubric:Buffer.from('WEBVTT\n\nOther Person: I edited three videos.')}),/No transcript turns matched/);
});
test('report strips unsolicited hiring verdict and retains evidence',async()=>{
 const e=assessment();e.verdict='Hire';const out=await runCode(evaluator,'Validate and render assessment',{json:{output:JSON.stringify(e)}},{'Validate submission':{pack:fixture(),answers,reviewed:{candidate:'A',reviewer:'TA',rubric_id:'DEMO-1'}}});
 assert.equal(out[0].json.evaluation.verdict,undefined);assert.equal(out[0].json.decision_status,'awaiting_human_review');assert.equal(out[0].binary.report.mimeType,'text/html');
 assert.equal(out[0].json.evaluation.assessments[0].review_priority,'low');assert.match(out[0].json.reportHtml,/Applied rubric anchor/);assert.match(out[0].json.reportHtml,/Confidence basis/);assert.match(out[0].json.reportHtml,/Review-priority basis/);assert.doesNotMatch(out[0].json.reportHtml,/Reviewer action/);
});
test('review priority accounts for essential-criterion evidence and only shows required actions',async()=>{
 const e=assessment();Object.assign(e.assessments[0],{score:2,review_action:'Verify the success metric in the interviewer notes.'});
 const out=await runCode(evaluator,'Validate and render assessment',{json:{output:JSON.stringify(e)}},{'Validate submission':{pack:fixture(),answers,reviewed:{candidate:'A',reviewer:'TA',rubric_id:'DEMO-1'}}});
 assert.equal(out[0].json.evaluation.assessments[0].review_priority,'medium');assert.match(out[0].json.evaluation.assessments[0].review_reason,/essential criterion/);assert.match(out[0].json.reportHtml,/Reviewer action/);
});
test('evaluator PDF branch returns a named PDF and rejects non-PDF responses',async()=>{
 const source={json:{decision_status:'awaiting_human_review'},binary:{report:await asBuffer(Buffer.from('<html>report</html>'),'candidate-evidence-review.html','text/html')}};
 const prepared=await runCode(evaluator,'Prepare report PDF',source);
 assert.equal(prepared[0].binary.html.fileName,'index.html');
 assert.equal(prepared[0].binary.logo.fileName,'zuru-logo.png');
 const pdf=Buffer.from('%PDF-1.7 mock');
 const out=await runCode(evaluator,'Download assessment PDF',{json:{},binary:{pdf:{}}},{'Validate and render assessment':source},{getBinaryDataBuffer:async()=>pdf});
 assert.equal(out[0].binary.report.fileName,'candidate-evidence-review.pdf');assert.equal(out[0].binary.report.mimeType,'application/pdf');
 await assert.rejects(runCode(evaluator,'Download assessment PDF',{json:{},binary:{pdf:{}}},{'Validate and render assessment':source},{getBinaryDataBuffer:async()=>Buffer.from('<html>error</html>')}),/did not return a PDF/);
});
function configuredTelegram(){
 const copy=structuredClone(telegram);
 const router=copy.nodes.find(n=>n.name==='Authorize and route Telegram message');
 router.parameters.jsCode=router.parameters.jsCode
  .replace('REPLACE_WITH_APPROVED_TELEGRAM_USER_ID','424242')
  .replace('REPLACE_WITH_WORKFLOW_02_PRODUCTION_FORM_URL','https://example.test/form/evaluator');
 return copy;
}
function telegramMessage(text){return {json:{message:{message_id:10,text,chat:{id:99},from:{id:424242}}}};}
function telegramCallback(data){return {json:{callback_query:{id:'callback-1',data,from:{id:424242},message:{message_id:10,chat:{id:99}}}}};}
test('Telegram inline buttons map to the same deterministic routes as typed commands',async()=>{
 const w=configuredTelegram();
 const start=await runCode(w,'Authorize and route Telegram message',telegramMessage('/start'));
 assert.equal(start[0].json.keyboard,'menu');assert.equal(start[0].json.use_ai,false);
 const hiring=await runCode(w,'Authorize and route Telegram message',telegramCallback('HMIS_MENU_1'));
 assert.equal(hiring[0].json.command,'1');assert.equal(hiring[0].json.use_ai,true);assert.equal(hiring[0].json.is_callback,true);
 const evaluation=await runCode(w,'Authorize and route Telegram message',telegramCallback('HMIS_MENU_2'));
 assert.equal(evaluation[0].json.use_ai,false);assert.match(evaluation[0].json.reply,/https:\/\/example\.test\/form\/evaluator/);
 const confirm=await runCode(w,'Authorize and route Telegram message',telegramCallback('HMIS_CONFIRM'));
 assert.equal(confirm[0].json.command,'CONFIRM BRIEF AND GENERATE');assert.equal(confirm[0].json.callback_query_id,'callback-1');
});
test('Telegram replies escape HTML and select only the required inline keyboard',async()=>{
 const ordinary=await runCode(telegram,'Prepare Telegram reply',{json:{output:'**Must-have**: R&D <script> A_B'}});
 assert.match(ordinary[0].json.reply,/R&amp;D &lt;script&gt; A_B/);assert.equal(ordinary[0].json.keyboard,'none');
 const menu=await runCode(telegram,'Prepare Telegram reply',{json:{reply:'Choose',keyboard:'menu'}});assert.equal(menu[0].json.keyboard,'menu');
 const confirm=await runCode(telegram,'Prepare Telegram reply',{json:{output:'Review this, then use CONFIRM BRIEF AND GENERATE'}});assert.equal(confirm[0].json.keyboard,'confirm');
 const send=telegram.nodes.find(n=>n.name==='Send Telegram reply');assert.equal(send.parameters.additionalFields.parse_mode,'HTML');
 const menuNode=telegram.nodes.find(n=>n.name==='Send Telegram menu');assert.equal(menuNode.parameters.replyMarkup,'inlineKeyboard');assert.equal(menuNode.parameters.inlineKeyboard.rows.length,2);
 const confirmNode=telegram.nodes.find(n=>n.name==='Send Telegram confirmation');assert.equal(confirmNode.parameters.inlineKeyboard.rows[0].row.buttons[0].additionalFields.callback_data,'HMIS_CONFIRM');
 const trigger=telegram.nodes.find(n=>n.name==='Telegram message received');assert.deepEqual(trigger.parameters.updates,['message','callback_query']);
 const ack=telegram.nodes.find(n=>n.name==='Acknowledge Telegram button');assert.equal(ack.parameters.operation,'answerQuery');
});
test('hiring interview defines nine fixed adaptive discovery areas',()=>{
 const numbered=[...hiringPrompt.matchAll(/^([1-9])\. /gm)].map(match=>Number(match[1]));
 assert.deepEqual(numbered,[1,2,3,4,5,6,7,8,9]);
 assert.match(hiringPrompt,/coverage is fixed; the wording and follow-ups adapt/i);
 assert.match(hiringPrompt,/ask only for missing or ambiguous information/i);
});
test('Telegram review canvas contains no inherited WhatsApp node names',()=>{
 assert.ok(telegram.nodes.every(node=>!node.name.includes('WhatsApp')));
 assert.ok(Object.keys(telegram.connections).every(name=>!name.includes('WhatsApp')));
});
test('exports are inactive, independent and contain valid connection references',()=>{
 for(const w of [evaluator,telegram]) {
  assert.equal(w.active,false);assert.equal(w.id,undefined);assert.equal(w.versionId,undefined);
  const names=new Set(w.nodes.map(n=>n.name));assert.equal(names.size,w.nodes.length);
  for(const [source,connections] of Object.entries(w.connections)){assert.ok(names.has(source));for(const groups of Object.values(connections))for(const edges of groups)for(const edge of edges)assert.ok(names.has(edge.node));}
  for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new vm.Script('(async function(){'+n.parameters.jsCode+'})'));
  assert.ok(!JSON.stringify(w).includes('sk-or-v1-'));
 }
 assert.ok(!evaluator.nodes.some(n=>n.type.endsWith('.memoryBufferWindow')));
});
test('PDF nodes use the local converter and never expose it on a host port',()=>{
 for(const w of [evaluator,telegram]) for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest')) {
  assert.equal(n.parameters.url,'http://gotenberg:3000/forms/chromium/convert/html');
  assert.equal(n.parameters.contentType,'multipart-form-data');
  assert.ok(n.parameters.bodyParameters.parameters.some(p=>p.parameterType==='formBinaryData' && p.inputDataFieldName==='html'));
  assert.ok(n.parameters.bodyParameters.parameters.some(p=>p.parameterType==='formBinaryData' && p.inputDataFieldName==='logo'));
  assert.equal(n.parameters.options.response.response.responseFormat,'file');
  assert.equal(n.parameters.options.response.response.outputPropertyName,'pdf');
 }
 const compose=fs.readFileSync(path.join(root,'n8n/compose.yml'),'utf8');
 const service=compose.slice(compose.indexOf('  gotenberg:'),compose.indexOf('  sandbox-certs:'));
 assert.match(service,/gotenberg\/gotenberg:8/);assert.doesNotMatch(service,/ports:/);
 const tunnel=compose.slice(compose.indexOf('  cloudflared:'),compose.indexOf('  gotenberg:'));
 assert.match(tunnel,/profiles: \['telegram'\]/);assert.match(tunnel,/http:\/\/n8n:5678/);assert.doesNotMatch(tunnel,/ports:/);
});
