import {describe,it,expect} from 'vitest';
import catalog from '../data/catalog-v4.json';
import claims from '../data/evidence/verified_claims.json';
import sources from '../data/evidence/sources.json';
import {formatOffer,getRecordEvidence,primaryOffer,priceClaims} from '../apps/web/CatalogEvidence';

const matches=(name:string)=>catalog.rows.filter(r=>r.name.includes(name));
describe('customer catalog price and source display',()=>{
 it('uses the sourced manufacturer price and retains its minimum lot condition',()=>{
  const rows=matches('Ronavi H1500');
  const offer=primaryOffer(rows.map(r=>r.sourceOrdinal));
  expect(offer?.value).toBe(2160000);
  expect(offer?.unit).toBe('RUB/unit');
  expect(offer?.scope).toMatch(/100 роботов/);
  expect(formatOffer(offer!)).toContain('₽ / шт.');
  expect(offer?.source_url).toBe('https://ronavi-robotics.ru/catalogue/h1500');
 });
 it('does not confuse commissioned service and rental with unit purchase',()=>{
  const c=primaryOffer(matches('Клинботикс 600').map(r=>r.sourceOrdinal));
  expect(c?.attribute).toBe('purchase_price');
  expect(c?.value).toBe(2300000);
  const offers=priceClaims(matches('Клинботикс 600').map(r=>r.sourceOrdinal));
  expect(offers.some(x=>x.attribute==='rental_first_month')).toBe(true);
  expect(offers.some(x=>x.attribute==='commissioning_price_floor')).toBe(true);
 });
 it('keeps manufacturer specifications and incompatible values separated',()=>{
  const rows=matches('Клинботикс 600');
  const facts=getRecordEvidence(rows.map(r=>r.sourceOrdinal));
  expect(facts.some(c=>c.status==='source_conflict'&&c.use==='blocked'&&c.value===null)).toBe(true);
  expect(facts.some(c=>c.status==='manufacturer_spec'&&c.source_url.startsWith('https://'))).toBe(true);
 });
 it('reproduces the original collection with the active attributed batch',()=>{
  expect(catalog.rowCount).toBe(223);
  expect(catalog.uniqueModels).toBe(187);
  expect(claims).toHaveLength(87);
  expect(sources).toHaveLength(33);
 });
});

