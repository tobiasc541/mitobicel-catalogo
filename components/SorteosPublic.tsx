'use client';
import {useEffect,useState} from 'react';
import {getDb} from '@/lib/client';
import {Icon} from '@/components/Visuals';

type Campaign={
 id:string;period:string;title:string;subtitle:string;store_name:string;
 prizes:string[];starts_at:string;ends_at:string;draw_at:string;status:string;
 results_published:boolean;terms:string;video_url:string;video_title:string;
 free_instructions:string;prize_image_url?:string;
};
type Winner={prize:string;winner_label:string;dni_mask:string;drawn_at:string;delivered:boolean;delivery_video_url:string;delivery_photo_url:string};
type Delivery={period:string;prize:string;delivered_at:string;video_url:string;photo_url:string};
const examples=[
 {title:'Televisores y entretenimiento',description:'Smart TV Samsung, LG, Philips o TCL de 43”, 50” y 55”.',purpose:'Un Smart TV para disfrutar con tu familia cuando termina la jornada.',icon:'film'},
 {title:'Motos 110 y movilidad',description:'Motocicletas 110 cc, como Honda Wave o Corven Energy.',purpose:'Movete con mayor libertad entre distintos puntos de venta y zonas.',icon:'truck'},
 {title:'Utilitarios y camionetas',description:'Peugeot Partner, Renault Kangoo o Fiat Fiorino.',purpose:'Un utilitario podría ayudarte a transportar más mercadería y ampliar tu recorrido.',icon:'truck'},
 {title:'Celulares y conectividad',description:'iPhone, Samsung Galaxy o Motorola Moto.',purpose:'Atendé mensajes, gestioná cobros y mantenete conectado estés donde estés.',icon:'award'},
 {title:'Notebooks y tablets',description:'HP, Lenovo, ASUS, Samsung Galaxy Tab o iPad.',purpose:'Una herramienta para ordenar tus cuentas, tus pedidos y tus oportunidades.',icon:'package'},
 {title:'Electrodomésticos para tu hogar',description:'Heladeras, cocinas, lavarropas y microondas: Patrick, Drean, Whirlpool y otras marcas.',purpose:'Premios que pueden mejorar tu día a día y el de tu familia.',icon:'package'},
 ] as const;
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
function registrationError(err:unknown):string{
 const e=err&&typeof err==='object'?err as {message?:string;code?:string;hint?:string}:null;
 const message=e?.message||'No se pudo completar el registro.';
 if(e?.code==='PGRST202'||/could not find the function/i.test(message))
  return 'La función de inscripción necesita actualizarse. Avisá al personal de MITOBICEL 1 para que revise la configuración.';
 if(e?.code==='42501')return 'La inscripción está bloqueada por permisos de la base de datos. Avisá al comercio.';
 if(e?.code==='23514')return 'El formato del código no coincide con el permitido. Solicitá un código nuevo en MITOBICEL 1.';
 return message.length>220?message.slice(0,220)+'…':message;
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
 const [deliveries,setDeliveries]=useState<Delivery[]>([]);
 const [ready,setReady]=useState(false),[problem,setProblem]=useState('');
 const [firstName,setFirstName]=useState(''),[lastName,setLastName]=useState('');
 const [dni,setDni]=useState(''),[phone,setPhone]=useState(''),[code,setCode]=useState('');
 const [free,setFree]=useState(false),[accept,setAccept]=useState(false);
 const [sending,setSending]=useState(false),[receipt,setReceipt]=useState('');
 const [now,setNow]=useState(Date.now());
 const [selectedExample,setSelectedExample]=useState<number|null>(null);
 const [heroImageUrl,setHeroImageUrl]=useState('');
 useEffect(()=>{
  const codeFromUrl=new URLSearchParams(window.location.search).get('codigo');
  // Accept already printed legacy URLs, but the new QR is always /sorteos.
  if(codeFromUrl)setCode(codeFromUrl.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,40));
  let live=true;
  const load=async()=>{
   const db=getDb();
   if(!db){if(live){setProblem('El sistema de inscripción está en preparación.');setReady(true);}return;}
   const {data,error}=await db.from('raffle_campaigns').select('*').in('status',['live','closed']).order('period',{ascending:false}).limit(5);
   if(!live)return;
   if(error){setProblem('La plataforma de sorteos todavía no está configurada.');setReady(true);return;}
   const hero=await db.rpc('raffle_public_hero_image');
   if(live&&!hero.error)setHeroImageUrl(typeof hero.data==='string'?hero.data:'');
   const archive=await db.rpc('raffle_public_deliveries');
   if(live&&!archive.error)setDeliveries((archive.data||[]) as Delivery[]);
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
  const first=firstName.trim(),last=lastName.trim(),doc=dni.replace(/\D/g,''),tel=phone.trim();
  if(first.length<2){setProblem('Escribí tu nombre completo: al menos dos letras.');return;}
  if(last.length<2){setProblem('Escribí tu apellido completo: al menos dos letras.');return;}
  if(!/^\d{7,9}$/.test(doc)){setProblem('Ingresá un DNI válido de 7 a 9 números.');return;}
  if(tel.length<8){setProblem('Ingresá tu teléfono con código de área.');return;}
  if(!accept){setProblem('Aceptá las bases y condiciones de la edición.');return;}
  const token=code.trim().toUpperCase();
  if(!free&&!(/^\d{4}$/.test(token)||/^[A-Z0-9]{20,40}$/.test(token))){
   setProblem('El código nuevo tiene cuatro números. Usá el que te entregaron en el local.');return;
  }
  const db=getDb();if(!db){setProblem('No se pudo conectar con la inscripción.');return;}
  setSending(true);
  try{
   const {data,error}=await db.rpc('raffle_register',{
    p_campaign_id:campaign.id,p_code:free?'':token,
    p_first_name:first,p_last_name:last,p_dni:doc,
    p_phone:tel,p_free:free,p_accept:accept
   });
   if(error)throw error;
   const result=String(data||'');
   if(result.startsWith('DENEGADO:')){setProblem(result.slice(9).trim());return;}
   if(!result)throw new Error('No recibimos confirmación de la base. Comprobá tu inscripción con el comercio.');
   setReceipt(result);setCode('');setAccept(false);
  }catch(err){setProblem(registrationError(err));}
  finally{setSending(false);}
 }
 return <main className="raffle-site">
  <div className="raffle-topline"><span>MITOBICEL · INDUSTRIA ARGENTINA</span><span>PARA BUSCAS, PAPELERAS Y DISTRIBUIDORES</span></div>
  <header className="raffle-header"><a href="/sorteos" aria-label="MITOBICEL Sorteos"><img src="/logo-mitobicel.png" alt="Logo MITOBICEL"/></a><span><span className="raffle-live-dot"/> Sorteos para buscas y mayoristas</span></header>
  <section className="raffle-hero">
   <div className="raffle-hero-copy">
    <span className="raffle-eyebrow">VOLVIMOS. ¡Y VOLVIMOS CON TODO!</span>
    <h1>Tu esfuerzo merece <em>algo grande.</em></h1>
    <p>Para quienes salen a vender en el tren y en la calle, y para las papeleras y distribuidoras que nos eligen cada día: <strong>gracias por ser parte de MITOBICEL.</strong></p>
    <p>Con cada venta te llevás el fruto de tu trabajo. Y ahora queremos agradecerte con la oportunidad de participar por premios que pueden hacer tu día a día más fácil, abrirte nuevas puertas o alegrar a tu familia.</p>
    <div className="raffle-hero-actions"><a href="#participar" className="raffle-cta">Registrar mi participación <span>↗</span></a><a href="#resultados" className="raffle-cta-secondary">Ver resultados</a></div>
    <div className="raffle-hero-info"><span><Icon name="award"/> Un agradecimiento a quienes nos eligen</span><span><Icon name="package"/> Una nueva participación por compra validada</span></div>
   </div>
   <div className="raffle-hero-art raffle-gifts-hero">
    {heroImageUrl?
     <img className="raffle-hero-art-uploaded" src={heroImageUrl} alt="MITOBICEL Sorteos: collage de premios posibles y agradecimiento a buscas, papeleras y distribuidores"/>:
     <>
    <img className="raffle-gifts-logo" src="/logo-mitobicel.png" alt="MITOBICEL"/>
    <span className="raffle-gifts-ribbon">UN AGRADECIMIENTO A TU ESFUERZO</span>
    {campaign?.prize_image_url&&campaign.prizes.length?
     <div className="raffle-gifts-real"><img src={campaign.prize_image_url} alt={"Premio confirmado: "+campaign.prizes[0]}/><strong>PREMIO CONFIRMADO · {campaign.period}</strong></div>:
     <div className="raffle-gifts-stage" aria-label="Ilustraciones de posibles premios: movilidad, tecnología y equipamiento">
      <div className="raffle-gifts-tile raffle-gifts-mobility"><Icon name="truck"/><span>Movilidad</span></div>
      <div className="raffle-gifts-tile raffle-gifts-tv"><Icon name="film"/><span>Entretenimiento</span></div>
      <div className="raffle-gifts-center"><Icon name="gift"/><strong>¡GRACIAS!</strong><span>Seguimos creciendo juntos</span></div>
      <div className="raffle-gifts-tile raffle-gifts-tech"><Icon name="package"/><span>Tecnología</span></div>
      <div className="raffle-gifts-tile raffle-gifts-home"><Icon name="award"/><span>Para tu hogar</span></div>
     </div>}
    <span className="raffle-gifts-foot">BUSCAS · PAPELERAS · DISTRIBUIDORES</span>
     </>}
   </div>
  </section>
  <section className="raffle-section raffle-prizes" id="premios">
   <span className="raffle-eyebrow">PREMIOS PARA SOÑAR EN GRANDE</span><h2>Gracias por estar. <em>Lo mejor está por venir.</em></h2>
   <p className="raffle-section-lead">Tocá cada tarjeta y descubrí cómo un premio podría acompañarte. Estos son ejemplos de posibilidades futuras, no premios anunciados ni confirmados.</p>
   <div className="raffle-prize-grid">{examples.map((prize,i)=><button type="button" className={"raffle-prize-card"+(selectedExample===i?" is-selected":"")} key={prize.title} aria-expanded={selectedExample===i} onClick={()=>setSelectedExample(selectedExample===i?null:i)}><span className="raffle-prize-index">{String(i+1).padStart(2,'0')}</span><div className="raffle-prize-icon"><Icon name={prize.icon}/></div><h3>{prize.title}</h3><p className="raffle-prize-description">{prize.description}</p>{selectedExample===i&&<p className="raffle-prize-purpose" aria-live="polite">{prize.purpose}</p>}<span className="raffle-prize-more">{selectedExample===i?"− Ocultar detalle":"+ Ver cómo podría ayudarte"}</span><small>Ejemplos futuros · No confirmados</small></button>)}</div>
   {campaign?.prizes.length?<div className="raffle-confirmed">{campaign.prize_image_url&&<img className="raffle-confirmed-image" src={campaign.prize_image_url} alt={"Foto del premio confirmado "+campaign.prizes[0]}/>}<strong>Premios confirmados · Edición {campaign.period}</strong><div>{campaign.prizes.map((p,i)=><span key={i}>{p}</span>)}</div></div>:<p className="raffle-inline-note">Los premios de la próxima edición se publicarán cuando sean confirmados oficialmente.</p>}
  </section>
  <div className="raffle-mini-thanks" role="note"><span className="raffle-mini-thanks-heart"><Icon name="heart"/></span><p><strong>Para quienes no paran:</strong> desde una moto 110 hasta un utilitario tipo Partner, un premio podría ayudarte a recorrer más lugares, transportar más mercadería o trabajar con mayor comodidad. <strong>Gracias por crecer con nosotros.</strong></p></div>
  <section className="raffle-section raffle-how" id="como-participar">
   <span className="raffle-eyebrow">UN GESTO DE AGRADECIMIENTO</span><h2>Nos acompañaste. <em>Ahora queremos agradecerte.</em></h2>
   <p className="raffle-how-intro">Una forma más de agradecer a quienes nos eligen. Así funciona:</p>
   <div className="raffle-steps">
    <article><span>01</span><h3>Escaneá el QR general</h3><p>En MITOBICEL 1, Temperley, a una cuadra de la estación, encontrás el mismo QR para todos. Abrí la página de sorteos cuando quieras.</p></article>
    <article><span>02</span><h3>Validá tu compra</h3><p>El comercio verifica la compra, registra tu DNI y te entrega cuatro números. Ingresalos con ese mismo DNI: un código por compra válida. Podés volver a participar si comprás nuevamente.</p></article>
    <article><span>03</span><h3>Seguí el sorteo</h3><p>Consultá acá la fecha oficial, los premios confirmados, los ganadores y las entregas.</p></article>
   </div>
   <div className="raffle-authorized-shop"><Icon name="map-pin"/><div><strong>Único comercio autorizado: MITOBICEL 1</strong><p>Temperley, Zona Sur, Buenos Aires · A una cuadra de la estación.</p></div></div>
   <p className="raffle-free-note">Sin obligación de compra. También podés participar por la vía gratuita del formulario, conforme a las bases de cada edición.</p>
  </section>
  <section className="raffle-section raffle-register-section" id="participar">
   <div className="raffle-register-intro">
    <span className="raffle-eyebrow">SORTEOS PARA BUSCAS, PAPELERAS Y DISTRIBUIDORES</span>
    <h2>Registrá tu <em>participación.</em></h2>
    <p>Tu esfuerzo merece reconocimiento. Completá tus datos para participar en la edición vigente; si resultás ganador, tu nombre y DNI se comprobarán con tu documento. Nunca publicamos el DNI completo.</p>
    <div className="raffle-date-box"><span>PRÓXIMA FECHA OFICIAL</span><strong>{campaign?.draw_at?date(campaign.draw_at):'A confirmar por MITOBICEL'}</strong><small>{campaign?'Edición '+campaign.period+' · '+(campaign.store_name.trim().toLowerCase()==='temper'?'MITOBICEL 1':campaign.store_name):'Consultá esta página para próximos anuncios'}</small>
     {campaign&&<small>Inscripciones: {date(campaign.starts_at)} hasta {date(campaign.ends_at)}.</small>}</div>
   </div>
   <div className="raffle-register-card">
    <span className="raffle-eyebrow">FORMULARIO OFICIAL</span>
    <h3>{open?'¡Inscripciones abiertas!':'Tu participación, cuando se anuncie la edición.'}</h3>
    {!ready?<p>Cargando información de la edición…</p>:!open?<div className="raffle-not-open"><Icon name="award"/><strong>Próxima edición en preparación</strong><p>Cuando MITOBICEL publique las fechas, las bases y los premios confirmados, vas a poder registrarte acá. Todavía no estamos recibiendo datos personales.</p></div>:
    <form onSubmit={e=>void submit(e)}>
     <div className="raffle-entry-modes">
      <label><input type="radio" name="entry" checked={!free} onChange={()=>setFree(false)}/> Con código de compra</label>
      <label><input type="radio" name="entry" checked={free} onChange={()=>setFree(true)}/> Sin obligación de compra</label>
     </div>
     {!free&&<p className="raffle-free-instructions">El QR es siempre el mismo. Después de comprar, mostrás tu DNI en MITOBICEL 1 y recibís un código de cuatro números vinculado a ese documento. Cada nueva compra validada permite otra participación.</p>}
     {!free?<label className="raffle-field">Código de cuatro números de tu compra<input inputMode="numeric" value={code} onChange={e=>setCode(e.target.value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,40))} autoComplete="one-time-code" required placeholder="Ejemplo: 0427"/></label>:<p className="raffle-free-instructions">{campaign?.free_instructions||'Podés participar sin compra según las bases de la edición.'}</p>}
     <div className="raffle-fields-two">
      <label className="raffle-field">Nombre<input value={firstName} onChange={e=>setFirstName(e.target.value.slice(0,80))} required minLength={2} autoComplete="given-name" maxLength={80} placeholder="Tu nombre completo"/></label>
      <label className="raffle-field">Apellido<input value={lastName} onChange={e=>setLastName(e.target.value.slice(0,80))} required minLength={2} autoComplete="family-name" maxLength={80} placeholder="Tu apellido completo"/></label>
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
   <div><span className="raffle-eyebrow">PORQUE AGRADECER TAMBIÉN ES CUMPLIR</span><h2>Cada premio entregado, <em>una historia para compartir.</em></h2><p>Acá vamos a mostrar las entregas reales cuando se realicen, para que toda la comunidad de buscas, papeleras y distribuidores pueda seguir los resultados.</p></div>
   <Video url={campaign?.video_url||''} title={campaign?.video_title||'Entregas MITOBICEL'}/>
   {deliveries.length>0&&<div className="raffle-delivery-links">
    {deliveries.map((d,i)=><a key={i} href={d.video_url||d.photo_url} rel="noopener noreferrer" target="_blank">{d.prize} · {d.period} · Ver entrega ↗</a>)}
   </div>}
  </section>
  {campaign?.terms&&<section className="raffle-section raffle-terms" id="bases"><details><summary>Bases y condiciones de la edición {campaign.period}</summary><p>{campaign.terms}</p></details></section>}
  <footer className="raffle-footer"><img src="/logo-mitobicel.png" alt="MITOBICEL"/><div><strong>MITOBICEL · Sorteos para buscas, papeleras y distribuidores</strong><p>Comercio autorizado: MITOBICEL 1, Temperley, a una cuadra de la estación. Fábrica: Av. San Martín 249, Burzaco.</p><small>© {new Date().getFullYear()} · Participación sin obligación de compra · Resultados sujetos a las bases de cada edición.</small></div></footer>
 </main>;
}
