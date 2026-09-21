import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflow=JSON.parse(fs.readFileSync(path.join(root,'workflows/01-hiring-pack-generator.json'),'utf8'));

const readinessInputs=(overrides={})=>({
 role_context:'confirmed',outcomes:'confirmed',responsibilities_boundaries:'confirmed',
 capability_priorities:'confirmed',role_specific_evidence:'confirmed',collaboration_support:'confirmed',
 candidate_evidence:'confirmed',working_behaviours:'confirmed',logistics_decisions:'confirmed',...overrides
});

function pack(employmentType='internship') {
 return {
  kind:'hiring_pack',
  role:{title:employmentType==='permanent_full_time'?'Brand Designer':'AI Integration Intern',team:'Technology',level:employmentType==='permanent_full_time'?'Experienced':'Intern',location:'Auckland, New Zealand',arrangement:'Onsite',contract:'Incorrect source value',employment_type:employmentType,outcomes:['Ship an automation pilot','Document the workflow','Train the receiving team'],trainable:['Internal systems'],open_questions:[]},
  jd:{intro:'Build useful systems with ZURU.',purpose:'Turn practical opportunities into measurable improvements.',responsibilities:['Map current processes','Build and test a pilot','Document adoption guidance'],essential:['Clear problem solving','Evidence of delivery'],preferred:['Workflow automation experience']},
  criteria:Array.from({length:4},(_,i)=>({id:'C'+(i+1),name:['Problem solving','Delivery','Collaboration','Learning'][i],priority:i===3?'preferred':'essential',reason:'Supports reliable role outcomes',dna:'',anchors:{'1':'Below agreed standard','2':'Partially meets the standard','3':'Meets the agreed standard','4':'Exceeds the agreed standard'},green_flags:['Uses a specific example'],concerns:['Cannot explain personal contribution']})),
  questions:Array.from({length:5},(_,i)=>({id:'Q'+(i+1),criterion_ids:['C'+(i%4+1)],text:'Describe relevant evidence '+(i+1)})),
  human_review:['TA approves the rubric before use'],
  readiness_inputs:readinessInputs()
 };
}

const asBuffer=async(buffer,fileName,mimeType)=>({data:buffer.toString('base64'),fileName,mimeType});
async function runCode(name,item,upstream={}) {
 const script=workflow.nodes.find(node=>node.name===name).parameters.jsCode;
 const inputItems=Array.isArray(item)?item:[item];
 const asItems=value=>Array.isArray(value)?value:(value && (value.json || value.binary)?[value]:[{json:value}]);
 const context={Buffer,Date,$input:{first:()=>inputItems[0],all:()=>inputItems},$execution:{id:'readiness-test'},$:nodeName=>({first:()=>asItems(upstream[nodeName])[0],all:()=>asItems(upstream[nodeName])})};
 const fn=vm.runInNewContext('(async function(){'+script+'\n})',context);
 return fn.call({helpers:{prepareBinaryData:asBuffer}});
}

async function generate(candidatePack) {
 return runCode('Validate and render hiring pack',{json:{output:JSON.stringify(candidatePack)}},{'Authorize and route Telegram message':{command:'CONFIRM BRIEF AND GENERATE'}});
}

test('hiring assistant is a canonical inactive export with unique identifiers',()=>{
 assert.equal(workflow.active,false);
 assert.equal(workflow.name,'HMIS 01 — Hiring pack generator');
 assert.deepEqual(new Set(workflow.nodes.map(node=>node.id)).size,workflow.nodes.length);
 assert.ok(workflow.nodes.find(node=>node.type==='n8n-nodes-base.telegramTrigger').webhookId);
});

test('hiring assistant normalises internship seasonality and calculates readiness deterministically',async()=>{
 const candidatePack=pack('internship');
 candidatePack.role.contract='January 2027 for 16 weeks';
 candidatePack.readiness_inputs.logistics_decisions='partial';
 const output=(await generate(candidatePack))[0];
 assert.equal(output.json.pack.role.contract,'12-week summer internship commencing mid-November');
 assert.equal(output.json.readiness.score,95);
 assert.equal(output.json.readiness.label,'Ready for TA review');
 assert.match(output.json.readiness.method,/not a manager performance score/i);
 const bundle=JSON.parse(Buffer.from(output.binary.rubric.data,'base64').toString());
 assert.equal(bundle.pack.readiness_inputs,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(bundle.readiness)),JSON.parse(JSON.stringify(output.json.readiness)));
});

test('hiring assistant removes dates from the permanent full-time contract and blocks dated candidate copy',async()=>{
 const candidatePack=pack('permanent_full_time');
 candidatePack.role.contract='Starts 15 November 2026';
 candidatePack.role.open_questions=['Start date','Portfolio review owner'];
 const output=(await generate(candidatePack))[0];
 assert.equal(output.json.pack.role.contract,'Permanent full-time');
 assert.deepEqual(Array.from(output.json.pack.role.open_questions),['Portfolio review owner']);
 assert.equal(output.json.readiness.score,95);

 const dated=pack('permanent_full_time');
 dated.jd.purpose='Join the permanent team starting November 2026.';
 await assert.rejects(generate(dated),/must not include employment dates or programme years/);
 const datedGuide=pack('permanent_full_time');
 datedGuide.human_review=['Confirm the start date in December'];
 await assert.rejects(generate(datedGuide),/must not include employment dates or programme years/);
});

test('readiness flags vague areas and completion message explains the human checkpoint',async()=>{
 const candidatePack=pack('internship');
 candidatePack.role.outcomes=['Help the team'];
 candidatePack.readiness_inputs=readinessInputs({outcomes:'confirmed',candidate_evidence:'unknown',working_behaviours:'conflicting'});
 const source=(await generate(candidatePack))[0];
 assert.equal(source.json.readiness.areas.outcomes,'partial');
 assert.equal(source.json.readiness.score,74);
 assert.equal(source.json.readiness.label,'Requirements need refinement');
 assert.ok(source.json.readiness.needs_attention.some(value=>value.includes('Candidate evidence')));
 const pdf={data:Buffer.from('%PDF mock').toString('base64'),fileName:'document.pdf',mimeType:'application/pdf'};
 const result=(await runCode('Collect hiring pack',[
  {json:{document_key:'jd'},binary:{pdf}},
  {json:{document_key:'hiring_guide'},binary:{pdf}}
 ],{'Validate and render hiring pack':source}))[0];
 assert.match(result.json.output,/Hiring Brief Readiness: 74\/100/);
 assert.match(result.json.output,/TA approval is still required/);
});
