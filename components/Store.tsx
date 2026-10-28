'use client';
import {useEffect,useMemo,useState,useCallback} from 'react';
import QRCode from 'qrcode';
import {getDb} from '@/lib/client';

type Item={id:string;category:string;title:string;subtitle:string;measure:string;presentation:string;packages:number|null;bags_per_roll:number|null;units_per_box:number|null;price_pickup:number|null;price_delivery:number|null;featured:boolean;enabled:boolean;position:number};
const seeds:Item[]=[
 ['cam-32','camiseta','Bolsas camiseta','Línea verde · Más que premium','32 × 40',20],
 ['cam-40','camiseta','Bolsas camiseta','Línea verde · Más que premium','40 × 50',20],
 ['cam-45','camiseta','Bolsas camiseta','Línea verde · Más que premium','45 × 60',20],
 ['arr-1','arranque','Bolsas de arranque','Todas las medidas para tu comercio','15 × 20',null],
 ['arr-2','arranque','Bolsas de arranque','Todas las medidas para tu comercio','15 × 25',null],
 ['arr-3','arranque','Bolsas de arranque','Todas las medidas para tu comercio','20 × 30',null],
 ['arr-4','arranque','Bolsas de arranque','Todas las medidas para tu comercio','25 × 35',null],
 ['arr-5','arranque','Bolsas de arranque','Todas las medidas para tu comercio','30 × 40',null],
 ['res-1','residuos','Bolsas de basura','En rollito fondo estrella y en paquete','45 × 60',null],
 ['res-2','residuos','Bolsas de basura','En rollito fondo estrella y en paquete','50 × 70',null],
 ['fol-1','folex','Folex','Presentaciones mayoristas','14 × 14',null],
 ['fol-2','folex','Folex','Presentaciones mayoristas','14 × 28',null],
 ['fol-3','folex','Folex','Presentaciones mayoristas','20 × 25',null],
 ['film-1','film','Film adherente','Para cajones de frutas y verduras','Medidas a consultar',null],
 ['muns-45','munsmawa','Film verdulero Munsmawa','Promoción semanal · Caja por 9 unidades','45 cm × 350 m',null]
].map((a,i)=>({id:String(a[0]),category:String(a[1]),title:String(a[2]),subtitle:String(a[3]),measure:String(a[4]),presentation:String(a[1])==='munsmawa'?'Caja':'Bulto',packages:a[5] as number|null,bags_per_roll:null,units_per_box:a[1]==='munsmawa'?9:null,price_pickup:a[1]==='munsmawa'?46725:null,price_delivery:null,featured:a[1]==='munsmawa',enabled:true,position:i+1}));
const categories=['camiseta','arranque','residuos','folex','film','munsmawa'];
const money=(n:number|null)=>n===null?'Consultar precio':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const whatsapp=(text:string)=>'https://wa.me/541162190702?text='+encodeURIComponent(text);
const num=(s:string)=>s.trim()===''?null:Math.max(0,Number(s)||0);
const categoryLabel=(c:string)=>({camiseta:'Bolsas camiseta',arranque:'Bolsas de arranque',residuos:'Bolsas de basura · rollito fondo estrella y paquete',folex:'Folex',film:'Film adherente',munsmawa:'Film Munsmawa'} as Record<string,string>)[c]||c;

