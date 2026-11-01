'use client';
import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {getDb,getDbConfigIssue} from '@/lib/client';

type Campaign={
 id:string;period:string;title:string;subtitle:string;starts_at:string;ends_at:string;draw_at:string;
 status:'draft'|'live'|'closed';prizes:string[];terms:string;results_published:boolean;
 prize_image_url:string;hero_image_url:string;video_url:string;video_title:string;
};
type Entry={id:string;first_name:string;last_name:string;dni:string;phone:string;created_at:string};
type Winner={id:string;entry_id:string;prize:string;drawn_at:string;delivered_at:string|null;
 delivery_video_url:string;delivery_photo_url:string};
type FormState={
 id:string;period:string;title:string;subtitle:string;starts_at:string;ends_at:string;draw_at:string;
 status:'draft'|'live'|'closed';prizes:string;terms:string;results_published:boolean;
 prize_image_url:string;hero_image_url:string;video_url:string;video_title:string;
};
const local=(v:string)=>{if(!v)return '';const d=new Date(v);
 if(!Number.isFinite(d.getTime()))return '';const p=(n:number)=>String(n).padStart(2,'0');
 return [d.getFullYear(),p(d.getMonth()+1),p(d.getDate())].join('-')+'T'+p(d.getHours())+':'+p(d.getMinutes());
};
const fresh=():FormState=>({
 id:'',period:new Date().toISOString().slice(0,7),
 title:'Sorteo mensual para consumidores MITOBICEL',
 subtitle:'Un agradecimiento a todas las personas que eligen nuestros productos.',
 starts_at:'',ends_at:'',draw_at:'',status:'draft',prizes:'',terms:'',
 results_published:false,prize_image_url:'',hero_image_url:'',
 video_url:'',video_title:'Conocé las entregas de premios de MITOBICEL'
});
const editor=(c:Campaign):FormState=>({...c,prizes:(c.prizes||[]).join('\n'),
 starts_at:local(c.starts_at),ends_at:local(c.ends_at),draw_at:local(c.draw_at)});
