'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {getDb,getDbConfigIssue} from '@/lib/client';
import {Icon} from '@/components/Visuals';
import seedData from '@/data/catalogo2.provincias.26-10.json';
import {
 FULL_CATALOG_TABLE,FULL_CATALOG_PATH,FULL_CATALOG_ADMIN_PATH,
 itemPresentation,makeCategorySlug,formatCatalogPrice,correctLegacyUnpricedRow,type FullCatalogItem
} from '@/lib/fullCatalog';

const numberOrNull=(value:string)=>value.trim()===''?null:Number(value);
const maxUpload=3*1024*1024;
const initialCatalog=seedData as FullCatalogItem[];

export default function FullCatalogAdmin(){
 const [authorized,setAuthorized]=useState(false);
 const [checking,setChecking]=useState(true);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [items,setItems]=useState<FullCatalogItem[]>(initialCatalog);
 const [syncedCount,setSyncedCount]=useState(0);
 const [unpricedLegacyCount,setUnpricedLegacyCount]=useState(0);
 const [importProgress,setImportProgress]=useState<number|null>(null);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState(false);
 const [busyId,setBusyId]=useState<string|null>(null);
 const [selectedCategory,setSelectedCategory]=useState('');
 const [newSize,setNewSize]=useState('');
 const [newTitle,setNewTitle]=useState('');
 const [newSubtitle,setNewSubtitle]=useState('');
 const [newMeasure,setNewMeasure]=useState('');
 const [newPresentation,setNewPresentation]=useState('Bulto');
 const [unsavedTick,setUnsavedTick]=useState(0);
 const dirty=useRef(new Set<string>());
 const editVersions=useRef(new Map<string,number>());
 const fetchVersion=useRef(0);
 const db=getDb();

 const load=useCallback(async()=>{
  const client=getDb();
  if(!client){setError('Faltan las variables públicas de Supabase.');return;}
  const request=++fetchVersion.current;
  const {data,error:fetchError}=await client.from(FULL_CATALOG_TABLE).select('*').order('position',{ascending:true});
  if(request!==fetchVersion.current)return;
  if(fetchError){
   setError('La tabla Catálogo 2 no está disponible: '+fetchError.message+'. Ejecutá supabase/catalogo_2_setup_y_carga.sql en el proyecto MITOBICEL.');
   return;
  }
  setError('');
  const remote=(data||[]) as FullCatalogItem[];
  const imported=new Set(remote.filter(row=>row.id.startsWith('prov26-')).map(row=>row.id));
  setSyncedCount(imported.size);
  const initialById=new Map(initialCatalog.map(row=>[row.id,row]));
  setUnpricedLegacyCount(remote.filter(row=>
    correctLegacyUnpricedRow(row,initialById.get(row.id))!==row
  ).length);
  setItems(previous=>{
   const local=new Map(previous.map(row=>[row.id,row]));
   const combined=new Map(initialCatalog.map(row=>[row.id,row]));
   const extras:FullCatalogItem[]=[];
   for(const row of remote){
    if(combined.has(row.id))
     combined.set(row.id,dirty.current.has(row.id)?local.get(row.id)||row:correctLegacyUnpricedRow(row,combined.get(row.id)));
    else if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(row.id))
     extras.push(dirty.current.has(row.id)?local.get(row.id)||row:row);
   }
   return [...combined.values(),...extras].sort((a,b)=>a.position-b.position);
  });
 },[]);

 useEffect(()=>{
  const client=getDb();
  if(!client){setChecking(false);return;}
  let cancelled=false;
  void (async()=>{
   const {data:{user}}=await client.auth.getUser();
   if(!user){if(!cancelled)setChecking(false);return;}
   const {data:access}=await client.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
   if(!cancelled){setAuthorized(Boolean(access));setChecking(false);}
  })();
  return()=>{cancelled=true;};
 },[]);

 useEffect(()=>{
  if(!authorized)return;
  void load();
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible')void load();
  },20000);
  return()=>window.clearInterval(timer);
 },[authorized,load]);

 const groups=(()=>{
  const keys:string[]=[];
  for(const item of items)if(!keys.includes(item.category))keys.push(item.category);
  return keys.map(category=>({category,items:items.filter(item=>item.category===category)}));
 })();

 useEffect(()=>{
  if(!selectedCategory&&items.length)setSelectedCategory(items[0].category);
 },[items,selectedCategory]);

 async function login(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!db)return;
  setSaving(true);setMessage('');
  try{
   const {data,error:signInError}=await db.auth.signInWithPassword({email,password});
   if(signInError||!data.user)throw new Error(signInError?.message||'No se pudo iniciar sesión.');
   const {data:access,error:accessError}=await db.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
   if(accessError||!access){
    await db.auth.signOut();
    throw new Error('El usuario no tiene permisos para el superadmin.');
   }
   setAuthorized(true);setPassword('');
  }catch(err){
   setMessage(err instanceof Error?err.message:'No se pudo ingresar.');
  }finally{setSaving(false);}
 }

 async function logout(){
  if(db)await db.auth.signOut();
  dirty.current.clear();editVersions.current.clear();
  setAuthorized(false);setItems([]);setMessage('');
 }

 function patch(id:string,key:keyof FullCatalogItem,value:string|number|boolean|null){
  dirty.current.add(id);
  editVersions.current.set(id,(editVersions.current.get(id)||0)+1);
  setUnsavedTick(value=>value+1);
  setItems(previous=>previous.map(item=>item.id===id?{...item,[key]:value}:item));
 }

 async function save(item:FullCatalogItem){
  if(!db||!authorized)return;
  setBusyId(item.id);setMessage('');
  const revision=editVersions.current.get(item.id)||0;
  const {data,error:saveError}=await db.from(FULL_CATALOG_TABLE).update({
   category:item.category,title:item.title,subtitle:item.subtitle,
   measure:item.measure,presentation:item.presentation,
   packages:item.packages,bags_per_roll:item.bags_per_roll,units_per_box:item.units_per_box,
   price_pickup:item.price_pickup,price_delivery:item.price_delivery,
   price_list:item.price_list??null,currency:item.currency||'ARS',
   source_original_price:item.source_original_price??null,source_page:item.source_page??null,
   requires_quote:item.requires_quote??false,
   enabled:item.enabled,featured:item.featured,image_url:item.image_url??null,position:item.position
  }).eq('id',item.id).select('*').maybeSingle();
  if(saveError||!data){
   setMessage('No se guardó '+item.title+' '+item.measure+': '+(saveError?.message||'Supabase no confirmó el cambio.'));
  }else if((editVersions.current.get(item.id)||0)===revision){
   fetchVersion.current++;
   dirty.current.delete(item.id);setUnsavedTick(value=>value+1);
   setItems(previous=>previous.map(x=>x.id===item.id?data as FullCatalogItem:x));
   setMessage('Guardado en Catálogo 2: '+item.title+' '+item.measure+'. El catálogo del QR no cambió.');
  }else{
   setMessage('Se guardó una versión anterior; hubo ediciones durante el guardado. Volvé a guardar la fila.');
  }
  setBusyId(null);
 }

 async function addExistingMeasure(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!db||!authorized||!newSize.trim()||!selectedCategory)return;
  const template=items.find(x=>x.category===selectedCategory);
  if(!template)return;
  setSaving(true);setMessage('');
  const item:FullCatalogItem={
   ...template,id:crypto.randomUUID(),measure:newSize.trim(),
   price_pickup:null,price_delivery:null,price_list:null,requires_quote:true,source_original_price:null,source_page:null,enabled:true,featured:false,
   position:Math.max(0,...items.map(x=>x.position))+1
  };
  const {data,error:insertError}=await db.from(FULL_CATALOG_TABLE).insert(item).select('*').maybeSingle();
  if(insertError||!data)setMessage('No se agregó la medida: '+(insertError?.message||'Sin confirmación de Supabase.'));
  else{setNewSize('');setMessage('Nueva medida agregada al Catálogo 2.');await load();}
  setSaving(false);
 }

 async function addNewLine(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!db||!authorized||!newTitle.trim()||!newMeasure.trim())return;
  const slug=makeCategorySlug(newTitle.trim());
  if(!slug){setMessage('Ingresá un nombre de producto válido.');return;}
  if(items.some(item=>item.category===slug)){
   setMessage('Esta línea ya existe. Usá «Agregar medida» para incorporar otra presentación.');
   return;
  }
  setSaving(true);setMessage('');
  const item:FullCatalogItem={
   id:crypto.randomUUID(),category:slug,title:newTitle.trim(),subtitle:newSubtitle.trim(),
   measure:newMeasure.trim(),presentation:newPresentation.trim()||'Bulto',
   packages:null,bags_per_roll:null,units_per_box:null,
   price_pickup:null,price_delivery:null,price_list:null,currency:'ARS',source_original_price:null,source_page:null,requires_quote:true,featured:false,enabled:true,image_url:null,
   position:Math.max(0,...items.map(x=>x.position))+1
  };
  const {data,error:insertError}=await db.from(FULL_CATALOG_TABLE).insert(item).select('*').maybeSingle();
  if(insertError||!data){
   setMessage('No se creó la línea: '+(insertError?.message||'Sin confirmación de Supabase.'));
  }else{
   setNewTitle('');setNewSubtitle('');setNewMeasure('');setNewPresentation('Bulto');
   setSelectedCategory(slug);setMessage('Nueva línea publicada en Catálogo 2.');
   await load();
  }
  setSaving(false);
 }

 async function importPreparedCatalog(){
  if(!db||!authorized)return;
  if(error){setMessage('Primero ejecutá el SQL de configuración en Supabase para crear la tabla del Catálogo 2.');return;}
  setSaving(true);setImportProgress(0);setMessage('');
  try{
   const {data:existing,error:queryError}=await db.from(FULL_CATALOG_TABLE)
    .select('id,price_list,currency,requires_quote,source_original_price');
   if(queryError)throw queryError;
   const known=new Map((existing||[]).map(row=>[row.id,row]));
   const missing=initialCatalog.filter(row=>!known.has(row.id));
   const toCorrect=initialCatalog.filter(official=>{
    const current=known.get(official.id);
    return current&&correctLegacyUnpricedRow(current as FullCatalogItem,official)!==current;
   });
   const operations=Math.ceil(missing.length/20)+toCorrect.length;
   let done=0,corrected=0;
   for(let i=0;i<missing.length;i+=20){
    const batch=missing.slice(i,i+20);
    const {error:batchError}=await db.from(FULL_CATALOG_TABLE)
     .upsert(batch,{onConflict:'id',ignoreDuplicates:true});
    if(batchError)throw batchError;
    setImportProgress(Math.round(++done/Math.max(1,operations)*100));
   }
   // Actualizamos únicamente los 14 importes antiguos que estaban NULL,
   // si siguen coincidiendo con el precio original del PDF. No se pisan
   // ediciones posteriores del administrador.
   for(const official of toCorrect){
    const {data:updated,error:updateError}=await db.from(FULL_CATALOG_TABLE)
     .update({price_list:official.price_list,requires_quote:false})
     .eq('id',official.id)
     .eq('source_original_price',official.source_original_price!)
     .eq('requires_quote',true).is('price_list',null)
     .select('id');
    if(updateError)throw updateError;
    corrected+=(updated||[]).length;
    setImportProgress(Math.round(++done/Math.max(1,operations)*100));
   }
   await load();
   setMessage(missing.length||corrected
    ?'Sincronizadas '+missing.length+' presentaciones nuevas y corregidos '+corrected+' precios que estaban sin cargar. No se sobrescribieron precios personalizados.'
    :'El Catálogo 2 ya tiene sus 176 precios de lista sincronizados. No hubo cambios.');
  }catch(err){
   setMessage('No se pudo terminar la sincronización: '+(err instanceof Error?err.message:String(err))+'. Los datos ya guardados permanecen; podés reintentar.');
  }finally{
   setSaving(false);setImportProgress(null);
  }
 }

 async function removeRow(item:FullCatalogItem){
  if(!db||!authorized)return;
  if(!window.confirm('¿Eliminar '+item.title+' · '+item.measure+' solamente del Catálogo 2?'))return;
  setBusyId(item.id);
  const {data,error:deleteError}=await db.from(FULL_CATALOG_TABLE).delete().eq('id',item.id).select('id').maybeSingle();
  if(deleteError||!data){
   setMessage('No se eliminó: '+(deleteError?.message||'Supabase no confirmó el cambio.'));
  }else{
   dirty.current.delete(item.id);editVersions.current.delete(item.id);
   setItems(previous=>previous.filter(x=>x.id!==item.id));
   setMessage('Presentación retirada del Catálogo 2. El catálogo del QR no se modificó.');
  }
  setBusyId(null);
 }

 async function uploadCategoryImage(category:string,file:File|undefined){
  if(!db||!authorized||!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>maxUpload){
   setMessage('Seleccioná una imagen PNG, JPG o WEBP de hasta 3 MB.');
   return;
  }
  setSaving(true);setMessage('Subiendo imagen...');
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const name='catalogo-2/'+category+'-'+crypto.randomUUID()+'.'+ext;
  const {error:uploadError}=await db.storage.from('catalog-images').upload(name,file,{contentType:file.type,upsert:false});
  if(uploadError){setMessage('No se pudo subir: '+uploadError.message);setSaving(false);return;}
  const url=db.storage.from('catalog-images').getPublicUrl(name).data.publicUrl;
  const {data,error:updateError}=await db.from(FULL_CATALOG_TABLE).update({image_url:url}).eq('category',category).select('id');
  if(updateError||!data?.length){
   setMessage('Imagen subida, pero no aplicada a Catálogo 2: '+(updateError?.message||'Sin filas actualizadas.'));
  }else{
   setItems(previous=>previous.map(x=>x.category===category?{...x,image_url:url}:x));
   setMessage('Imagen publicada solamente en Catálogo 2.');
  }
  setSaving(false);
 }

 return <div className="app full-catalog-admin">
  <header className="header"><div className="wrap head-inner">
   <a href={FULL_CATALOG_PATH} className="brand-logo" aria-label="Ver Catálogo 2"><img src="/logo-mitobicel.png" alt="MITOBICEL"/></a>
   <div className="head-cta"><a href={FULL_CATALOG_PATH} className="admin-link">Ver Catálogo 2 ↗</a></div>
  </div></header>
  <main className="wrap admin-main">
   <div className="admin-banner"><span className="overline">GESTIÓN INDEPENDIENTE · CATÁLOGO 2</span><h1>Catálogo 2 <em>MITOBICEL.</em></h1>
    <p>Catálogo completo para clientes habituales. Los cambios de esta página no modifican los precios del QR ni el Catálogo 1.</p>
   </div>

   {!db?<section className="panel"><h2>Configurar Supabase</h2><p>{getDbConfigIssue()||'No se pudo inicializar Supabase.'}</p></section>:
    checking?<section className="panel">Verificando autorización del superadmin…</section>:
    !authorized?<section className="panel login-card"><span className="overline">ACCESO RESTRINGIDO</span><h2>Ingresá al superadmin</h2>
     <p>Usá exactamente el mismo usuario y contraseña del administrador MITOBICEL.</p>
     <form onSubmit={login}>
      <label>Correo electrónico<input value={email} type="email" autoComplete="username" onChange={e=>setEmail(e.target.value)} required/></label>
      <label>Contraseña<input value={password} type="password" autoComplete="current-password" onChange={e=>setPassword(e.target.value)} required/></label>
      <button type="submit" className="btn red" disabled={saving}>{saving?'Verificando…':'Ingresar al Catálogo 2'}</button>
     </form>
    </section>:
    <div className="admin-content">
     <div className="admin-catalog-switch" role="navigation" aria-label="Administrar catálogos">
      <a href="/admin" className="admin-catalog-tab">Catálogo 1 · Tarjetas QR</a>
      <a href={FULL_CATALOG_ADMIN_PATH} className="admin-catalog-tab active" aria-current="page">Catálogo 2 · Clientes</a>
      <a href={FULL_CATALOG_PATH} className="admin-catalog-preview" target="_blank" rel="noopener noreferrer">Vista pública ↗</a>
     </div>
     <div className="admin-summary">
      <div><strong>{items.length}</strong><span>Presentaciones en catálogo</span></div>
      <div><strong>{groups.length}</strong><span>Líneas de producto</span></div>
      <div><strong>{syncedCount}/176</strong><span>Sincronizadas en Supabase</span></div>
      <button type="button" className="btn dark" onClick={()=>void logout()}>Cerrar sesión</button>
     </div>
     {error&&<div className="admin-warning" role="alert"><strong>Falta activar la base de Catálogo 2.</strong><p>{error}</p></div>}
     <section className="panel catalog-2-import">
      <span className="overline">CATÁLOGO COMPLETO · LISTA PROVINCIAS 26/10</span>
      <h2>176 presentaciones preparadas con precios de lista</h2>
      <p>144 presentaciones mayoristas con $4.000 de descuento; 14 precios por kilo, unidad o paquete suelto conservados tal como figuran en el PDF; 18 precios en USD sin convertir. Las 176 variantes tienen precio de lista.</p>
      <p>La web de clientes ya muestra las 176 variantes desde su versión publicada. Para editarlas y guardarlas en la base, sincronizalas con Supabase. Esta importación <strong>incorpora registros faltantes y corrige los antiguos precios vacíos</strong>, sin sobrescribir importes que ya modificaste.</p>
      <button className="btn green" type="button" disabled={saving||!!error||(syncedCount>=176&&unpricedLegacyCount===0)} onClick={()=>void importPreparedCatalog()}>
       {saving&&importProgress!==null?'Sincronizando '+importProgress+'%':syncedCount>=176&&unpricedLegacyCount===0?'176 productos con precios sincronizados ✓':'Sincronizar Catálogo 2'+(unpricedLegacyCount?' · corregir '+unpricedLegacyCount+' precios':'')}
      </button>
      {importProgress!==null&&<div className="catalog-2-progress" role="status"><div style={{width:importProgress+'%'}}/></div>}
      <small>Si aparece «Falta activar la base», ejecutá primero <code>supabase/catalogo_2_setup_y_carga.sql</code> en el proyecto MITOBICEL.</small>
     </section>
     <section className="panel"><span className="overline">CREAR PRODUCTOS</span><h2>Agregar nuevas líneas al Catálogo 2</h2>
      <p>Las líneas del PDF ya están preparadas. También podés añadir productos y medidas nuevos desde aquí.</p>
      <form className="full-admin-add-form" onSubmit={addNewLine}>
       <label>Producto o línea<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Ej. Bolsas consorcio" required/></label>
       <label>Subtítulo<input value={newSubtitle} onChange={e=>setNewSubtitle(e.target.value)} placeholder="Ej. Línea industrial"/></label>
       <label>Primera medida<input value={newMeasure} onChange={e=>setNewMeasure(e.target.value)} placeholder="Ej. 80 × 110" required/></label>
       <label>Presentación<input value={newPresentation} onChange={e=>setNewPresentation(e.target.value)} placeholder="Bulto, Caja, Rollo..."/></label>
       <button type="submit" className="btn green" disabled={saving||!!error}>+ Crear línea</button>
      </form>
      {groups.length>0&&<form className="full-admin-add-measure" onSubmit={addExistingMeasure}>
       <label>Línea existente<select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}>
        {groups.map(group=><option value={group.category} key={group.category}>{group.items[0].title}</option>)}
       </select></label>
       <label>Nueva medida<input value={newSize} onChange={e=>setNewSize(e.target.value)} placeholder="Ej. 50 × 70" required/></label>
       <button type="submit" className="btn dark" disabled={saving||!!error||!newSize.trim()}>+ Agregar medida</button>
      </form>}
     </section>

     <section className="panel"><div className="section-top"><div><span className="overline">EDICIÓN RÁPIDA · SOLO CATÁLOGO 2</span><h2>Productos, precios y presentaciones</h2>
      <p>Los cambios pendientes se conservan mientras escribís. Cada precio se publica en el Catálogo 2 al presionar «Guardar medida».</p>
     </div></div>
      {!error&&groups.length===0&&<p>Creá una línea para comenzar.</p>}
      {groups.map(group=><div key={group.category} className="admin-category">
       <div className="category-admin-header"><div><h3>{group.items[0].title}</h3><p>Imagen para todas las medidas de esta línea en Catálogo 2</p></div>
        <label className="btn white upload-control"><Icon name="upload"/> Elegir imagen<input type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={e=>{void uploadCategoryImage(group.category,e.target.files?.[0]);e.currentTarget.value='';}}/></label>
       </div>
       {group.items.map(item=><div key={item.id} className={'edit-row'+(dirty.current.has(item.id)?' edit-row-dirty':'')}>
        <div className="edit-fields">
         <label>Producto<input value={item.title} onChange={e=>patch(item.id,'title',e.target.value)}/></label>
         <label>Subtítulo<input value={item.subtitle} onChange={e=>patch(item.id,'subtitle',e.target.value)}/></label>
         <label>Presentación<input value={item.presentation} onChange={e=>patch(item.id,'presentation',e.target.value)}/></label>
         <label>Medida<input value={item.measure} onChange={e=>patch(item.id,'measure',e.target.value)}/></label>
         <label>Precio de lista<input type="number" inputMode="decimal" min="0" step="0.01" value={item.price_list??''} onChange={e=>{patch(item.id,'price_list',numberOrNull(e.target.value));patch(item.id,'requires_quote',!e.target.value.trim());}} placeholder="A confirmar"/></label>
         <label>Moneda<select value={item.currency||'ARS'} onChange={e=>patch(item.id,'currency',e.target.value as 'ARS'|'USD')}><option value="ARS">Pesos argentinos (ARS)</option><option value="USD">Dólares (USD)</option></select></label>
         <label>Retiro por fábrica $<input type="number" inputMode="decimal" min="0" step="0.01" value={item.price_pickup??''} onChange={e=>patch(item.id,'price_pickup',numberOrNull(e.target.value))} placeholder="Sin cargar"/></label>
         <label>Con envío $<input type="number" inputMode="decimal" min="0" step="0.01" value={item.price_delivery??''} onChange={e=>patch(item.id,'price_delivery',numberOrNull(e.target.value))} placeholder="Sin cargar"/></label>
         <label>{item.category==='arranque'?'Rollos/bulto':'Paquetes/bulto'}<input type="number" min="0" value={item.packages??''} onChange={e=>patch(item.id,'packages',numberOrNull(e.target.value))}/></label>
         <label>Bolsas por rollito<input type="number" min="0" value={item.bags_per_roll??''} onChange={e=>patch(item.id,'bags_per_roll',numberOrNull(e.target.value))}/></label>
         <label>Unidades por caja<input type="number" min="0" value={item.units_per_box??''} onChange={e=>patch(item.id,'units_per_box',numberOrNull(e.target.value))}/></label>
         <label>Orden<input type="number" min="0" value={item.position} onChange={e=>patch(item.id,'position',Number(e.target.value)||0)}/></label>
         <div className="catalog-provenance">Origen: {item.source_page?'página '+item.source_page+' del PDF':'agregado desde el admin'} · Precio original: {formatCatalogPrice(item.source_original_price,item.currency||'ARS')}</div>
        </div>
        <div className="edit-actions">
         <label><input type="checkbox" checked={item.enabled} onChange={e=>patch(item.id,'enabled',e.target.checked)}/> Visible</label>
         <span className={'edit-status'+(dirty.current.has(item.id)?' unsaved':'')}>{dirty.current.has(item.id)?'● Cambios sin guardar':'✓ Guardado'}</span>
         <button type="button" className="btn green" disabled={!!busyId||saving} onClick={()=>void save(item)}>{busyId===item.id?'Guardando…':'Guardar medida'}</button>
         <button type="button" className="btn subtle full-admin-remove" disabled={!!busyId||saving} onClick={()=>void removeRow(item)}>Eliminar</button>
        </div>
       </div>)}
      </div>)}
     </section>
     <p className="admin-note">Por seguridad, únicamente los usuarios registrados en <code>admin_users</code> pueden escribir en el Catálogo 2. La dirección de clientes funciona sin inicio de sesión.</p>
    </div>
   }
   {message&&<p role="status" className="toast">{message}</p>}
  </main>
 </div>;
}
