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
 {title:'Televisores y entretenimiento',description:'Smart TV Samsung, LG, Philips o TCL de 43”, 50” y 55”.',purpose:'Un regalo para compartir momentos de descanso y alegría con los tuyos.',icon:'film'},
 {title:'Motos 110 y movilidad',description:'Motocicletas 110 cc, como Honda Wave o Corven Energy.',purpose:'Una ayuda para el trabajo, los mandados y la vida de cada día.',icon:'truck'},
 {title:'Utilitarios y camionetas',description:'Peugeot Partner, Renault Kangoo o Fiat Fiorino.',purpose:'Un vehículo podría abrir nuevas oportunidades de trabajo para una familia.',icon:'truck'},
 {title:'Celulares y conectividad',description:'iPhone, Samsung Galaxy o Motorola Moto.',purpose:'Una herramienta para estar conectado con quienes querés y con tu trabajo.',icon:'award'},
 {title:'Notebooks y tablets',description:'HP, Lenovo, ASUS, Samsung Galaxy Tab o iPad.',purpose:'Una herramienta para estudiar, trabajar y construir nuevas oportunidades.',icon:'package'},
 {title:'Electrodomésticos para tu hogar',description:'Heladeras, cocinas, lavarropas y microondas: Patrick, Drean, Whirlpool y otras marcas.',purpose:'Detalles que pueden hacer más cómoda la vida en el hogar.',icon:'package'},
 ] as const;