function toISO(value:string,label:string){
 if(!value)throw new Error('Completá la fecha y hora de '+label+'.');
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))throw new Error('Fecha inválida: '+label+'.');
 return d.toISOString();
}
export default function SorteosCompradoresAdmin(){
 const [checking,setChecking]=useState(true),[authorized,setAuthorized]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [campaigns,setCampaigns]=useState<Campaign[]>([]),[form,setForm]=useState<FormState>(fresh);
 const [entries,setEntries]=useState<Entry[]>([]),[winners,setWinners]=useState<Winner[]>([]);
 const [drawPrize,setDrawPrize]=useState(''),[qrImage,setQrImage]=useState('');
 const [uploading,setUploading]=useState(false);
 const db=getDb();
 const update=<K extends keyof FormState>(key:K,value:FormState[K])=>setForm(v=>({...v,[key]:value}));
 const publicUrl=()=>typeof window!=='undefined'?window.location.origin+'/sorteos/agradecimiento':'';
 async function loadDetails(id:string){
  const d=getDb();if(!d)return;
  const [one,two]=await Promise.all([
   d.from('raffle_consumer_entries').select('id,first_name,last_name,dni,phone,created_at').eq('campaign_id',id).order('created_at',{ascending:false}).limit(2000),
   d.from('raffle_consumer_winners').select('id,entry_id,prize,drawn_at,delivered_at,delivery_video_url,delivery_photo_url').eq('campaign_id',id).order('drawn_at',{ascending:false})
  ]);
  if(one.error||two.error){setError('No se pudieron cargar participantes o ganadores: '+(one.error?.message||two.error?.message));return;}
  setEntries((one.data||[]) as Entry[]);setWinners((two.data||[]) as Winner[]);
 }
 async function load(selectedId?:string){
  const d=getDb();if(!d)return;
  const {data,error:e}=await d.from('raffle_consumer_campaigns').select('*').order('period',{ascending:false}).limit(60);
  if(e){setError(e.code==='42P01'||e.code==='PGRST205'?
   'Falta instalar supabase/sorteos_consumidores_independientes.sql en el Supabase de MITOBICEL.':
   'No se pudieron cargar los sorteos para consumidores: '+e.message);return;}
  const all=(data||[]) as Campaign[];
  setCampaigns(all);
  const chosen=all.find(c=>c.id===selectedId)||all[0];
  if(chosen){setForm(editor(chosen));await loadDetails(chosen.id);}
  else{setForm(fresh());setEntries([]);setWinners([]);}
 }
 useEffect(()=>{
  let alive=true;
  const init=async()=>{
   const d=getDb();
   if(!d){if(alive){setError(getDbConfigIssue()||'Supabase no configurado.');setChecking(false);}return;}
   const {data:{user}}=await d.auth.getUser();
   if(!alive)return;
   if(!user){setAuthorized(false);setChecking(false);return;}
   const {data:admin,error:adminError}=await d.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
   if(!alive)return;
   setAuthorized(Boolean(admin&&!adminError));setChecking(false);
   if(admin&&!adminError)await load();
  };
  void init();
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  if(typeof window==='undefined')return;
  QRCode.toDataURL(publicUrl(),{width:880,margin:3,color:{dark:'#063b23',light:'#ffffff'}})
   .then(setQrImage).catch(()=>{});
 },[]);
 async function login(e:React.FormEvent){
  e.preventDefault();const d=getDb();if(!d)return;
  setBusy(true);setError('');
  try{
   const {data,error:authError}=await d.auth.signInWithPassword({email,password});
   if(authError||!data.user)throw new Error('Correo o contraseña incorrectos.');
   const {data:admin}=await d.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
   if(!admin){await d.auth.signOut();throw new Error('Esta cuenta no tiene permisos de superadministrador.');}
   setAuthorized(true);setPassword('');await load();
  }catch(err){setError(err instanceof Error?err.message:'No se pudo ingresar.');}
  finally{setBusy(false);}
 }
 async function save(activate:boolean){
  const d=getDb();if(!d||busy)return;
  setError('');setNotice('');
  let start:string,end:string,draw:string;
  try{start=toISO(form.starts_at,'inicio');end=toISO(form.ends_at,'cierre');draw=toISO(form.draw_at,'sorteo');}
  catch(e){setError(e instanceof Error?e.message:'Revisá las fechas.');return;}
  if(!(start<end&&end<=draw)){setError('Las fechas deben estar ordenadas: inicio, cierre y sorteo.');return;}
  const prizes=form.prizes.split('\n').map(x=>x.trim()).filter(Boolean);
  const status=activate?'live':form.status;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.period)){setError('Indicá un período YYYY-MM válido.');return;}
  if(!form.title.trim()){setError('Completá el título.');return;}
  if(status==='live'&&new Date(end).getTime()<Date.now()){setError('No se puede publicar una edición cuyo cierre ya pasó.');return;}
  if(status!=='draft'&&(!prizes.length||form.terms.trim().length<80)){
   setError('Para publicar se requieren premios confirmados y bases reales (mínimo 80 caracteres).');return;}
  if(form.results_published&&status==='draft'){setError('Primero publicá la edición.');return;}
  const values={period:form.period,title:form.title.trim(),subtitle:form.subtitle.trim(),
   starts_at:start,ends_at:end,draw_at:draw,status,prizes,terms:form.terms.trim(),
   results_published:form.results_published,prize_image_url:form.prize_image_url,
   hero_image_url:form.hero_image_url,video_url:form.video_url.trim(),video_title:form.video_title.trim()};
  setBusy(true);
  try{
   const query=form.id?
    d.from('raffle_consumer_campaigns').update(values).eq('id',form.id).select('id').single():
    d.from('raffle_consumer_campaigns').insert(values).select('id').single();
   const {data,error:e}=await query;
   if(e)throw e;
   await load(data.id);
   setNotice(activate?'Edición de consumidores publicada.':'Edición de consumidores guardada correctamente.');
  }catch(err){setError(err instanceof Error?err.message:'Error al guardar la edición.');}
  finally{setBusy(false);}
 }
 async function uploadPhoto(file:File|undefined,kind:'hero_image_url'|'prize_image_url'){
  const d=getDb();if(!d||!file||!form.id||uploading)return;
  if(file.type!=='image/png'||file.size>5*1024*1024){setError('Elegí una imagen PNG de máximo 5 MB.');return;}
  setError('');setUploading(true);
  try{
   const path='compradores/'+form.id+'/'+kind+'-'+crypto.randomUUID()+'.png';
   const {error:uploadError}=await d.storage.from('raffle-prizes').upload(path,file,{contentType:'image/png',upsert:false,cacheControl:'3600'});
   if(uploadError)throw uploadError;
   const url=d.storage.from('raffle-prizes').getPublicUrl(path).data.publicUrl;
   const {error:saveError}=await d.from('raffle_consumer_campaigns').update({[kind]:url}).eq('id',form.id);
   if(saveError)throw saveError;
   update(kind,url);setNotice('Imagen cargada correctamente en los sorteos de consumidores.');
  }catch(err){setError('Error al subir la imagen: '+(err instanceof Error?err.message:'No se pudo completar la carga.')+'. Revisá el bucket raffle-prizes.');}
  finally{setUploading(false);}
 }
 async function drawWinner(){
  const d=getDb();if(!d||!form.id||!drawPrize||busy)return;
  if(!window.confirm('¿Sortear al azar un ganador de CONSUMIDORES para '+drawPrize+'?'))return;
  setError('');setNotice('');setBusy(true);
  const {error:e}=await d.rpc('raffle_consumer_draw',{p_campaign_id:form.id,p_prize:drawPrize});
  if(e)setError(e.message);else{setNotice('Ganador de consumidores seleccionado y registrado.');setDrawPrize('');await loadDetails(form.id);}
  setBusy(false);
 }
 async function updateDelivery(id:string,payload:Record<string,string|null>){
  const d=getDb();if(!d||!form.id)return;
  const {error:e}=await d.from('raffle_consumer_winners').update(payload).eq('id',id);
  if(e)setError(e.message);else{setNotice('Entrega guardada.');await loadDetails(form.id);}
 }
 function downloadQr(){
  if(!qrImage)return;
  const a=document.createElement('a');a.href=qrImage;a.download='MITOBICEL-QR-SORTEOS-CONSUMIDORES.png';a.click();
 }
 const selected=Boolean(form.id);
 return <main className="raffle-admin">
  <header className="raffle-admin-header"><img src="/logo-mitobicel.png" alt="MITOBICEL"/><div><span className="raffle-eyebrow">SUPERADMINISTRADOR · SISTEMA INDEPENDIENTE</span><strong>Sorteos · Consumidor final</strong></div><a href="/sorteos/agradecimiento" target="_blank" rel="noopener noreferrer">Ver página de compradores ↗</a></header>
  <div className="raffle-admin-main">
   <div className="raffle-admin-banner"><span className="raffle-eyebrow">DOS PÚBLICOS · DOS SORTEOS DISTINTOS</span><h1>Sorteos para consumidores finales</h1><p>Administrá las inscripciones que llegan directamente desde el QR impreso en los productos. Sin códigos, sin mezclarlas con los sorteos para vendedores.</p></div>
   {checking?<div className="raffle-admin-panel"><p>Verificando acceso…</p></div>:!authorized?
    <form className="raffle-admin-panel raffle-login" onSubmit={e=>void login(e)}>
     <h2>Ingresá al administrador</h2><p>Usá la misma cuenta de superadministrador de MITOBICEL.</p>
     <label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
     <label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
     <button className="raffle-cta" disabled={busy} type="submit">Ingresar ↗</button>
    </form>:<>
     <nav className="raffle-admin-nav">
      <a href="/admin">Catálogo 1</a><a href="/admin/catalogo-2">Catálogo 2</a>
      <a href="/admin/sorteos">Sorteos · Vendedores</a>
      <a className="active" href="/admin/sorteos/compradores">Sorteos · Consumidor final</a>
      <button type="button" onClick={()=>{setForm(fresh());setEntries([]);setWinners([]);setDrawPrize('');setError('');setNotice('Nueva edición de consumidores. Completá los campos y guardá.');}}>+ Nueva edición</button>
     </nav>
     <div className="raffle-admin-kpis"><div><strong>{campaigns.length}</strong><span>Ediciones de consumidores</span></div><div><strong>{entries.length}</strong><span>Inscripciones (máx. 2000)</span></div><div><strong>{winners.length}</strong><span>Ganadores de esta edición</span></div></div>
     <div className="raffle-admin-panel">
      <h2>QR exclusivo para compradores</h2>
      <p>Este QR es independiente del QR general para vendedores. Debe llevar a <strong>/sorteos/agradecimiento</strong>, no a /sorteos. Una vez colocado en los productos, permite registrarse directamente, sin código adicional.</p>
      <div className="raffle-admin-qr-actions">
       {qrImage&&<img src={qrImage} alt="QR para inscripciones de consumidores" style={{width:150,height:150,borderRadius:12,border:'1px solid #d5e7d7'}}/>}
       <div><a href="/sorteos/agradecimiento" target="_blank" rel="noopener noreferrer">Abrir página de consumidores ↗</a><p style={{overflowWrap:'anywhere'}}>{publicUrl()}</p><button type="button" disabled={!qrImage} onClick={downloadQr}>Descargar QR PNG de consumidores</button></div>
      </div>
      <p className="raffle-admin-hint">Importante: si el QR ya impreso en un envase apunta a otra URL, hay que actualizar su destino o reimprimirlo. La web no puede cambiar la dirección codificada dentro de un QR físico.</p>
     </div>
     <div className="raffle-admin-panel">
      <h2>Administrar edición de consumidores</h2>
      <p>Los datos que guardes acá no modifican los premios, participantes ni resultados de los vendedores.</p>
      {campaigns.length>0&&<label>Seleccionar edición guardada<select value={form.id} onChange={e=>{const c=campaigns.find(x=>x.id===e.target.value);if(c){setForm(editor(c));setDrawPrize('');setEntries([]);setWinners([]);void loadDetails(c.id);}}}>
       {!form.id&&<option value="">Nueva edición</option>}
       {campaigns.map(c=><option key={c.id} value={c.id}>{c.period} · {c.status} · {c.title}</option>)}
      </select></label>}
      <form className="raffle-admin-form" onSubmit={e=>{e.preventDefault();void save(false);}}>
       <label>Edición (año-mes)<input type="month" required value={form.period} onChange={e=>update('period',e.target.value)}/></label>
       <label>Estado<select value={form.status} onChange={e=>update('status',e.target.value as FormState['status'])}>
        <option value="draft">Borrador</option><option value="live">Publicada</option><option value="closed">Cerrada</option>
       </select></label>
       <label className="wide">Título<input required value={form.title} onChange={e=>update('title',e.target.value.slice(0,180))}/></label>
       <label className="wide">Subtítulo<input value={form.subtitle} onChange={e=>update('subtitle',e.target.value.slice(0,300))}/></label>
       <label>Inicio de inscripción<input type="datetime-local" required value={form.starts_at} onChange={e=>update('starts_at',e.target.value)}/></label>
       <label>Cierre de inscripción<input type="datetime-local" required value={form.ends_at} onChange={e=>update('ends_at',e.target.value)}/></label>
       <label>Fecha del sorteo<input type="datetime-local" required value={form.draw_at} onChange={e=>update('draw_at',e.target.value)}/></label>
       <label className="wide">Premios confirmados (uno por línea)<textarea rows={5} value={form.prizes} onChange={e=>update('prizes',e.target.value)} placeholder="Ej.: Televisor Smart TV 43 pulgadas"/></label>
       <label className="wide">Bases y condiciones reales para consumidores<textarea rows={9} value={form.terms} onChange={e=>update('terms',e.target.value)} placeholder="Fechas, elegibilidad, una inscripción por DNI por edición, premios, selección, entregas, tratamiento de datos y condiciones…"/></label>
       <label className="wide">URL del video de entregas<input type="url" value={form.video_url} onChange={e=>update('video_url',e.target.value)}/></label>
       <label className="wide">Título del video<input value={form.video_title} onChange={e=>update('video_title',e.target.value)}/></label>
       <label className="raffle-admin-check wide"><input type="checkbox" checked={form.results_published} onChange={e=>update('results_published',e.target.checked)}/> Publicar resultados durante el mes siguiente al sorteo (DNI parcialmente oculto)</label>
       <div className="raffle-admin-activation-actions wide">
        <button type="submit" disabled={busy} className="raffle-cta-secondary">Guardar edición</button>
        <button type="button" disabled={busy} className="raffle-cta" onClick={()=>void save(true)}>Publicar edición de consumidores ↗</button>
       </div>
      </form>
      <p className="raffle-admin-legal">Revisá las bases, privacidad, protección de datos y requisitos legales antes de publicar. Un QR abierto no demuestra por sí solo que alguien compró un producto.</p>
     </div>
     <div className="raffle-admin-panel">
      <h2>Imágenes independientes de consumidores</h2>
      <p>La galería de seis imágenes ilustrativas sigue siendo la misma. Acá podés cargar la portada o imagen del premio confirmado solo para este sorteo.</p>
      {!selected?<p>Guardá primero una edición para habilitar la carga de imágenes.</p>:<div className="raffle-consumer-image-grid">
       <div><h3>Portada principal</h3>{form.hero_image_url&&<img src={form.hero_image_url} alt="Portada de compradores"/>}
        <label>Subir portada PNG<input type="file" accept="image/png" disabled={uploading} onChange={e=>{void uploadPhoto(e.target.files?.[0],'hero_image_url');e.currentTarget.value='';}}/></label>
       </div>
       <div><h3>Premio confirmado</h3>{form.prize_image_url&&<img src={form.prize_image_url} alt="Premio confirmado para compradores"/>}
        <label>Subir imagen PNG<input type="file" accept="image/png" disabled={uploading} onChange={e=>{void uploadPhoto(e.target.files?.[0],'prize_image_url');e.currentTarget.value='';}}/></label>
       </div>
      </div>}
     </div>
     <div className="raffle-admin-panel">
      <h2>Participantes · Solo consumidores</h2>
      <p>Una inscripción por DNI en cada edición mensual. Datos privados: no se publican nombres completos ni DNI.</p>
      {!selected?<p>Seleccioná una edición para ver sus participantes.</p>:
       entries.length?<div className="raffle-admin-list">{entries.map(e=><div key={e.id}><strong>{e.first_name} {e.last_name}</strong><span>DNI {e.dni} · {e.phone}</span><small>{new Date(e.created_at).toLocaleString('es-AR')}</small></div>)}</div>:<p>No hay consumidores registrados en esta edición.</p>}
     </div>
     <div className="raffle-admin-panel">
      <h2>Sorteo y entregas · Consumidores</h2>
      <p>La selección aleatoria se habilita después del cierre y la fecha configurada. Nunca mezcla compradores con vendedores.</p>
      <div className="raffle-admin-draw"><label>Premio confirmado<select value={drawPrize} onChange={e=>setDrawPrize(e.target.value)}>
       <option value="">Elegir premio…</option>
       {form.prizes.split('\n').map(x=>x.trim()).filter(Boolean).map((p,i)=><option key={i} value={p}>{p}</option>)}
      </select></label><button type="button" disabled={!selected||!drawPrize||busy} onClick={()=>void drawWinner()}>Seleccionar ganador al azar</button></div>
      {winners.length>0&&<div className="raffle-consumer-winners-admin">
       {winners.map(w=>{
        const person=entries.find(e=>e.id===w.entry_id);
        return <article key={w.id}>
         <strong>{w.prize}</strong>
         <p>{person?person.first_name+' '+person.last_name+' · DNI '+person.dni:'Participante registrado'} · {new Date(w.drawn_at).toLocaleString('es-AR')}</p>
         <div className="raffle-admin-qr-actions">
          <button type="button" onClick={()=>void updateDelivery(w.id,{delivered_at:w.delivered_at?null:new Date().toISOString()})}>
           {w.delivered_at?'Marcar como no entregado':'Confirmar entrega'}
          </button>
         </div>
         <label>URL del video de entrega<input type="url" defaultValue={w.delivery_video_url} onBlur={e=>{if(e.target.value!==w.delivery_video_url)void updateDelivery(w.id,{delivery_video_url:e.target.value});}}/></label>
         <label>URL de la foto de entrega<input type="url" defaultValue={w.delivery_photo_url} onBlur={e=>{if(e.target.value!==w.delivery_photo_url)void updateDelivery(w.id,{delivery_photo_url:e.target.value});}}/></label>
        </article>;
       })}
      </div>}
     </div>
    </>}
   {error&&<p className="raffle-error" role="alert">{error}</p>}
   {notice&&<p className="raffle-success" role="status">{notice}</p>}
  </div>
 </main>;
}
