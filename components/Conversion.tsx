'use client';
import {useCallback,useEffect,useState} from 'react';
import {getDb} from '@/lib/client';
import {Icon} from '@/components/Visuals';
const wa=(s:string)=>'https://wa.me/541162190702?text='+encodeURIComponent(s);
type Review={text:string;city:string;verified:boolean};
const sample=['¿Tienen bolsas camiseta 40 × 50 por medio pallet?','¿Puedo visitar la fábrica y probar la calidad de las bolsas?','¿Cómo cotizo film verdulero y bolsas de arranque juntos?'];
const qs=[
 {q:'¿Cómo hago mi pedido y cómo se coordina la entrega o el retiro?',a:'Elegí las medidas en el catálogo o mandanos el detalle por WhatsApp. Confirmamos stock, precio final y fecha para retirar en planta o coordinar el envío.'},
 {q:'¿Venden únicamente por bulto cerrado o se pueden armar pedidos surtidos?',a:'Trabajamos por bulto cerrado, pero podés combinar distintas líneas y medidas —camiseta, arranque, fondo estrella, Folex y film— en un pedido mayorista. Mínimo: 50 bultos.'},
 {q:'¿Qué medios de pago aceptan para compras mayoristas?',a:'Los medios de pago y datos de cobro se confirman con nuestro equipo por WhatsApp antes de cerrar la operación. No realices transferencias sin validar los datos de la compra.'},
 {q:'¿Las bolsas mantienen el mismo micronaje y resistencia entre partidas?',a:'Fabricamos mediante extrusión y confección propia. Consultanos el micronaje, peso y las especificaciones de la presentación que necesitás; si requerís una resistencia particular, la confirmamos antes de producir o despachar.'}
]
export function DirectComparison(){
 return <section className="contrast-section" id="por-que-fabrica"><div className="wrap">
  <div className="contrast-intro"><span className="overline">TU MARGEN IMPORTA</span><h2>Menos intermediarios.<br/><em>Más control de tu compra.</em></h2><p>Conocé la diferencia entre comprar por reventa y tratar directamente con el fabricante.</p></div>
  <div className="contrast-grid">
   <article className="contrast-other"><div className="contrast-title">✕ COMPRA A REVENDEDORES</div><ul><li>El precio puede incluir márgenes de intermediación.</li><li>Las especificaciones pueden depender de diferentes proveedores.</li><li>La disponibilidad se gestiona a través de terceros.</li><li>Las consultas técnicas pueden requerir varias derivaciones.</li></ul></article>
   <article className="contrast-us"><div className="contrast-title">✓ COMPRA DIRECTO EN MITOBICEL</div><ul><li>Trato comercial directo con nuestra fábrica en Burzaco.</li><li>Consultás medidas, presentación y características técnicas.</li><li>Coordinás retiros en planta y entregas mayoristas.</li><li>Un único contacto para precios, pedidos y disponibilidad.</li></ul></article>
  </div>
  <div className="contrast-bottom"><span>Sin intermediarios, con atención personalizada y condiciones claras.</span><a href={wa('Hola MITOBICEL, quiero cotizar una compra mayorista directo de fábrica')} target="_blank" rel="noopener noreferrer" className="btn green"><Icon name="whatsapp"/> QUIERO COMPRAR DIRECTO POR WHATSAPP ↗</a></div>
 </div></section>;
}
export function SocialQuestions(){
 const [reviews,setReviews]=useState<Review[]>([]);
 const load=useCallback(async()=>{
  const db=getDb();if(!db)return;
  const {data,error}=await db.from('site_settings').select('key,value').like('key','review_%');
  if(error)return;
  const map=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
  const approved=[1,2,3].map(i=>({text:map['review_'+i+'_text']||'',city:map['review_'+i+'_city']||'',verified:map['review_'+i+'_verified']==='true'})).filter(r=>r.verified&&r.text.trim());
  setReviews(approved);
 },[]);
 useEffect(()=>{void load();const id=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);return()=>window.clearInterval(id)},[load]);
 const actual=reviews.length>0;
 return <section className="wrap messages-section"><div className="section-top"><div><span className="overline">HABLAMOS DIRECTO CON TU NEGOCIO</span><h2>{actual?'Lo que nos cuentan nuestros':'Consultas habituales de'} <em>clientes mayoristas.</em></h2><p>{actual?'Comentarios compartidos con autorización.':'Ejemplos de consultas para que veas lo fácil que es pedir directo de fábrica.'}</p></div></div>
 <div className="message-grid">{(actual?reviews.map(r=>({text:r.text,city:r.city,real:true})):sample.map(s=>({text:s,city:'Ejemplo de consulta',real:false}))).map((r,i)=>
  <article className="message-card" key={i}><div className="message-header"><Icon name="whatsapp"/><strong>{r.real?'Mensaje de cliente':'Consulta modelo'}</strong></div><div className="message-bubble"><p>{r.text}</p><span>{r.real?'✓ Comentario autorizado':'Ejemplo ilustrativo'}</span></div><div className="message-city">{r.city||'Cliente mayorista'}</div></article>
 )}</div>
 </section>;
}
export function WholesaleFAQ(){
 const [expanded,setExpanded]=useState<number|null>(0);
 return <section className="wrap faq-section" id="preguntas-frecuentes"><div className="faq-heading"><span className="overline">INFORMACIÓN PARA TU COMPRA</span><h2>Preguntas que <em>recibimos siempre.</em></h2><p>Todo lo importante para empezar a trabajar directamente con la fábrica.</p></div>
  <div className="faq-accordions">{qs.map((item,i)=><div className={'faq-item'+(expanded===i?' active':'')} key={i}><button type="button" onClick={()=>setExpanded(v=>v===i?null:i)} aria-expanded={expanded===i} aria-controls={'faq-answer-'+i}><span>{item.q}</span><span className="faq-icon">{expanded===i?'−':'+'}</span></button>{expanded===i&&<div className="faq-answer" id={'faq-answer-'+i}><p>{item.a}</p></div>}</div>)}</div>
  <div className="faq-cta"><span>¿Tenés otra consulta sobre precios o presentaciones?</span><a href={wa('Hola MITOBICEL, tengo una consulta sobre sus productos mayoristas')} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/> Hablemos por WhatsApp ↗</a></div>
 </section>;
}
