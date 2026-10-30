'use client';
import {useState} from 'react';
import {getDb} from '@/lib/client';
import {FULL_CATALOG_TABLE} from '@/lib/fullCatalog';
import {inspectCatalog2Zip,optimizeProductImage,readZipEntry,type Catalog2Bundle} from '@/lib/catalog2ZipImport';

/** Only shown inside authenticated Catálogo 2 superadmin. All DB/storage writes use the
 * current admin session and Supabase RLS; never expose service-role keys.
 */
export default function Catalog2BulkImages({onCompleted}:{onCompleted:()=>Promise<void>}){
 const [bundle,setBundle]=useState<Catalog2Bundle|null>(null);
 const [reading,setReading]=useState(false);
 const [running,setRunning]=useState(false);
 const [replaceExisting,setReplaceExisting]=useState(false);
 const [includeReview,setIncludeReview]=useState(true);
 const [progress,setProgress]=useState(0);
 const [done,setDone]=useState(0);
 const [skipped,setSkipped]=useState(0);
 const [error,setError]=useState('');
 const [log,setLog]=useState<string[]>([]);
 const append=(text:string)=>setLog(prev=>[...prev.slice(-7),text]);
 async function selectBundle(file:File|undefined){
  setBundle(null);setError('');setLog([]);setProgress(0);setDone(0);setSkipped(0);
  if(!file)return;
  setReading(true);
  try{setBundle(await inspectCatalog2Zip(file));}
  catch(err){setError(err instanceof Error?err.message:'No pude leer el ZIP.');}
  finally{setReading(false);}
 }
 async function publish(){
  if(!bundle||running)return;
  const db=getDb();
  if(!db){setError('Supabase no está configurado.');return;}
  setRunning(true);setError('');setLog([]);setProgress(0);setDone(0);setSkipped(0);
  try{
   // Query only Catálogo 2. The QR and catalog_items never participate.
   const {data,error:queryError}=await db.from(FULL_CATALOG_TABLE)
    .select('id,category,image_url').like('category','cat2-%').limit(2000);
   if(queryError)throw queryError;
   const indexed=new Map<string,{category:string;hasImage:boolean}>();
   for(const row of data||[]){
    const code=/^cat2-(\d{2})-/.exec(row.category)?.[1];
    if(!code)continue;
    const current=indexed.get(code);
    indexed.set(code,{category:row.category,hasImage:Boolean(current?.hasImage||row.image_url)});
   }
   if(indexed.size===0)throw Error('Primero sincronizá las 176 presentaciones desde el apartado anterior de Catálogo 2.');
   const target=bundle.mapping.filter(spec=>includeReview||spec.revision==='LISTO');
   const reused=new Map<string,string>();
   let updated=0,omitted=0;
   for(const [index,spec] of target.entries()){
    const category=indexed.get(spec.categoria_num);
    if(!category){omitted++;append('Sin registrar: categoría '+spec.categoria_num);setSkipped(omitted);continue;}
    if(category.hasImage&&!replaceExisting){omitted++;append('Conservada imagen existente: '+category.category);setSkipped(omitted);continue;}
    let publicUrl=reused.get(spec.nombre_archivo);
    if(!publicUrl){
     const entry=bundle.entries.get('png/'+spec.nombre_archivo);
     if(!entry)throw Error('No encontré '+spec.nombre_archivo+' en el ZIP.');
     const raw=await readZipEntry(bundle.file,entry);
     const image=await optimizeProductImage(raw);
     const slug=spec.nombre_archivo.replace(/\.png$/i,'').replace(/[^a-z0-9_-]/gi,'-');
     const storagePath='catalogo-2/importadas/'+slug+'-'+crypto.randomUUID()+'.webp';
     const {error:uploadError}=await db.storage.from('catalog-images').upload(storagePath,image,{
      contentType:'image/webp',cacheControl:'31536000',upsert:false
     });
     if(uploadError)throw new Error('Error subiendo '+spec.nombre_archivo+': '+uploadError.message);
     publicUrl=db.storage.from('catalog-images').getPublicUrl(storagePath).data.publicUrl;
     reused.set(spec.nombre_archivo,publicUrl);
    }
    let update=db.from(FULL_CATALOG_TABLE)
     .update({image_url:publicUrl}).eq('category',category.category);
    if(!replaceExisting)update=update.is('image_url',null);
    const {data:changed,error:updateError}=await update.select('id');
    if(updateError)throw new Error('Error aplicando '+spec.nombre_archivo+': '+updateError.message);
    if((changed||[]).length===0){omitted++;setSkipped(omitted);append('Sin cambios: '+spec.nombre_archivo);}
    else{updated++;setDone(updated);append('✓ '+spec.nombre_archivo+' · '+changed!.length+' presentaciones');}
    setProgress(Math.round((index+1)/Math.max(1,target.length)*100));
   }
   await onCompleted();
   append('Finalizado: '+updated+' categorías actualizadas, '+omitted+' omitidas. Revisá /catalogo-clientes.');
  }catch(err){setError(err instanceof Error?err.message:'Error durante la importación. Podés reintentar sin duplicar categorías.');}
  finally{setRunning(false);}
 }
 const ready=bundle?.mapping.filter(x=>x.revision==='LISTO').length||0;
 const review=bundle?.mapping.filter(x=>x.revision==='REVISAR').length||0;
 return <section className="panel catalog2-mass-import" aria-label="Importación masiva de imágenes">
  <span className="overline">IMÁGENES DEL PDF · CATÁLOGO 2</span>
  <h2>Importar todas las fotos de productos</h2>
  <p>Seleccioná una sola vez el ZIP <strong>MITOBICEL_CATALOGO2_IMAGENES_4K_Y_MAPEO.zip</strong>. Asociamos automáticamente las fotos con las 53 líneas de productos (176 presentaciones). No toca el catálogo del QR.</p>
  <label className="bulk-import-file">Paquete ZIP de imágenes
   <input type="file" accept=".zip,application/zip" disabled={running||reading} onChange={e=>void selectBundle(e.target.files?.[0])}/>
  </label>
  {reading&&<p>Verificando nombres y archivos del paquete…</p>}
  {bundle&&<>
   <div className="catalog2-import-stats">
    <span><strong>{bundle.mapping.length}</strong> categorías detectadas</span>
    <span><strong>{ready}</strong> recortes listos</span>
    <span><strong>{review}</strong> para revisar</span>
   </div>
   <label className="bulk-import-option"><input type="checkbox" checked={includeReview} disabled={running} onChange={e=>setIncludeReview(e.target.checked)}/> Incluir también las {review} fotos marcadas para revisión visual</label>
   <label className="bulk-import-option"><input type="checkbox" checked={replaceExisting} disabled={running} onChange={e=>setReplaceExisting(e.target.checked)}/> Reemplazar fotos que ya cargué manualmente (opcional)</label>
   <p className="bulk-import-hint">Las imágenes se optimizan a WebP transparente para que el sitio cargue rápido. Los PNG originales 4K permanecen intactos en tu ZIP. No subimos el ZIP completo al servidor, sino una imagen por categoría.</p>
   <button className="btn green" type="button" disabled={running||reading} onClick={()=>void publish()}>
    {running?'Importando fotos…':'Importar '+(includeReview?53:ready)+' categorías a Catálogo 2'}
   </button>
  </>}
  {(running||progress>0)&&<div className="catalog2-mass-progress" role="status" aria-live="polite">
   <div className="catalog2-progress-track"><div style={{width:progress+'%'}}/></div>
   <span>{progress}% · {done} categorías actualizadas · {skipped} omitidas</span>
  </div>}
  {error&&<p className="catalog2-import-error" role="alert">{error}</p>}
  {log.length>0&&<div className="catalog2-import-log" role="status">{log.map((entry,i)=><p key={i}>{entry}</p>)}</div>}
 </section>;
}
