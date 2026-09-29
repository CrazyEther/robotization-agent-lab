import {describe,it,expect} from 'vitest';
import {createScenario} from '../ris/contracts';
import {compileAgentScenario,defaultOperations,runAgentStudy} from './model';
function setup(){
 const input=createScenario('factory');
 input.workload.shiftHours=1;
 const operations=defaultOperations(input);
 return {input,operations,replications:5,clearanceMeters:.15,reworkProbability:0};
}
describe('Independent agent-process modeling',()=>{
 it('builds a real transport-process chain from the source model',()=>{
  const model=compileAgentScenario(setup());
  expect(model.process.nodes.map(n=>n.kind)).toEqual(['source','process','process','sink']);
  expect(model.process.edges.map(e=>e.mode)).toEqual(['transport','transport','transport']);
  expect(model.facility.floors[0].objects.filter(o=>o.kind==='machine')).toHaveLength(2);
 });
 it('runs transport and both processing stations in one trace and experiment',()=>{
  const study=runAgentStudy(setup());
  expect(study.run.metrics.completed).toBeGreaterThan(0);
  expect(study.run.metrics.transportDistanceMeters).toBeGreaterThan(0);
  expect(study.run.trace.events.some(e=>e.type==='process.started'&&e.resourceId==='machine-2')).toBe(true);
  expect(study.run.trace.events.some(e=>e.type==='robot.motion')).toBe(true);
  expect(study.experiment.replications).toBe(5);
  expect(study.experiment.metrics.completed.mean).not.toBeNull();
 });
 it('processing bottleneck affects computed throughput',()=>{
  const input=setup();
  const fast=runAgentStudy({...input,operations:input.operations.map((o,i)=>i?o:{...o,durationSeconds:15})});
  const slow=runAgentStudy({...input,operations:input.operations.map((o,i)=>i?o:{...o,durationSeconds:600})});
  expect(fast.run.metrics.completed).toBeGreaterThan(slow.run.metrics.completed);
 });
 it('supports conditional rework with stochastic service times',()=>{
  const config=setup();
  config.operations[0].stochastic=true;
  const study=runAgentStudy({...config,reworkProbability:.2});
  expect(study.scenario.process.edges.some(e=>e.probability===.2)).toBe(true);
  expect(study.run.trace.events.some(e=>e.type==='task.completed')).toBe(true);
 });
 it('rejects an infeasible payload instead of pretending the robot can carry it',()=>{
  const config=setup();
  config.input.workload.loadKg=config.input.robot.payloadKg+1;
  expect(()=>runAgentStudy(config)).toThrow(/payload|load/i);
 });
});
