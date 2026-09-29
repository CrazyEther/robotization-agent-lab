import {describe,it,expect} from 'vitest';
import app from '../apps/api/app';
import v4 from '../data/catalog-v4.json';

describe('organizer CSV v4 is retained without fabricating provenance',()=>{
 it('preserves every source row, including multiple records per model',()=>{
  expect(v4.rowCount).toBe(223);
  expect(v4.rows).toHaveLength(v4.rowCount);
  expect(new Set(v4.rows.map(r=>r.sourceRecordId)).size).toBe(187);
  expect(new Set(v4.rows.map(r=>r.sourceOrdinal)).size).toBe(223);
  expect(v4.source.sha256).toBe('1521b9c886a706eda3a65cd697ec78018ad41d501713333e834266879dedb5d9');
 });
 it('does not invent currency, source URL or verified deployment claims',()=>{
  expect(v4.rows.every(r=>r.currency===null&&r.sourceUrl===null)).toBe(true);
  expect(v4.rows.every(r=>r.priceVerification==='unverified'&&r.caseVerification==='unverified')).toBe(true);
  expect(v4.rows[0].priceRaw).toBe('2 700 000,00');
  expect(v4.rows[0].priceValue).toBe(2700000);
  expect(v4.rows[0].cases).toContain('Восток-Сервис');
 });
 it('serves source-attributed CSV separately from the original reference catalog',async()=>{
  const response=await app.request('/api/v1/catalog/v4');
  expect(response.status).toBe(200);
  const payload=await response.json();
  expect(payload.rowCount).toBe(223);
  expect(payload.source.verification).toBe('not_independently_verified');
 });
});
