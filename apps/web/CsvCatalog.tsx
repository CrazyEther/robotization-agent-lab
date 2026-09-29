import {useMemo,useState} from 'react';
import {ArrowUpRight,Search,X} from 'lucide-react';
import catalog from '../../data/catalog-v4.json';
import CatalogEvidence,{priceClaims} from './CatalogEvidence';
import SupplementCatalog from './SupplementCatalog';
import './csv-catalog.css';
type RecordRow=(typeof catalog.rows)[number];
const unique=(values:string[])=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
const displayPrice=(r:RecordRow)=>r.priceRaw?r.priceRaw+' · валюта не указана':'Цена не указана';
export default function CsvCatalog(){
 const [query,setQuery]=useState(''),[industry,setIndustry]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(1),[opened,setOpened]=useState<string|null>(null);
 const families=useMemo(()=>{
  const map=new Map<string,RecordRow[]>();
  for(const row of catalog.rows)map.set(row.sourceRecordId,[...(map.get(row.sourceRecordId)??[]),row]);
  return [...map].map(([id,rows])=>({id,rows,first:rows[0]}));
 },[]);
 const industries=useMemo(()=>unique(catalog.rows.map(r=>r.industry)),[]);
 const kinds=useMemo(()=>unique(catalog.rows.map(r=>r.type||r.kind)),[]);
 const filtered=useMemo(()=>families.filter(f=>f.rows.some(r=>(!industry||r.industry===industry)&&(!kind||(r.type||r.kind)===kind)&&
  (!query||[r.name,r.company,r.description,r.scenario,r.cases,r.region,r.industry].join(' ').toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))))),[families,query,industry,kind]);
 const size=18,pages=Math.max(1,Math.ceil(filtered.length/size)),shown=filtered.slice((Math.min(page,pages)-1)*size,Math.min(page,pages)*size);
 const selected=families.find(f=>f.id===opened);
 const reset=()=>setPage(1);
 return <section className="ris-csv-root" aria-label="Дополнительный каталог из CSV">
  <div className="ris-csv-warning"><strong>Каталог CSV · {catalog.uniqueModels} моделей / {catalog.rowCount} исходных записей</strong>
   <p>Данные выгрузки дополнены отдельным реестром первичных источников. У части моделей доступны характеристики, опубликованные кейсы и коммерческие условия. Неатрибутированные цены CSV не подставляются в ROI; конфликтующие характеристики блокируются.</p></div>
  <div className="ris-csv-filters"><label><Search size={17}/><input aria-label="Поиск по CSV" placeholder="Модель, производитель, кейс, отрасль..." value={query} onChange={e=>{setQuery(e.target.value);reset();}}/></label>
   <select aria-label="Отрасль CSV" value={industry} onChange={e=>{setIndustry(e.target.value);reset();}}><option value="">Все отрасли</option>{industries.map(x=><option key={x} value={x}>{x}</option>)}</select>
   <select aria-label="Тип оборудования CSV" value={kind} onChange={e=>{setKind(e.target.value);reset();}}><option value="">Все типы</option>{kinds.map(x=><option key={x} value={x}>{x}</option>)}</select>
   <span>{filtered.length} моделей</span></div>  <div className="ris-market-grid">{shown.map(f=><article key={f.id} className="ris-robot ris-csv-card">
   <div className="ris-robot-top"><span>{f.first.type||f.first.kind}</span><span>{f.first.status}</span></div>
   <h3>{f.first.name}</h3><p className="ris-csv-maker">{f.first.company}</p>
   <p>{f.first.description||f.first.scenario}</p>
   <div className="ris-csv-attributes"><span>{unique(f.rows.map(r=>r.industry)).join(' · ')}</span><span>Записей: {f.rows.length}</span></div>
   <div className="ris-csv-price"><small>{priceClaims(f.rows.map(r=>r.sourceOrdinal)).length?'Опубликованные предложения с источниками':'Заявленная стоимость в CSV'}</small><strong>{priceClaims(f.rows.map(r=>r.sourceOrdinal)).length?priceClaims(f.rows.map(r=>r.sourceOrdinal)).map(c=>String(c.value)+' '+c.unit).join(' / '):unique(f.rows.map(displayPrice)).join(' / ')}</strong></div>
   <button className="ris-robot-button" onClick={()=>setOpened(f.id)}>Все характеристики и кейсы <ArrowUpRight size={17}/></button>
  </article>)}</div>
  {!shown.length&&<p className="ris-csv-empty">По выбранным фильтрам записей нет.</p>}
  <SupplementCatalog/>
  {pages>1&&<nav className="ris-csv-pages" aria-label="Страницы каталога CSV"><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>← Назад</button><span>Страница {Math.min(page,pages)} из {pages}</span><button disabled={page>=pages} onClick={()=>setPage(v=>v+1)}>Далее →</button></nav>}
  {selected&&<div className="ris-csv-overlay" role="presentation" onClick={()=>setOpened(null)}>
   <section role="dialog" aria-modal="true" aria-label={'Карточка '+selected.first.name} className="ris-csv-detail" onClick={e=>e.stopPropagation()}>
    <div className="ris-csv-detail-head"><div><span>КАТАЛОГ CSV / ИСХОДНЫЕ ДАННЫЕ</span><h2>{selected.first.name}</h2><p>{selected.first.company}</p></div><button aria-label="Закрыть карточку" onClick={()=>setOpened(null)}><X size={20}/></button></div>
    <p className="ris-csv-caution">Исходное описание взято из CSV. Ниже показаны отдельно привязанные сведения из первоисточников с датой фиксации, условиями предложения и отметками о противоречиях. Не связанные с источниками данные остаются неподтверждёнными.</p>
    {selected.first.description&&<section><h3>Описание</h3><p>{selected.first.description}</p></section>}
    <CatalogEvidence ordinals={selected.rows.map(r=>r.sourceOrdinal)}/>
    {selected.rows.map(row=><section className="ris-csv-source" key={row.sourceOrdinal}>
     <h3>Исходная запись №{row.sourceOrdinal}</h3>
     <dl>{([['Тип',row.type||row.kind],['Подтип',row.subtype],['Статус',row.status],['УГТ',row.technologyReadiness],['Рыночный потенциал',row.marketPotential],['Регион',row.region],['Отрасль',row.industry],['Сценарий',row.scenario],['Цена из файла',displayPrice(row)]] as [string,string][]).filter(([,v])=>v).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
     <h4>Кейс / применение — заявление из CSV</h4><p>{row.cases||'Не указано'}</p>
    </section>)}
    <p className="ris-csv-caution">Для расчёта пригодности нужны подтверждённые ТТХ точной модификации, габариты груза, интерфейс захвата и коммерческое предложение с валютой и составом поставки.</p>
   </section></div>}
 </section>;
}
