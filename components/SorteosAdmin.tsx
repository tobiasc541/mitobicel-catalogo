'use client';
import {useEffect,useState,useCallback} from 'react';
import QRCode from 'qrcode';
import {getDb,getDbConfigIssue} from '@/lib/client';
import {Icon} from '@/components/Visuals';

type Campaign={
 id:string;period:string;title:string;subtitle:string;store_name:string;prizes:string[];
 starts_at:string;ends_at:string;draw_at:string;status:'draft'|'live'|'closed';
 results_published:boolean;terms:string;video_url:string;video_title:string;free_instructions:string
};
type Code={id:string;code:string;store_name:string;used_at:string|null;campaign_id:string};
type Entry={id:string;first_name:string;last_name:string;dni:string;phone:string;entry_type:string;created_at:string;campaign_id:string};
type Winner={id:string;prize:string;entry_id:string;delivered_at:string|null;delivery_video_url:string;delivery_photo_url:string;drawn_at:string};
const local=(s:string)=>s?new Date(s).toLocaleString('sv-SE',{hour12:false}).replace(' ','T').slice(0,16):'';
const iso=(s:string)=>new Date(s).toISOString();
const fresh=()=>({
 id:'',period:new Date().toISOString().slice(0,7),title:'Sorteo mensual MITOBICEL',subtitle:'Premios, experiencias y oportunidades para nuestros clientes.',
 store_name:'Temper',prizes:'',starts_at:'',ends_at:'',draw_at:'',
 status:'draft' as 'draft'|'live'|'closed',results_published:false,terms:'',video_url:'',
 video_title:'Conocé las entregas de nuestros premios',
 free_instructions:'Sin obligación de compra: elegí la opción gratuita en el formulario, una participación por persona y mes.'
});
type Editor=ReturnType<typeof fresh>;
const publicLink=(code:string)=>typeof window==='undefined'?'':window.location.origin+'/sorteos?codigo='+code;
const asEditor=(c:Campaign):Editor=>({
 id:c.id,period:c.period,title:c.title,subtitle:c.subtitle,store_name:c.store_name,prizes:(c.prizes||[]).join('\n'),
 starts_at:local(c.starts_at),ends_at:local(c.ends_at),draw_at:local(c.draw_at),
 status:c.status,results_published:c.results_published,terms:c.terms,video_url:c.video_url,
 video_title:c.video_title,free_instructions:c.free_instructions
});
function randomCode(){
 const bytes=crypto.getRandomValues(new Uint8Array(12));
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
}
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
 const [quantity,setQuantity]=useState(25),[drawPrize,setDrawPrize]=useState('');
 const [printed,setPrinted]=useState<Code[]>([]);
 const db=getDb();
 const update=<K extends keyof Editor>(key:K,value:Editor[K])=>setForm(s=>({...s,[key]:value}));
 const load=useCallback(async(selected?:string)=>{
  const d=getDb();if(!d)return;
  const {data,error:e}=await d.from('raffle_campaigns').select('*').order('period',{ascending:false});
  if(e){setError('No está instalada la base de sorteos. Ejecutá supabase/sorteos_mensuales.sql: '+e.message);return;}
  setError('');const all=(data||[]) as Campaign[];setCampaigns(all);
  const active=all.find(c=>c.id===selected)||all.find(c=>c.id===form.id)||all[0];
  if(active){setForm(asEditor(active));await loadDetails(active.id);}
 },[form.id]);
 async function loadDetails(id:string){
  const d=getDb();if(!d)return;
  const [a,b,c]=await Promise.all([
   d.from('raffle_codes').select('id,code,store_name,used_at,campaign_id').eq('campaign_id',id).order('created_at',{ascending:false}).limit(1000),
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
 async function save(e:React.FormEvent){
  e.preventDefault();if(!db||busy)return;
  setError('');setNotice('');
  let dates:string[];
  try{dates=[iso(form.starts_at),iso(form.ends_at),iso(form.draw_at)];}
  catch{setError('Completá fechas válidas de inicio, cierre y sorteo.');return;}
  if(!(dates[0]<dates[1]&&dates[1]<=dates[2])){setError('El cierre debe ser posterior al inicio y el sorteo debe ser posterior al cierre.');return;}
  const prizes=form.prizes.split('\n').map(p=>p.trim()).filter(Boolean);
  if(form.status!=='draft'&&(!prizes.length||form.terms.trim().length<80)){
   setError('Para publicar, cargá premios confirmados y bases y condiciones de al menos 80 caracteres.');return;
  }
  if(form.results_published&&form.status==='draft'){setError('No se publican resultados de una edición en borrador.');return;}
  setBusy(true);
  const values={
   period:form.period,title:form.title.trim(),subtitle:form.subtitle.trim(),
   store_name:form.store_name.trim()||'Temper',prizes,
   starts_at:dates[0],ends_at:dates[1],draw_at:dates[2],
   status:form.status,results_published:form.results_published,
   terms:form.terms.trim(),video_url:form.video_url.trim(),
   video_title:form.video_title.trim(),free_instructions:form.free_instructions.trim()
  };
  const request=form.id?db.from('raffle_campaigns').update(values).eq('id',form.id).select('id').single():
    db.from('raffle_campaigns').insert(values).select('id').single();
  const {data,error:saveError}=await request;
  if(saveError){setError(saveError.message);}else{setNotice('Edición guardada correctamente.');await load(data.id);}
  setBusy(false);
 }
 async function generate(){
  if(!db||!form.id||busy)return;
  const count=Math.max(1,Math.min(200,Math.floor(quantity||0)));
  setBusy(true);setError('');setNotice('');
  const links=Array.from({length:count},()=>({campaign_id:form.id,store_name:form.store_name||'Temper',code:randomCode()}));
  const {data,error:e}=await db.from('raffle_codes').insert(links).select('id,code,store_name,used_at,campaign_id');
  if(e)setError(e.message);
  else{
   const added=(data||[]) as Code[];setPrinted(added);setNotice(count+' códigos únicos generados. Descargá o imprimí los QR para entregarlos por bulto.');
   await loadDetails(form.id);
  }
  setBusy(false);
 }
 function exportCodes(){
  if(!codes.length)return;
  downloadText('mitobicel-codigos-'+form.period+'.csv',
   '\uFEFFcodigo,comercio,enlace,estado\n'+codes.map(c=>
    [c.code,c.store_name,publicLink(c.code),c.used_at?'utilizado':'disponible'].map(x=>'"'+x.replace(/"/g,'""')+'"').join(',')
   ).join('\n'));
 }
 async function printQr(){
  const list=printed.length?printed:codes.filter(c=>!c.used_at).slice(0,100);
  if(!list.length){setError('Primero generá códigos para imprimir.');return;}
  const win=window.open('','_blank');
  if(!win){setError('Permití las ventanas emergentes para imprimir los QR.');return;}
  win.document.write('<title>QR MITOBICEL · '+form.period+'</title><p>Generando talonarios QR…</p>');
  try{
   const cards=await Promise.all(list.map(async c=>{
    const png=await QRCode.toDataURL(publicLink(c.code),{width:220,margin:1,errorCorrectionLevel:'M'});
    return '<article><img src="'+png+'"/><strong>MITOBICEL · SORTEOS</strong><small>'+c.store_name+'</small><code>'+c.code+'</code></article>';
   }));
   win.document.open();
   win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>QR Sorteos MITOBICEL</title><style>*{box-sizing:border-box}body{font-family:Arial;margin:16px}h1{font-size:16px}.sheet{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{border:1px dashed #999;padding:10px;text-align:center;break-inside:avoid;display:flex;flex-direction:column;align-items:center}article img{width:100%;max-width:135px}strong{font-size:9px;margin:4px}small{font-size:9px}code{font-size:9px;margin-top:4px}@media print{button{display:none}.sheet{gap:8px}article{page-break-inside:avoid}}</style></head><body><button onclick="window.print()">Imprimir / Guardar PDF</button><h1>MITOBICEL · Sorteos '+form.period+' · '+form.store_name+'</h1><p>Un QR único por bulto. Entregar uno por compra. Conservar los restantes hasta su distribución.</p><section class="sheet">'+cards.join('')+'</section></body></html>');
   win.document.close();win.focus();
  }catch{win.close();setError('No se pudieron generar los códigos QR. Intentá nuevamente.');}
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
   <div className="raffle-admin-banner"><span className="raffle-eyebrow">GESTIÓN DE SORTEOS</span><h1>Una experiencia que deja huella.</h1><p>Creá ediciones mensuales, administrá participaciones y publicá premios y resultados, sin modificar ninguno de los catálogos.</p></div>
   {checking?<p>Verificando permisos…</p>:!authorized?<form className="raffle-admin-panel raffle-login" onSubmit={e=>void login(e)}>
    <h2>Ingresá al superadmin</h2><p>Acceso exclusivo con las credenciales del administrador de MITOBICEL.</p>
    <label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label>
    <label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
    <button className="raffle-cta" disabled={busy} type="submit">Ingresar al Centro de Sorteos ↗</button>
   </form>:<>
    <nav className="raffle-admin-nav" aria-label="Apartados del superadmin">
     <a href="/admin">Catálogo 1</a><a href="/admin/catalogo-2">Catálogo 2</a><a className="active" href="/admin/sorteos">Sorteos · MITOBICEL</a>
     <button onClick={()=>{setForm(fresh());setCodes([]);setEntries([]);setWinners([]);setNotice('Creá una nueva edición y guardala.');}}>+ Nueva edición</button>
    </nav>
    <div className="raffle-admin-kpis"><div><strong>{campaigns.length}</strong><span>Ediciones</span></div><div><strong>{codes.length}</strong><span>QR generados (máx. 1000 visibles)</span></div><div><strong>{entries.length}</strong><span>Participaciones (máx. 2000 visibles)</span></div><div><strong>{winners.length}</strong><span>Ganadores de esta edición</span></div></div>
    <div className="raffle-admin-panel">
     <h2>Configurar edición mensual</h2>
     <div className="raffle-admin-editions">{campaigns.map(c=><button key={c.id} className={form.id===c.id?'active':''} type="button" onClick={()=>{setForm(asEditor(c));void loadDetails(c.id);}}>{c.period} · {c.status}</button>)}</div>
     <form className="raffle-admin-form" onSubmit={e=>void save(e)}>
      <label>Mes de la edición<input type="month" required value={form.period} onChange={e=>update('period',e.target.value)}/></label>
      <label>Comercio autorizado<input value={form.store_name} onChange={e=>update('store_name',e.target.value)} required/></label>
      <label className="wide">Título<input value={form.title} onChange={e=>update('title',e.target.value)} required/></label>
      <label className="wide">Subtítulo<input value={form.subtitle} onChange={e=>update('subtitle',e.target.value)}/></label>
      <label>Inicio de inscripción<input type="datetime-local" value={form.starts_at} required onChange={e=>update('starts_at',e.target.value)}/></label>
      <label>Cierre de inscripción<input type="datetime-local" value={form.ends_at} required onChange={e=>update('ends_at',e.target.value)}/></label>
      <label>Fecha y hora del sorteo<input type="datetime-local" value={form.draw_at} required onChange={e=>update('draw_at',e.target.value)}/></label>
      <label>Estado<select value={form.status} onChange={e=>update('status',e.target.value as Editor['status'])}><option value="draft">Borrador (no público)</option><option value="live">Publicado / inscripciones</option><option value="closed">Cerrado / resultados</option></select></label>
      <label className="wide">Premios CONFIRMADOS (uno por renglón)<textarea rows={4} value={form.prizes} placeholder="Ej.: Smart TV 50 pulgadas · 1 unidad" onChange={e=>update('prizes',e.target.value)}/></label>
      <label className="wide">Bases y condiciones de la edición<textarea rows={7} value={form.terms} placeholder="Organizador, vigencia, alcance geográfico, requisitos, premios, probabilidades, vía gratuita, procedimiento de selección, costos, validación de DNI, datos personales…" onChange={e=>update('terms',e.target.value)}/></label>
      <label className="wide">Procedimiento gratuito<textarea rows={2} value={form.free_instructions} onChange={e=>update('free_instructions',e.target.value)}/></label>
      <label className="wide">URL video de fábrica / entregas (YouTube, Vimeo o MP4)<input type="url" value={form.video_url} onChange={e=>update('video_url',e.target.value)} placeholder="https://…"/></label>
      <label className="wide">Título del video<input value={form.video_title} onChange={e=>update('video_title',e.target.value)}/></label>
      <label className="raffle-admin-check wide"><input type="checkbox" checked={form.results_published} onChange={e=>update('results_published',e.target.checked)}/> Publicar los ganadores (DNI parcialmente oculto) durante el mes siguiente al sorteo</label>
      <button className="raffle-cta" disabled={busy} type="submit">Guardar edición ↗</button>
     </form>
     <p className="raffle-admin-legal">Antes de publicar, revisá las bases con asesoramiento legal: modalidad sin obligación de compra, premios reales, fechas, probabilidad, alcance, privacidad y obligaciones fiscales. No publicar nombres completos ni DNI de participantes.</p>
    </div>
    <div className="raffle-admin-panel" id="talonarios">
     <h2>Generar QR únicos por bulto · {form.store_name||'Temper'}</h2>
     <p>Un QR por bulto entregado. Cada código válido se consume al inscribirse. La URL pública permanece fija: <strong>/sorteos</strong>.</p>
     <div className="raffle-admin-qr-actions"><label>Cantidad de nuevos códigos<input type="number" min={1} max={200} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
      <button type="button" className="raffle-cta" disabled={!canManage||busy} onClick={()=>void generate()}>Generar códigos</button>
      <button type="button" disabled={!codes.length} onClick={exportCodes}>Descargar CSV</button>
      <button type="button" disabled={!codes.length} onClick={()=>void printQr()}>Imprimir QR por bulto</button>
     </div>
     <p className="raffle-admin-hint">Elegí el talonario recién generado o los últimos 100 QR sin utilizar para imprimir. Si un QR ya se utilizó, el sistema no permite otra inscripción con ese código.</p>
     {codes.length>0&&<div className="raffle-admin-codes">{codes.slice(0,12).map(c=><div key={c.id}><code>{c.code}</code><small>{c.used_at?'Utilizado':'Disponible'}</small></div>)}</div>}
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
