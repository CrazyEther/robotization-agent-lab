import {describe,it,expect} from 'vitest';
import app from '../apps/api/app';
import {createScenario} from '../packages/ris/contracts';
import {defaultOperations} from '../packages/agent-studio/model';
const input=createScenario('warehouse');
input.workload.shiftHours=1;
const body={input,operations:defaultOperations(input),clearanceMeters:.15,replications:5,reworkProbability:0};
describe('public agent study endpoints',()=>{
 it('has a self-describing API with stated computational limits',async()=>{
  const response=await app.request('/api/v1/agent/health');
  expect(response.status).toBe(200);
  const data=await response.json();
  expect(data.engine).toBe('simcore-process');
  expect(data.limits.maxJobs).toBe(90);
 });
 it('executes the model rather than supplying fabricated KPIs',async()=>{
  const response=await app.request('/api/v1/agent/study',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  const data=await response.json();
  expect(data.run.metrics.completed).toBeGreaterThan(0);
  expect(data.run.trace.scenarioHash).toBe(data.scenarioHash);
  expect(data.experiment.replications).toBe(5);
  expect(data.run.trace.events.some((e:{type:string})=>e.type==='robot.motion')).toBe(true);
 });
 it('refuses unbounded public compute load',async()=>{
  const response=await app.request('/api/v1/agent/study',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({...body,input:{...input,workload:{...input.workload,demandPerHour:300}}})});
  expect(response.status).toBe(422);
 });
 it('does not accept fake schema extensions',async()=>{
  const response=await app.request('/api/v1/agent/study',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({...body,untrusted:true})});
  expect(response.status).toBe(422);
 });
});
