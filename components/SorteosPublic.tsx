'use client';
import {useEffect,useState} from 'react';
import {getDb} from '@/lib/client';
import {Icon} from '@/components/Visuals';

type Campaign={
 id:string;period:string;title:string;subtitle:string;store_name:string;
 prizes:string[];starts_at:string;ends_at:string;draw_at:string;status:string;
 results_published:boolean;terms:string;video_url:string;video_title:string;
 free_instructions:string;
};
type Winner={prize:string;winner_label:string;dni_mask:string;drawn_at:string;delivered:boolean;delivery_video_url:string;delivery_photo_url:string};
const date=(iso:string)=>new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
function embedUrl(raw:string):string|null{
 try{
  const url=new URL(raw);
  const host=url.hostname.replace(/^www\./,'');
  if(host==='youtube.com'||host==='m.youtube.com'){
   const id=url.searchParams.get('v')||url.pathname.match(/^\/shorts\/([\w-]{11})/)?.[1];
   return id&&/^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:null;
  }
  if(host==='youtu.be'){
   const id=url.pathname.slice(1);return /^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:null;
  }
  if(host==='vimeo.com'||host==='player.vimeo.com'){
   const id=url.pathname.match(/(\d{6,12})/)?.[1];
   return id?'https://player.vimeo.com/video/'+id:null;
  }
 }catch{}
 return null;
}
function Video({url,title}:{url:string;title:string}){
 const embed=embedUrl(url);
 let direct=false;
 try{const u=new URL(url);direct=u.protocol==='https:'&&/\.mp4($|\?)/i.test(u.pathname+u.search);}catch{}
 return <div className="raffle-video">
  {embed?<iframe src={embed} title={title} loading="lazy" allow="encrypted-media;picture-in-picture;fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:
   direct?<video src={url} controls playsInline preload="metadata"/>:
   <div className="raffle-video-placeholder"><span className="raffle-video-play"><Icon name="play"/></span><strong>Entregas que se pueden ver</strong><p>Acá se publicarán los videos oficiales de MITOBICEL cuando estén disponibles.</p></div>}
 </div>;
}
export default function SorteosPublic(){
 const [campaign,setCampaign]=useState<Campaign|null>(null);
 const [winners,setWinners]=useState<Winner[]>([]);
 const [ready,setReady]=useState(false),[problem,setProblem]=useState('');
 const [firstName,setFirstName]=useState(''),[lastName,setLastName]=useState('');
 const [dni,setDni]=useState(''),[phone,setPhone]=useState(''),[code,setCode]=useState('');
 const [free,setFree]=useState(false),[accept,setAccept]=useState(false);
 const [sending,setSending]=useState(false),[receipt,setReceipt]=useState('');
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{
  const codeFromUrl=new URLSearchParams(window.location.search).get('codigo');
  if(codeFromUrl)setCode(codeFromUrl.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,40));
  let live=true;
  const load=async()=>{
   const db=getDb();
   if(!db){if(live){setProblem('El sistema de inscripción está en preparación.');setReady(true);}return;}
   const {data,error}=await db.from('raffle_campaigns').select('*').in('status',['live','closed']).order('period',{ascending:false}).limit(5);
   if(!live)return;
   if(error){setProblem('La plataforma de sorteos todavía no está configurada.');setReady(true);return;}
   const rows=(data||[]) as Campaign[];
   const current=rows.find(x=>x.status==='live'&&Date.now()<=new Date(x.draw_at).getTime())||rows[0]||null;
   setCampaign(current);
   if(current?.results_published){
    const result=await db.rpc('raffle_public_winners',{p_campaign_id:current.id});
    if(live&&!result.error)setWinners(result.data as Winner[]||[]);
   }
   setReady(true);
  };
  void load();
  const watch=window.setInterval(()=>{setNow(Date.now());void load();},60000);
  return()=>{live=false;window.clearInterval(watch);};
 },[]);
 const open=Boolean(campaign&&campaign.status==='live'&&now>=new Date(campaign.starts_at).getTime()&&now<=new Date(campaign.ends_at).getTime()&&campaign.prizes.length&&campaign.terms.length>=80);
 async function submit(e:React.FormEvent){
  e.preventDefault();setReceipt('');setProblem('');
  if(!campaign||!open)return;
  if(!free&&!/^[A-Z0-9]{20,40}$/.test(code.trim().toUpperCase())){setProblem('Ingresá el código único que te entregó el comercio.');return;}
  const db=getDb();if(!db){setProblem('No se pudo conectar con la inscripción.');return;}
  setSending(true);
  try{
   const {data,error}=await db.rpc('raffle_register',{
    p_campaign_id:campaign.id,p_code:free?'':code.trim().toUpperCase(),
    p_first_name:firstName,p_last_name:lastName,p_dni:dni.replace(/\D/g,''),
    p_phone:phone,p_free:free,p_accept:accept
   });
   if(error)throw error;
   setReceipt(String(data||'Tu participación fue registrada.'));
   setCode('');setAccept(false);
  }catch(err){setProblem(err instanceof Error?err.message:'No se pudo registrar tu participación.');}
  finally{setSending(false);}
 }
 return <main className="raffle-site">
  <div className="raffle-topline"><span>MITOBICEL · INDUSTRIA ARGENTINA</span><span>SORTEOS MENSUALES</span></div>
  <header className="raffle-header"><a href="/sorteos" aria-label="MITOBICEL Sorteos"><img src="/logo-mitobicel.png" alt="Logo MITOBICEL"/></a><span><span className="raffle-live-dot"/> Página oficial de sorteos</span></header>
  <section className="raffle-hero">
   <div className="raffle-hero-copy">
    <span className="raffle-eyebrow">UNA EXPERIENCIA DIFERENTE PARA NUESTROS CLIENTES</span>
    <h1>Tu compra puede venir con <em>una gran sorpresa.</em></h1>
    <p>Participá de las ediciones mensuales de sorteos MITOBICEL. Escaneá el QR que te entrega el comercio autorizado, registrá tus datos y seguí los anuncios de esta página.</p>
    <div className="raffle-hero-actions"><a href="#participar" className="raffle-cta">Registrar mi participación <span>↗</span></a><a href="#resultados" className="raffle-cta-secondary">Ver resultados</a></div>
    <div className="raffle-hero-info"><span><Icon name="award"/> Premios confirmados en cada edición</span><span><Icon name="package"/> Una oportunidad por código válido</span></div>
   </div>
   <div className="raffle-hero-art">
    <span className="raffle-art-top">EDICIÓN MENSUAL · MITOBICEL</span>
    <div className="raffle-art-orbit"><div className="raffle-art-award"><Icon name="award"/></div></div>
    <span className="raffle-art-title">LO MEJOR PODRÍA SER TUYO</span>
    <span className="raffle-art-foot">Premios · Emoción · Comunidad</span>
   </div>
  </section>
  <section className="raffle-section raffle-prizes" id="premios">
   <span className="raffle-eyebrow">LO QUE SE VIENE</span><h2>Grandes premios. <em>Grandes momentos.</em></h2>
   <p className="raffle-section-lead">Cada mes anunciamos los premios confirmados y las fechas oficiales. Algunos ejemplos de categorías que pueden formar parte de próximas ediciones:</p>
   <div className="raffle-prize-grid">{['Televisores y entretenimiento','Motocicletas y movilidad','Celulares y tecnología','Notebooks y tablets','Electrodomésticos','Audio y accesorios'].map((prize,i)=><div className="raffle-prize-card" key={prize}><span className="raffle-prize-index">0{i+1}</span><div className="raffle-prize-icon"><Icon name={i===0||i===2||i===3?'film':i===1?'truck':i===4?'package':'award'}/></div><h3>{prize}</h3><small>Ejemplos · Sujetos a confirmación</small></div>)}</div>
   {campaign?.prizes.length?<div className="raffle-confirmed"><strong>Premios confirmados · Edición {campaign.period}</strong><div>{campaign.prizes.map((p,i)=><span key={i}>{p}</span>)}</div></div>:<p className="raffle-inline-note">Los premios de la próxima edición se publicarán cuando sean confirmados oficialmente.</p>}
  </section>
  <section className="raffle-section raffle-how" id="como-participar">
   <span className="raffle-eyebrow">SIMPLE, CLARO Y TRANSPARENTE</span><h2>Tu próxima oportunidad empieza <em>con un QR.</em></h2>
   <div className="raffle-steps">
    <article><span>01</span><h3>Recibí tu código</h3><p>Por cada bulto participante, el comercio autorizado Temper te entrega un código QR único, válido para una inscripción.</p></article>
    <article><span>02</span><h3>Completá tus datos</h3><p>Escanealo, cargá nombre, apellido y DNI. El documento se verifica con el original si resultás ganador.</p></article>
    <article><span>03</span><h3>Seguí el sorteo</h3><p>Consultá acá la fecha oficial, los premios confirmados, los ganadores y las entregas.</p></article>
   </div>
   <p className="raffle-free-note">Sin obligación de compra. También existe una vía de participación gratuita, disponible en el formulario, según las bases de cada edición.</p>
  </section>
  <section className="raffle-section raffle-register-section" id="participar">
   <div className="raffle-register-intro">
    <span className="raffle-eyebrow">TU LUGAR EN LA PRÓXIMA EDICIÓN</span>
    <h2>Registrá tu <em>participación.</em></h2>
    <p>Los datos se utilizan para administrar el sorteo y verificar la identidad del ganador. Tu DNI completo nunca se publica.</p>
    <div className="raffle-date-box"><span>PRÓXIMA FECHA OFICIAL</span><strong>{campaign?.draw_at?date(campaign.draw_at):'A confirmar por MITOBICEL'}</strong><small>{campaign?'Edición '+campaign.period+' · '+campaign.store_name:'Consultá esta página para próximos anuncios'}</small></div>
   </div>
   <div className="raffle-register-card">
    <span className="raffle-eyebrow">FORMULARIO OFICIAL</span>
    <h3>Una participación, una ilusión.</h3>
    {!ready?<p>Cargando información de la edición…</p>:!open?<div className="raffle-not-open"><Icon name="award"/><strong>Inscripciones todavía no habilitadas</strong><p>Publicaremos las fechas, los premios y las bases en esta página. Volvé a visitarnos.</p></div>:
    <form onSubmit={e=>void submit(e)}>
     <div className="raffle-entry-modes">
      <label><input type="radio" name="entry" checked={!free} onChange={()=>setFree(false)}/> Con código del comercio</label>
      <label><input type="radio" name="entry" checked={free} onChange={()=>setFree(true)}/> Sin obligación de compra</label>
     </div>
     {!free?<label className="raffle-field">Código único del bulto<input value={code} onChange={e=>setCode(e.target.value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,40))} autoComplete="off" required placeholder="Ingresá tu código de participación"/></label>:<p className="raffle-free-instructions">{campaign?.free_instructions||'Una participación gratuita por persona y mes.'}</p>}
     <div className="raffle-fields-two">
      <label className="raffle-field">Nombre<input value={firstName} onChange={e=>setFirstName(e.target.value.slice(0,80))} required autoComplete="given-name" maxLength={80} placeholder="Tu nombre"/></label>
      <label className="raffle-field">Apellido<input value={lastName} onChange={e=>setLastName(e.target.value.slice(0,80))} required autoComplete="family-name" maxLength={80} placeholder="Tu apellido"/></label>
     </div>
     <div className="raffle-fields-two">
      <label className="raffle-field">DNI<input inputMode="numeric" value={dni} onChange={e=>setDni(e.target.value.replace(/\D/g,'').slice(0,9))} minLength={7} maxLength={9} required placeholder="Solo números"/></label>
      <label className="raffle-field">Teléfono de contacto<input inputMode="tel" type="tel" value={phone} onChange={e=>setPhone(e.target.value.slice(0,30))} required placeholder="Código de área y número"/></label>
     </div>
     <label className="raffle-accept"><input type="checkbox" checked={accept} required onChange={e=>setAccept(e.target.checked)}/> Acepto las bases y condiciones de la edición y el tratamiento de datos para gestionar el sorteo.</label>
     <button className="raffle-cta raffle-submit" type="submit" disabled={sending}>{sending?'Registrando…':'Confirmar mi participación ↗'}</button>
    </form>}
    {receipt&&<p className="raffle-success" role="status">{receipt}</p>}
    {problem&&<p className="raffle-error" role="alert">{problem}</p>}
    <p className="raffle-privacy">El DNI se utiliza para comprobar identidad al adjudicar premios. No compartimos los datos de participantes públicamente.</p>
   </div>
  </section>
  <section className="raffle-section raffle-results" id="resultados">
   <span className="raffle-eyebrow">RESULTADOS PÚBLICOS</span>
   <h2>La emoción no termina <em>con el sorteo.</em></h2>
   <p className="raffle-section-lead">Los resultados oficiales permanecerán disponibles durante el mes siguiente a la fecha del sorteo.</p>
   {winners.length?<div className="raffle-winners">{winners.map((w,i)=><div className="raffle-winner" key={i}><Icon name="award"/><div><strong>{w.prize}</strong><p>{w.winner_label} · DNI {w.dni_mask}</p><small>Fecha del sorteo: {date(w.drawn_at)} · {w.delivered?'Premio entregado':'Pendiente de entrega'}</small></div></div>)}</div>:<div className="raffle-result-empty"><Icon name="award"/><div><strong>Próximamente, nuevos ganadores</strong><p>Los resultados se mostrarán acá una vez realizado y publicado el sorteo.</p></div></div>}
  </section>
  <section className="raffle-section raffle-video-section" id="entregas">
   <div><span className="raffle-eyebrow">TRANSPARENCIA EN CADA ENTREGA</span><h2>Historias reales. <em>Premios entregados.</em></h2><p>Seguí los videos de las entregas oficiales y conocé a quienes recibieron sus premios.</p></div>
   <Video url={campaign?.video_url||''} title={campaign?.video_title||'Entregas MITOBICEL'}/>
   {winners.filter(w=>w.delivery_video_url||w.delivery_photo_url).length>0&&<div className="raffle-delivery-links">
    {winners.filter(w=>w.delivery_video_url||w.delivery_photo_url).map((w,i)=><a key={i} href={w.delivery_video_url||w.delivery_photo_url} rel="noopener noreferrer" target="_blank">{w.prize} · Ver entrega ↗</a>)}
   </div>}
  </section>
  {campaign?.terms&&<section className="raffle-section raffle-terms" id="bases"><details><summary>Bases y condiciones de la edición {campaign.period}</summary><p>{campaign.terms}</p></details></section>}
  <footer className="raffle-footer"><img src="/logo-mitobicel.png" alt="MITOBICEL"/><div><strong>MITOBICEL · Sorteos oficiales</strong><p>Fábrica en Av. San Martín 249, Burzaco · Buenos Aires.</p><small>© {new Date().getFullYear()} · Participación sin obligación de compra · Resultados sujetos a las bases de cada edición.</small></div></footer>
 </main>;
}
