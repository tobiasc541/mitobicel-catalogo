'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import QRCode from 'qrcode';
import {getDb,getDbConfigIssue} from '@/lib/client';
import {Icon} from '@/components/Visuals';
import Campaigns from '@/components/Campaigns';
import IndustrialBar from '@/components/IndustrialBar';
import SocialProof from '@/components/SocialProof';
import {SocialQuestions,WholesaleFAQ} from '@/components/Conversion';
import WholesaleCart from '@/components/WholesaleCart';
import type {OrderLine} from '@/lib/order';

type Item={id:string;category:string;title:string;subtitle:string;measure:string;presentation:string;packages:number|null;bags_per_roll:number|null;units_per_box:number|null;price_pickup:number|null;price_delivery:number|null;featured:boolean;enabled:boolean;position:number;image_url?:string|null};
const seeds:Item[]=[
 ['cam-32','camiseta','Bolsas camiseta','Línea verde · Más que premium','32 × 40',20],
 ['cam-40','camiseta','Bolsas camiseta','Línea verde · Más que premium','40 × 50',20],
 ['cam-45','camiseta','Bolsas camiseta','Línea verde · Más que premium','45 × 60',20],
 ['arr-1','arranque','Bolsas de arranque','Todas las medidas para tu comercio','15 × 20',null],
 ['arr-2','arranque','Bolsas de arranque','Todas las medidas para tu comercio','15 × 25',null],
 ['arr-3','arranque','Bolsas de arranque','Todas las medidas para tu comercio','20 × 30',null],
 ['arr-4','arranque','Bolsas de arranque','Todas las medidas para tu comercio','25 × 35',null],
 ['arr-5','arranque','Bolsas de arranque','Todas las medidas para tu comercio','30 × 40',null],
 ['res-1','residuos','Bolsas de basura en rollito fondo estrella','Residuos premium','45 × 60',null],
 ['res-2','residuos','Bolsas de basura en rollito fondo estrella','Residuos premium','50 × 70',null],
 ['res-3','residuos','Bolsas de basura en rollito fondo estrella','Residuos premium','60 × 90',null],
 ['fol-1','folex','Folex','Presentaciones mayoristas','14 × 14',null],
 ['fol-2','folex','Folex','Presentaciones mayoristas','14 × 28',null],
 ['fol-3','folex','Folex','Presentaciones mayoristas','20 × 25',null],
 ['muns-45','munsmawa','Film verdulero Munsmawa','Promoción semanal · Caja por 9 unidades','45 cm × 350 m',null]
].map((a,i)=>({id:String(a[0]),category:String(a[1]),title:String(a[2]),subtitle:String(a[3]),measure:String(a[4]),presentation:String(a[1])==='munsmawa'?'Caja':'Bulto',packages:a[5] as number|null,bags_per_roll:null,units_per_box:a[1]==='munsmawa'?9:null,price_pickup:a[1]==='munsmawa'?46725:null,price_delivery:null,featured:a[1]==='munsmawa',enabled:true,position:i+1,image_url:null}));
const categories=['camiseta','arranque','residuos','folex','munsmawa'];
const money=(n:number|null)=>n===null?'Consultar precio':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const whatsapp=(text:string)=>'https://wa.me/541162190702?text='+encodeURIComponent(text);
const num=(s:string)=>s.trim()===''?null:Math.max(0,Number(s)||0);
const categoryLabel=(c:string)=>({camiseta:'Bolsas camiseta',arranque:'Bolsas de arranque',residuos:'Bolsas de basura en rollito fondo estrella',folex:'Folex',munsmawa:'Film verdulero Munsmawa'} as Record<string,string>)[c]||c;

