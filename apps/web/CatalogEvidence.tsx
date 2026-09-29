import claimsJson from '../../data/evidence/verified_claims.json';
import './csv-catalog.css';

export type EvidenceClaim={
 id:string;catalog_rows:number[];attribute:string;value:unknown;unit:string;scope:string;
 status:string;use:string;evidence:string;source_url:string;source_fetched_at_utc:string;
};
const claims=claimsJson as EvidenceClaim[];
const money=new Set(['purchase_price','purchase_price_floor','rental_price_floor','rental_first_month',
 'rental_following_month','commissioning_price_floor','s2p_monthly_fee','p2p_monthly_fee']);
const labels:Record<string,string>={
 payload_kg:'Грузоподъёмность',minimum_passage_mm:'Минимальная ширина проезда',
 dimensions_lwh_mm:'Габариты (Д × Ш × В)',manufacturer_max_speed_m_s:'Максимальная скорость',
 full_charge_h:'Время зарядки',runtime_h:'Автономность',runtime_80_to_20_h:'Время работы (80–20%)',
 cleaning_rate_m2_h:'Производительность уборки',cleaning_rate_range_m2_h:'Производительность уборки',
 lift_height_mm:'Высота подъёма',case_fleet_count:'Количество роботов',case_active_fleet_count:'Действующий парк',
 case_planned_fleet_count:'Запланированный парк',case_route_length_m:'Длина маршрута',
 case_remaining_manual_tasks:'Ручные операции',case_reported_payload_kg:'Перевозимый груз',
 case_cleaned_area_m2_2h:'Обработанная площадь',case_route_origin:'Отправление',
 case_route_destination:'Назначение',case_service_zones:'Зоны обслуживания',
 case_charger_location:'Зарядка',case_transport_interface:'Транспортный интерфейс',
 purchase_price:'Покупка',purchase_price_floor:'Покупка, от',
 rental_price_floor:'Аренда, от',rental_first_month:'Аренда, первый месяц',
 rental_following_month:'Аренда, последующие месяцы',commissioning_price_floor:'Пусконаладка, от',
 product_summary:'Описание производителя',process_application:'Применение',
 manufacturer_homepage:'Сайт производителя',pallet_platform_transport:'Перевозка платформ',
 pallet_floor_pickup:'Подхват паллет',cleaning_area_per_charge_m2:'Площадь за заряд',
 case_service_zone:'Зона обслуживания',case_floor_material:'Покрытие пола',
 case_stationless_mode:'Работа без станции',case_excluded_zone:'Исключённые зоны',
 wet_cleaning_runtime_h:'Автономность влажной уборки',mark2_standard_passage_variant_mm:'Ширина прохода',
};
const format=(v:unknown)=>Array.isArray(v)?v.join(' × '):typeof v==='boolean'?(v?'Да':'Нет'):
 v===null?'Требует уточнения':String(v);
export const getRecordEvidence=(ordinals:number[])=>{
 const ids=new Set(ordinals);return claims.filter(c=>c.catalog_rows.some(n=>ids.has(n)));
};
export const priceClaims=(ordinals:number[])=>getRecordEvidence(ordinals).filter(c=>
 money.has(c.attribute)&&c.use!=='blocked'&&typeof c.value==='number'&&Number.isFinite(c.value));
export const formatOffer=(c:EvidenceClaim)=>{
 const n=typeof c.value==='number'?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(c.value):format(c.value);
 const unit=c.unit==='RUB/unit'?'₽ / шт.':c.unit==='RUB/month'?'₽ / мес.':
 c.unit==='RUB/month before VAT'?'₽ / мес., без НДС':c.unit==='RUB'?'₽':c.unit;
 return `${n} ${unit}`;
};
export const offerLabel=(c:EvidenceClaim)=>labels[c.attribute]??c.attribute.replaceAll('_',' ');
export const primaryOffer=(ordinals:number[])=>{
 const offers=priceClaims(ordinals).filter(c=>c.attribute!=='commissioning_price_floor');
 return offers.sort((a,b)=>{
  const weight=(c:EvidenceClaim)=>c.attribute==='purchase_price'?0:c.attribute==='purchase_price_floor'?1:
   c.attribute==='rental_price_floor'?2:3;
  return weight(a)-weight(b);
 })[0]??null;
};
export default function CatalogEvidence({ordinals}:{ordinals:number[]}){
 const relevant=getRecordEvidence(ordinals);
 if(relevant.length===0)return null;
 const groups:[string,(c:EvidenceClaim)=>boolean][]=[
  ['Цены и условия',c=>money.has(c.attribute)],
  ['Характеристики',c=>c.status==='manufacturer_spec'&&!money.has(c.attribute)],
  ['Применение на объектах',c=>['case_context','topology_context','candidate_application'].includes(c.use)],
  ['Дополнительные сведения',c=>!money.has(c.attribute)&&c.status!=='manufacturer_spec'&&
   !['case_context','topology_context','candidate_application'].includes(c.use)&&c.use!=='blocked'],
  ['Требуют уточнения',c=>c.use==='blocked'],
 ];
 return <div className="ris-evidence-root">
  {groups.map(([name,filter])=>{
   const items=relevant.filter(filter);
   return items.length?<section key={name} className="ris-evidence-group"><h3>{name}</h3>
    {items.map(c=><article key={c.id} className={'ris-evidence-claim'+(c.use==='blocked'?' is-blocked':'')}>
     <div><strong>{labels[c.attribute]??c.attribute.replaceAll('_',' ')}</strong>
      {c.use==='blocked'&&<span>Требует уточнения</span>}</div>
     <b>{money.has(c.attribute)&&typeof c.value==='number'?formatOffer(c):
      `${format(c.value)} ${c.value===null?'':c.unit==='text'||c.unit==='url'?'':c.unit}`}</b>
     {c.scope&&<p>{c.scope}</p>}
     {c.use!=='blocked'&&c.evidence&&<p className="ris-evidence-excerpt">{c.evidence}</p>}
     {c.source_url&&<a href={c.source_url} target="_blank" rel="noopener noreferrer">
      {money.has(c.attribute)?'Условия у поставщика ↗':'Первоисточник ↗'}</a>}
     {c.source_fetched_at_utc&&<small>Сведения от {c.source_fetched_at_utc.slice(0,10)}</small>}
    </article>)}
   </section>:null;
  })}
 </div>;
}

\n