export default function Store({admin=false}:{admin?:boolean}){
 const [items,setItems]=useState<Item[]>(seeds);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(admin);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[configured,setConfigured]=useState(true);
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('todos');
 const [qrUrl,setQrUrl]=useState(''),[qr,setQr]=useState('');
 const [newCategory,setNewCategory]=useState('camiseta'),[newSize,setNewSize]=useState('');
 const db=getDb();
 const load=useCallback(async(isAdmin=false)=>{
   const client=getDb();if(!client){setConfigured(false);return;}
   const q=client.from('catalog_items').select('*').order('position',{ascending:true});
   const {data,error}=await (isAdmin?q:q.eq('enabled',true));
   if(error){setMessage('No se pudieron consultar los productos: '+error.message);return;}
   setItems((data||[]) as Item[]);setConfigured(true);
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
 async function logout(){if(db)await db.auth.signOut();setAuthorized(false);setEmail('');setMessage('');}
 function patch(id:string,key:keyof Item,value:string|number|boolean|null){setItems(prev=>prev.map(item=>item.id===id?{...item,[key]:value}:item));}
 async function save(item:Item){if(!db||!authorized)return;setBusy(true);setMessage('');
   const {error}=await db.from('catalog_items').update({category:item.category,title:item.title,subtitle:item.subtitle,measure:item.measure,presentation:item.presentation,packages:item.packages,bags_per_roll:item.bags_per_roll,units_per_box:item.units_per_box,price_pickup:item.price_pickup,price_delivery:item.price_delivery,featured:item.featured,enabled:item.enabled,position:item.position}).eq('id',item.id);
   setMessage(error?'Error al guardar: '+error.message:'Cambios guardados. El catálogo público se actualiza automáticamente.');setBusy(false);
 }
 async function addMeasure(){if(!db||!authorized||!newSize.trim())return;setBusy(true);
   const same=items.filter(x=>x.category===newCategory);
   const template=same[0];
   const item:Item={id:crypto.randomUUID(),category:newCategory,title:template?.title||categoryLabel(newCategory),subtitle:template?.subtitle||'',measure:newSize.trim(),presentation:template?.presentation||'Bulto',packages:template?.packages??null,bags_per_roll:null,units_per_box:template?.units_per_box??null,price_pickup:null,price_delivery:null,featured:false,enabled:true,position:Math.max(0,...items.map(x=>x.position))+1};
   const {error}=await db.from('catalog_items').insert(item);
   if(error)setMessage(error.message);else{setNewSize('');setMessage('Medida agregada');await load(true);}setBusy(false);
 }
 async function createQR(){try{const u=new URL(qrUrl);if(u.protocol!=='https:')throw new Error('Ingresá una dirección HTTPS.');
   if(u.hostname.includes('-git-'))throw new Error('No uses una dirección de vista previa de Vercel.');
   const image=await QRCode.toDataURL(u.toString(),{width:720,margin:3,color:{dark:'#08130e',light:'#ffffff'}});
   setQr(image);setMessage('QR generado. Guardalo solamente después de confirmar el dominio definitivo.');
 }catch(e){setMessage(e instanceof Error?e.message:'URL no válida');}}
 const visible=items.filter(p=>p.enabled).filter(p=>filter==='todos'||p.category===filter).filter(p=>(p.title+' '+p.measure+' '+p.subtitle).toLowerCase().includes(search.toLowerCase()));
 const groups=categories.map(c=>({key:c,items:visible.filter(p=>p.category===c)})).filter(g=>g.items.length);
 const promos=items.filter(p=>p.enabled&&p.featured);
 return <div className="app">
   <div className="ribbon">INDUSTRIA ARGENTINA <span>✦</span> FABRICANTE DIRECTO <span>✦</span> VENTA EXCLUSIVA POR MAYOR</div>
   <header className="header"><div className="wrap head-inner">
     <a href="/" className="logo" aria-label="MITOBICEL catálogo"><span className="logo-arrows">↝</span>MI<span>TOBICEL</span></a>
     {!admin&&<nav><a href="#promociones">Promociones</a><a href="#productos">Productos</a><a href="#compra">Cómo comprar</a></nav>}
     <div className="head-cta"><a className="btn green" href={whatsapp('Hola Mitobicel, quiero consultar por precios mayoristas')} target="_blank" rel="noopener noreferrer">WhatsApp <span>↗</span></a><a className="admin-link" href={admin?'/':'/admin'}>{admin?'← Volver al catálogo':'Acceso administrador'}</a></div>
   </div></header>
   {admin?<main className="wrap admin-main">
     <div className="admin-banner"><span className="overline">GESTIÓN DE CATÁLOGO</span><h1>Centro de control <em>MITOBICEL</em></h1><p>Actualizá los precios y promociones en segundos, sin modificar código ni generar otro QR.</p></div>
     {!configured?<section className="panel"><h2>Conectar base de datos</h2><p>Faltan las variables de Supabase en Vercel. Configurá <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, y ejecutá <code>supabase/schema.sql</code> en tu proyecto de Supabase.</p></section>:
     checking?<section className="panel">Verificando acceso...</section>:
     !authorized?<section className="login-card panel"><span className="overline">SOLO PERSONAL AUTORIZADO</span><h2>Ingresá a tu cuenta</h2><p>El catálogo es público. Esta sección es privada.</p><form onSubmit={login}><label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" placeholder="tu@correo.com"/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" placeholder="Tu contraseña"/></label><button className="btn red" disabled={busy} type="submit">{busy?'Ingresando...':'Ingresar al superadmin →'}</button></form></section>:
     <div className="admin-content"><div className="admin-summary"><div><strong>{items.length}</strong><span>Presentaciones</span></div><div><strong>{items.filter(x=>x.featured).length}</strong><span>Promociones</span></div><div><strong>{items.filter(x=>x.enabled).length}</strong><span>Publicadas</span></div><button className="btn dark" onClick={()=>void logout()}>Cerrar sesión</button></div>
       <section className="panel qr-panel"><div><span className="overline">TU QR DEFINITIVO</span><h2>Un solo QR, siempre los últimos precios.</h2><p>Generalo con el dominio público de producción. El QR no cambia cuando actualizás tus precios.</p><label>Dirección definitiva del catálogo<input value={qrUrl} onChange={e=>setQrUrl(e.target.value)} placeholder="https://tu-dominio.com/"/></label><button className="btn green" onClick={()=>void createQR()}>Generar QR</button></div>{qr&&<div className="qr-result"><img src={qr} alt="QR de Mitobicel"/><a download="mitobicel-qr-catalogo.png" href={qr} className="btn dark">Descargar PNG</a></div>}</section>
       <section className="panel"><div className="section-top"><div><span className="overline">EDICIÓN RÁPIDA</span><h2>Precios y presentaciones</h2><p>Guardá cada fila para actualizar el precio público.</p></div></div>
       {categories.map(c=><div key={c} className="admin-category"><h3>{categoryLabel(c)}</h3>{items.filter(p=>p.category===c).map(p=><div key={p.id} className="edit-row"><div className="edit-fields">
         <label>Medida<input value={p.measure} onChange={e=>patch(p.id,'measure',e.target.value)}/></label>
         <label>Retiro por fábrica $<input inputMode="numeric" type="number" min="0" value={p.price_pickup??''} onChange={e=>patch(p.id,'price_pickup',num(e.target.value))} placeholder="Sin cargar"/></label>
         <label>Con envío $<input inputMode="numeric" type="number" min="0" value={p.price_delivery??''} onChange={e=>patch(p.id,'price_delivery',num(e.target.value))} placeholder="Sin cargar"/></label>
         <label>Paquetes/bulto<input type="number" min="0" value={p.packages??''} onChange={e=>patch(p.id,'packages',num(e.target.value))}/></label>
         <label>Bolsas/rollito<input type="number" min="0" value={p.bags_per_roll??''} onChange={e=>patch(p.id,'bags_per_roll',num(e.target.value))}/></label>
         <label>Unid./caja<input type="number" min="0" value={p.units_per_box??''} onChange={e=>patch(p.id,'units_per_box',num(e.target.value))}/></label>
       </div><div className="edit-actions"><label><input type="checkbox" checked={p.featured} onChange={e=>patch(p.id,'featured',e.target.checked)}/> Promoción</label><label><input type="checkbox" checked={p.enabled} onChange={e=>patch(p.id,'enabled',e.target.checked)}/> Visible</label><button disabled={busy} className="btn green" onClick={()=>void save(p)}>Guardar medida</button></div></div>)}</div>)}
       <div className="add-row"><label>Categoría<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{categoryLabel(c)}</option>)}</select></label><label>Nueva medida<input placeholder="Ej. 50 × 70" value={newSize} onChange={e=>setNewSize(e.target.value)}/></label><button className="btn dark" onClick={()=>void addMeasure()} disabled={busy||!newSize.trim()}>+ Agregar medida</button></div></section>
       <p className="admin-note">Por seguridad, solo los usuarios cargados en la tabla <code>admin_users</code> pueden modificar datos. Nunca publiques claves privadas en GitHub.</p>
     </div>}
     {message&&<p role="status" className="toast">{message}</p>}
   </main>:<main>
      <section className="hero wrap"><div className="hero-left"><div className="eyebrow"><span className="live-dot"/> PRECIOS MAYORISTAS · DIRECTO DE FÁBRICA</div><h1>Calidad que se nota.<br/><em>Precio que conviene.</em></h1><p className="lead">Fabricando calidad al mejor precio hace más de <strong>15 años.</strong> Fabricantes directos, sin intermediarios, para negocios de todo el país.</p><div className="hero-buttons"><a className="btn red" href="#productos">Explorar catálogo <span>↓</span></a><a className="btn white" href={whatsapp('Hola, quiero consultar por el catálogo mayorista de MITOBICEL')} target="_blank" rel="noopener noreferrer">Solicitar asesoramiento ↗</a></div><div className="hero-stats"><div><b>50 bultos</b><span>Compra mínima</span></div><div><b>100 bultos</b><span>Envíos desde</span></div><div><b>Todo el país</b><span>Distribución</span></div></div></div><div className="hero-right"><div className="hero-image-label">VISITANOS EN FÁBRICA</div><img src="/fabrica.svg" alt="MITOBICEL fábrica de bolsas, Av. San Martín 249, Burzaco, horarios y WhatsApp" className="factory-picture"/><p>Av. San Martín 249, Burzaco · Podés venir a conocer y probar nuestra calidad.</p></div></section>
      <div className="trust-strip"><div className="wrap trust-grid"><div><span>◉</span><b>Fabricante directo</b><small>Sin intermediarios</small></div><div><span>✦</span><b>Calidad premium</b><small>Precios competitivos</small></div><div><span>▣</span><b>Retiro por fábrica</b><small>Conocé nuestros productos</small></div><div><span>➜</span><b>Envíos nacionales</b><small>Desde 100 bultos</small></div></div></div>
      {!configured&&<div className="wrap"><p className="demo-note">Vista previa del catálogo. Conectá Supabase para publicar y actualizar precios desde el administrador.</p></div>}
      <section className="wrap section" id="promociones"><div className="section-top"><div><span className="overline">PRECIOS ESPECIALES DIRECTO DE FÁBRICA</span><h2><em>Promociones</em> semanales</h2><p>Oportunidades seleccionadas para comercios, distribuidores y mayoristas.</p></div><span className="red-pill">OFERTAS VIGENTES</span></div>
       <div className="promo-list">{promos.map(p=><div key={p.id} className="promo-card"><div><span className="promo-tag">PROMOCIÓN SEMANAL</span><h3>{p.title}</h3><p>{p.subtitle}</p><span className="promo-measure">{p.measure} · {p.units_per_box?'Caja x '+p.units_per_box+' unidades':p.presentation}</span></div><div className="promo-prices"><small>RETIRANDO POR FÁBRICA</small><strong>{money(p.price_pickup)}</strong><small>PRECIO CON ENVÍO</small><b>{money(p.price_delivery)}</b></div><a className="btn white" target="_blank" rel="noopener noreferrer" href={whatsapp('Hola, quiero la promoción de '+p.title)}>Consultar ↗</a></div>)}{!promos.length&&<div className="empty">Próximamente nuevas promociones semanales.</div>}</div>
      </section>
      <section className="wrap section" id="productos"><div className="section-top"><div><span className="overline">CATÁLOGO MAYORISTA ACTUALIZADO</span><h2>Todo lo que tu <em>negocio necesita.</em></h2><p>Consultá el precio para retirar por fábrica o recibir en tu local.</p></div></div><div className="filters"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="⌕  Buscar producto, medida..." aria-label="Buscar productos"/><select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filtrar categoría"><option value="todos">Todos los productos</option>{categories.map(c=><option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>
       <div className="product-grid">{groups.map(g=><article key={g.key} className="product-card"><div className="product-head"><div><span className="overline">DIRECTO DE NUESTRA FÁBRICA</span><h3>{g.items[0].title}</h3><p>{g.items[0].subtitle}</p></div><span className="sku-count">{g.items.length} MEDIDAS</span></div><div className="table-scroller"><table><thead><tr><th>MEDIDA</th><th>PRESENTACIÓN</th><th>RETIRO FÁBRICA</th><th>CON ENVÍO</th></tr></thead><tbody>{g.items.map(p=><tr key={p.id}><td className="size">{p.measure}</td><td>{p.packages!==null?p.packages+' paquetes/bulto':p.units_per_box!==null?'Caja x '+p.units_per_box:p.presentation}{p.bags_per_roll!==null&&<small>{p.bags_per_roll} bolsas por rollito</small>}{g.key==='residuos'&&p.bags_per_roll===null&&<small>Bolsas/rollito: consultar</small>}</td><td className="price">{money(p.price_pickup)}</td><td className="price price-green">{money(p.price_delivery)}</td></tr>)}</tbody></table></div><div className="product-bottom"><span>{g.key==='camiseta'?'Más medidas disponibles hasta 80 × 100 cm.':g.key==='residuos'?'Rollito fondo estrella y en paquete.':'Estas son las medidas más solicitadas. Tenemos otras opciones.'}</span><a target="_blank" rel="noopener noreferrer" href={whatsapp('Hola, quiero consultar otras medidas de '+g.items[0].title)}>Consultar por WhatsApp ↗</a></div></article>)}{!groups.length&&<div className="empty">No encontramos productos con esa búsqueda.</div>}</div>
      </section>
      <section className="wrap section" id="compra"><div className="buy-card"><span className="overline">COMPRA POR MAYOR · SIN INTERMEDIARIOS</span><h2>Comprá directo donde <em>se fabrica.</em></h2><div className="steps"><div><span>01</span><h3>Desde medio pallet</h3><p>Compra mínima de 50 bultos para acceder a nuestros mejores precios. No vendemos por menor.</p></div><div><span>02</span><h3>Retiro por fábrica</h3><p>Vení a Avenida San Martín 249, Burzaco. Podés conocer y probar la calidad antes de comprar.</p></div><div><span>03</span><h3>Envíos a todo el país</h3><p>Realizamos envíos desde 100 bultos. Consultá tu cotización por WhatsApp.</p></div></div><a className="btn red" target="_blank" rel="noopener noreferrer" href={whatsapp('Hola Mitobicel, quiero hacer un pedido mayorista')}>Hacer mi pedido por WhatsApp ↗</a></div></section>
      <footer><div className="wrap footer-row"><div><strong>MITOBICEL</strong><p>Fabricando calidad al mejor precio hace más de 15 años.</p><small>El Señor es mi pastor; nada me faltará. — Salmos 23:1</small></div><div><b>Fábrica</b><p>Av. San Martín 249, Burzaco, Buenos Aires</p><p>Lun–Vie 8:30–13 y 13:30–17 · Sáb 8:30–13</p></div><div><a className="btn green" href={whatsapp('Hola Mitobicel, quiero consultar un producto')} target="_blank" rel="noopener noreferrer">11 6219 0702 ↗</a></div></div></footer>
      <a className="floating-wa" href={whatsapp('Hola, quiero consultar los precios mayoristas')} aria-label="Consultar por WhatsApp" target="_blank" rel="noopener noreferrer">✆</a>
      {message&&<p role="status" className="toast">{message}</p>}
   </main>}
 </div>;
}
