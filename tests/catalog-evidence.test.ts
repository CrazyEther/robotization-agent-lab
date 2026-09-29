import {describe,it,expect} from 'vitest';
import app from '../apps/api/app';
import catalog from '../data/catalog-v4.json';
import claims from '../data/evidence/verified_claims.json';
import sources from '../data/evidence/sources.json';
import supplements from '../data/evidence/supplement_products_v2.json';
describe('attributed catalog evidence is independent of unverified CSV',()=>{
 it('ties evidence to exact CSV row and source fingerprint',()=>{
  const row=catalog.rows[0];
  expect(row.sourceRecordId).toBe('5760e938-9a43-45a7-b8e8-f4f2e6383930');
  const matched=claims.filter(c=>c.catalog_rows.includes(row.sourceOrdinal));
  expect(matched.some(c=>c.attribute==='payload_kg'&&c.value===1500&&c.status==='manufacturer_spec')).toBe(true);
  expect(matched.every(c=>c.catalog_sha256===catalog.source.sha256)).toBe(true);
  expect(matched.every(c=>sources.some(s=>s.id===c.source_id&&s.url===c.source_url))).toBe(true);
 });
 it('preserves blocked source conflicts and offer conditions',()=>{
  expect(claims.some(c=>c.use==='blocked'&&c.value===null&&c.status==='source_conflict')).toBe(true);
  expect(claims.some(c=>c.attribute==='purchase_price_floor'&&c.scope.includes('100'))).toBe(true);
  expect(supplements.products.some(p=>p.product_ref==='aethon_t3')).toBe(true);
  expect(supplements.products.some(p=>p.product_ref==='tld_eztow')).toBe(true);
 });
 it('exposes evidence via API without publishing local raw file paths',async()=>{
  const response=await app.request('/api/v1/catalog/v4/evidence');
  expect(response.status).toBe(200);
  const data=await response.json();
  expect(data.claims.length).toBe(claims.length);
  expect(data.sources.length).toBe(sources.length);
  expect(data.claims.every((c:object)=>!('source_file_private' in c))).toBe(true);
  expect(data.supplements.products.length).toBe(2);
 });
});
