// Purpose: Detect reviewable WooCommerce catalog anomalies and export only explicitly approved category updates.
import {extract} from '@gbesse/decision-workbench/statebridge';
import {createGraph,candidatePairs,propose,approve} from '@gbesse/matchgraph';
import {classifyPair} from '@gbesse/matchgraph/jev';
import {createDesk,openCase,resolveCase,prepareERPChange} from '@gbesse/exceptionos';
import {fingerprint} from '@gbesse/decisionpacks';
const ensure=(ok,m)=>{if(!ok)throw Error(m);};
const norm=s=>String(s).normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export async function importCatalog(content,name='catalog.csv'){
 const document=await extract({name,format:'csv',content});
 ensure(document.rows.length<=300,'Maximum 300 catalog rows per review');
 const columns=Object.keys(document.rows[0]?.fields??{});ensure(['ID','Name','Categories'].every(k=>columns.includes(k)),'WooCommerce ID, Name and Categories columns required');
 const findings=[],products=[],seenIds=new Set(),seenSkus=new Map(),categories=new Map();
 for(const row of document.rows){
  const f=row.fields,id=String(f.ID);ensure(/^[1-9][0-9]*$/.test(id)&&!seenIds.has(id),'Every row needs a unique existing positive WooCommerce ID');seenIds.add(id);ensure(f.Name?.trim(),'Product name required');
  const attributes=Object.create(null);for(const key of columns){const match=key.match(/^Attribute (\d+) name$/);if(match&&f[key])attributes[f[key]]=f[`Attribute ${match[1]} value(s)`]??'';}
  // Internal SKU uses the stable WooCommerce ID so duplicate or missing commercial SKUs remain inspectable.
  products.push({id,supplierId:'woocommerce',sku:id,description:f.Name,unit:'item',packSize:1,attributes,active:true});
  if(f.SKU){const previous=seenSkus.get(norm(f.SKU));if(previous)findings.push({id:`sku:${id}`,type:'duplicate_sku',productId:id,otherId:previous,reason:'Same normalized SKU; inspect identities before merging',status:'open'});else seenSkus.set(norm(f.SKU),id);}
  const category=f.Categories??'',key=norm(category);if(!key)findings.push({id:`category:${id}`,type:'category',productId:id,current:category,suggested:'',reason:'Missing categories',status:'open'});
  else if(categories.has(key)&&categories.get(key)!==category)findings.push({id:`category:${id}`,type:'category',productId:id,current:category,suggested:categories.get(key),reason:'Capitalization or spacing differs for the same category list',status:'open'});else categories.set(key,category);
 }
 const graph=createGraph(products),byId=new Map(products.map(p=>[p.id,p])),pairs=new Set();
 for(const p of products){for(const pair of candidatePairs(graph,p.id,5)){
  const target=byId.get(pair.to),key=[p.id,target.id].sort().join(':');if(pairs.has(key)||norm(p.description)!==norm(target.description))continue;pairs.add(key);
  const contradictory=Object.keys(p.attributes).filter(k=>Object.hasOwn(target.attributes,k)&&norm(p.attributes[k])!==norm(target.attributes[k]));
  findings.push({id:`pair:${key}`,type:contradictory.length?'attribute_conflict':'candidate_duplicate',productId:p.id,otherId:target.id,reason:contradictory.length?'Same normalized name but conflicting attributes: '+contradictory.join(', '):'Same normalized name; identity still requires human evidence',status:'open'});
 }}
 const desk=createDesk(products.map(p=>({tenantId:'local',supplierId:'woocommerce',sku:p.id,description:p.description,unit:p.unit,active:true})));
 return {schemaVersion:1,sourceFingerprint:fingerprint(document),document,graph,desk,findings,history:[]};
}
export function reviewFinding(catalog,{findingId,action,actor,note,category}){
 const next=structuredClone(catalog),f=next.findings.find(f=>f.id===findingId);ensure(f&&f.status==='open','Finding is absent or already reviewed');
 ensure(typeof actor==='string'&&actor.trim()&&actor.length<=100&&typeof note==='string'&&note.trim()&&note.length<=2000,'Reviewer and evidence note required');
 ensure(['dismiss','approve'].includes(action),'Unknown review action');
 if(action==='approve'){
  if(f.type==='category'){ensure(typeof category==='string'&&category.trim()&&category.length<=2000&&!/^[\s]*[=+@-]|[\r\n]/.test(category),'Provide safe WooCommerce category names');f.correction=category;}
  else {
   ensure(f.type==='candidate_duplicate','Attribute/SKU conflicts cannot be automatically merged; dismiss with evidence or correct the source and reimport');
   const from=next.graph.products.find(p=>p.id===f.productId);
   // MatchGraph enforces equal known attributes; ExceptionOS retains a scoped reference precedent. Neither executes a merge.
   next.graph=propose(next.graph,{from:f.productId,to:f.otherId,relation:'identical',useCase:'catalog-identity',evidence:{reference:next.sourceFingerprint,note},expiresAt:new Date(Date.now()+30*86400000).toISOString(),actor});
   next.graph=approve(next.graph,next.graph.relationships.at(-1).id,{actor,note});
   next.desk=openCase(next.desk,{id:f.id,tenantId:'local',customerId:'catalog-review',supplierId:'woocommerce',externalRef:f.productId,description:from.description,unit:'item',quantity:1},actor);
   next.desk=resolveCase(next.desk,f.id,{sku:f.otherId,actor,note,expectedRevision:0});f.proposal=prepareERPChange(next.desk,f.id);
  }
 }
 f.status=action==='approve'?'approved':'dismissed';f.review={actor,note,at:new Date().toISOString()};next.history.push({findingId,...f.review,action});return next;
}
export function exportCorrections(catalog){
 const approved=catalog.findings.filter(f=>f.status==='approved'&&f.type==='category');ensure(approved.length,'No approved category corrections');
 const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
 return {csv:['ID,Categories',...approved.map(f=>[f.productId,f.correction].map(quote).join(','))].join('\r\n')+'\r\n',sourceFingerprint:catalog.sourceFingerprint,updates:approved.length,instructions:'WooCommerce Products → Import → Update existing products; match by ID. Only Categories is exported. Review on a store backup/staging copy first.'};
}
export async function advise(catalog,findingId,{provider}={}){
 const finding=catalog.findings.find(f=>f.id===findingId);ensure(finding?.otherId,'Select a pair finding');
 return classifyPair(catalog.graph,finding.productId,finding.otherId,'catalog-identity',{provider});
}
