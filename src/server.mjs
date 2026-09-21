// Purpose: Operate the local catalog review app with durable revision checks and optional Jev pair advice.
import {startLocalApp} from '@gbesse/decision-workbench/apps';import {readFile} from 'node:fs/promises';
import {importCatalog,reviewFinding,exportCorrections,advise} from './index.mjs';
const demo=process.argv.includes('--demo');
const synthetic=async({model})=>({model,answers:{relation:{type:'choice',choice:'unknown',confidence:1,probabilities:{identical:0,substitute:0,incompatible:0,unknown:1}}}});
await startLocalApp({web:new URL('../web/',import.meta.url),database:process.env.APP_DATABASE??'.local/catalog.sqlite',token:process.env.APP_TOKEN,handle:async({path,method,body,store})=>{
 if(path==='/api/workspace'&&method==='GET')return {mode:demo?'synthetic':process.env.TYPESAFE_API_KEY?'live':'unconfigured',catalogs:store.list('catalog')};
 if(path==='/api/example'&&method==='GET')return {content:await readFile(new URL('../examples/woocommerce.csv',import.meta.url),'utf8')};
 if(method!=='POST')return;
 if(path==='/api/import')return store.create('catalog',await importCatalog(body.content,body.name));
 const saved=store.get('catalog',body.id);if(!saved)throw Error('Import a catalog first');
 if(path==='/api/review')return store.put('catalog',saved.id,reviewFinding(saved.data,body),body.revision);
 if(path==='/api/export')return exportCorrections(saved.data);
 if(path==='/api/advice'){const advice=await advise(saved.data,body.findingId,{provider:demo?synthetic:undefined});return store.create('advice',{catalogId:saved.id,revision:saved.revision,mode:demo?'synthetic':'live',...advice});}
}});