function BrandLogo(){const [missing,setMissing]=useState(false);return <a href="/" className="logo brand-logo" aria-label="MITOBICEL catálogo">{!missing&&<img src="/logo-mitobicel.png" alt="MITOBICEL" onError={()=>setMissing(true)}/>}{missing&&<span className="brand-fallback"><span className="brand-stroke">↝</span>MITOBICEL</span>}</a>;}
function FactoryPhoto(){const [fallback,setFallback]=useState(false);return <img src={fallback?'/fabrica.svg':'/mitobicel-fabrica.png'} alt="MITOBICEL, fábrica de bolsas — Av. San Martín 249, Burzaco. Horarios y WhatsApp." className="factory-picture" onError={()=>setFallback(true)}/>;}

export default function Store({admin=false}:{admin?:boolean}){
 const [items,setItems]=useState<Item[]>(seeds);
 // Los cambios del formulario no se reemplazan por lecturas periódicas/realtime.
 const dirtyItems=useRef(new Set<string>());
 const editVersions=useRef(new Map<string,number>());
 const requestVersion=useRef(0);
 const [,setEditTick]=useState(0);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(admin);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[configured,setConfigured]=useState(true);
 const [search,setSearch]=useState('');
 const [orderLines,setOrderLines]=useState<OrderLine[]>([]);
 const addOrder=(line:OrderLine)=>setOrderLines(prev=>{const old=prev.find(x=>x.key===line.key);return old?prev.map(x=>x.key===line.key?{...x,quantity:x.quantity+line.quantity}:x):[...prev,line]});
 const updateOrder=(key:string,qty:number)=>setOrderLines(prev=>prev.map(x=>x.key===key?{...x,quantity:qty}:x));
 const removeOrder=(key:string)=>setOrderLines(prev=>prev.filter(x=>x.key!==key));
 const [qrUrl,setQrUrl]=useState(''),[qr,setQr]=useState('');
 const [newCategory,setNewCategory]=useState('camiseta'),[newSize,setNewSize]=useState('');
 const db=getDb();
 const load=useCallback(async(isAdmin=false)=>{
   const client=getDb();
   if(!client){setConfigured(false);return;}
   const thisRequest=++requestVersion.current;
   const q=client.from('catalog_items').select('*').order('position',{ascending:true});
   const {data,error}=await (isAdmin?q:q.eq('enabled',true));
   if(thisRequest!==requestVersion.current)return;
   if(error){setMessage('No se pudieron consultar los productos: '+error.message);return;}
   setItems(previous=>{
      const local=new Map(previous.map(row=>[row.id,row]));
      return ((data||[]) as Item[]).map(remote=>isAdmin&&dirtyItems.current.has(remote.id)
         ?local.get(remote.id)||remote
         :remote);
   });
   setConfigured(true);
 },[]);

 useEffect(()=>{if(typeof window!=='undefined')setQrUrl(window.location.origin+'/');
   const client=getDb();
   if(!client){setConfigured(false);setChecking(false);return;}
   if(admin){
      void (async()=>{const {data}=await client.auth.getUser();if(data.user){
         const {data:access}=await client.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
         if(access){setAuthorized(true);await load(true);}
      }setChecking(false);})();
   }else{void load(false);}
   const channel=client.channel('mitobicel-catalogo')
      .on('postgres_changes',{event:'*',schema:'public',table:'catalog_items'},()=>void load(admin))
      .subscribe();
   const interval=window.setInterval(()=>{if(!admin||document.visibilityState==='visible')void load(admin);},15000);
   return()=>{window.clearInterval(interval);void client.removeChannel(channel)};
 },[admin,load]);
 async function login(e:React.FormEvent){e.preventDefault();if(!db)return;setBusy(true);setMessage('');
   const {data,error}=await db.auth.signInWithPassword({email,password});
   if(error||!data.user){setMessage('No se pudo ingresar: '+(error?.message||'revisá los datos'));setBusy(false);return;}
   const {data:access,error:accessErr}=await db.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
   if(accessErr||!access){await db.auth.signOut();setMessage('Este usuario no tiene permisos de superadministrador.');setBusy(false);return;}
   setAuthorized(true);setPassword('');await load(true);setBusy(false);
 }
 async function logout(){if(db)await db.auth.signOut();dirtyItems.current.clear();editVersions.current.clear();setAuthorized(false);setEmail('');setMessage('');}
 function patch(id:string,key:keyof Item,value:string|number|boolean|null){
   dirtyItems.current.add(id);
   editVersions.current.set(id,(editVersions.current.get(id)||0)+1);
   setEditTick(t=>t+1);
   setItems(prev=>prev.map(item=>item.id===id?{...item,[key]:value}:item));
 }
 async function save(item:Item){
   if(!db||!authorized)return;
   setBusy(true);
   setMessage('');
   const version=editVersions.current.get(item.id)||0;
   // .select() permite verificar que la fila se guardó realmente,
   // evitando informar éxito si RLS no autorizó el UPDATE.
   const {data,error}=await db.from('catalog_items').update({
    category:item.category,title:item.title,subtitle:item.subtitle,
    measure:item.measure,presentation:item.presentation,packages:item.packages,
    bags_per_roll:item.bags_per_roll,units_per_box:item.units_per_box,
    price_pickup:item.price_pickup,price_delivery:item.price_delivery,
    featured:item.featured,enabled:item.enabled,position:item.position
   }).eq('id',item.id).select('*').maybeSingle();
   if(error||!data){
     setMessage('No se guardó '+item.title+' '+item.measure+': '+(error?.message||'Supabase no confirmó la actualización. Revisá permisos del administrador.'));
   }else if((editVersions.current.get(item.id)||0)===version){
     requestVersion.current++;
     dirtyItems.current.delete(item.id);
     setEditTick(t=>t+1);
     setItems(prev=>prev.map(row=>row.id===item.id?data as Item:row));
     setMessage('Guardado y verificado en Supabase: '+item.title+' '+item.measure+'.');
   }else{
     setMessage('La última versión se guardó, pero hiciste otros cambios mientras se enviaba. Volvé a guardar esta fila.');
   }
   setBusy(false);
 }

 async function addMeasure(){if(!db||!authorized||!newSize.trim())return;setBusy(true);
   const same=items.filter(x=>x.category===newCategory);
   const template=same[0];
   const item:Item={id:crypto.randomUUID(),category:newCategory,title:template?.title||categoryLabel(newCategory),subtitle:template?.subtitle||'',measure:newSize.trim(),presentation:template?.presentation||'Bulto',packages:template?.packages??null,bags_per_roll:null,units_per_box:template?.units_per_box??null,price_pickup:null,price_delivery:null,featured:false,enabled:true,position:Math.max(0,...items.map(x=>x.position))+1,image_url:template?.image_url??null};
   const {error}=await db.from('catalog_items').insert(item);
   if(error)setMessage(error.message);else{setNewSize('');setMessage('Medida agregada');await load(true);}setBusy(false);
 }
 async function uploadCategoryImage(category:string,file:File|undefined){
   if(!file||!db||!authorized)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setMessage('Usá PNG, JPG o WEBP.');return;}
   if(file.size>3*1024*1024){setMessage('La imagen debe pesar menos de 3 MB.');return;}
   setBusy(true);setMessage('Subiendo imagen...');
   const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
   const path='productos/'+category+'-'+crypto.randomUUID()+'.'+ext;
   const {error}=await db.storage.from('catalog-images').upload(path,file,{contentType:file.type,upsert:false});
   if(error){setMessage('Error al subir: '+error.message);setBusy(false);return;}
   const {data}=db.storage.from('catalog-images').getPublicUrl(path);
   const {error:updateError}=await db.from('catalog_items').update({image_url:data.publicUrl}).eq('category',category);
   if(updateError){setMessage('Foto subida pero no publicada: '+updateError.message);}else{setMessage('Foto actualizada en todos los tamaños.');await load(true);}
   setBusy(false);
 }
 async function removeCategoryImage(category:string){if(!db||!authorized)return;setBusy(true);
   const {error}=await db.from('catalog_items').update({image_url:null}).eq('category',category);
   setMessage(error?'Error: '+error.message:'Imagen retirada del catálogo.');if(!error)await load(true);setBusy(false);
 }
 async function createQR(){try{const u=new URL(qrUrl);if(u.protocol!=='https:')throw new Error('Ingresá una dirección HTTPS.');
   if(u.hostname.includes('-git-'))throw new Error('No uses una dirección de vista previa de Vercel.');
   const image=await QRCode.toDataURL(u.toString(),{width:720,margin:3,color:{dark:'#08130e',light:'#ffffff'}});
   setQr(image);setMessage('QR generado. Guardalo solamente después de confirmar el dominio definitivo.');
 }catch(e){setMessage(e instanceof Error?e.message:'URL no válida');}}
 const norm=(s:string)=>s.toLocaleLowerCase('es').replace(/[×x]/g,'x').replace(/\s+/g,'');
 const visible=items.filter(p=>p.enabled&&p.category!=='film').filter(p=>norm(p.title+' '+p.measure+' '+p.subtitle).includes(norm(search)));
 const groups=categories.map(c=>({key:c,items:visible.filter(p=>p.category===c)})).filter(g=>g.items.length);
 return <div className="app">
   <IndustrialBar/>
   <header className="header"><div className="wrap head-inner">
     <BrandLogo/>
     {!admin&&<nav><a href="#promociones">Promociones</a><a href="#productos">Productos</a><a href="#compra">Cómo comprar</a></nav>}
     <div className="head-cta"><a className="btn green" href={whatsapp('Hola Mitobicel, quiero consultar por precios mayoristas')} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/> WhatsApp para pedidos <span>↗</span></a>{admin&&<a className="admin-link" href="/">← Volver al catálogo</a>}</div>
   </div></header>
   {admin?<main className="wrap admin-main">
     <div className="admin-banner"><span className="overline">GESTIÓN DE CATÁLOGO</span><h1>Centro de control <em>MITOBICEL</em></h1><p>Actualizá los precios y promociones en segundos, sin modificar código ni generar otro QR.</p></div>
     {!configured?<section className="panel"><h2>Conectar base de datos</h2><p>{getDbConfigIssue()||"La conexión con Supabase no está lista. Comprobá el último despliegue Production en Vercel."} Revisá las variables del proyecto y verificá que el despliegue más reciente figure como Ready.</p></section>:
     checking?<section className="panel">Verificando acceso...</section>:
     !authorized?<section className="login-card panel"><span className="overline">SOLO PERSONAL AUTORIZADO</span><h2>Ingresá a tu cuenta</h2><p>El catálogo es público. Esta sección es privada.</p><form onSubmit={login}><label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" placeholder="tu@correo.com"/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" placeholder="Tu contraseña"/></label><button className="btn red" disabled={busy} type="submit">{busy?'Ingresando...':'Ingresar al superadmin →'}</button></form></section>:
     <div className="admin-content"><div className="admin-summary"><div><strong>{items.length}</strong><span>Presentaciones</span></div><div><strong>{categories.length}</strong><span>Líneas de producto</span></div><div><strong>{items.filter(x=>x.enabled).length}</strong><span>Publicadas</span></div><button className="btn dark" onClick={()=>void logout()}>Cerrar sesión</button></div>
       <Campaigns admin products={items}/><section className="panel qr-panel"><div><span className="overline">TU QR DEFINITIVO</span><h2>Un solo QR, siempre los últimos precios.</h2><p>Generalo con el dominio público de producción. El QR no cambia cuando actualizás tus precios.</p><label>Dirección definitiva del catálogo<input value={qrUrl} onChange={e=>setQrUrl(e.target.value)} placeholder="https://tu-dominio.com/"/></label><button className="btn green" onClick={()=>void createQR()}>Generar QR</button></div>{qr&&<div className="qr-result"><img src={qr} alt="QR de Mitobicel"/><a download="mitobicel-qr-catalogo.png" href={qr} className="btn dark">Descargar PNG</a></div>}</section>
       <section className="panel"><div className="section-top"><div><span className="overline">EDICIÓN RÁPIDA</span><h2>Precios y presentaciones</h2><p>Los cambios se conservan mientras editás, aunque se actualice el catálogo. Guardá cada fila para publicar y confirmar los datos en Supabase. Las ofertas semanales se administran arriba en «Promociones y contenido de fábrica».</p></div></div>
       {categories.map(c=><div key={c} className="admin-category"><div className="category-admin-header"><div><h3>{categoryLabel(c)}</h3><p>Imagen para todas las medidas de esta categoría</p></div><div className="category-upload"><label className="btn white upload-control"><Icon name="upload"/> Elegir imagen<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{void uploadCategoryImage(c,e.target.files?.[0]);e.currentTarget.value='';}}/></label>{items.some(p=>p.category===c&&p.image_url)&&<button type="button" className="btn subtle" disabled={busy} onClick={()=>void removeCategoryImage(c)}>Quitar imagen</button>}</div></div>{items.filter(p=>p.category===c).map(p=><div key={p.id} className={"edit-row"+(dirtyItems.current.has(p.id)?" edit-row-dirty":"")}><div className="edit-fields">
         <label>Producto<input value={p.title} onChange={e=>patch(p.id,'title',e.target.value)}/></label><label>Subtítulo<input value={p.subtitle} onChange={e=>patch(p.id,'subtitle',e.target.value)}/></label><label>Presentación<input value={p.presentation} onChange={e=>patch(p.id,'presentation',e.target.value)}/></label><label>Medida<input value={p.measure} onChange={e=>patch(p.id,'measure',e.target.value)}/></label>
         <label>Retiro por fábrica $<input inputMode="decimal" type="number" min="0" step="0.01" value={p.price_pickup??''} onChange={e=>patch(p.id,'price_pickup',num(e.target.value))} placeholder="Sin cargar"/></label>
         <label>Con envío $<input inputMode="decimal" type="number" min="0" step="0.01" value={p.price_delivery??''} onChange={e=>patch(p.id,'price_delivery',num(e.target.value))} placeholder="Sin cargar"/></label>
         <label>{p.category==='arranque'?'Rollos/bulto':'Paquetes/bulto'}<input type="number" min="0" value={p.packages??''} onChange={e=>patch(p.id,'packages',num(e.target.value))}/></label>
         <label>Bolsas/rollito<input type="number" min="0" value={p.bags_per_roll??''} onChange={e=>patch(p.id,'bags_per_roll',num(e.target.value))}/></label>
         <label>Unid./caja<input type="number" min="0" value={p.units_per_box??''} onChange={e=>patch(p.id,'units_per_box',num(e.target.value))}/></label>
       </div><div className="edit-actions"><label><input type="checkbox" checked={p.enabled} onChange={e=>patch(p.id,'enabled',e.target.checked)}/> Visible</label><span className={"edit-status"+(dirtyItems.current.has(p.id)?" unsaved":"")}>{dirtyItems.current.has(p.id)?"● Cambios sin guardar":"✓ Sin cambios pendientes"}</span><button type="button" disabled={busy} className="btn green" onClick={()=>void save(p)}>{busy?"Guardando...":"Guardar medida"}</button></div></div>)}</div>)}
       <div className="add-row"><label>Categoría<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{categoryLabel(c)}</option>)}</select></label><label>Nueva medida<input placeholder="Ej. 50 × 70" value={newSize} onChange={e=>setNewSize(e.target.value)}/></label><button className="btn dark" onClick={()=>void addMeasure()} disabled={busy||!newSize.trim()}>+ Agregar medida</button></div></section>
       <p className="admin-note">Por seguridad, solo los usuarios cargados en la tabla <code>admin_users</code> pueden modificar datos. Nunca publiques claves privadas en GitHub.</p>
     </div>}
     {message&&<p role="status" className="toast">{message}</p>}
   </main>:<main>
      <section className="hero wrap"><div className="hero-left"><div className="eyebrow hero-pill"><span className="live-dot"/> FÁBRICA DIRECTA DE POLIETILENO · SIN INTERMEDIARIOS</div><h1>Calidad que se nota.<br/><em>Precio que conviene.</em></h1><p className="lead">Fabricando calidad al mejor precio hace más de <strong>15 años.</strong> Fabricantes directos, sin intermediarios, para negocios de todo el país.</p><div className="hero-buttons"><a className="btn red" href="#productos">VER CATÁLOGO Y PRECIOS DE FÁBRICA <span>↓</span></a></div><SocialProof placement="hero"/><div className="hero-stats"><div><small>DESDE</small><b>50 <i>bultos</i></b><span>Pedido mínimo</span></div><div><small>ORIGEN</small><b>100%</b><span>Directo de fábrica</span></div><div><small>CATÁLOGO</small><b>5 <i>líneas</i></b><span>Productos mayoristas</span></div></div></div><div className="hero-right"><div className="hero-image-label">VISITANOS EN FÁBRICA</div><FactoryPhoto/><div className="factory-location"><div><strong>📍 Av. San Martín 249, Burzaco</strong><small>Vení a conocer la fábrica y probar nuestra calidad.</small></div><a className="factory-map" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=Avenida+San+Martin+249+Burzaco+Buenos+Aires">📍 ABRIR EN GOOGLE MAPS ↗</a></div></div></section>
      <div className="trust-strip"><div className="wrap trust-grid"><div><span><Icon name="factory"/></span><b>Fabricante directo</b><small>Sin intermediarios</small></div><div><span><Icon name="award"/></span><b>Calidad premium</b><small>Precios competitivos</small></div><div><span><Icon name="package"/></span><b>Retiro por fábrica</b><small>Conocé nuestros productos</small></div><div><span><Icon name="truck"/></span><b>Envíos</b><small>Desde 100 bultos</small></div></div></div>
      <Campaigns products={items} onAdd={addOrder}/>
      {!configured&&<div className="wrap"><p className="demo-note">Catálogo en modo demostración. {getDbConfigIssue()||"No se pudo inicializar Supabase. Revisá el último despliegue en Vercel."}</p></div>}
      <section className="wrap section" id="productos"><div className="section-top"><div><span className="overline">CATÁLOGO MAYORISTA ACTUALIZADO</span><h2>Todo lo que tu <em>negocio necesita.</em></h2><p>Consultá el precio para retirar por fábrica o recibir en tu local.</p></div></div><div className="filters"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="⌕  Buscar producto o medida..." aria-label="Buscar productos o medidas"/></div>
       <div className="product-grid masonry-grid">{[0,1].map(column=><div className="masonry-column" key={column}>{groups.filter((_,i)=>i%2===column).map(g=><article key={g.key} className="product-card"><div className="product-head"><div className="product-title-area"><div className="product-picture">{g.items.find(p=>p.image_url)?.image_url?<img src={g.items.find(p=>p.image_url)?.image_url||''} alt={g.items[0].title}/>:<Icon name={g.key==='camiseta'?'shopping-bag':g.key==='residuos'?'trash':g.key==='folex'?'layers':g.key==='munsmawa'?'film':'package'}/>}</div><div><span className="overline">DIRECTO DE NUESTRA FÁBRICA</span><h3>{g.items[0].title}</h3><p>{g.items[0].subtitle}</p></div></div><span className="sku-count">{g.items.length} MEDIDAS</span></div><div className="table-scroller"><table><thead><tr><th>MEDIDA</th><th>PRESENTACIÓN</th><th>RETIRO FÁBRICA</th><th>CON ENVÍO</th><th>ACCIÓN</th></tr></thead><tbody>{g.items.map(p=><tr key={p.id}>
<td className="size" data-label="Medida">{p.measure}</td>
<td data-label="Presentación">{p.packages!==null?p.packages+(p.category==='arranque'?' rollos/bulto':' paquetes/bulto'):p.units_per_box!==null?'Caja x '+p.units_per_box:p.presentation}{p.bags_per_roll!==null&&<small>{p.bags_per_roll} bolsas por rollito</small>}</td>
<td className="price" data-label="Retiro por fábrica">{money(p.price_pickup)}</td>
<td className="price price-green" data-label="Con envío">{money(p.price_delivery)}</td>
<td className="add-cell"><button type="button" className="add-product" onClick={()=>addOrder({key:p.id,title:p.title,detail:p.measure+' · '+(p.packages!==null?p.packages+(p.category==='arranque'?' rollos/bulto':' paquetes/bulto'):p.units_per_box!==null?'Caja x '+p.units_per_box:p.presentation),quantity:1,unit:p.presentation.toLowerCase().includes('caja')?'caja':'bulto',pricePickup:p.price_pickup,priceDelivery:p.price_delivery})}>+ Cotizar / Agregar</button></td>
</tr>)}</tbody></table></div><div className="product-bottom"><span>{g.key==='camiseta'?'Más medidas disponibles hasta 80 × 100 cm.':g.key==='residuos'?'Fabricación propia · fondo estrella.':'Disponemos de más medidas.'}</span><a target="_blank" rel="noopener noreferrer" href={whatsapp('Hola, quiero consultar otras medidas de '+g.items[0].title)}><Icon name="whatsapp"/> Consultar más medidas por WhatsApp ↗</a></div></article>)}</div>)}{!groups.length&&<div className="empty">No encontramos productos con esa búsqueda.</div>}</div>
      </section>
      <section className="wrap section" id="compra"><div className="buy-card">
        <span className="overline">TRES PASOS PARA TU PEDIDO MAYORISTA</span>
        <h2>Elegís, cotizás <em>y coordinamos.</em></h2>
        <div className="steps">
          <div><span>01</span><h3>Seleccioná las medidas</h3><p>Agregá al pedido las presentaciones y cantidades que necesita tu negocio.</p></div>
          <div><span>02</span><h3>Enviá la cotización</h3><p>Revisá tu carrito express y enviá todas las cantidades en un solo mensaje.</p></div>
          <div><span>03</span><h3>Confirmá la operación</h3><p>Te respondemos con stock disponible, importe final, forma de pago y coordinación de entrega o retiro.</p></div>
        </div><a className="btn red" href="#productos">Seleccionar productos ↑</a>
      </div></section>
      <SocialQuestions/>
      <WholesaleFAQ/>
      <footer className="site-footer"><div className="wrap footer-row">
       <div className="footer-identity"><a href="/" className="footer-brand" aria-label="Inicio MITOBICEL"><img src="/logo-mitobicel.png" alt="MITOBICEL"/></a><p>Fabricando calidad al mejor precio hace más de 15 años.</p><small>«El Señor es mi pastor; nada me faltará». — Salmos 23:1</small></div>
       <div className="footer-details"><strong>Fábrica y atención</strong><p>Avenida San Martín 249, Burzaco, Buenos Aires.</p><p>Lunes a viernes: 8:30–13 y 13:30–17 h<br/>Sábados: 8:30–13 h</p><a href="https://www.google.com/maps/search/?api=1&query=Avenida+San+Martin+249+Burzaco+Buenos+Aires" target="_blank" rel="noopener noreferrer">Cómo llegar ↗</a></div>
       <div className="footer-contact"><strong>Pedí directo por WhatsApp</strong><a className="btn green" href={whatsapp('Hola MITOBICEL, quiero consultar un pedido mayorista')} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/> 11 6219-0702</a><p>Venta exclusiva por mayor.</p></div>
      </div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} MITOBICEL · Todos los derechos reservados.</span><span>Industria argentina · Fabricante directo</span></div></footer>
      <a className="floating-wa" href={whatsapp('Hola, quiero consultar los precios mayoristas')} aria-label="Consultar por WhatsApp" target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/></a>
      <WholesaleCart lines={orderLines} onQuantity={updateOrder} onRemove={removeOrder}/>
      {message&&<p role="status" className="toast">{message}</p>}
   </main>}
 </div>;
}
