/* global process, console */
/* Import an organizer CSV as unverified source records; never infer currency or verified claims. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import Papa from 'papaparse';
const file=process.argv[2];
if(!file)throw new Error('Usage: node scripts/import-catalog-v4.mjs <catalog_export_v4.csv>');
const raw=readFileSync(resolve(file));
const text=raw.toString('utf8').replace(/^\uFEFF/,'');
const parsed=Papa.parse(text,{header:true,delimiter:';',skipEmptyLines:true});
if(parsed.errors.length)throw new Error('CSV errors: '+JSON.stringify(parsed.errors.slice(0,3)));
const headers=['id','Название','тип','статус','компания','описание','Тип','Подтип','Сценарий','Кейсы','УГТ','Рын Потенциал','Регион','Отрасль','Цена изделия'];
if(headers.join('|')!==parsed.meta.fields?.join('|'))throw new Error('Unexpected catalog v4 header; review mapping before import');
const rows=parsed.data.map((record,index)=>{
 const sourceOrdinal=index+1;
 if(!record.id||!record['Название'])throw new Error('Missing model identity in CSV record '+sourceOrdinal);
 const priceRaw=record['Цена изделия'].trim();
 const priceValue=priceRaw&&/^\d[\d\s]*,\d{2}$/.test(priceRaw)?Number(priceRaw.replace(/\s/g,'').replace(',','.')):null;
 return {sourceOrdinal,sourceRecordId:record.id,name:record['Название'],kind:record['тип'],status:record['статус'],company:record['компания'],
  description:record['описание'],type:record['Тип'],subtype:record['Подтип'],scenario:record['Сценарий'],cases:record['Кейсы'],
  technologyReadiness:record['УГТ'],marketPotential:record['Рын Потенциал'],region:record['Регион'],industry:record['Отрасль'],
  priceRaw,priceValue,currency:null,priceVerification:'unverified',caseVerification:'unverified',sourceUrl:null};
});
const sha256=createHash('sha256').update(raw).digest('hex');
const uniqueModels=new Set(rows.map(r=>r.sourceRecordId)).size;
const out={schemaVersion:'ris-catalog-v4/1',source:{name:'catalog_export_v4.csv',sha256,kind:'user_supplied_csv',
 verification:'not_independently_verified',currency:'not_specified',license:'not_verified'},
 rowCount:rows.length,uniqueModels,rows};
writeFileSync(resolve('data/catalog-v4.json'),JSON.stringify(out,null,2)+'\n','utf8');
console.log(JSON.stringify({source:sha256,rows:rows.length,uniqueModels,output:'data/catalog-v4.json'}));
