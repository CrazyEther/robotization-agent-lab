import type {SimulationInput} from '../ris/contracts';
import {compileScenario,compileTransportNetwork,runProcessNetwork,runProcessExperiment,
 type SimulationScenarioV2,type ProcessRun,type ProcessExperiment} from '../simulation-core';

export type Operation={id:string;label:string;x:number;y:number;durationSeconds:number;capacity:number;transformsLoad:boolean;stochastic:boolean};
export type AgentConfiguration={input:SimulationInput;operations:Operation[];clearanceMeters:number;replications:number;reworkProbability:number};
export type AgentStudy={scenario:SimulationScenarioV2;run:ProcessRun;experiment:ProcessExperiment;
 routes:ReturnType<typeof compileTransportNetwork>;limitations:string[]};
const cell=(n:number)=>n+.5;
const free=(x:number,y:number,input:SimulationInput,r=.95)=>x>=1&&y>=1&&x<input.layout.width-1&&y<input.layout.height-1&&
 input.layout.obstacles.every(o=>x+.5<o.x-r||x+.5>o.x+o.w+r||y+.5<o.y-r||y+.5>o.y+o.h+r);
export function findFreeStation(input:SimulationInput,ratioX:number,ratioY:number,used:{x:number;y:number}[]=[]){
 const found=[] as {x:number;y:number;cost:number}[];
 for(let x=1;x<input.layout.width-1;x++)for(let y=1;y<input.layout.height-1;y++){
  if(!free(x,y,input)||used.some(p=>Math.hypot(p.x-x,p.y-y)<3))continue;
  found.push({x,y,cost:(x-input.layout.width*ratioX)**2+(y-input.layout.height*ratioY)**2});
 }
 found.sort((a,b)=>a.cost-b.cost);
 if(!found.length)throw new Error('Нет свободного места для технологического поста');
 return {x:found[0].x,y:found[0].y};
}
export function defaultOperations(input:SimulationInput):Operation[]{
 const a=findFreeStation(input,.42,.28,[input.layout.pickup,input.layout.dropoff]);
 const b=findFreeStation(input,.68,.63,[input.layout.pickup,input.layout.dropoff,a]);
 return [
  {id:'machine-1',label:'Технологическая обработка',...a,durationSeconds:110,capacity:1,transformsLoad:true,stochastic:false},
  {id:'machine-2',label:'Контроль и упаковка',...b,durationSeconds:45,capacity:1,transformsLoad:false,stochastic:false},
 ];
}
export function compileAgentScenario(c:AgentConfiguration):SimulationScenarioV2{
 const {input,operations,clearanceMeters,reworkProbability}=c;
 if(operations.length<1||operations.length>5)throw new RangeError('От 1 до 5 этапов');
 if(!Number.isFinite(clearanceMeters)||clearanceMeters<0||clearanceMeters>2)throw new RangeError('Зазор 0–2 м');
 if(!Number.isFinite(reworkProbability)||reworkProbability<0||reworkProbability>.6)throw new RangeError('Доля доработки 0–60%');
 const ids=new Set<string>();
 for(const op of operations){
  if(!op.id||ids.has(op.id))throw new Error('Повтор идентификатора поста');ids.add(op.id);
  if(!Number.isInteger(op.capacity)||op.capacity<1||op.capacity>50)throw new RangeError('Каналов поста 1–50');
  if(!Number.isFinite(op.durationSeconds)||op.durationSeconds<1||op.durationSeconds>86400)throw new RangeError('Операция 1–86400 с');
  if(!free(op.x,op.y,input))throw new Error('Рабочий пост пересекает препятствие или границу: '+op.label);
 }
 const objects:SimulationScenarioV2['facility']['floors'][number]['objects']=[
  ...input.layout.obstacles.map((o,i)=>({id:'obstacle-'+i,label:'Препятствие '+(i+1),kind:'wall' as const,
   geometry:{...o,rotationDeg:0},blocking:true,capacity:0,properties:{}})),
  {id:'source',label:'Зона поступления',kind:'station',geometry:{x:cell(input.layout.pickup.x)-.2,
   y:cell(input.layout.pickup.y)-.2,w:.4,h:.4,rotationDeg:0},blocking:false,capacity:1,properties:{}},
  {id:'sink',label:'Зона выгрузки',kind:'station',geometry:{x:cell(input.layout.dropoff.x)-.2,
   y:cell(input.layout.dropoff.y)-.2,w:.4,h:.4,rotationDeg:0},blocking:false,capacity:1,properties:{}},
  {id:'charger',label:'Зарядная зона',kind:'charger',geometry:{x:cell(input.layout.pickup.x)-.4,
   y:cell(input.layout.pickup.y)-.4,w:.8,h:.8,rotationDeg:0},blocking:false,
   capacity:input.robot.chargerCount,properties:{}},
  ...operations.map(op=>({id:op.id,label:op.label,kind:'machine' as const,
   geometry:{x:cell(op.x)-.3,y:cell(op.y)-.3,w:.6,h:.6,rotationDeg:0},
   blocking:false,capacity:op.capacity,properties:{}})),
 ];
 const nodes:SimulationScenarioV2['process']['nodes']=[
  {id:'input',kind:'source',label:'Поступление груза',facilityObjectId:'source',properties:{}},
  ...operations.map(op=>({id:'step-'+op.id,kind:'process' as const,label:op.label,facilityObjectId:op.id,
   ...(op.stochastic?{durationModel:{kind:'lognormal' as const,medianSeconds:op.durationSeconds,sigma:.28}}
     :{durationSeconds:op.durationSeconds}),properties:{transformsLoad:op.transformsLoad}})),
  ...(reworkProbability>0?[{id:'quality',kind:'decision' as const,label:'Контроль возврата',
   facilityObjectId:operations.at(-1)!.id,properties:{}}]:[]),
  {id:'output',kind:'sink',label:'Готовый груз',facilityObjectId:'sink',properties:{}},
 ];
 const edges:SimulationScenarioV2['process']['edges']=[
  {id:'first-leg',from:'input',to:'step-'+operations[0].id,mode:'transport'},
  ...operations.slice(0,-1).map((op,i)=>({id:'interstage-'+i,from:'step-'+op.id,
   to:'step-'+operations[i+1].id,mode:'transport' as const})),
  ...(reworkProbability>0?[
   {id:'quality-check',from:'step-'+operations.at(-1)!.id,to:'quality',mode:'flow' as const},
   {id:'rework-leg',from:'quality',to:'step-'+operations[0].id,mode:'transport' as const,probability:reworkProbability},
   {id:'outbound-leg',from:'quality',to:'output',mode:'transport' as const,probability:1-reworkProbability},
  ]:[{id:'outbound-leg',from:'step-'+operations.at(-1)!.id,to:'output',mode:'transport' as const}]),
 ];
 return compileScenario({
  schemaVersion:'ris-simulation-scenario/2',id:'agent-operations',name:'Агентный производственный поток',
  profile:input.sector,
  facility:{schemaVersion:'ris-facility/2',id:'facility',name:'Один уровень',unit:'m',
   source:{type:'template',name:'Демонстрационная планировка',geometryStatus:'reference',
    dimensionsConfirmed:false,siteSpecific:false},
   floors:[{id:'floor-1',label:'Уровень 1',zMeters:0,
    widthMeters:input.layout.width,heightMeters:input.layout.height,objects}]},
  process:{schemaVersion:'ris-process/1',id:'process',name:'Многоэтапный материальный поток',
   entityType:input.sector==='hospital'?'container':input.sector==='airport'?'baggage':'pallet',nodes,edges},
  robots:[{id:'amr',label:'AMR',fleetSize:input.robot.count,capacity:{payloadKg:input.robot.payloadKg},
   kinematics:{maxSpeedMps:input.robot.speedMps,accelerationMps2:.7,decelerationMps2:.7,turnRadiusM:0},
   dimensions:{lengthM:.75,widthM:.58,heightM:.5},
   battery:{capacityWh:input.robot.batteryWh,chargeW:input.robot.chargeW,
    whPerMeter:input.robot.whPerMeter,minSoc:.15},
   handling:{loadSeconds:input.robot.loadSeconds,unloadSeconds:input.robot.unloadSeconds},
   navigationType:'free-space'}],
  workload:{demandPerHour:input.workload.demandPerHour,unitLoadKg:input.workload.loadKg,
   shiftHours:input.workload.shiftHours,arrivalProcess:input.mode,seed:input.seed},
 });
}
export function runAgentStudy(c:AgentConfiguration):AgentStudy{
 const scenario=compileAgentScenario(c);
 const transport={robotId:'amr',safetyClearanceMeters:c.clearanceMeters,samplePeriodSeconds:3};
 const routes=compileTransportNetwork(scenario,'amr',{safetyClearanceMeters:c.clearanceMeters});
 const run=runProcessNetwork(scenario,{transport});
 const experiment=runProcessExperiment(scenario,{replications:c.replications,transport});
 return {scenario,run,experiment,routes,limitations:[
  'Один уровень; лифты и лестницы не моделируются.',
  'Геометрия и технологические параметры — пользовательские допущения до калибровки.',
  'Трафик, очереди, перезарядка и пропускная способность моделируются ядром; это не промышленная система управления AMR.',
  'Помощь пациентам, санитарные протоколы и аэродромный допуск требуют специальных предметных моделей.',
 ]};
}
