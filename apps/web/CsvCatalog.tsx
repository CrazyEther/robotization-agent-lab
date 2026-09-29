import {useMemo,useState} from 'react';
import {ArrowUpRight,Search,X,ExternalLink} from 'lucide-react';
import catalog from '../../data/catalog-v4.json';
import CatalogEvidence,{getRecordEvidence,offerLabel,primaryOffer,formatOffer} from './CatalogEvidence';
import SupplementCatalog from './SupplementCatalog';
import './csv-catalog.css';

type RecordRow=(typeof catalog.rows)[number];
type Family={id:string;rows:RecordRow[];first:RecordRow};
const unique=(values:string[])=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
const amount=(v:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v);
const getReferencePrice=(rows:RecordRow[])=>rows.find(r=>r.priceValue!==null&&r.priceValue>0)?.priceValue??null;
const primaryLink=(rows:RecordRow[])=>{
 const items=getRecordEvidence(rows.map(r=>r.sourceOrdinal));
 return items.find(c=>c.status==='manufacturer_spec'&&c.source_url)?.source_url
  ??items.find(c=>c.source_url)?.source_url??null;
};
export default function CsvCatalog(){
 const [query,setQuery]=useState(''),[industry,setIndustry]=useState(''),[kind,setKind]=useState(''),
  [page,setPage]=useState(1),[opened,setOpened]=useState<string|null>(null);
 const families=useMemo(()=>{
  const map=new Map<string,RecordRow[]>();
  for(const row of catalog.rows)map.set(row.sourceRecordId,[...(map.get(row.sourceRecordId)??[]),row]);
  return [...map].map(([id,rows])=>({id,rows,first:rows[0]}));
 },[]);
 const industries=useMemo(()=>unique(catalog.rows.map(r=>r.industry)),[]);
 const kinds=useMemo(()=>unique(catalog.rows.map(r=>r.type||r.kind)),[]);
 const filtered=useMemo(()=>families.filter(f=>f.rows.some(r=>
  (!industry||r.industry===industry)&&(!kind||(r.type||r.kind)===kind)&&
  (!query||[r.name,r.company,r.description,r.scenario,r.cases,r.region,r.industry].join(' ').
   toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))))),[families,query,industry,kind]);
 const size=18,pages=Math.max(1,Math.ceil(filtered.length/size));
 const shown=filtered.slice((Math.min(page,pages)-1)*size,Math.min(page,pages)*size);
 const selected=families.find(f=>f.id===opened);
 const reset=()=>setPage(1);
 return <section className="ris-csv-root" aria-label="Каталог робототехнических решений">
  <header className="ris-catalog-heading">
   <div><h2>Робототехнические решения</h2><p>Модели, производители, характеристики, применение и предложения поставщиков</p></div>
   <span>{catalog.uniqueModels} моделей</span>
  </header>
  <div className="ris-csv-filters"><label><Search size={17}/>
   <input aria-label="Поиск по каталогу" placeholder="Модель, производитель, применение..." value={query}
    onChange={e=>{setQuery(e.target.value);reset();}}/></label>
   <select aria-label="Отрасль" value={industry} onChange={e=>{setIndustry(e.target.value);reset();}}>
    <option value="">Все отрасли</option>{industries.map(x=><option key={x} value={x}>{x}</option>)}</select>
   <select aria-label="Тип оборудования" value={kind} onChange={e=>{setKind(e.target.value);reset();}}>
    <option value="">Все типы</option>{kinds.map(x=><option key={x} value={x}>{x}</option>)}</select>
   <span>{filtered.length} найдено</span></div>
  <div className="ris-market-grid">{shown.map(f=>{
   const offer=primaryOffer(f.rows.map(r=>r.sourceOrdinal));
   const referencePrice=getReferencePrice(f.rows);
   const link=primaryLink(f.rows);
   return <article key={f.id} className="ris-robot ris-csv-card">
    <div className="ris-robot-top"><span>{f.first.type||f.first.kind}</span><span>{f.first.status}</span></div>
    <h3>{f.first.name}</h3><p className="ris-csv-maker">{f.first.company}</p>
    <p>{f.first.description||f.first.scenario}</p>
    <div className="ris-csv-attributes"><span>{unique(f.rows.map(r=>r.industry)).join(' · ')}</span>
     <span>{f.first.region}</span></div>
    <div className="ris-csv-price">
     <small>{offer?offerLabel(offer):referencePrice?'Ориентировочная стоимость':'Стоимость'}</small>
     <strong>{offer?formatOffer(offer):referencePrice?`≈ ${amount(referencePrice)} ₽`:'По запросу'}</strong>
     {offer&&<small className="ris-offer-scope">{offer.scope}</small>}
     {!offer&&referencePrice&&<small className="ris-offer-scope">Справочная оценка. Уточните актуальные условия у поставщика.</small>}
    </div>
    {link&&<a className="ris-catalog-external" href={link} target="_blank" rel="noopener noreferrer">
     Страница производителя <ExternalLink size={14}/></a>}
    <button className="ris-robot-button" onClick={()=>setOpened(f.id)}>
     Характеристики и применение <ArrowUpRight size={17}/></button>
   </article>;
  })}</div>
  {!shown.length&&<p className="ris-csv-empty">По выбранным фильтрам моделей нет.</p>}
  {pages>1&&<nav className="ris-csv-pages" aria-label="Страницы каталога">
   <button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>← Назад</button>
   <span>Страница {Math.min(page,pages)} из {pages}</span>
   <button disabled={page>=pages} onClick={()=>setPage(v=>v+1)}>Далее →</button></nav>}
  <SupplementCatalog/>
  {selected&&<div className="ris-csv-overlay" role="presentation" onClick={()=>setOpened(null)}>
   <section role="dialog" aria-modal="true" aria-label={'Карточка '+selected.first.name}
    className="ris-csv-detail" onClick={e=>e.stopPropagation()}>
    <div className="ris-csv-detail-head"><div><span>КАТАЛОГ ОБОРУДОВАНИЯ</span><h2>{selected.first.name}</h2>
      <p>{selected.first.company}</p></div>
     <button aria-label="Закрыть карточку" onClick={()=>setOpened(null)}><X size={20}/></button></div>
    {selected.first.description&&<section><h3>Описание</h3><p>{selected.first.description}</p></section>}
    <section><h3>Сведения о модели</h3>
     <dl>{([['Тип',selected.first.type||selected.first.kind],['Подтип',selected.first.subtype],
      ['Статус',selected.first.status],['Готовность технологии',selected.first.technologyReadiness],
      ['Регион',selected.first.region],['Отрасль',selected.first.industry],
      ['Назначение',selected.first.scenario]] as [string,string][]).filter(([,v])=>v).map(([key,value])=>
      <div className="ris-csv-dl-row" key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    {getReferencePrice(selected.rows)!==null&&
     <section className="ris-reference-price"><h3>Справочная стоимость</h3>
      <strong>≈ {amount(getReferencePrice(selected.rows)!)} ₽</strong>
      <p>Оценка для предварительного сравнения. Итоговая стоимость, комплектация и условия уточняются у поставщика.</p>
     </section>}
    <CatalogEvidence ordinals={selected.rows.map(r=>r.sourceOrdinal)}/>
    {unique(selected.rows.map(r=>r.cases)).length>0&&<section className="ris-csv-source">
     <h3>Кейсы и применение</h3>
     {unique(selected.rows.map(r=>r.cases)).map((description,i)=><p key={i}>{description}</p>)}
    </section>}
   </section></div>}
 </section>;
}

\n