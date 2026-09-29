import claimsJson from '../../data/evidence/verified_claims.json';
import sourceJson from '../../data/evidence/sources.json';
import './csv-catalog.css';
type Claim={id:string;catalog_rows:number[];attribute:string;value:unknown;unit:string;scope:string;status:string;use:string;evidence:string;source_url:string;source_fetched_at_utc:string};
const claims=claimsJson as Claim[];
const refs=new Map(sourceJson.map(s=>[s.id,s]));
const money=new Set(['purchase_price','purchase_price_floor','rental_price_floor','rental_first_month','rental_following_month','commissioning_price_floor','s2p_monthly_fee','p2p_monthly_fee']);
const blocked=(c:Claim)=>c.use==='blocked'||c.value===null||['source_conflict','model_variant_uncertain'].includes(c.status);
const format=(v:unknown)=>Array.isArray(v)?v.join(' × '):typeof v==='boolean'?(v?'да':'нет'):v===null?'Не подтверждено':String(v);
export function getRecordEvidence(ordinals:number[]){const rowIds=new Set(ordinals);return claims.filter(c=>c.catalog_rows.some(r=>rowIds.has(r)))}
export function priceClaims(ordinals:number[]){return getRecordEvidence(ordinals).filter(c=>money.has(c.attribute)&&!blocked(c))}
export default function CatalogEvidence({ordinals}:{ordinals:number[]}){
 const relevant=getRecordEvidence(ordinals);
 const sections:[string,(c:Claim)=>boolean][]=[
  ['Цены и предложения',c=>money.has(c.attribute)],
  ['Паспортные характеристики',c=>c.status==='manufacturer_spec'&&!money.has(c.attribute)],
  ['Кейсы и подтверждённые применения',c=>c.use==='case_context'||c.use==='topology_context'||c.use==='candidate_application'],
  ['Разночтения и непроверенные характеристики',c=>blocked(c)],
  ['Другие сведения',c=>!money.has(c.attribute)&&c.status!=='manufacturer_spec'&&!blocked(c)&&!['case_context','topology_context','candidate_application'].includes(c.use)]
 ];
 return <div className="ris-evidence-root">
  {relevant.length===0?<p>Для данной записи нет связанных доказательств с URL: все сведения остаются данными исходной выгрузки.</p>:
   <p className="ris-evidence-intro">Атрибутировано {relevant.length} утверждений. Статус «производитель» означает происхождение сведений, а не независимую эксплуатационную сертификацию. Условия ценовых предложений обязательны.</p>}
  {sections.map(([name,match])=>{const items=relevant.filter(match);return items.length?<section key={name} className="ris-evidence-group">
   <h3>{name} · {items.length}</h3>{items.map(c=><article key={c.id} className={'ris-evidence-claim'+(blocked(c)?' is-blocked':'')}>
    <div><strong>{c.attribute.replaceAll('_',' ')}</strong><span>{blocked(c)?'Не использовать в расчётах':c.status}</span></div>
    <b>{format(c.value)} {c.unit}</b>
    <p>{c.scope}</p><p><em>Фрагмент источника:</em> {c.evidence}</p>
    {c.source_url&&<a href={c.source_url} target="_blank" rel="noopener noreferrer">Открыть первоисточник ↗</a>}
    {c.source_fetched_at_utc&&<small>Зафиксировано: {c.source_fetched_at_utc.slice(0,10)}</small>}
   </article>)}</section>:null;})}

  <p className="ris-evidence-intro">Контроль данных: {refs.size} источников в реестре; {claims.length} атрибутированных утверждений. Конфликты не разрешаются автоматически.</p>
 </div>;
}
