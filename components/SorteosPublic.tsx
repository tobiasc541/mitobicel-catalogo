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
type Delivery={period:string;prize:string;delivered_at:string;video_url:string;photo_url:string};
const examples=[
 {title:'Televisores y entretenimiento',description:'Smart TV Samsung, LG, Philips o TCL de 43”, 50” y 55”.',purpose:'Equipá tu local, tu casa o tu espacio de trabajo.',icon:'film'},
 {title:'Motos 110 y movilidad',description:'Motocicletas 110 cc, como Honda Wave o Corven Energy.',purpose:'Una ayuda para hacer entregas y visitar clientes con agilidad.',icon:'truck'},
 {title:'Utilitarios para crecer',description:'Peugeot Partner, Renault Kangoo o Fiat Fiorino.',purpose:'Imaginá llegar a más papeleras y comercios con tus propios repartos.',icon:'truck'},
 {title:'Celulares y conectividad',description:'iPhone, Samsung Galaxy o Motorola Moto.',purpose:'Respondé pedidos, grabá productos y conectate con más compradores.',icon:'award'},
 {title:'Notebooks y tablets',description:'HP, Lenovo, ASUS, Samsung Galaxy Tab o iPad.',purpose:'Organizá stock, precios y ventas desde donde estés.',icon:'package'},
 {title:'Electrodomésticos para tu hogar',description:'Heladeras, cocinas, lavarropas y microondas: Patrick, Drean, Whirlpool y otras marcas.',purpose:'Premios que pueden mejorar tu día a día y el de tu familia.',icon:'package'},
 {title:'Audio y tecnología',description:'Parlantes JBL, Sony, auriculares Bluetooth y equipos de audio.',purpose:'Disfrutá o sumá equipamiento útil para tu actividad.',icon:'award'}
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
  <div className="raffle-topline"><span>MITOBICEL · INDUSTRIA ARGENTINA</span><span>PARA BUSCAS, PAPELERAS Y DISTRIBUIDORES</span></div>
  <header className="raffle-header"><a href="/sorteos" aria-label="MITOBICEL Sorteos"><img src="/logo-mitobicel.png" alt="Logo MITOBICEL"/></a><span><span className="raffle-live-dot"/> Sorteos para buscas y mayoristas</span></header>
  <section className="raffle-hero">
   <div className="raffle-hero-copy">
    <span className="raffle-eyebrow">VOLVIMOS. Y VOLVIMOS CON TODO.</span>
    <h1>Vos hacés crecer tu negocio. <em>Nosotros queremos celebrarlo.</em></h1>
    <p>Esta página es exclusivamente para buscas —los revendedores que se ganan el día recorriendo comercios—, papeleras y distribuidores. Gracias a ustedes, MITOBICEL sigue creciendo. Por eso queremos devolverles ese apoyo con nuevas oportunidades y sorteos mensuales.</p>
    <p>No se trata solamente de comprar un bulto, revenderlo y obtener tu ganancia: queremos que también tengas la posibilidad de participar por premios que pueden impulsar tu trabajo y tu vida.</p>
    <div className="raffle-hero-actions"><a href="#participar" className="raffle-cta">Registrar mi participación <span>↗</span></a><a href="#resultados" className="raffle-cta-secondary">Ver resultados</a></div>
    <div className="raffle-hero-info"><span><Icon name="award"/> Un agradecimiento a quienes nos eligen</span><span><Icon name="package"/> Un código único por bulto participante</span></div>
   </div>
   <div className="raffle-hero-art">
    <span className="raffle-art-top">MITOBICEL · GRACIAS POR CONFIAR</span>
    <div className="raffle-art-orbit"><div className="raffle-art-award"><Icon name="award"/></div></div>
    <span className="raffle-art-title">CRECEMOS CON VOS</span>
    <span className="raffle-art-foot">Buscas · Papeleras · Distribuidores</span>
   </div>
  </section>
  <section className="raffle-section raffle-prizes" id="premios">
   <span className="raffle-eyebrow">MÁS QUE PREMIOS: NUEVAS POSIBILIDADES</span><h2>Soñá en grande. <em>Seguí creciendo.</em></h2>
   <p className="raffle-section-lead">Nos encantaría agradecerte con premios que hagan una diferencia. Estas son ideas de lo que podría llegar en futuras ediciones, no premios confirmados ni disponibles actualmente.</p>
   <div className="raffle-prize-grid">{examples.map((prize,i)=><div className="raffle-prize-card" key={prize.title}><span className="raffle-prize-index">{String(i+1).padStart(2,'0')}</span><div className="raffle-prize-icon"><Icon name={prize.icon}/></div><h3>{prize.title}</h3><p className="raffle-prize-description">{prize.description}</p><p className="raffle-prize-purpose">{prize.purpose}</p><small>Ejemplo para futuras ediciones · No confirmado</small></div>)}</div>
   {campaign?.prizes.length?<div className="raffle-confirmed"><strong>Premios confirmados · Edición {campaign.period}</strong><div>{campaign.prizes.map((p,i)=><span key={i}>{p}</span>)}</div></div>:<p className="raffle-inline-note">Los premios de la próxima edición se publicarán cuando sean confirmados oficialmente.</p>}
  </section>
  <section className="raffle-growth-story" aria-label="Nuestro agradecimiento a los revendedores">
   <div className="raffle-growth-inner">
    <span className="raffle-eyebrow">ESTO ES PARA LOS QUE SALEN A BUSCAR OPORTUNIDADES</span>
    <h2>Con un bulto hacés una venta. <em>Con una oportunidad, podrías llegar mucho más lejos.</em></h2>
    <p>Sabemos el esfuerzo que hay detrás de cada reventa: salir temprano, recorrer negocios, ofrecer mercadería y ganarse la confianza de nuevos clientes. Una moto 110 podría ayudarte a hacer entregas más rápido; un utilitario como una Partner o Kangoo, a llegar con más mercadería a más comercios; y una notebook, a ordenar tu stock y tus ventas.</p>
    <p><strong>Gracias por acompañarnos.</strong> Seguimos fabricando para que ustedes sigan creciendo. Los sorteos son nuestra manera de decirlo con hechos.</p>
   </div>
  </section>
  <section className="raffle-section raffle-how" id="como-participar">
   <span className="raffle-eyebrow">UN AGRADECIMIENTO POR SEGUIR CRECIENDO JUNTOS</span><h2>Esto es para ustedes. <em>Gracias por ser parte.</em></h2>
   <p className="raffle-how-intro">Queremos devolver un poquito de todo lo que nos dan. Participar es muy sencillo:</p>
   <div className="raffle-steps">
    <article><span>01</span><h3>Recibí tu código</h3><p>En el punto autorizado de Temperley, a una cuadra de la estación, te entregan un código QR único por cada bulto participante. Cada código suma una oportunidad.</p></article>
    <article><span>02</span><h3>Completá tus datos</h3><p>Escanealo, cargá nombre, apellido y DNI. El documento se verifica con el original si resultás ganador.</p></article>
    <article><span>03</span><h3>Seguí el sorteo</h3><p>Consultá acá la fecha oficial, los premios confirmados, los ganadores y las entregas.</p></article>
   </div>
   <div className="raffle-authorized-shop"><Icon name="map-pin"/><div><strong>Único comercio autorizado de MITOBICEL para esta acción</strong><p>Temper · Temperley, Zona Sur, Buenos Aires · A una cuadra de la estación de Temperley.</p></div></div>
   <p className="raffle-free-note">Sin obligación de compra. También podés participar por la vía gratuita del formulario, conforme a las bases de cada edición.</p>
  </section>
  <section className="raffle-section raffle-register-section" id="participar">
   <div className="raffle-register-intro">
    <span className="raffle-eyebrow">SORTEOS PARA BUSCAS, PAPELERAS Y DISTRIBUIDORES</span>
    <h2>Registrá tu <em>participación.</em></h2>
    <p>Tu esfuerzo merece reconocimiento. Completá tus datos para participar en la edición vigente; si resultás ganador, tu nombre y DNI se comprobarán con tu documento. Nunca publicamos el DNI completo.</p>
    <div className="raffle-date-box"><span>PRÓXIMA FECHA OFICIAL</span><strong>{campaign?.draw_at?date(campaign.draw_at):'A confirmar por MITOBICEL'}</strong><small>{campaign?'Edición '+campaign.period+' · '+campaign.store_name:'Consultá esta página para próximos anuncios'}</small></div>
   </div>
   <div className="raffle-register-card">
    <span className="raffle-eyebrow">FORMULARIO OFICIAL</span>
    <h3>{open?'¡Inscripciones abiertas!':'Tu participación, cuando se anuncie la edición.'}</h3>
    {!ready?<p>Cargando información de la edición…</p>:!open?<div className="raffle-not-open"><Icon name="award"/><strong>Próxima edición en preparación</strong><p>Cuando MITOBICEL publique las fechas, las bases y los premios confirmados, vas a poder registrarte acá. Todavía no estamos recibiendo datos personales.</p></div>:
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
   <div><span className="raffle-eyebrow">PORQUE AGRADECER TAMBIÉN ES CUMPLIR</span><h2>Cada premio entregado, <em>una historia para compartir.</em></h2><p>Acá vamos a mostrar las entregas reales cuando se realicen, para que toda la comunidad de buscas, papeleras y distribuidores pueda seguir los resultados.</p></div>
   <Video url={campaign?.video_url||''} title={campaign?.video_title||'Entregas MITOBICEL'}/>
   {deliveries.length>0&&<div className="raffle-delivery-links">
    {deliveries.map((d,i)=><a key={i} href={d.video_url||d.photo_url} rel="noopener noreferrer" target="_blank">{d.prize} · {d.period} · Ver entrega ↗</a>)}
   </div>}
  </section>
  {campaign?.terms&&<section className="raffle-section raffle-terms" id="bases"><details><summary>Bases y condiciones de la edición {campaign.period}</summary><p>{campaign.terms}</p></details></section>}
  <footer className="raffle-footer"><img src="/logo-mitobicel.png" alt="MITOBICEL"/><div><strong>MITOBICEL · Sorteos para buscas, papeleras y distribuidores</strong><p>Comercio autorizado: Temper, Temperley, a una cuadra de la estación. Fábrica: Av. San Martín 249, Burzaco.</p><small>© {new Date().getFullYear()} · Participación sin obligación de compra · Resultados sujetos a las bases de cada edición.</small></div></footer>
 </main>;
}
