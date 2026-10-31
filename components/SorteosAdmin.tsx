'use client';
import {useEffect,useState,useCallback} from 'react';
import QRCode from 'qrcode';
import {getDb,getDbConfigIssue} from '@/lib/client';
import {Icon} from '@/components/Visuals';

type Campaign={
 id:string;period:string;title:string;subtitle:string;store_name:string;prizes:string[];
 starts_at:string;ends_at:string;draw_at:string;status:'draft'|'live'|'closed';
 results_published:boolean;terms:string;video_url:string;video_title:string;free_instructions:string;prize_image_url:string
};
type Code={id:string;code:string;store_name:string;used_at:string|null;campaign_id:string;buyer_dni?:string|null};
type Entry={id:string;first_name:string;last_name:string;dni:string;phone:string;entry_type:string;created_at:string;campaign_id:string};
type Winner={id:string;prize:string;entry_id:string;delivered_at:string|null;delivery_video_url:string;delivery_photo_url:string;drawn_at:string};
/** Datetime-local is a local wall-clock value (Argentina), not an ISO UTC string.
 * Accept both the input control format and a localized DD/MM/YYYY representation.
 * Return a specific validation error rather than letting toISOString throw.
 */
const local=(input:string)=>{
 if(!input)return '';
 const d=new Date(input);
 if(!Number.isFinite(d.getTime()))return '';
 const pad=(n:number)=>String(n).padStart(2,'0');
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function iso(input:string,label:string):string{
 const s=(input||'').trim();
 const match=s.match(/^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::\d\d)?$/)
  || s.match(/^(\d\d)\/(\d\d)\/(\d{4})[, ]+(\d\d):(\d\d)$/);
 if(!match)throw new Error('Revisá el formato de '+label+'. Elegí día y hora desde el calendario.');
 const european=s.includes('/');
 const y=Number(european?match[3]:match[1]),m=Number(match[2]),day=Number(european?match[1]:match[3]);
 const hour=Number(match[4]),minute=Number(match[5]);
 const d=new Date(y,m-1,day,hour,minute,0);
 if(!Number.isFinite(d.getTime())||d.getFullYear()!==y||d.getMonth()!==m-1||d.getDate()!==day||d.getHours()!==hour||d.getMinutes()!==minute)
  throw new Error('La fecha de '+label+' no es válida. Comprobá día, mes y hora.');
 return d.toISOString();
}
const fresh=()=>({
 id:'',period:new Date().toISOString().slice(0,7),title:'Sorteo mensual MITOBICEL',subtitle:'Premios, experiencias y oportunidades para nuestros clientes.',
 store_name:'MITOBICEL 1',prizes:'',starts_at:'',ends_at:'',draw_at:'',
 status:'draft' as 'draft'|'live'|'closed',results_published:false,terms:'',video_url:'',
 video_title:'Conocé las entregas de nuestros premios',prize_image_url:'',
 free_instructions:'Sin obligación de compra: el formulario ofrece una participación gratuita por persona en cada edición. Podés sumar participaciones adicionales mediante compras distintas y códigos válidos de un solo uso.'
});
type Editor=ReturnType<typeof fresh>;
const publicLink=()=>typeof window==='undefined'?'':window.location.origin+'/sorteos';
const asEditor=(c:Campaign):Editor=>({
 id:c.id,period:c.period,title:c.title,subtitle:c.subtitle,store_name:c.store_name.trim().toLowerCase()==='temper'?'MITOBICEL 1':c.store_name,prizes:(c.prizes||[]).join('\n'),
 starts_at:local(c.starts_at),ends_at:local(c.ends_at),draw_at:local(c.draw_at),
 status:c.status,results_published:c.results_published,terms:c.terms,video_url:c.video_url,
 video_title:c.video_title,free_instructions:c.free_instructions,prize_image_url:c.prize_image_url||''
});
function downloadText(name:string,body:string){
 const file=new Blob([body],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(file);
 const a=document.createElement('a');a.href=url;a.download=name;a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export default function SorteosAdmin(){
 const [authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [campaigns,setCampaigns]=useState<Campaign[]>([]);
 const [form,setForm]=useState<Editor>(fresh);
 const [codes,setCodes]=useState<Code[]>([]),[entries,setEntries]=useState<Entry[]>([]),[winners,setWinners]=useState<Winner[]>([]);
 const [buyerDni,setBuyerDni]=useState(''),[drawPrize,setDrawPrize]=useState('');
 const [printed,setPrinted]=useState<Code[]>([]);
 const [qrImage,setQrImage]=useState('');
 const [sharedTerms,setSharedTerms]=useState('');
 const [sharedFree,setSharedFree]=useState('Sin obligación de compra: la vía gratuita permite una participación por DNI en cada edición. Las participaciones por compras verificadas son adicionales.');
 const [photoBusy,setPhotoBusy]=useState(false);
 const db=getDb();
 useEffect(()=>{
  let alive=true;
  const init=async()=>{
   try{const data=await QRCode.toDataURL(publicLink(),{width:820,margin:3,color:{dark:'#052a18',light:'#ffffff'}});if(alive)setQrImage(data);}catch{}
  };void init();return()=>{alive=false;};
 },[]);
 const update=<K extends keyof Editor>(key:K,value:Editor[K])=>setForm(s=>({...s,[key]:value}));
 const load=useCallback(async(selected?:string)=>{
  const d=getDb();if(!d)return;
  const {data,error:e}=await d.from('raffle_campaigns').select('*').order('period',{ascending:false});
  if(e){setError('No está instalada la base de sorteos. Ejecutá supabase/sorteos_mensuales.sql: '+e.message);return;}
  setError('');const all=(data||[]) as Campaign[];setCampaigns(all);
  const active=all.find(c=>c.id===selected)||all.find(c=>c.id===form.id)||all[0];
  const {data:settings}=await d.from('raffle_settings').select('terms,free_instructions').eq('id',1).maybeSingle();
  if(settings){
   setSharedTerms(settings.terms||'');if(settings.free_instructions)setSharedFree(settings.free_instructions);
  }
  if(active){setForm(asEditor(active));await loadDetails(active.id);}
  else if(settings)setForm(current=>({...current,terms:settings.terms||'',free_instructions:settings.free_instructions||current.free_instructions}));
 },[form.id]);
 async function loadDetails(id:string){
  const d=getDb();if(!d)return;
  const [a,b,c]=await Promise.all([
   d.from('raffle_codes').select('id,code,store_name,used_at,campaign_id,buyer_dni').eq('campaign_id',id).order('created_at',{ascending:false}).limit(1000),
   d.from('raffle_entries').select('id,first_name,last_name,dni,phone,entry_type,created_at,campaign_id').eq('campaign_id',id).order('created_at',{ascending:false}).limit(2000),
   d.from('raffle_winners').select('*').eq('campaign_id',id).order('drawn_at',{ascending:false})
  ]);
  if(a.error||b.error||c.error){setError('No se pudieron consultar los datos de la edición.');return;}
  setCodes((a.data||[]) as Code[]);setEntries((b.data||[]) as Entry[]);setWinners((c.data||[]) as Winner[]);
 }
 useEffect(()=>{
  const d=getDb();let cancelled=false;
  if(!d){setChecking(false);setError(getDbConfigIssue()||'Supabase no configurado.');return;}
  void (async()=>{
   const {data:{user}}=await d.auth.getUser();
   if(!user){if(!cancelled)setChecking(false);return;}
   const {data:permit}=await d.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
   if(!cancelled){setAuthorized(Boolean(permit));setChecking(false);}
  })();
  return()=>{cancelled=true;};
 },[]);
 useEffect(()=>{if(authorized)void load();},[authorized]); // Load only on login.
 async function login(e:React.FormEvent){
  e.preventDefault();const d=getDb();if(!d)return;
  setBusy(true);setError('');
  const {data,error:authError}=await d.auth.signInWithPassword({email,password});
  if(authError||!data.user){setError('Usuario o contraseña incorrectos.');setBusy(false);return;}
  const {data:access}=await d.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
  if(!access){setError('La cuenta no tiene permisos de superadministrador.');await d.auth.signOut();}
  else{setAuthorized(true);setPassword('');}
  setBusy(false);
 }
 async function save(e:React.SyntheticEvent,activate=false){
  e.preventDefault();if(!db||busy)return;
  setError('');setNotice('');
  let dates:string[];
  try{dates=[iso(form.starts_at,'inicio de inscripción'),iso(form.ends_at,'cierre de inscripción'),iso(form.draw_at,'sorteo')];}
  catch(err){setError(err instanceof Error?err.message:'Revisá las fechas del sorteo.');return;}
  if(!(dates[0]<dates[1]&&dates[1]<=dates[2])){setError('El cierre debe ser posterior al inicio y el sorteo debe ser posterior al cierre.');return;}
  const prizes=form.prizes.split('\n').map(p=>p.trim()).filter(Boolean);
  const nextStatus=activate?'live':form.status;
  if(!form.period||!form.title.trim()||!form.store_name.trim()){
   setError('Completá el mes, el título y el comercio autorizado.');return;
  }
  if(nextStatus==='live'&&Date.parse(dates[1])<Date.now()){
   setError('La fecha de cierre ya pasó. Elegí un período vigente antes de activar inscripciones.');return;
  }
  if(nextStatus!=='draft'&&(!prizes.length||form.terms.trim().length<80)){
   setError('Para habilitar inscripciones, cargá premios realmente confirmados y las bases legales completas (mínimo 80 caracteres).');return;
  }
  if(form.results_published&&nextStatus==='draft'){setError('No se publican resultados de una edición en borrador.');return;}
  setBusy(true);
  const values={
   period:form.period,title:form.title.trim(),subtitle:form.subtitle.trim(),
   store_name:form.store_name.trim()||'MITOBICEL 1',prizes,
   starts_at:dates[0],ends_at:dates[1],draw_at:dates[2],
   status:nextStatus,results_published:form.results_published,
   terms:form.terms.trim(),video_url:form.video_url.trim(),
   video_title:form.video_title.trim(),free_instructions:form.free_instructions.trim(),prize_image_url:form.prize_image_url
  };
  const request=form.id?db.from('raffle_campaigns').update(values).eq('id',form.id).select('id').single():
    db.from('raffle_campaigns').insert(values).select('id').single();
  const {data,error:saveError}=await request;
  if(saveError){setError(saveError.message);}else{setNotice(activate?'Edición publicada. Las inscripciones están disponibles dentro del período configurado.':'Edición guardada correctamente.');await load(data.id);}
  setBusy(false);
 }
 async function generate(){
  if(!db||!form.id||busy)return;
  const dni=buyerDni.replace(/\D/g,'');
  if(!/^\d{7,9}$/.test(dni)){setError('Ingresá el DNI del comprador antes de generar su código.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error:e}=await db.rpc('raffle_issue_purchase_code',{
    p_campaign_id:form.id,p_buyer_dni:dni
   });
   if(e)throw e;
   const issued=String(data||'');
   if(!/^\d{4}$/.test(issued))throw new Error('La base de datos no devolvió un código de cuatro cifras.');
   setPrinted([{id:crypto.randomUUID(),campaign_id:form.id,code:issued,store_name:'MITOBICEL 1',buyer_dni:dni,used_at:null}]);
   setBuyerDni('');
   setNotice('Código generado: '+issued+'. Entregalo únicamente a la persona cuyo DNI verificaste.');
   await loadDetails(form.id);
  }catch(err){
   const message=err&&typeof err==='object'&&'message' in err?String(err.message):'No se pudo emitir el código.';
   setError('Error al emitir código: '+message+'. Si no actualizaste Supabase, ejecutá el SQL de códigos de cuatro cifras.');
  }finally{setBusy(false);}
 }
 function exportCodes(){
  if(!codes.length)return;
  downloadText('mitobicel-codigos-'+form.period+'.csv',
   '\uFEFFcodigo,comercio,enlace,estado\n'+codes.map(c=>
    [c.code,c.store_name,publicLink(),c.used_at?'utilizado':'disponible'].map(x=>'"'+x.replace(/"/g,'""')+'"').join(',')
   ).join('\n'));
 }

 async function printQr(){
  const list=printed.length?printed:codes.filter(c=>!c.used_at).slice(0,100);
  if(!list.length){setError('Primero generá códigos de compra para entregar.');return;}
  const win=window.open('','_blank');
  if(!win){setError('Permití la ventana emergente para imprimir los códigos.');return;}
  // Only textual vouchers, no distinct QR. Single general QR is printed from its own action.
  const items=list.map(c=>'<article><strong>MITOBICEL 1 · SORTEOS</strong><p>Escaneá el QR general del local y anotate con este código de compra:</p><code>'+c.code+'</code><small>Válido una sola vez · No compartir hasta entregarlo</small></article>').join('');
  win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Códigos MITOBICEL</title><style>*{box-sizing:border-box}body{font-family:Arial;margin:15px}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}article{border:1px dashed #888;padding:16px;min-height:135px;display:flex;align-items:center;text-align:center;flex-direction:column;justify-content:center;break-inside:avoid}strong{font-size:12px}p,small{font-size:10px}code{font-size:15px;font-weight:900;letter-spacing:1px;overflow-wrap:anywhere}@media print{button{display:none}}</style></head><body><button onclick="print()">Imprimir comprobantes</button><h1>MITOBICEL 1 · Códigos por compra</h1><p>Cada cupón corresponde a una compra verificada; no son códigos QR.</p><section class="sheet">'+items+'</section></body></html>');
  win.document.close();win.focus();
 }
 function downloadGeneralQr(){
  if(!qrImage)return;
  const link=document.createElement('a');link.href=qrImage;link.download='MITOBICEL-QR-GENERAL-SORTEOS.png';link.click();
 }
 async function saveGeneralTerms(){
  if(!db||busy)return;
  if(sharedTerms.trim().length<80){setError('Completá las bases generales reales (mínimo 80 caracteres) antes de guardarlas.');return;}
  setBusy(true);setError('');setNotice('');
  const {error:e}=await db.from('raffle_settings').upsert({id:1,terms:sharedTerms.trim(),free_instructions:sharedFree.trim()},{onConflict:'id'});
  if(e)setError('No se pudieron guardar las bases: '+e.message+'. Ejecutá la actualización SQL de sorteos.');
  else{if(!form.id||form.status==='draft')setForm(f=>({...f,terms:sharedTerms.trim(),free_instructions:sharedFree.trim()}));setNotice('Bases generales guardadas. Las próximas ediciones reutilizarán este texto. Las bases de las ediciones publicadas se conservan.');}
  setBusy(false);
 }
 async function uploadPrize(file:File|undefined){
  if(!db||!form.id||!file||photoBusy)return;
  if(file.type!=='image/png'||file.size>5*1024*1024){setError('Seleccioná un PNG de máximo 5 MB.');return;}
  setError('');setPhotoBusy(true);
  const path='premios/'+form.id+'/'+crypto.randomUUID()+'.png';
  const {error:uploadError}=await db.storage.from('raffle-prizes').upload(path,file,{contentType:'image/png',cacheControl:'3600',upsert:false});
  if(uploadError){setError('Error al cargar imagen: '+uploadError.message+'. Ejecutá la migración de sorteos.');setPhotoBusy(false);return;}
  const url=db.storage.from('raffle-prizes').getPublicUrl(path).data.publicUrl;
  const {error:updateError}=await db.from('raffle_campaigns').update({prize_image_url:url}).eq('id',form.id);
  if(updateError)setError('Foto subida pero no guardada en la edición: '+updateError.message);
  else{setForm(f=>({...f,prize_image_url:url}));setNotice('Imagen PNG del premio publicada.');}
  setPhotoBusy(false);
 }
 async function draw(){
  if(!db||!form.id||!drawPrize.trim()||busy)return;
  if(!confirm('¿Confirmás el sorteo aleatorio de un participante para el premio "'+drawPrize+'"? Esta acción queda registrada.'))return;
  setBusy(true);setError('');setNotice('');
  const {error:e}=await db.rpc('raffle_draw',{p_campaign_id:form.id,p_prize:drawPrize.trim()});
  if(e)setError(e.message);else{setNotice('Ganador seleccionado y registrado. Verificá su DNI antes de la entrega.');setDrawPrize('');await loadDetails(form.id);}
  setBusy(false);
 }
 async function updateDelivery(w:Winner,field:'delivered_at'|'delivery_video_url'|'delivery_photo_url',value:string|null){
  if(!db||!form.id)return;
  const payload={[field]:value};
  const {error:e}=await db.from('raffle_winners').update(payload).eq('id',w.id);
  if(e)setError(e.message);else{setNotice('Entrega actualizada.');await loadDetails(form.id);}
 }
 const canManage=Boolean(form.id);
 return <div className="raffle-admin">
  <header className="raffle-admin-header"><img src="/logo-mitobicel.png" alt="MITOBICEL"/><div><span className="raffle-eyebrow">SOLO PERSONAL AUTORIZADO</span><strong>Centro de Control · Sorteos</strong></div><a href="/sorteos" target="_blank" rel="noopener noreferrer">Ver página pública ↗</a></header>
  <section className="raffle-admin-main">
   <div className="raffle-admin-banner"><span className="raffle-eyebrow">GESTIÓN DE SORTEOS</span><h1>Volvimos. Y volvimos con todo.</h1><p>Administrá los sorteos de agradecimiento para buscas, papeleras y distribuidores. Comercio autorizado: MITOBICEL 1, Temperley, a una cuadra de la estación. Los catálogos siguen independientes.</p></div>
   {checking?<p>Verificando permisos…</p>:!authorized?<form className="raffle-admin-panel raffle-login" onSubmit={e=>void login(e)}>
    <h2>Ingresá al superadmin</h2><p>Acceso exclusivo con las credenciales del administrador de MITOBICEL.</p>
    <label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label>
    <label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
    <button className="raffle-cta" disabled={busy} type="submit">Ingresar al Centro de Sorteos ↗</button>
   </form>:<>
    <nav className="raffle-admin-nav" aria-label="Apartados del superadmin">
     <a href="/admin">Catálogo 1</a><a href="/admin/catalogo-2">Catálogo 2</a><a className="active" href="/admin/sorteos">Sorteos · MITOBICEL</a>
     <button onClick={()=>{setForm({...fresh(),terms:sharedTerms,free_instructions:sharedFree});setCodes([]);setEntries([]);setWinners([]);setNotice('Creá una nueva edición y guardala.');}}>+ Nueva edición</button>
    </nav>
    <div className="raffle-admin-kpis"><div><strong>{campaigns.length}</strong><span>Ediciones</span></div><div><strong>{codes.length}</strong><span>Códigos de compra (máx. 1000 visibles)</span></div><div><strong>{entries.length}</strong><span>Participaciones (máx. 2000 visibles)</span></div><div><strong>{winners.length}</strong><span>Ganadores de esta edición</span></div></div>
    <div className="raffle-admin-panel">
     <h2>QR general único · MITOBICEL Sorteos</h2>
     <p>Imprimí este mismo QR y dejalo visible en MITOBICEL 1. Siempre apunta a <strong>/sorteos</strong>, no cambia entre compras ni entre meses. Cada compra validada utiliza un código de un solo uso, separado del QR.</p>
     <div className="raffle-admin-general-qr">{qrImage&&<img src={qrImage} alt="QR general del sitio MITOBICEL Sorteos"/>}<div><strong>Un QR para siempre</strong><p>Mostrale el mismo QR a todos los compradores. Para prevenir inscripciones falsas, entregá un código de compra distinto después de cada venta.</p><button type="button" className="raffle-cta" disabled={!qrImage} onClick={downloadGeneralQr}>Descargar QR fijo PNG</button></div></div>
    </div>
    <div className="raffle-admin-panel">
     <h2>Bases y condiciones generales</h2>
     <p>Se guardan una sola vez y se reutilizan al crear nuevas ediciones. No reemplazan retroactivamente las bases de un sorteo ya publicado. Verificá que las bases sean legalmente adecuadas y completen datos particulares de cada premio y fecha.</p>
     <label className="raffle-admin-general-label">Texto general<textarea value={sharedTerms} rows={6} onChange={e=>setSharedTerms(e.target.value)} placeholder="Organizador, condiciones, ámbito geográfico, requisitos, protección de datos, participación gratuita, procedimiento y probabilidades…"/></label>
     <label className="raffle-admin-general-label">Participación sin compra<textarea value={sharedFree} rows={2} onChange={e=>setSharedFree(e.target.value)}/></label>
     <button className="raffle-cta" type="button" disabled={busy} onClick={()=>void saveGeneralTerms()}>Guardar bases para próximas ediciones</button>
    </div>
    <div className="raffle-admin-panel">
     <h2>Configurar edición mensual</h2>
     <div className="raffle-admin-editions">{campaigns.map(c=><button key={c.id} className={form.id===c.id?'active':''} type="button" onClick={()=>{setForm(asEditor(c));void loadDetails(c.id);}}>{c.period} · {c.status}</button>)}</div>
     <div className="raffle-admin-activation" role="status">
      <strong>{form.id&&form.status==='live'?'Edición publicada':'Activación de inscripciones'}</strong>
      <p>{form.id&&form.status==='live'
        ?'La inscripción se abre y cierra automáticamente según las fechas configuradas. Comprobá la página pública y probá un código de prueba.'
        :'Para abrir las inscripciones: definí fechas vigentes, cargá premios confirmados y las bases legales, y activá esta edición. Sin esos datos el formulario público permanecerá cerrado.'}</p>
     </div>
     <form className="raffle-admin-form" onSubmit={e=>void save(e)}>
      <label>Mes de la edición<input type="month" required value={form.period} onChange={e=>update('period',e.target.value)}/></label>
      <label>Comercio autorizado (MITOBICEL 1 · Temperley)<input value={form.store_name} onChange={e=>update('store_name',e.target.value)} required/></label>
      <label className="wide">Título<input value={form.title} onChange={e=>update('title',e.target.value)} required/></label>
      <label className="wide">Subtítulo<input value={form.subtitle} onChange={e=>update('subtitle',e.target.value)}/></label>
      <label>Inicio de inscripción<input type="datetime-local" value={form.starts_at} required onChange={e=>update('starts_at',e.target.value)}/></label>
      <label>Cierre de inscripción<input type="datetime-local" value={form.ends_at} required onChange={e=>update('ends_at',e.target.value)}/></label>
      <label>Fecha y hora del sorteo<input type="datetime-local" value={form.draw_at} required onChange={e=>update('draw_at',e.target.value)}/></label>
      <label>Estado<select value={form.status} onChange={e=>update('status',e.target.value as Editor['status'])}><option value="draft">Borrador (no público)</option><option value="live">Inscripciones habilitadas (con fechas y bases)</option><option value="closed">Cerrado / resultados</option></select></label>
      <label className="wide">Premios CONFIRMADOS (uno por renglón)<textarea rows={4} value={form.prizes} placeholder="Ej.: Smart TV 50 pulgadas · 1 unidad" onChange={e=>update('prizes',e.target.value)}/></label>
      <label className="wide">Bases aplicables a esta edición (se copia el texto general, pero podés precisar condiciones particulares)<textarea rows={6} value={form.terms} onChange={e=>update('terms',e.target.value)} placeholder="Primero guardá las bases generales de MITOBICEL."/></label>
      <label className="wide">Participación sin obligación de compra (heredada de las bases generales)<textarea rows={2} value={form.free_instructions} onChange={e=>update('free_instructions',e.target.value)}/></label>
      <div className="raffle-admin-photo wide"><strong>Foto PNG del premio de esta edición</strong>
       <p>Guardá la edición antes de subir la imagen. Se mostrará en la página pública junto al premio confirmado.</p>
       {form.prize_image_url&&<img src={form.prize_image_url} alt="Vista previa de la foto del premio"/>}
       <label>Seleccionar foto PNG (máximo 5 MB)<input type="file" accept="image/png" disabled={!form.id||photoBusy} onChange={e=>{void uploadPrize(e.target.files?.[0]);e.currentTarget.value='';}}/></label>
       {photoBusy&&<p>Subiendo imagen…</p>}
      </div>
      <label className="wide">URL video de fábrica / entregas (YouTube, Vimeo o MP4)<input type="url" value={form.video_url} onChange={e=>update('video_url',e.target.value)} placeholder="https://…"/></label>
      <label className="wide">Título del video<input value={form.video_title} onChange={e=>update('video_title',e.target.value)}/></label>
      <label className="raffle-admin-check wide"><input type="checkbox" checked={form.results_published} onChange={e=>update('results_published',e.target.checked)}/> Publicar los ganadores (DNI parcialmente oculto) durante el mes siguiente al sorteo</label>
      <div className="raffle-admin-activation-actions wide">
       <button className="raffle-cta-secondary" disabled={busy} type="submit">Guardar borrador / cambios</button>
       <button className="raffle-cta" disabled={busy} type="button" onClick={e=>void save(e,true)}>Publicar y habilitar inscripciones ↗</button>
      </div>
     </form>
     <p className="raffle-admin-legal">Antes de publicar, revisá las bases con asesoramiento legal: modalidad sin obligación de compra, premios reales, fechas, probabilidad, alcance, privacidad y obligaciones fiscales. No publicar nombres completos ni DNI de participantes.</p>
    </div>
    <div className="raffle-admin-panel" id="talonarios">
     <h2>Código rápido de cuatro números por compra</h2>
     <p>El QR general no cambia. Después de verificar una compra, ingresá el DNI del comprador y generá su código de <strong>4 números</strong>. Solo sirve con ese DNI y se utiliza una vez. Si vuelve a comprar, generás otro.</p>
     <div className="raffle-admin-qr-actions"><label>DNI del comprador (verificado en el local)<input inputMode="numeric" type="text" minLength={7} maxLength={9} pattern="[0-9]{7,9}" value={buyerDni} onChange={e=>setBuyerDni(e.target.value.replace(/\D/g,'').slice(0,9))} placeholder="7 a 9 números"/></label>
      <button type="button" className="raffle-cta" disabled={!canManage||busy||buyerDni.length<7} onClick={()=>void generate()}>Generar 4 números</button>
      <button type="button" disabled={!codes.length} onClick={exportCodes}>Descargar comprobantes CSV</button>
      <button type="button" disabled={!codes.length&&!printed.length} onClick={()=>void printQr()}>Imprimir comprobante</button>
     </div>
     <p className="raffle-admin-hint">Para evitar inscripciones falsas, verificá la venta y el DNI antes de generar los cuatro números. No se crean miles de códigos sin comprador: cada venta confirmada recibe uno nuevo.</p>
     {codes.length>0&&<div className="raffle-admin-codes">{codes.slice(0,12).map(c=><div key={c.id}><code>{c.code}</code><small>{c.used_at?'Utilizado':'Disponible'} · {c.buyer_dni?'DNI terminado en '+c.buyer_dni.slice(-3):'Código anterior'}</small></div>)}</div>}
    </div>
    <div className="raffle-admin-panel"><h2>Participantes de esta edición</h2><p>Los DNI completos son información privada y solo se visualizan acá para verificar a la persona al entregar un premio.</p>
     {entries.length?<div className="raffle-admin-list">{entries.slice(0,200).map(e=><div key={e.id}><strong>{e.first_name} {e.last_name}</strong><span>DNI {e.dni} · {e.phone}</span><small>{e.entry_type==='free'?'Vía gratuita':'QR de comercio'} · {new Date(e.created_at).toLocaleDateString('es-AR')}</small></div>)}</div>:<p>Todavía no hay participaciones registradas.</p>}
    </div>
    <div className="raffle-admin-panel"><h2>Realizar sorteo y publicar entregas</h2><p>El sorteo se habilita después de la fecha configurada. La selección aleatoria queda registrada en la base. Confirmá personalmente el DNI antes de adjudicar el premio.</p>
     <div className="raffle-admin-draw"><label>Premio confirmado<select value={drawPrize} onChange={e=>setDrawPrize(e.target.value)}>
      <option value="">Elegir premio…</option>{form.prizes.split('\n').map(p=>p.trim()).filter(Boolean).map((p,i)=><option key={i} value={p}>{p}</option>)}
     </select></label><button type="button" disabled={busy||!canManage||!drawPrize} onClick={()=>void draw()}>Seleccionar ganador al azar</button></div>
     <div className="raffle-admin-winners">{winners.map(w=>{
      const entry=entries.find(e=>e.id===w.entry_id);
      return <div className="raffle-admin-winner" key={w.id}>
       <strong>{w.prize}</strong>
       <p>{entry?entry.first_name+' '+entry.last_name+' · DNI '+entry.dni+' · '+entry.phone:'Ganador registrado'}</p>
       <label>Video de entrega<input type="url" defaultValue={w.delivery_video_url||''} onBlur={e=>{if(e.target.value!==w.delivery_video_url)void updateDelivery(w,'delivery_video_url',e.target.value);}} placeholder="https://…"/></label>
       <label>Foto de entrega (URL)<input type="url" defaultValue={w.delivery_photo_url||''} onBlur={e=>{if(e.target.value!==w.delivery_photo_url)void updateDelivery(w,'delivery_photo_url',e.target.value);}} placeholder="https://…"/></label>
       <label className="raffle-admin-check"><input type="checkbox" checked={Boolean(w.delivered_at)} onChange={e=>void updateDelivery(w,'delivered_at',e.target.checked?new Date().toISOString():null)}/> Premio entregado</label>
      </div>;
     })}</div>
    </div>
    {notice&&<div className="raffle-admin-notice" role="status">{notice}</div>}
   </>}
   {error&&<div className="raffle-admin-error" role="alert">{error}</div>}
  </section>
 </div>;
}