const prizeSpritePositions=['0%','100%','40%','60%','80%','20%'] as const;
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
export default function SorteosAgradecimiento(){
 const [campaign,setCampaign]=useState<Campaign|null>(null);
 const [winners,setWinners]=useState<Winner[]>([]);
 const [deliveries,setDeliveries]=useState<Delivery[]>([]);
 const [ready,setReady]=useState(false),[problem,setProblem]=useState('');
 const [firstName,setFirstName]=useState(''),[lastName,setLastName]=useState('');
 const [dni,setDni]=useState(''),[phone,setPhone]=useState(''),[code,setCode]=useState('');
 const [accept,setAccept]=useState(false);
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
  if(!(/^\d{4}$/.test(token)||/^[A-Z0-9]{20,40}$/.test(token))){
   setProblem('El código nuevo tiene cuatro números. Usá el que te entregaron en el local.');return;
  }
  const db=getDb();if(!db){setProblem('No se pudo conectar con la inscripción.');return;}
  setSending(true);
  try{
   const {data,error}=await db.rpc('raffle_register',{
    p_campaign_id:campaign.id,p_code:token,
    p_first_name:first,p_last_name:last,p_dni:doc,
    p_phone:tel,p_free:false,p_accept:accept
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
  <div className="raffle-topline"><span>MITOBICEL · INDUSTRIA ARGENTINA</span><span>PARA TODAS LAS PERSONAS QUE NOS ELIGEN</span></div>
  <header className="raffle-header"><a href="/sorteos/agradecimiento" aria-label="MITOBICEL · Gracias por elegirnos"><img src="/logo-mitobicel.png" alt="Logo MITOBICEL"/></a><span><span className="raffle-live-dot"/> Sorteos mensuales · Gracias por elegirnos</span></header>
  <section className="raffle-hero">
   <div className="raffle-hero-copy">
    <span className="raffle-eyebrow">UN MENSAJE DE FE Y GRATITUD PARA VOS</span>
    <h1>Gracias de corazón. <em>Que Dios te bendiga.</em></h1>
    <p>A vos que elegís un producto MITOBICEL en la calle, en una papelera, en una distribuidora o en tu comercio de confianza: <strong>queremos darte las gracias.</strong> Cada compra significa muchísimo más de lo que imaginás.</p>
    <p>Con tu apoyo, nuestra fábrica puede seguir creciendo. Pero también ayudás a que un vendedor tenga trabajo, sostenga a su familia y lleve un plato de comida a su casa. <strong>Detrás de cada producto hay personas, esfuerzo e historias reales.</strong></p>
    <div className="raffle-faith-note"><strong>Una bendición para tu hogar</strong><p>Desde nuestra fe le pedimos a Dios que bendiga tu vida y a tu familia. Jesús nos enseñó con su ejemplo a ser bondadosos y generosos: no se trata de guardarnos todo, sino de compartir lo que recibimos y hacer el bien. Por eso queremos transformar nuestro agradecimiento en algo que también llegue a vos.</p></div>
    <div className="raffle-hero-actions"><a href="#participar" className="raffle-cta">Participar del sorteo <span>↗</span></a><a href="#resultados" className="raffle-cta-secondary">Ver resultados</a></div>
    <div className="raffle-hero-info"><span><Icon name="award"/> Cada compra ayuda a crecer y a dar trabajo</span><span><Icon name="package"/> Recordá pedir el QR oficial de sorteos</span></div>
   </div>
   <div className="raffle-hero-art raffle-gifts-hero">
    {heroImageUrl?
     <img className="raffle-hero-art-uploaded" src={heroImageUrl} alt="MITOBICEL Sorteos: collage de premios posibles y agradecimiento a todos nuestros clientes"/>:
     <>
    <img className="raffle-gifts-logo" src="/logo-mitobicel.png" alt="MITOBICEL"/>
    <span className="raffle-gifts-ribbon">UN AGRADECIMIENTO A TU CONFIANZA</span>
    {campaign?.prize_image_url&&campaign.prizes.length?
     <div className="raffle-gifts-real"><img src={campaign.prize_image_url} alt={"Premio confirmado: "+campaign.prizes[0]}/><strong>PREMIO CONFIRMADO · {campaign.period}</strong></div>:
     <div className="raffle-gifts-stage" aria-label="Ilustraciones de posibles premios: movilidad, tecnología y equipamiento">
      <div className="raffle-gifts-tile raffle-gifts-mobility"><Icon name="truck"/><span>Movilidad</span></div>
      <div className="raffle-gifts-tile raffle-gifts-tv"><Icon name="film"/><span>Entretenimiento</span></div>
      <div className="raffle-gifts-center"><Icon name="gift"/><strong>¡GRACIAS!</strong><span>Seguimos creciendo juntos</span></div>
      <div className="raffle-gifts-tile raffle-gifts-tech"><Icon name="package"/><span>Tecnología</span></div>
      <div className="raffle-gifts-tile raffle-gifts-home"><Icon name="award"/><span>Para tu hogar</span></div>
     </div>}
    <span className="raffle-gifts-foot">CONSUMIDORES · VENDEDORES · COMERCIOS</span>
     </>}
   </div>
  </section>
  <section className="raffle-section raffle-prizes" id="premios">
   <span className="raffle-eyebrow">UNA FORMA DE COMPARTIR LO BUENO</span><h2>Tu confianza nos ayuda. <em>Queremos devolverte un poco.</em></h2>
   <p className="raffle-section-lead">Estos son algunos ejemplos de lo que soñamos poder compartir con nuestra comunidad. Tocá cada tarjeta para ver cómo podría acompañar a una familia. Son posibilidades futuras, no premios anunciados ni confirmados.</p>
   <div className="raffle-prize-grid">{examples.map((prize,i)=><button type="button" className={"raffle-prize-card"+(selectedExample===i?" is-selected":"")} key={prize.title} aria-expanded={selectedExample===i} onClick={()=>setSelectedExample(selectedExample===i?null:i)}><span className="raffle-prize-index">{String(i+1).padStart(2,'0')}</span><div className="raffle-prize-icon" role="img" aria-label={`Imagen ilustrativa de ${prize.title}`} style={{backgroundImage:"url('/sorteos/premios-sprite.png')",backgroundSize:"600% 100%",backgroundPosition:prizeSpritePositions[i],backgroundRepeat:"no-repeat"}}/><h3>{prize.title}</h3><p className="raffle-prize-description">{prize.description}</p>{selectedExample===i&&<p className="raffle-prize-purpose" aria-live="polite">{prize.purpose}</p>}<span className="raffle-prize-more">{selectedExample===i?"− Ocultar detalle":"+ Ver cómo podría ayudarte"}</span><small>Ejemplos futuros · No confirmados</small></button>)}</div>
   {campaign?.prizes.length?<div className="raffle-confirmed">{campaign.prize_image_url&&<img className="raffle-confirmed-image" src={campaign.prize_image_url} alt={"Foto del premio confirmado "+campaign.prizes[0]}/>}<strong>Premios confirmados · Edición {campaign.period}</strong><div>{campaign.prizes.map((p,i)=><span key={i}>{p}</span>)}</div></div>:<p className="raffle-inline-note">Los premios de la próxima edición se publicarán cuando sean confirmados oficialmente.</p>}
  </section>
  <div className="raffle-mini-thanks" role="note"><span className="raffle-mini-thanks-heart"><Icon name="heart"/></span><p><strong>Tu compra también es una oportunidad para otro:</strong> el vendedor que trabaja en la calle, la papelera de tu barrio, la distribuidora y cada familia que vive de este trabajo. <strong>Gracias por ayudarnos a crecer juntos.</strong></p></div>
  <section className="raffle-faith-banner" aria-labelledby="raffle-faith-heading"><span className="raffle-eyebrow">DAR TAMBIÉN ES RECIBIR</span><h2 id="raffle-faith-heading">El ejemplo de Jesús: <em>compartir con amor.</em></h2><p>Creemos que el éxito no tiene sentido si queda solo en nuestras manos. Jesús nos mostró que la verdadera grandeza está en servir, ser generosos y mirar al que tenemos al lado. Por eso esta iniciativa nace de la gratitud: queremos hacer el bien con lo que Dios nos permite construir.</p><p><strong>Que Dios bendiga cada hogar, cada vendedor y cada persona que confía en MITOBICEL.</strong></p></section>
  <section className="raffle-section raffle-how" id="como-participar">
   <span className="raffle-eyebrow">TU COMPRA, UN QR Y UNA OPORTUNIDAD</span><h2>Elegís MITOBICEL. <em>Nosotros te damos las gracias.</em></h2>
   <p className="raffle-how-intro">Cada vez que comprás productos MITOBICEL, recordá consultar por el QR oficial y los sorteos mensuales. Cuando el punto de venta está adherido, así funciona:</p>
   <div className="raffle-steps">
    <article><span>01</span><h3>Buscá el QR oficial</h3><p>Cuando comprás un producto MITOBICEL, pedí el QR de nuestros sorteos mensuales en el comercio adherido. Escanealo desde tu celular para acceder a la inscripción.</p></article>
    <article><span>02</span><h3>Recibí tus cuatro números</h3><p>El personal verifica la compra y te entrega un código de cuatro dígitos. Ingresá ese código en la web y completá vos tus datos. Cada código se utiliza una sola vez.</p></article>
    <article><span>03</span><h3>Compartí la alegría</h3><p>Seguí las fechas, los ganadores y las entregas mensuales. Nuestro deseo es que cada premio llegue con alegría y bendición a una familia.</p></article>
   </div>
   <div className="raffle-authorized-shop"><Icon name="map-pin"/><div><strong>Punto de validación actualmente habilitado: MITOBICEL 1</strong><p>Temperley, Zona Sur, Buenos Aires · A una cuadra de la estación. Consultá si tu comercio participa antes de solicitar un código.</p></div></div>
  </section>
  <section className="raffle-section raffle-register-section" id="participar">
   <div className="raffle-register-intro">
    <span className="raffle-eyebrow">PARA QUIENES ELIGEN NUESTROS PRODUCTOS</span>
    <h2>Gracias por estar. <em>Participá del sorteo.</em></h2>
    <p>Esta es una pequeña manera de agradecerte por confiar en nuestros productos. Si recibiste un código del comercio adherido, completá tus datos para registrarte en la edición vigente. Si ganás, verificaremos tu identidad antes de entregar el premio.</p>
    <div className="raffle-date-box"><span>PRÓXIMA FECHA OFICIAL</span><strong>{campaign?.draw_at?date(campaign.draw_at):'A confirmar por MITOBICEL'}</strong><small>{campaign?'Edición '+campaign.period+' · '+(campaign.store_name.trim().toLowerCase()==='temper'?'MITOBICEL 1':campaign.store_name):'Consultá esta página para próximos anuncios'}</small>
     {campaign&&<small>Inscripciones: {date(campaign.starts_at)} hasta {date(campaign.ends_at)}.</small>}</div>
   </div>
   <div className="raffle-register-card">
    <span className="raffle-eyebrow">TU CÓDIGO DE AGRADECIMIENTO</span>
    <h3>{open?'¡Inscripciones abiertas!':'Tu participación, cuando se anuncie la edición.'}</h3>
    {!ready?<p>Cargando información de la edición…</p>:!open?<div className="raffle-not-open"><Icon name="award"/><strong>Próxima edición en preparación</strong><p>Cuando MITOBICEL publique las fechas, las bases y los premios confirmados, vas a poder registrarte acá. Todavía no estamos recibiendo datos personales.</p></div>:
    <form onSubmit={e=>void submit(e)}>
     <p className="raffle-free-instructions"><strong>¿Compraste un producto MITOBICEL?</strong> En los puntos adheridos, podés escanear el QR oficial y recibir un código de cuatro números por tu compra validada. El personal no necesita anotar tu DNI para emitirlo: lo completás vos en este formulario. Consultá las bases de la edición para conocer las condiciones de participación.</p>
     <label className="raffle-field">Código de cuatro números que recibiste<input inputMode="numeric" value={code} onChange={e=>setCode(e.target.value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,40))} autoComplete="one-time-code" required placeholder="Ejemplo: 0427"/></label>
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
   <span className="raffle-eyebrow">UNA ALEGRÍA QUE QUEREMOS COMPARTIR</span>
   <h2>La gratitud se demuestra <em>con hechos.</em></h2>
   <p className="raffle-section-lead">Compartimos públicamente los resultados oficiales durante el mes siguiente al sorteo. Celebramos a cada familia que recibe una bendición a través de esta iniciativa.</p>
   {winners.length?<div className="raffle-winners">{winners.map((w,i)=><div className="raffle-winner" key={i}><Icon name="award"/><div><strong>{w.prize}</strong><p>{w.winner_label} · DNI {w.dni_mask}</p><small>Fecha del sorteo: {date(w.drawn_at)} · {w.delivered?'Premio entregado':'Pendiente de entrega'}</small></div></div>)}</div>:<div className="raffle-result-empty"><Icon name="award"/><div><strong>Próximamente, nuevas historias para celebrar</strong><p>Los ganadores aparecerán acá cuando se realice y publique el sorteo oficial.</p></div></div>}
  </section>
  <section className="raffle-section raffle-video-section" id="entregas">
   <div><span className="raffle-eyebrow">DAR CON AMOR ES PARTE DE NUESTRO CAMINO</span><h2>Cada entrega, <em>una alegría para compartir.</em></h2><p>Queremos que veas cómo esta gratitud se vuelve real: publicaremos las entregas de premios cuando se realicen. Gracias a vos, seguimos generando trabajo y oportunidades para quienes viven de los productos MITOBICEL.</p></div>
   <Video url={campaign?.video_url||''} title={campaign?.video_title||'Entregas MITOBICEL'}/>
   {deliveries.length>0&&<div className="raffle-delivery-links">
    {deliveries.map((d,i)=><a key={i} href={d.video_url||d.photo_url} rel="noopener noreferrer" target="_blank">{d.prize} · {d.period} · Ver entrega ↗</a>)}
   </div>}
  </section>
  {campaign?.terms&&<section className="raffle-section raffle-terms" id="bases"><details><summary>Bases y condiciones de la edición {campaign.period}</summary><p>{campaign.terms}</p></details></section>}
  <footer className="raffle-footer"><img src="/logo-mitobicel.png" alt="MITOBICEL"/><div><strong>MITOBICEL · Gracias a cada persona que nos elige</strong><p>Que Dios bendiga a tu familia. Gracias por acompañar a nuestros vendedores, comercios y a nuestra fábrica. Punto de validación: MITOBICEL 1, Temperley. Fábrica: Av. San Martín 249, Burzaco.</p><small>© {new Date().getFullYear()} · Sorteos mensuales sujetos a las bases y condiciones de cada edición.</small></div></footer>
 </main>;
}
