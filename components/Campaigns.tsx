'use client';
import {useEffect,useState,useCallback} from 'react';
import {getDb} from '@/lib/client';
type Product={id:string;title:string;measure:string;enabled:boolean};
type Promotion={id:string;title:string;description:string;product_a_id:string;product_b_id:string;quantity_a:number;quantity_b:number;price_pickup:number|null;price_delivery:number|null;active:boolean;sort_order:number};
type Settings={factory_video_url:string;social_proof_text:string};
const empty:Promotion={id:'',title:'Combo mayorista',description:'Promoción especial por tiempo limitado',product_a_id:'',product_b_id:'',quantity_a:1,quantity_b:1,price_pickup:null,price_delivery:null,active:true,sort_order:1};
const fmt=(n:number|null)=>n==null?'Consultar precio':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const wa=(t:string)=>'https://wa.me/541162190702?text='+encodeURIComponent(t);
const parse=(s:string)=>s===''?null:Number(s);
function videoEmbed(u:string){try{let url=new URL(u);if(url.protocol!=='https:')return null;
if(['www.youtube.com','youtube.com','m.youtube.com'].includes(url.hostname)){const id=url.pathname.startsWith('/shorts/')?url.pathname.split('/')[2]:url.searchParams.get('v');return id&&/^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:null;}
if(url.hostname==='youtu.be'){const id=url.pathname.slice(1);return /^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:null;}
if(url.hostname==='vimeo.com'||url.hostname==='www.vimeo.com'){const id=url.pathname.slice(1);return /^\d+$/.test(id)?'https://player.vimeo.com/video/'+id:null;}
if(url.hostname==='player.vimeo.com'&&/^\/video\/\d+$/.test(url.pathname))return url.toString();
return null;}catch{return null;}}
export default function Campaigns({admin=false,products=[]}:{admin?:boolean;products?:Product[]}){
const [promos,setPromos]=useState<Promotion[]>([]),[draft,setDraft]=useState<Promotion>(empty),[settings,setSettings]=useState<Settings>({factory_video_url:'',social_proof_text:''});
const [ready,setReady]=useState(false),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false);
const load=useCallback(async()=>{const db=getDb();if(!db)return;
const [p,s]=await Promise.all([db.from('combo_promotions').select('*').order('sort_order'),db.from('site_settings').select('key,value')]);
if(p.error||s.error){setNotice('Las promociones y el video necesitan la nueva migración SQL.');return;}
setPromos(p.data||[]);
const dict=Object.fromEntries((s.data||[]).map(x=>[x.key,x.value]));setSettings({factory_video_url:dict.factory_video_url||'',social_proof_text:dict.social_proof_text||''});setReady(true);
},[]);
useEffect(()=>{void load();const timer=setInterval(()=>void load(),30000);return()=>clearInterval(timer)},[load]);
async function savePromo(e:React.FormEvent){e.preventDefault();const db=getDb();if(!db)return;if(draft.product_a_id===draft.product_b_id){setNotice('Elegí dos presentaciones distintas.');return;}setSaving(true);const data={...draft,id:draft.id||crypto.randomUUID()};
const {error}=await db.from('combo_promotions').upsert(data);setNotice(error?error.message:'Promoción guardada y publicada.');if(!error){setDraft(empty);await load()}setSaving(false)}
async function removePromo(id:string){const db=getDb();if(!db)return;setSaving(true);const {error}=await db.from('combo_promotions').delete().eq('id',id);setNotice(error?error.message:'Promoción eliminada');await load();setSaving(false)}
async function saveSettings(e:React.FormEvent){e.preventDefault();const db=getDb();if(!db)return;const link=settings.factory_video_url.trim();
if(link&&!videoEmbed(link)){setNotice('Para seguridad, usá un link de YouTube o Vimeo.');return;}
setSaving(true);const {error}=await db.from('site_settings').upsert(Object.entries(settings).map(([key,value])=>({key,value})));setNotice(error?error.message:'Video y texto guardados.');setSaving(false)}
const byId=(id:string)=>products.find(p=>p.id===id);
const video=videoEmbed(settings.factory_video_url);
if(admin)return <section className="campaign-admin panel"><span className="overline">MARKETING DESDE SUPERADMIN</span><h2>Promociones combinadas y video</h2><p>Combiná dos productos, elegí cantidades en bultos y publicá precios diferenciados. Todo queda visible sin volver a desplegar Vercel.</p>
<form className="campaign-form" onSubmit={savePromo}>
<label>Nombre de la promoción<input required maxLength={100} value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))}/></label>
<label>Mensaje corto<input maxLength={180} value={draft.description} onChange={e=>setDraft(p=>({...p,description:e.target.value}))}/></label>
<label>Producto 1<select required value={draft.product_a_id} onChange={e=>setDraft(p=>({...p,product_a_id:e.target.value}))}><option value="">Seleccionar producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.title} · {p.measure}</option>)}</select></label>
<label>Bultos producto 1<input type="number" min={1} required value={draft.quantity_a} onChange={e=>setDraft(p=>({...p,quantity_a:Math.max(1,Number(e.target.value)||1)}))}/></label>
<label>Producto 2<select required value={draft.product_b_id} onChange={e=>setDraft(p=>({...p,product_b_id:e.target.value}))}><option value="">Seleccionar producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.title} · {p.measure}</option>)}</select></label>
<label>Bultos producto 2<input type="number" min={1} required value={draft.quantity_b} onChange={e=>setDraft(p=>({...p,quantity_b:Math.max(1,Number(e.target.value)||1)}))}/></label>
<label>Precio total retiro por fábrica ($)<input type="number" min={0} placeholder="Sin precio" value={draft.price_pickup??''} onChange={e=>setDraft(p=>({...p,price_pickup:parse(e.target.value)}))}/></label>
<label>Precio total con envío ($)<input type="number" min={0} placeholder="Sin precio" value={draft.price_delivery??''} onChange={e=>setDraft(p=>({...p,price_delivery:parse(e.target.value)}))}/></label>
<label className="check-setting"><input type="checkbox" checked={draft.active} onChange={e=>setDraft(p=>({...p,active:e.target.checked}))}/> Promoción visible</label>
<div className="campaign-actions"><button className="btn green" disabled={saving||!draft.product_a_id||!draft.product_b_id}>Guardar promoción</button>{draft.id&&<button type="button" className="btn white" onClick={()=>setDraft(empty)}>Cancelar edición</button>}</div>
</form>
<div className="campaign-saved">{promos.map(p=><div key={p.id}><strong>{p.title}</strong><span>{p.quantity_a} × {byId(p.product_a_id)?.title||'Producto'} + {p.quantity_b} × {byId(p.product_b_id)?.title||'Producto'}</span><button className="btn subtle" onClick={()=>setDraft(p)}>Editar</button><button className="btn subtle" disabled={saving} onClick={()=>void removePromo(p.id)}>Eliminar</button></div>)}</div>
<hr/><h3>Video institucional y confianza</h3>
<form onSubmit={saveSettings} className="campaign-form">
<label className="wide">Enlace del video (YouTube o Vimeo)<input type="url" placeholder="https://www.youtube.com/watch?v=..." value={settings.factory_video_url} onChange={e=>setSettings(x=>({...x,factory_video_url:e.target.value}))}/></label>
<label className="wide">Frase de confianza (usar cifras solo si están comprobadas)<input maxLength={180} placeholder="Fabricantes y distribuidores siguen eligiendo MITOBICEL" value={settings.social_proof_text} onChange={e=>setSettings(x=>({...x,social_proof_text:e.target.value}))}/></label>
<button className="btn green" disabled={saving}>Guardar video y texto</button>
</form>{notice&&<p role="status" className="notice">{notice}</p>}</section>;
return <>{ready&&promos.some(p=>p.active)&&<section className="wrap section combo-section"><div className="section-top"><div><span className="overline">OPORTUNIDADES PARA MAYORISTAS</span><h2>Combos que <em>convienen.</em></h2></div></div><div className="combo-grid">{promos.filter(p=>p.active).map(p=><article className="combo-card" key={p.id}><div className="combo-mark">COMBO ESPECIAL</div><h3>{p.title}</h3><p>{p.description}</p><div className="combo-products"><span><b>{p.quantity_a} bultos</b>{byId(p.product_a_id)?.title} · {byId(p.product_a_id)?.measure}</span><span className="combo-plus">+</span><span><b>{p.quantity_b} bultos</b>{byId(p.product_b_id)?.title} · {byId(p.product_b_id)?.measure}</span></div><div className="combo-prices"><div><small>Total retiro en fábrica</small><strong>{fmt(p.price_pickup)}</strong><small>Por bulto: {fmt(p.price_pickup==null?null:p.price_pickup/(p.quantity_a+p.quantity_b))}</small></div><div><small>Total con envío</small><strong>{fmt(p.price_delivery)}</strong><small>Por bulto: {fmt(p.price_delivery==null?null:p.price_delivery/(p.quantity_a+p.quantity_b))}</small></div></div><a className="btn white" target="_blank" rel="noopener noreferrer" href={wa('Hola, quiero consultar el combo '+p.title)}>Consultar combo por WhatsApp ↗</a></article>)}</div></section>}
<section className="wrap video-section" id="fabrica"><div className="video-copy"><span className="overline">CONOCÉ NUESTRA FÁBRICA</span><h2>Calidad que podés <em>ver de cerca.</em></h2><p>Fabricamos directamente, sin intermediarios. Podés visitarnos y probar nuestros productos antes de hacer tu pedido mayorista.</p><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=Avenida+San+Martin+249+Burzaco+Buenos+Aires" className="btn white">Cómo llegar a fábrica ↗</a></div><div className="video-frame">{video?<iframe src={video} title="Video de la fábrica MITOBICEL" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>:<div className="video-empty"><span className="play-icon">▶</span><b>Conocé cómo fabricamos</b><p>Próximamente: recorré nuestra fábrica en video.</p></div>}</div></section>
<section className="wrap trust-stars"><span aria-label="Cinco estrellas" className="stars">★★★★★</span><strong>{settings.social_proof_text||'La confianza se construye con calidad, atención y precios de fábrica.'}</strong><small>MITOBICEL · Industria argentina</small></section></>;
}
