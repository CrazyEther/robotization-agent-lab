import {useState} from 'react';
import {ArrowUpRight,Box,X} from 'lucide-react';
import data from '../../data/evidence/supplement_products_v2.json';
const sourceById=new Map(data.sources.map(s=>[s.source_ref,s]));
export default function SupplementCatalog(){
 const [opened,setOpened]=useState<string|null>(null);
 const selected=data.products.find(p=>p.product_ref===opened);
 return <section className="ris-supplement">
  <header><h2>Другие модели</h2><p>Оборудование для больничной логистики и аэропортовой инфраструктуры</p></header>
  <div className="ris-market-grid">{data.products.map(p=><article className="ris-robot" key={p.product_ref}>
   <div className="ris-robot-top"><span>Робототехника</span><span>{p.manufacturer}</span></div>
   <div className="ris-robot-image"><Box size={43}/></div><h3>{p.model}</h3>
   <p>{p.applications.map(a=>a.process_code.replaceAll('_',' ')).join(' / ')}</p>
   <div className="ris-specs">{p.specifications.map(s=><div key={s.attribute}><span>{s.attribute.replaceAll('_',' ')}</span><strong>{s.source_value} {s.source_unit}</strong></div>)}</div>
   <button className="ris-robot-button" onClick={()=>setOpened(p.product_ref)}>Подробнее и источники <ArrowUpRight size={16}/></button>
  </article>)}</div>
  {selected&&<div className="ris-csv-overlay" role="presentation" onClick={()=>setOpened(null)}><section role="dialog" aria-modal="true" aria-label={selected.manufacturer+' '+selected.model} className="ris-csv-detail" onClick={e=>e.stopPropagation()}>
   <div className="ris-csv-detail-head"><div><span>ХАРАКТЕРИСТИКИ И ПРИМЕНЕНИЕ</span><h2>{selected.manufacturer} {selected.model}</h2><p>Модификация: {selected.variant}</p></div><button onClick={()=>setOpened(null)} aria-label="Закрыть"><X size={20}/></button></div>
   <p className="ris-csv-caution">Параметры опубликованы производителем. Нельзя подменять тяговое усилие грузоподъёмностью или паспортную скорость фактической эксплуатационной скоростью.</p>
   {selected.specifications.map(s=><section className="ris-evidence-claim" key={s.attribute}><h3>{s.attribute.replaceAll('_',' ')}</h3><b>{s.source_value} {s.source_unit}</b><p>{s.status} · страница {s.source_page??'не указана'}</p>
    {sourceById.get(s.source_ref)&&<a href={sourceById.get(s.source_ref)!.url} target="_blank" rel="noopener noreferrer">Открыть документ производителя ↗</a>}</section>)}
   <h3>Сфера применения</h3>{selected.applications.map(a=><p key={a.process_code}>{a.object_slug} / {a.process_code}</p>)}
   <p>Стоимость: {selected.offers.length?'Уточните коммерческие условия':'По запросу у производителя'}</p>
  </section></div>}
 </section>;
}

