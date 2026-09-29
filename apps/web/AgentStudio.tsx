import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Box,Download,Pause,Play,RotateCcw,ShoppingBag} from 'lucide-react';
import registry from '../../data/catalog.json';
import supplement from '../../data/market-supplement.json';
import marketWarehouse from '../../data/market-scenarios/warehouse.json';
import marketHospital from '../../data/market-scenarios/hospital.json';
import marketAirport from '../../data/market-scenarios/airport.json';
import {createScenario,evaluateInvestment,type FinanceInput,type Sector,type SimulationInput} from '../../packages/ris/contracts';
import {buildSimulationCoreReplay} from '../../packages/ris/simulationCoreReplay';
import {compileAgentScenario,defaultOperations,findFreeStation,runAgentStudy,type Operation,type AgentStudy,type AgentConfiguration} from '../../packages/agent-studio/model';
import './agent-studio.css';

const market:Record<string,{process:string;constraint:string}>={warehouse:marketWarehouse,hospital:marketHospital,airport:marketAirport};
const fmt=(n:number,d=1)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(n);
const cash=(n:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n)+' ₽';
const download=(name:string,object:unknown)=>{const blob=new Blob([JSON.stringify(object,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);};
const processNames:Record<Sector,[string,string]>={
 warehouse:['Приёмка / подготовка паллеты','Передача / погрузка'],
 factory:['Технологическая обработка','Контроль и упаковка'],
 hospital:['Подготовка закрытого контейнера','Передача отделению'],
 airport:['Проверка и сортировка багажа','Передача на выгрузку'],
};
const defaults:FinanceInput={unitPrice:0,installation:0,infrastructure:0,chargersCost:0,maintenanceAnnual:0,
 electricityPerKwh:0,baselineCostAnnual:0,residualHumanCostAnnual:0,daysPerYear:250,horizonYears:5,
 discountRatePercent:15,annualDemand:0,baselineAnnualCompleted:0};
const eventNames:Record<string,string>={
 'task.created':'Новая заявка','task.completed':'Задание выполнено','entity.loaded':'Робот забрал груз',
 'entity.unloaded':'Груз выгружен','entity.processing':'Груз поступил на обработку',
 'entity.consumed':'Исходная грузовая единица заменена','entity.completed':'Готовая продукция доставлена',
 'process.started':'Начало операции','process.completed':'Конец операции',
 'robot.charging':'Зарядка робота','traffic.conflict':'Задержка на маршруте',
 'robot.waiting':'Ожидание','resource.failed':'Оборудование остановлено',
 'resource.repaired':'Оборудование восстановлено',
};
type Result=AgentStudy&{frames:ReturnType<typeof buildSimulationCoreReplay>};
export default function AgentStudio({initialScenario,selectedRobotId}:{initialScenario:SimulationInput;selectedRobotId:string|null}){
 const [input,setInput]=useState<SimulationInput>(()=>({...initialScenario,workload:{...initialScenario.workload,shiftHours:1}}));
 const [operations,setOperations]=useState<Operation[]>(()=>defaultOperations(initialScenario).map((op,i)=>({
  ...op,label:processNames[initialScenario.sector][i],
 })));
 const [clearance,setClearance]=useState(.15),[rework,setRework]=useState(0),[replications,setReplications]=useState(5);
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState('');
 const [playing,setPlaying]=useState(false),[index,setIndex]=useState(0),[speed,setSpeed]=useState(20);
 const clock=useRef(0),[finance,setFinance]=useState<FinanceInput>(defaults);
 const [catalogOpen,setCatalogOpen]=useState(false),[selectedRobot,setSelectedRobot]=useState(selectedRobotId??'');
 const [layoutTool,setLayoutTool]=useState<'move'|'rack'|'obstacle'|'station'>('move');
 const [layoutNote,setLayoutNote]=useState('');
 const [obstacleKinds,setObstacleKinds]=useState<Array<'rack'|'obstacle'>>(
  ()=>initialScenario.layout.obstacles.map(()=>'obstacle'));
 const [selectedObstacle,setSelectedObstacle]=useState<number|null>(null);
 const svgRef=useRef<SVGSVGElement>(null);
 const drag=useRef<{kind:'pickup'|'dropoff'|'obstacle'|'station';index?:number;id?:string}|null>(null);
 const pointerToGrid=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const svg=svgRef.current,matrix=svg?.getScreenCTM();
  if(!svg||!matrix)return null;
  const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
  const p=point.matrixTransform(matrix.inverse());
  return {x:Math.floor(p.x),y:Math.floor(p.y)};
 };
 const moveOnPlan=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(!drag.current)return;
  const point=pointerToGrid(e);if(!point)return;
  const {kind,index:obstacleIndex,id}=drag.current;
  const x=Math.max(1,Math.min(input.layout.width-2,point.x));
  const y=Math.max(1,Math.min(input.layout.height-2,point.y));
  if(kind==='station'){
   setOperations(old=>old.map(op=>op.id===id?{...op,x,y}:op));
  }else if(kind==='obstacle'&&obstacleIndex!==undefined){
   setInput(old=>({...old,layout:{...old.layout,obstacles:old.layout.obstacles.map((o,i)=>i===obstacleIndex
    ?{...o,x:Math.max(1,Math.min(old.layout.width-o.w-1,x)),y:Math.max(1,Math.min(old.layout.height-o.h-1,y))}:o)}}));
  }else{
   setInput(old=>({...old,layout:{...old.layout,[kind]:{x,y}}}));
  }
 };
 const startDrag=(e:ReactPointerEvent<SVGElement>,state:NonNullable<typeof drag.current>)=>{
  e.stopPropagation();if(layoutTool!=='move')return;
  invalidate();drag.current=state;
  svgRef.current?.setPointerCapture(e.pointerId);
 };
 const endDrag=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(drag.current){drag.current=null;if(svgRef.current?.hasPointerCapture(e.pointerId))svgRef.current.releasePointerCapture(e.pointerId);}
 };
 const addToPlan=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(layoutTool==='move'||(e.target as Element).getAttribute('data-layout-background')!=='true')return;
  const position=pointerToGrid(e);if(!position)return;
  const x=Math.max(1,Math.min(input.layout.width-4,position.x));
  const y=Math.max(1,Math.min(input.layout.height-4,position.y));
  if(layoutTool==='station'){
   if(operations.length>=5){setLayoutNote('В этом прототипе поддерживается не более пяти технологических постов.');return;}
   const id='machine-'+(Math.max(0,...operations.map(o=>Number(o.id.split('-').at(-1))||0))+1);
   setOperations(old=>[...old,{id,label:'Дополнительный технологический пост',x,y,durationSeconds:60,capacity:1,transformsLoad:false,stochastic:false}]);
  }else{
   const w=layoutTool==='rack'?3:2,h=layoutTool==='rack'?6:3;
   const index=input.layout.obstacles.length;
   setInput(old=>({...old,layout:{...old.layout,obstacles:[...old.layout.obstacles,{x,y,w,h}]}}));
   setObstacleKinds(old=>[...old,layoutTool]);
   setSelectedObstacle(index);
  }
  setLayoutNote('');
  setLayoutTool('move');invalidate();
 };
 const loadShop=()=>{
  const shop=createScenario('factory');
  shop.layout={width:55,height:34,pickup:{x:4,y:17},dropoff:{x:50,y:17},obstacles:[
   {x:9,y:3,w:4,h:10},{x:9,y:23,w:4,h:8},
   {x:22,y:3,w:6,h:8},{x:22,y:24,w:6,h:7},
   {x:40,y:3,w:5,h:9},{x:40,y:24,w:5,h:7}
  ]};
  shop.robot={...shop.robot,count:4,chargerCount:2};
  shop.workload={demandPerHour:18,loadKg:90,shiftHours:1};
  setInput(shop);
  setOperations([
   {id:'machine-1',label:'Механообработка заготовки',x:18,y:17,durationSeconds:110,capacity:1,transformsLoad:true,stochastic:false},
   {id:'machine-2',label:'Контроль и упаковка',x:35,y:17,durationSeconds:45,capacity:1,transformsLoad:false,stochastic:false}
  ]);
  setLayoutTool('move');
  setObstacleKinds(['rack','rack','obstacle','obstacle','rack','rack']);
  setSelectedObstacle(null);
  setLayoutNote('Демонстрационный участок металлообработки 55 × 34 м. Размеры, станки и режимы условные, требуют обследования.');
  invalidate();
 };

 const setScenario=(fn:(before:SimulationInput)=>SimulationInput)=>{setInput(before=>fn(before));invalidate();};
 const editStage=(id:string,changes:Partial<Operation>)=>{setOperations(before=>before.map(op=>op.id===id?{...op,...changes}:op));invalidate();};
 function invalidate(){setResult(null);setError('');setPlaying(false);setIndex(0);clock.current=0;}
 const configuration:AgentConfiguration={input,operations,clearanceMeters:clearance,replications,reworkProbability:rework/100};
 const compiled=useMemo(()=>{try{return {scenario:compileAgentScenario(configuration),error:''};}
  catch(e){return {scenario:null,error:e instanceof Error?e.message:'Ошибочные параметры'};}},[input,operations,clearance,rework,replications]);
 function execute(){
  invalidate();
  try {
   const study=runAgentStudy(configuration),frames=buildSimulationCoreReplay(study.scenario,study.run.trace,{maxFrames:2400});
   if(!frames.length)throw new Error('Движок вернул пустую трассу');
   setResult({...study,frames});clock.current=frames[0].t;setPlaying(true);
  }catch(e){setError(e instanceof Error?e.message:'Ошибка исполнения');}
 }
 useEffect(()=>{if(!playing||!result||result.frames.length<2)return;
  const begin=performance.now(),start=clock.current,last=result.frames.at(-1)!.t;
  const interval=window.setInterval(()=>{
   const t=Math.min(last,start+(performance.now()-begin)/1000*speed);clock.current=t;
   let low=0,high=result.frames.length-1;
   while(low<high){const mid=Math.ceil((low+high)/2);if(result.frames[mid].t<=t)low=mid;else high=mid-1;}
   setIndex(low);if(t>=last)setPlaying(false);
  },65);
  return()=>window.clearInterval(interval);
 },[playing,result,speed]);
 const frame=result?.frames[Math.min(index,result.frames.length-1)]??null;
 const eventSlice=useMemo(()=>result?.run.trace.events.filter(e=>e.t<=(frame?.t??0)&&eventNames[e.type]).slice(-11).reverse()??[],
  [result,frame?.t]);
 const activeStations=useMemo(()=>{
  const map=new Map<string,number>();
  if(result&&frame)for(const e of result.run.trace.events){
   if(e.t>frame.t)break;
   if(e.type==='process.started'&&e.resourceId)map.set(e.resourceId,(map.get(e.resourceId)??0)+1);
   if(e.type==='process.completed'&&e.resourceId)map.set(e.resourceId,Math.max(0,(map.get(e.resourceId)??0)-1));
  }
  return map;
 },[result,frame?.t]);
 const economic=useMemo(()=>{
  if(!result)return null;
  try{
   const outcome=evaluateInvestment(input,{
    completed:result.experiment.metrics.completed.mean??0,
    energyKwh:result.experiment.metrics.transportEnergyKwh.mean??0,
    backlog:result.experiment.metrics.backlog.mean??0,
   },finance);
   const conservative=(result.experiment.metrics.completed.low95??0)*finance.daysPerYear>=finance.annualDemand&&
    result.experiment.runs.every(r=>r.metrics.completed*finance.daysPerYear>=finance.annualDemand);
   return conservative?outcome:{...outcome,comparable:false,roiPercent:null,netAnnualBenefit:outcome.netAnnualBenefit,
    npv:null,paybackYears:null,warnings:[...outcome.warnings,'Нижняя оценка серии прогонов не покрывает план: ROI/NPV заблокированы.']};
  }catch{return null;}
 },[result,input,finance]);
 const chart=useMemo(()=>{if(!result)return '';
  const points=result.frames.filter((_,i)=>i%Math.max(1,Math.floor(result.frames.length/160))===0);
  const last=points.at(-1)?.t??1,max=Math.max(1,result.run.metrics.created);
  return points.map(f=>(f.t/last*100)+','+(48-f.completed/max*44)).join(' ');
 },[result]);
 const chosen=registry.products.find(p=>p.id===selectedRobot);
 const supplemental=supplement.records.find(p=>p.id===selectedRobot);
 const supports=registry.products.filter(p=>p.familyId==='transport');
 const setRobots=(name:keyof SimulationInput['robot'],value:number)=>setScenario(s=>({...s,robot:{...s.robot,[name]:value}}));
 const setWorkload=(name:keyof SimulationInput['workload'],value:number)=>setScenario(s=>({...s,workload:{...s.workload,[name]:value}}));
 const fillEconomicExample=()=>{setFinance({
  unitPrice:900000,installation:300000,infrastructure:200000,chargersCost:140000,
  maintenanceAnnual:260000,electricityPerKwh:10,baselineCostAnnual:4800000,
  residualHumanCostAnnual:900000,daysPerYear:250,horizonYears:5,
  discountRatePercent:15,annualDemand:3500,baselineAnnualCompleted:3500
 });};
 const reset=()=>{const next=createScenario(input.sector);next.workload.shiftHours=1;setInput(next);
  setObstacleKinds(next.layout.obstacles.map(()=>'obstacle'));setSelectedObstacle(null);setLayoutNote('');
  setOperations(defaultOperations(next).map((op,i)=>({...op,label:processNames[next.sector][i]})));invalidate();};
 const editObstacle=(key:'x'|'y'|'w'|'h',value:number)=>{
  if(selectedObstacle===null||!Number.isFinite(value))return;
  setInput(old=>({...old,layout:{...old.layout,obstacles:old.layout.obstacles.map((o,i)=>
   i===selectedObstacle?{...o,[key]:Math.max(key==='w'||key==='h'?1:0,Math.min(
    key==='w'?old.layout.width-o.x-1:key==='h'?old.layout.height-o.y-1:key==='x'?old.layout.width-o.w-1:old.layout.height-o.h-1,value))}:o)}}));
  invalidate();
 };
 const removeObstacle=()=>{
  if(selectedObstacle===null)return;
  setInput(old=>({...old,layout:{...old.layout,obstacles:old.layout.obstacles.filter((_,i)=>i!==selectedObstacle)}}));
  setObstacleKinds(old=>old.filter((_,i)=>i!==selectedObstacle));
  setSelectedObstacle(null);invalidate();
 };
 return <div className="ras-root" data-testid="agent-studio">
  <section className="ras-heading"><span>RIS / AGENT-BASED DIGITAL TWIN</span><h1>Агентная модель<br/><em>операций и логистики.</em></h1>
   <p>Одна дискретно-событийная временная шкала: заявки → движение AMR → погрузка → обработка → следующий участок → выгрузка. Трафик, зарядка, очереди и показатели рассчитываются Simulation Core, а не рисуются отдельно.</p>
   <div className="ras-head-actions"><button className="ris-primary" onClick={execute} disabled={!compiled.scenario} data-testid="agent-run">
    <Play size={17}/> {result?'Пересчитать модель':'Запустить модель'}</button>
    <button className="ris-secondary" onClick={loadShop} data-testid="load-shop"><Box size={17}/> Пример производственного участка</button>
    <button className="ris-secondary" onClick={reset}><RotateCcw size={16}/> Сброс шаблона</button>
    {result&&<button className="ris-secondary" onClick={()=>download('ris-agent-study.json',{configuration,scenario:result.scenario,run:result.run,experiment:result.experiment,finance,economic})}><Download size={17}/> Экспорт данных</button>}</div>
   {(error||compiled.error)&&<p className="ras-error" role="alert">{error||compiled.error}</p>}
  </section>

  <section className="ras-workbench">
   <div className="ras-main">
    <div className="ras-floorbar"><b>РЕДАКТОР И ЖИВАЯ МОДЕЛЬ / ЭТАЖ 1</b><span>{input.layout.width} × {input.layout.height} м</span></div>
    <div className="ras-editbar" role="toolbar" aria-label="Редактор производственной планировки">
     {([['move','Перемещение'],['rack','Стеллаж'],['obstacle','Препятствие'],['station','Техпост']] as const).map(([tool,label])=>
      <button type="button" key={tool} className={layoutTool===tool?'active':''} aria-pressed={layoutTool===tool} onClick={()=>setLayoutTool(tool)}>{label}</button>)}
     <label>Ширина, м<input aria-label="Ширина помещения" type="number" min="12" max="300" value={input.layout.width}
       onChange={e=>{const width=Math.max(12,Math.min(300,Number(e.target.value)||12));if(input.layout.obstacles.some(o=>o.x+o.w>=width)||input.layout.dropoff.x>=width||operations.some(o=>o.x>=width)){setLayoutNote('Сначала перенесите объекты внутрь новой границы.');return;}setScenario(s=>({...s,layout:{...s.layout,width}}));}}/></label>
     <label>Высота, м<input aria-label="Высота помещения" type="number" min="12" max="300" value={input.layout.height}
       onChange={e=>{const height=Math.max(12,Math.min(300,Number(e.target.value)||12));if(input.layout.obstacles.some(o=>o.y+o.h>=height)||input.layout.dropoff.y>=height||operations.some(o=>o.y>=height)){setLayoutNote('Сначала перенесите объекты внутрь новой границы.');return;}setScenario(s=>({...s,layout:{...s.layout,height}}));}}/></label>
     <button type="button" onClick={()=>download('facility-layout-preview.json',{schemaVersion:'ris-layout-preview/1',layout:input.layout,operations,robot:input.robot,workload:input.workload})}>Экспорт плана</button>
    </div>
    {layoutNote&&<p className="ras-layout-note" role="status">{layoutNote}</p>}
    {selectedObstacle!==null&&input.layout.obstacles[selectedObstacle]&&<div className="ras-selected-object" data-testid="selected-layout-object">
     <b>{obstacleKinds[selectedObstacle]==='rack'?'Стеллаж':'Препятствие'} №{selectedObstacle+1}</b>
     {(['x','y','w','h'] as const).map((key)=><label key={key}>{({x:'X, м',y:'Y, м',w:'Ширина, м',h:'Глубина, м'})[key]}
      <input type="number" min={key==='w'||key==='h'?1:0} aria-label={'Параметр '+key}
       value={input.layout.obstacles[selectedObstacle][key]} onChange={e=>editObstacle(key,Number(e.target.value))}/></label>)}
     <button type="button" onClick={removeObstacle}>Удалить объект</button>
    </div>}
    <svg ref={svgRef} aria-label="Двухмерная симуляция движения роботов" data-testid="agent-floor"
     viewBox={'0 0 '+input.layout.width+' '+input.layout.height} className="ras-floor"
     onPointerMove={moveOnPlan} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerDown={addToPlan}
     style={{cursor:layoutTool==='move'?'default':'crosshair',touchAction:'none'}}>
     <defs><pattern id="ras-grid" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M2 0 H0 V2" fill="none" stroke="#b8c7d4" strokeWidth=".09"/></pattern></defs>
     <rect width="100%" height="100%" fill="#edf2f5" data-layout-background="true"/>
     <rect width="100%" height="100%" fill="url(#ras-grid)" data-layout-background="true"/>
     {input.layout.obstacles.map((o,i)=><g key={'o'+i} data-testid="layout-obstacle"
      onPointerDown={e=>startDrag(e,{kind:'obstacle',index:i})}
      onClick={e=>{e.stopPropagation();setSelectedObstacle(i);}} style={{cursor:layoutTool==='move'?'grab':'pointer'}}>
      <rect x={o.x} y={o.y} width={o.w} height={o.h} fill={obstacleKinds[i]==='rack'?'#465f73':'#a65c4c'}
       stroke={selectedObstacle===i?'#f4cb61':'#163d57'} strokeWidth={selectedObstacle===i?'.42':'.24'} rx=".2" opacity="1"/>
      <text x={o.x+o.w/2} y={o.y+Math.min(1.1,o.h*.5)} textAnchor="middle" fontSize=".65" fontWeight="800" fill="white"
       pointerEvents="none">{obstacleKinds[i]==='rack'?'СТЕЛЛАЖ':'ПРЕПЯТСТВИЕ'}</text>
     </g>)}
     <g aria-label="Зарядка роботов" data-testid="agent-charger">
      <rect x={Math.max(0,input.layout.pickup.x-2)} y={Math.max(0,input.layout.pickup.y-3)} width="2" height="2" rx=".3"
       fill="#9768d7" stroke="#ffffff" strokeWidth=".22"/>
      <text x={Math.max(0,input.layout.pickup.x-2)+1} y={Math.max(0,input.layout.pickup.y-3)+1.25} textAnchor="middle"
       fill="white" fontSize="1.1" fontWeight="800">⚡</text>
      <title>Зарядка: {input.robot.chargerCount} каналов · расположен рядом с зоной поступления; в текущем движке её позиция привязана к точке A.</title>
     </g>
     {result?.routes.legs.map((leg,i)=><polyline key={leg.edgeId} data-testid="agent-route"
      points={leg.route.points.map(p=>p.x+','+p.y).join(' ')}
      stroke={i%2?'#119d80':'#1d62f3'} fill="none" strokeWidth=".26" strokeDasharray=".8 .45"/>)}
     {operations.map((op,i)=><g key={op.id} data-testid="agent-machine"
      onPointerDown={e=>startDrag(e,{kind:'station',id:op.id})} style={{cursor:layoutTool==='move'?'grab':'crosshair'}}>
      <rect x={op.x-.6} y={op.y-.6} width="2" height="2" rx=".25"
       stroke={(activeStations.get(op.id)??0)>0?'#ce6b0c':'#147a61'} strokeWidth=".3"
       fill={(activeStations.get(op.id)??0)>0?'#ffd491':'#9fe2ca'}/>
      <text x={op.x+.4} y={op.y+.58} textAnchor="middle" fontSize=".84" fontWeight="800" fill="#20415c">{i+1}</text>
      <title>{op.label} · {activeStations.get(op.id)??0}/{op.capacity} постов · {op.durationSeconds} с</title>
     </g>)}
     {(['pickup','dropoff'] as const).map((key,i)=><g key={key}
      onPointerDown={e=>startDrag(e,{kind:key})} style={{cursor:layoutTool==='move'?'grab':'crosshair'}}>
      <circle cx={cell(input.layout[key].x)} cy={cell(input.layout[key].y)} r="1" fill={i?'#fb7440':'#275fe5'} stroke="white" strokeWidth=".23"/>
      <text x={cell(input.layout[key].x)} y={cell(input.layout[key].y)+.25} textAnchor="middle" fontWeight="800" fontSize=".85" fill="white">{i?'B':'A'}</text></g>)}
     {frame?.cargos.map(c=><rect key={c.id} data-testid="agent-cargo" x={c.x-.38} y={c.y-.38} width=".76" height=".76" rx=".08"
      fill={c.phase==='processing'?'#ffb136':c.phase==='loaded'?'#37bafa':c.phase==='delivered'?'#17aa74':'#e1bf73'}
      stroke="#234054" strokeWidth=".11"><title>{c.id} · {c.phase}</title></rect>)}
     {frame?.robots.map(r=><g key={r.id} data-testid="agent-robot"><circle cx={r.x} cy={r.y} r=".72"
      fill={r.state==='loaded'?'#ff9e35':r.state==='charging'?'#8b58d6':'#1766ef'} stroke="#fff" strokeWidth=".18"/>
      <text x={r.x} y={r.y+.23} fontWeight="800" fill="white" textAnchor="middle" fontSize=".65">{r.id.split('#')[1]}</text></g>)}
    </svg>
    <div className="ras-legend"><span><i className="ras-indigo"/> Роботы</span><span><i className="ras-yellow"/> Груз</span>
     <span><i className="ras-green"/> Пост обработки</span><span><i className="ras-gray"/> Препятствия</span>
     <span><i className="ras-charge-legend"/> Зарядка ({input.robot.chargerCount} места)</span></div>
    <p className="ras-layout-note">Перетащите A, B, посты и препятствия в режиме «Перемещение»; инструменты добавляют объекты по клику. Включённая симуляция сбрасывается при редактировании. Зарядное место показано отдельно; пока геометрически связано с точкой A.</p>
    {result&&<div className="ras-replay"><button onClick={()=>{if(!playing&&index>=result.frames.length-1){clock.current=0;setIndex(0);}setPlaying(v=>!v);}}>
      {playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Пауза':'Воспроизвести'}</button>
      <input aria-label="Время агентной симуляции" type="range" min="0" max={result.frames.length-1} value={index}
       onChange={e=>{const ix=Number(e.target.value);setIndex(ix);clock.current=result.frames[ix].t;setPlaying(false);}}/>
      <b>{frame?Math.floor(frame.t/60)+' мин '+Math.floor(frame.t%60)+' с':'0 с'}</b>
      <select aria-label="Скорость воспроизведения" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>
       <option value={1}>1×</option><option value={8}>8×</option><option value={20}>20×</option><option value={60}>60×</option></select>
     </div>}
   </div>
   <aside className="ras-monitor"><div className="ras-monitor-title"><span>LIVE / EVENTTRACE</span><h3>Состояние агентов</h3></div>
    {frame?<><div className="ras-minikpis"><div><span>Создано</span><b>{frame.created}</b></div>
     <div><span>Доставлено</span><b>{frame.completed}</b></div>
     <div><span>В работе</span><b>{frame.backlog}</b></div></div>
     <h4>Роботы</h4><p className="ras-charge-note">SOC: {fmt(result?.run.metrics.minRobotSoc!==undefined?result.run.metrics.minRobotSoc*100:100,1)}% минимум · зарядок: {result?.run.metrics.chargeCount??0} · очередь к зарядке: {fmt(result?.run.metrics.chargerWaitSeconds??0,1)} с. Схема зарядки сейчас условная и расположена возле A.</p>{frame.robots.map(r=><div className="ras-agent-line" key={r.id}>
      <strong>{r.id}</strong><span>{r.state}{r.taskId?' / '+r.taskId:''}</span><em>{r.batteryPercent===undefined?'—':fmt(r.batteryPercent,0)+'%'}</em></div>)}
     <h4>Оборудование</h4>{operations.map(op=><div className="ras-agent-line" key={op.id}>
      <strong>{op.label}</strong><span>Занято {activeStations.get(op.id)??0}/{op.capacity}</span></div>)}
     <h4>Последние события</h4>{eventSlice.map(e=><div key={e.id} className="ras-log">
      <time>{Math.floor(e.t/60)}:{String(Math.floor(e.t%60)).padStart(2,'0')}</time>
      <span>{eventNames[e.type]}{e.taskId?' · '+e.taskId:''}</span></div>)}
    </>:<p className="ras-muted">Запустите эксперимент: журнал, грузы и положения роботов появятся из рассчитанной событийной трассы.</p>}
   </aside>
  </section>

  {result&&<section className="ras-results" data-testid="agent-results">
    <header><span>ENGINE / SIMCORE-PROCESS 4</span><h2>Результаты прогона</h2></header>
    <div className="ras-metrics">
     {([['Выполнено',result.run.metrics.completed],['Пропускная способность',fmt(result.run.metrics.throughputPerHour,1)+'/ч'],
      ['Остаток заданий',result.run.metrics.backlog],['P95 цикла',fmt(result.run.metrics.p95CycleSeconds??0,0)+' с'],
      ['Дистанция флота',fmt(result.run.metrics.transportDistanceMeters,0)+' м'],
      ['Ожидание трафика',fmt(result.run.metrics.trafficWaitSeconds,0)+' с'],
      ['Загрузка парка',fmt(result.run.metrics.robotUtilization*100,1)+'%'],
      ['Энергия',fmt(result.run.metrics.transportEnergyKwh,2)+' кВт·ч']] as [string,number|string][]).map(([label,value])=>
      <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="ras-results-bottom"><div><b>Нарастание выпуска</b><svg viewBox="0 0 100 50" preserveAspectRatio="none" className="ras-chart">
      <path d="M0 48H100" stroke="#cdd9e7" strokeWidth=".4"/><polyline points={chart} stroke="#1d62f3" strokeWidth=".8" fill="none"/></svg>
     <p>Среднее по {result.experiment.replications} независимым прогонам: {fmt(result.experiment.metrics.completed.mean??0,1)} шт./смену.
      95% ДИ среднего: [{fmt(result.experiment.metrics.completed.low95??0,1)}; {fmt(result.experiment.metrics.completed.high95??0,1)}]. Это неопределённость внутри модели, не гарантия на реальном объекте.</p>
    </div><div><b>Загрузка технологических постов</b>{operations.map(op=><div className="ras-util" key={op.id}>
     <span>{op.label}</span><strong>{fmt((result.run.metrics.resourceUtilization[op.id]??0)*100,1)}%</strong>
     <div><i style={{width:Math.min(100,(result.run.metrics.resourceUtilization[op.id]??0)*100)+'%'}}/></div></div>)}
    </div></div>
  </section>}

  <section className="ras-config"><div className="ras-section-heading"><span>ПАРАМЕТРЫ МОДЕЛИ</span><h2>Меняйте условия. Проверяйте последствия.</h2></div>
   <div className="ras-config-grid">
    <article className="ras-card"><h3>01 / Потоки и парк</h3><div className="ras-fields"><label>Отрасль<select aria-label="Отраслевой сценарий" value={input.sector} onChange={e=>{
      const sector=e.target.value as Sector,next=createScenario(sector);next.workload.shiftHours=1;
      setInput(next);setOperations(defaultOperations(next).map((op,i)=>({...op,label:processNames[sector][i]})));
      setSelectedRobot('');setObstacleKinds(next.layout.obstacles.map(()=>'obstacle'));setSelectedObstacle(null);
      setLayoutNote('');invalidate();
     }}><option value="warehouse">Склад</option><option value="factory">Производство</option><option value="hospital">Медицина</option><option value="airport">Аэропорт</option></select></label>
     <label>Роботов, шт.<input aria-label="Агенты роботы" type="number" min="1" max="100" value={input.robot.count} onChange={e=>setRobots('count',Number(e.target.value))}/></label>
     <label>Скорость, м/с<input type="number" min=".05" step=".05" value={input.robot.speedMps} onChange={e=>setRobots('speedMps',Number(e.target.value))}/></label>
     <label>Заявок/час<input type="number" min=".1" value={input.workload.demandPerHour} onChange={e=>setWorkload('demandPerHour',Number(e.target.value))}/></label>
     <label>Смена, ч<input type="number" min=".25" max="24" step=".25" value={input.workload.shiftHours} onChange={e=>setWorkload('shiftHours',Number(e.target.value))}/></label>
     <label>Масса, кг<input type="number" min=".1" value={input.workload.loadKg} onChange={e=>setWorkload('loadKg',Number(e.target.value))}/></label>
     <label>Грузоподъёмность, кг<input type="number" min=".1" value={input.robot.payloadKg} onChange={e=>setRobots('payloadKg',Number(e.target.value))}/></label>
     <label>Погрузка, с<input type="number" min="0" value={input.robot.loadSeconds} onChange={e=>setRobots('loadSeconds',Number(e.target.value))}/></label>
     <label>Разгрузка, с<input type="number" min="0" value={input.robot.unloadSeconds} onChange={e=>setRobots('unloadSeconds',Number(e.target.value))}/></label>
     <label>Потребление, Вт·ч/м<input type="number" min=".01" step=".05" value={input.robot.whPerMeter} onChange={e=>setRobots('whPerMeter',Number(e.target.value))}/></label>
     <label>Ёмкость батареи, Вт·ч<input type="number" min="10" value={input.robot.batteryWh} onChange={e=>setRobots('batteryWh',Number(e.target.value))}/></label>
     <label>Зарядных мест<input type="number" min="1" max="100" value={input.robot.chargerCount} onChange={e=>setRobots('chargerCount',Number(e.target.value))}/></label>
     <label>Зазор, м<input type="number" min="0" max="2" step=".05" value={clearance} onChange={e=>{setClearance(Number(e.target.value));invalidate();}}/></label>
     <label>Доработка, %<input aria-label="Вероятность доработки" type="number" min="0" max="60" step="5" value={rework} onChange={e=>{setRework(Number(e.target.value));invalidate();}}/></label>
     <label>Независимых прогонов<input type="number" min="5" max="30" value={replications} onChange={e=>{setReplications(Math.max(5,Math.min(30,Number(e.target.value))));invalidate();}}/></label>
     <label>Поток<select value={input.mode} onChange={e=>{setScenario(s=>({...s,mode:e.target.value as 'fixed'|'poisson'}));invalidate();}}><option value="fixed">Равномерный</option><option value="poisson">Пуассон</option></select></label>
    </div></article>
    <article className="ras-card"><h3>02 / Технологическая цепочка</h3>
     {operations.map((op,i)=><div className="ras-operation" key={op.id} data-testid="agent-operation">
      <div className="ras-stage-top"><b>{i+1}. {op.label}</b>{i>0&&<button onClick={()=>{setOperations(old=>old.filter(x=>x.id!==op.id));invalidate();}}>Удалить</button>}</div>
      <label>Название<input aria-label={'Название поста '+(i+1)} value={op.label} onChange={e=>editStage(op.id,{label:e.target.value})}/></label>
      <div className="ras-fields"><label>Время, с<input aria-label={'Длительность '+(i+1)} type="number" min="1" value={op.durationSeconds} onChange={e=>editStage(op.id,{durationSeconds:Number(e.target.value)})}/></label>
       <label>Постов<input type="number" min="1" max="50" value={op.capacity} onChange={e=>editStage(op.id,{capacity:Number(e.target.value)})}/></label>
       <label>X, м<input type="number" min="1" value={op.x} onChange={e=>editStage(op.id,{x:Number(e.target.value)})}/></label>
       <label>Y, м<input type="number" min="1" value={op.y} onChange={e=>editStage(op.id,{y:Number(e.target.value)})}/></label></div>
      <label className="ras-check"><input type="checkbox" checked={op.transformsLoad} onChange={e=>editStage(op.id,{transformsLoad:e.target.checked})}/> Формировать новую грузовую единицу</label>
      <label className="ras-check"><input type="checkbox" checked={op.stochastic} onChange={e=>editStage(op.id,{stochastic:e.target.checked})}/> Случайное время обработки (логнормальное)</label>
     </div>)}
     {operations.length<5&&<button className="ris-secondary" onClick={()=>{const id='machine-'+(Math.max(0,...operations.map(o=>Number(o.id.split('-').at(-1))||0))+1);
      const position=findFreeStation(input,.5,.65,[input.layout.pickup,input.layout.dropoff,...operations]);
      setOperations(old=>[...old,{id,label:'Новый технологический пост',...position,durationSeconds:60,capacity:1,transformsLoad:false,stochastic:false}]);invalidate();}}>+ Добавить этап</button>}
     <p className="ras-muted">Станции связаны транспортными ребрами. Удаление или добавление этапа изменяет Process Graph, маршруты и все KPI.</p>
    </article>
    <article className="ras-card"><h3>03 / Отраслевой паспорт</h3><p>{market[input.sector]?.process??'Производственная межоперационная логистика (демонстрационный профиль).'}</p>
     <p className="ras-warning">{market[input.sector]?.constraint??'Промышленная валидация геометрии и производственных параметров обязательна.'}</p>
     <button className="ris-secondary" onClick={()=>setCatalogOpen(v=>!v)}><ShoppingBag size={16}/> {catalogOpen?'Скрыть каталог':'Выбор робота из каталога'}</button>
     {catalogOpen&&<div className="ras-catalog"><label>Робот<select value={selectedRobot} onChange={e=>{setSelectedRobot(e.target.value);invalidate();}}>
      <option value="">Без подтверждённой модели</option>{supports.map(p=><option key={p.id} value={p.id}>{p.vendor}: {p.name}</option>)}
      {supplement.records.filter(p=>p.sector===input.sector).map(p=><option key={p.id} value={p.id}>{p.vendor}: {p.name} (дополнение)</option>)}</select></label>
      {supplemental&&<div className="ras-catalog-info"><b>{supplemental.vendor} {supplemental.name}</b><p>Применение: {supplemental.application}. Цена не подтверждена.</p>
       {supplemental.claims.map(c=><p key={c.key}>{c.key}: {c.value} {c.unit} · {c.status}</p>)}<p>{supplemental.warning}</p>
       <a href={supplemental.sourceUrl} target="_blank" rel="noreferrer">Источник производителя ↗</a></div>}
      {chosen&&<div className="ras-catalog-info"><b>{chosen.name}</b><p>{chosen.summary}</p><p>Пригодность конкретного робота и интерфейс захвата груза требуют проверки. Выбор не подменяет паспортные параметры введённой модели.</p>
       {registry.sources.filter(s=>chosen.sourceIds.includes(s.id)).slice(0,2).map(s=><a key={s.id} href={s.url} target="_blank" rel="noreferrer">Первоисточник ↗</a>)}</div>}
     </div>}
     <div className="ras-facility-summary"><Box size={23}/><p>Сектор: <b>{input.sector}</b><br/>Статус: <b>демонстрационная модель</b><br/>
      Шаблон геометрии и отраслевые допущения имеют демонстрационный статус. Точные параметры и нормативные ограничения не подтверждены.</p></div>
    </article>
   </div>
  </section>

  <section className="ras-finance"><div className="ras-section-heading"><span>ОЦЕНКА ЭКОНОМИКИ</span><h2>Результат симуляции → CAPEX / OPEX / ROI</h2><p>Экономические выводы возможны только при заданных реальных затратах и сопоставимом годовом объёме.</p></div>
   <div className="ras-finance-actions"><button type="button" className="ris-secondary" onClick={fillEconomicExample} data-testid="fill-finance-example">Заполнить учебный пример затрат</button>
    <p>Учебные финансовые цифры — не цены конкретного поставщика. План 3 500 готовых изделий/год относится к 1-часовой демонстрационной смене, а не к исследованию 400 перевозок за 8 часов. Измените исходные данные под предприятие.</p></div>
   <div className="ras-finance-grid"><div className="ras-fields">{([
    ['unitPrice','Цена робота, ₽'],['installation','Пусконаладка, ₽'],['infrastructure','Инфраструктура, ₽'],
    ['chargersCost','Зарядка / связь, ₽'],['maintenanceAnnual','Обслуживание, ₽/год'],
    ['electricityPerKwh','Электроэнергия, ₽/кВт·ч'],['baselineCostAnnual','Текущие затраты, ₽/год'],
    ['residualHumanCostAnnual','Оставшийся персонал, ₽/год'],['annualDemand','План, операций/год'],
    ['baselineAnnualCompleted','Выпуск до внедрения, шт./год'],
    ['daysPerYear','Рабочих дней в году'],['horizonYears','Период оценки, лет'],
    ['discountRatePercent','Ставка дисконтирования, %']
   ] as [keyof FinanceInput,string][]).map(([key,label])=><label key={key}>{label}<input type="number" min="0" value={finance[key]}
    onChange={e=>setFinance(old=>({...old,[key]:Number(e.target.value)}))}/></label>)}</div>
    <div className="ras-finance-summary"><span>ПО ОДНОМУ АГЕНТНОМУ ИССЛЕДОВАНИЮ</span>
     <div><small>CAPEX</small><b>{economic?cash(economic.capex):'—'}</b></div>
     <div><small>OPEX / год</small><b>{economic?cash(economic.annualOpex):'—'}</b></div>
     <div><small>TCO / {finance.horizonYears} лет</small><b>{economic?cash(economic.tco):'—'}</b></div>
     <div><small>ROI / {finance.horizonYears} лет</small><b>{economic?.roiPercent!=null?fmt(economic.roiPercent,1)+'%':'Недостаточно данных'}</b></div>
     <div><small>NPV / ставка {fmt(finance.discountRatePercent,1)}%</small><b data-testid="npv-value">{economic?.npv!=null?cash(economic.npv):'Недостаточно данных'}</b></div>
     <div><small>Чистый денежный эффект / год</small><b>{economic?.netAnnualBenefit!=null?cash(economic.netAnnualBenefit):'—'}</b></div>
     <div><small>Оценка мощности / год</small><b>{economic?fmt(economic.annualCompleted,0)+' изделий':'—'}</b></div>
     <div><small>Окупаемость</small><b>{economic?.paybackYears!=null?fmt(economic.paybackYears,2)+' года':'Не рассчитана'}</b></div>
     {economic?.warnings.map((w,i)=><p className="ras-warning" key={i}>{w}</p>)}
    </div></div>
  </section>
  <div className="ras-disclaimer">{result?.limitations.map(t=><p key={t}>{t}</p>)??<p>Настоящий прототип не является сертифицированным цифровым двойником и не воспроизводит полностью AnyLogic.</p>}</div>
 </div>;
}
function cell(n:number){return n+.5;}
