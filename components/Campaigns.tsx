'use client';
import {useState,useEffect,useCallback} from 'react';
import {getDb} from '@/lib/client';
import type {OrderLine} from '@/lib/order';
import {Icon} from '@/components/Visuals';
import {DirectComparison} from '@/components/Conversion';
import SocialProof from '@/components/SocialProof';
import {Upload} from 'tus-js-client';

type Product={id:string;title:string;measure:string;presentation?:string;enabled:boolean;image_url?:string|null};
type Offer={
id:string;title:string;description:string;product_a_id:string;product_b_id:string|null;
quantity_a:number;quantity_b:number;unit_a:string;unit_b:string;
price_pickup:number|null;price_delivery:number|null;price_old:number|null;
price_a_pickup?:number|null;price_a_delivery?:number|null;price_b_pickup?:number|null;price_b_delivery?:number|null;
price_mode:'combo'|'por_bulto';active:boolean;sort_order:number;
};
type Settings={factory_video_url:string;factory_video_poster:string;video_title:string;video_caption:string;social_proof_text:string;proof_count:string;proof_rating:string;proof_verified:string;promo_deadline:string;review_1_text:string;review_1_city:string;review_1_verified:string;review_2_text:string;review_2_city:string;review_2_verified:string;review_3_text:string;review_3_city:string;review_3_verified:string};
const defaults:Settings={factory_video_url:'',factory_video_poster:'',video_title:'Calidad que podés ver en vivo antes de hacer tu pedido',video_caption:'Conocé el proceso productivo de MITOBICEL.',social_proof_text:'La confianza se construye con calidad, atención y precios de fábrica.',proof_count:'',proof_rating:'',proof_verified:'false',promo_deadline:'',review_1_text:'',review_1_city:'',review_1_verified:'false',review_2_text:'',review_2_city:'',review_2_verified:'false',review_3_text:'',review_3_city:'',review_3_verified:'false'};
const empty:Offer={id:'',title:'Promoción mayorista',description:'Precio especial para papeleras y distribuidores',product_a_id:'',product_b_id:null,quantity_a:50,quantity_b:0,unit_a:'bultos',unit_b:'bultos',price_pickup:null,price_delivery:null,price_old:null,price_a_pickup:null,price_a_delivery:null,price_b_pickup:null,price_b_delivery:null,price_mode:'combo',active:true,sort_order:1};
const money=(n:number|null)=>n===null?'A consultar':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const val=(v:string)=>v===''?null:Math.max(0,Number(v)||0);
function videoSource(value:string){
 if(!value)return null;
 try{const u=new URL(value);if(u.protocol!=='https:')return null;
 const h=u.hostname.toLowerCase();
 if(/\.mp4$/i.test(u.pathname))return {type:'mp4',src:u.toString()};
 if(h==='youtu.be'){const id=u.pathname.slice(1).split('/')[0];if(/^[\w-]{11}$/.test(id))return {type:'embed',src:'https://www.youtube-nocookie.com/embed/'+id};}
 if(['youtube.com','www.youtube.com','m.youtube.com'].includes(h)){const id=u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:u.pathname.startsWith('/embed/')?u.pathname.split('/')[2]:u.searchParams.get('v');if(id&&/^[\w-]{11}$/.test(id))return {type:'embed',src:'https://www.youtube-nocookie.com/embed/'+id};}
 if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(h)){const id=u.pathname.match(/(\d+)/)?.[1];if(id)return {type:'embed',src:'https://player.vimeo.com/video/'+id};}
 return null;
 }catch{return null;}
}
const wu=(msg:string)=>'https://wa.me/541162190702?text='+encodeURIComponent(msg);
export default function Campaigns({admin=false,products=[],onAdd}:{
 admin?:boolean;products?:Product[];onAdd?:(item:OrderLine)=>void;
}){
 const [offers,setOffers]=useState<Offer[]>([]),[draft,setDraft]=useState<Offer>({...empty});
 const [settings,setSettings]=useState<Settings>({...defaults});
 const [ready,setReady]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[videoStarted,setVideoStarted]=useState(false),[uploadProgress,setUploadProgress]=useState<number|null>(null);
 const [offerReady,setOfferReady]=useState(true);
 const [chapter,setChapter]=useState(0);
 const chapters=[{title:'EXTRUSIÓN Y MATERIA PRIMA',detail:'El proceso de fabricación comienza con la selección de materiales y la extrusión del polietileno según cada presentación.'},{title:'SELLADO Y CONFECCIÓN',detail:'Conocé cómo trabajamos el sellado, los fuelles y el fondo estrella para cada tipo de bolsa.'},{title:'ABASTECIMIENTO MAYORISTA',detail:'Consultá presentaciones disponibles, stock y condiciones para retiro por fábrica o envío a tu local.'}];
 const load=useCallback(async()=>{
  const db=getDb();if(!db)return;
  const [a,b]=await Promise.all([db.from('catalog_offers').select('*').order('sort_order'),db.from('site_settings').select('key,value')]);
  if(a.error){setOfferReady(false);if(admin)setMessage('Para activar promociones ejecutá supabase/mitobicel_b2b_v3.sql: '+a.error.message);}
  else{setOffers((a.data||[]) as Offer[]);setOfferReady(true);}
  if(b.error){if(admin)setMessage('No se pudieron leer los ajustes: '+b.error.message);}
  else{const obj=Object.fromEntries((b.data||[]).map(x=>[x.key,x.value]));setSettings({...defaults,...obj});}
  setReady(true);
 },[admin]);
 useEffect(()=>{void load();if(admin)return;const i=setInterval(()=>{if(document.visibilityState==='visible')void load();},15000);return()=>clearInterval(i);},[load,admin]);
 const byId=(id:string|null)=>products.find(p=>p.id===id);
 const totalQty=(o:Offer)=>o.quantity_a+(o.product_b_id?o.quantity_b:0);
 const price=(p:number|null,o:Offer)=>p===null?null:o.price_mode==='por_bulto'?p*totalQty(o):p;
 const hasSeparatePrices=(o:Offer)=>!!o.product_b_id&&[o.price_a_pickup,o.price_a_delivery,o.price_b_pickup,o.price_b_delivery].some(x=>x!=null);
 const comboTotal=(o:Offer,mode:'pickup'|'delivery')=>{if(!hasSeparatePrices(o))return price(mode==='pickup'?o.price_pickup:o.price_delivery,o);
  const a=mode==='pickup'?o.price_a_pickup:o.price_a_delivery;
  const b=mode==='pickup'?o.price_b_pickup:o.price_b_delivery;
  return a==null||b==null?null:a*o.quantity_a+b*o.quantity_b;
 };
 const detail=(o:Offer)=>{
  const a=byId(o.product_a_id),b=byId(o.product_b_id);
  const aText=String(o.quantity_a)+' '+o.unit_a+' de '+(a?.title||'Producto A')+' '+(a?.measure||'');
  const bText=o.product_b_id?String(o.quantity_b)+' '+o.unit_b+' de '+(b?.title||'Producto B')+' '+(b?.measure||''):'';
  return [aText,bText].filter(Boolean).join(' + ');
 };
 async function saveOffer(e:React.FormEvent){e.preventDefault();const db=getDb();if(!db)return;
  if(draft.product_b_id&&draft.product_b_id===draft.product_a_id){setMessage('Seleccioná productos diferentes para el combo.');return;}
  setSaving(true);setMessage('');
  const data={...draft,id:draft.id||crypto.randomUUID(),product_b_id:draft.product_b_id||null,quantity_b:draft.product_b_id?draft.quantity_b:0};
  if(!data.product_b_id){data.price_b_pickup=null;data.price_b_delivery=null;}
  const {error}=await db.from('catalog_offers').upsert(data);
  setMessage(error?'No se pudo guardar: '+error.message:'Promoción publicada. Se actualiza para todos los visitantes.');
  if(!error){setDraft({...empty});await load();}
  setSaving(false);
 }
 async function deleteOffer(id:string){const db=getDb();if(!db)return;setSaving(true);const {error}=await db.from('catalog_offers').delete().eq('id',id);
  setMessage(error?'No se pudo eliminar: '+error.message:'Promoción retirada.');if(!error)await load();setSaving(false);}
 async function saveSettings(e:React.FormEvent){e.preventDefault();const db=getDb();if(!db)return;
  if(settings.factory_video_url&&!videoSource(settings.factory_video_url)){setMessage('El video debe ser una URL HTTPS válida de YouTube, Vimeo o MP4.');return;}
  setSaving(true);const {error}=await db.from('site_settings').upsert(Object.entries(settings).map(([key,value])=>({key,value})));
  setMessage(error?'Error al guardar: '+error.message:'Ajustes guardados y publicados.');setSaving(false);}
 async function uploadVideo(file:File|undefined,kind:'video'|'poster'){
  const db=getDb();if(!db||!file)return;
  const isVideo=kind==='video';
  const valid=isVideo?(file.type==='video/mp4'||file.name.toLowerCase().endsWith('.mp4')):['image/jpeg','image/png','image/webp'].includes(file.type);
  const sizeLimit=isVideo?500*1024*1024:3*1024*1024;
  if(!valid||file.size>sizeLimit){
   setMessage(isVideo?'Elegí un MP4 de hasta 500 MB.':'Elegí una imagen PNG, JPG o WEBP de hasta 3 MB.');
   return;
  }
  if(isVideo&&file.size>50*1024*1024){
   setMessage('La carga de videos grandes requiere Supabase Pro y límite global/bucket de al menos 500 MB. En Free el máximo real es 50 MB.');
  }
  setSaving(true);setUploadProgress(isVideo?0:null);
  const ext=isVideo?'mp4':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path='fabrica/'+crypto.randomUUID()+'.'+ext;
  try{
   if(isVideo){
    const {data:{session},error:authError}=await db.auth.getSession();
    if(authError||!session?.access_token)throw Error('Tu sesión venció. Volvé a iniciar sesión como superadmin.');
    const publicSupabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
    if(!publicSupabaseUrl)throw Error('Falta la URL pública de Supabase.');
    const projectUrl=new URL(publicSupabaseUrl);
    const directHost=projectUrl.hostname.endsWith('.supabase.co')
      ?projectUrl.hostname.replace('.supabase.co','.storage.supabase.co')
      :projectUrl.hostname;
    const endpoint=projectUrl.protocol+'//'+directHost+'/storage/v1/upload/resumable';
    await new Promise<void>((resolve,reject)=>{
     const uploader=new Upload(file,{
      endpoint,
      headers:{authorization:'Bearer '+session.access_token},
      retryDelays:[0,3000,5000,10000,20000],
      metadata:{bucketName:'factory-media',objectName:path,contentType:'video/mp4',cacheControl:'3600'},
      chunkSize:6*1024*1024,
      uploadDataDuringCreation:true,
      removeFingerprintOnSuccess:true,
      onError:(error)=>reject(error),
      onProgress:(uploaded,total)=>setUploadProgress(Math.min(100,Math.floor(uploaded/total*100))),
      onSuccess:()=>resolve()
     });
     void uploader.findPreviousUploads().then(previous=>{
      if(previous.length)uploader.resumeFromPreviousUpload(previous[0]);
      uploader.start();
     }).catch(reject);
    });
   }else{
    const {error}=await db.storage.from('factory-media').upload(path,file,{upsert:false,contentType:file.type});
    if(error)throw error;
   }
   const url=db.storage.from('factory-media').getPublicUrl(path).data.publicUrl;
   const key=isVideo?'factory_video_url':'factory_video_poster';
   const {error:saveError}=await db.from('site_settings').upsert({key,value:url});
   if(saveError)throw Error('Archivo subido, pero no se pudo publicar: '+saveError.message);
   setSettings(v=>({...v,[key]:url}));setVideoStarted(false);
   setMessage('Archivo publicado correctamente. El video se verá en el catálogo público.');
  }catch(error){
   const text=error instanceof Error?error.message:String(error);
   setMessage('No se pudo subir el archivo: '+text+
    (isVideo&&file.size>50*1024*1024?' Revisá tu plan Supabase y el tamaño máximo en Storage → Settings y en factory-media.':''));
  }finally{setSaving(false);setUploadProgress(null);}
 }
 const video=videoSource(settings.factory_video_url);
 const poster=(()=>{try{const u=new URL(settings.factory_video_poster);return u.protocol==='https:'?u.toString():'';}catch{return '';}})();
 
 if(admin)return <section className="panel campaign-admin" id="marketing">
  <span className="overline">GESTIÓN COMERCIAL</span><h2>Promociones y contenido de fábrica</h2>
  <p>Podés publicar una oferta de un solo producto o combinar dos. Todas las cifras son editables; no es necesario volver a publicar la web.</p>
  {!offerReady&&<p role="alert" className="admin-warning">Primero ejecutá el archivo <code>supabase/mitobicel_b2b_v3.sql</code> en SQL Editor.</p>}
  <form className="campaign-form" onSubmit={saveOffer}>
   <label>Nombre de la oferta<input required maxLength={100} value={draft.title} onChange={e=>setDraft(x=>({...x,title:e.target.value}))}/></label>
   <label>Mensaje promocional<input maxLength={180} value={draft.description} onChange={e=>setDraft(x=>({...x,description:e.target.value}))}/></label>
   <label>Tipo de oferta<select value={draft.product_b_id===null?'single':'combo'} onChange={e=>setDraft(x=>({...x,product_b_id:e.target.value==='single'?null:(products.find(p=>p.id!==x.product_a_id)?.id||null),quantity_b:e.target.value==='single'?0:Math.max(1,x.quantity_b)}))}><option value="single">Un solo producto</option><option value="combo">Dos productos combinados</option></select></label>
   <label>Producto A<select required value={draft.product_a_id} onChange={e=>setDraft(x=>({...x,product_a_id:e.target.value}))}><option value="">Elegir presentación</option>{products.map(p=><option key={p.id} value={p.id}>{p.title} · {p.measure}</option>)}</select></label>
   <label>Cantidad de A<input type="number" min="1" required value={draft.quantity_a} onChange={e=>setDraft(x=>({...x,quantity_a:Math.max(1,Math.floor(Number(e.target.value)||1))}))}/></label>
   <label>Unidad A<select value={draft.unit_a} onChange={e=>setDraft(x=>({...x,unit_a:e.target.value}))}><option>bultos</option><option>rollos</option><option>cajas</option></select></label>
   {draft.product_b_id!==null&&<>
   <label>Producto B<select required value={draft.product_b_id} onChange={e=>setDraft(x=>({...x,product_b_id:e.target.value}))}><option value="">Elegir presentación</option>{products.map(p=><option key={p.id} value={p.id}>{p.title} · {p.measure}</option>)}</select></label>
   <label>Cantidad de B<input type="number" min="1" required value={draft.quantity_b} onChange={e=>setDraft(x=>({...x,quantity_b:Math.max(1,Math.floor(Number(e.target.value)||1))}))}/></label>
   <label>Unidad B<select value={draft.unit_b} onChange={e=>setDraft(x=>({...x,unit_b:e.target.value}))}><option>bultos</option><option>rollos</option><option>cajas</option></select></label>
   </>}
   {draft.product_b_id ? <>
    <div className="wide offer-admin-prices-intro"><strong>Precios independientes por producto</strong><p>Cargá cuánto cuesta cada bulto, caja o rollo de cada producto llevando esta promoción. El total del combo se calcula según las cantidades elegidas.</p></div>
    <div className="offer-admin-product-prices wide"><strong>PRODUCTO A · {byId(draft.product_a_id)?.title||'Seleccionar producto'} · {byId(draft.product_a_id)?.measure||''}</strong>
     <div className="offer-admin-two-prices">
      <label>Producto A · Retirando por fábrica $ por {draft.unit_a.slice(0,-1)}<input type="number" min="0" step=".01" value={draft.price_a_pickup??''} onChange={e=>setDraft(x=>({...x,price_a_pickup:val(e.target.value)}))} placeholder="A consultar"/></label>
      <label>Producto A · Con envío $ por {draft.unit_a.slice(0,-1)}<input type="number" min="0" step=".01" value={draft.price_a_delivery??''} onChange={e=>setDraft(x=>({...x,price_a_delivery:val(e.target.value)}))} placeholder="A consultar"/></label>
     </div>
    </div>
    <div className="offer-admin-product-prices wide"><strong>PRODUCTO B · {byId(draft.product_b_id)?.title||'Seleccionar producto'} · {byId(draft.product_b_id)?.measure||''}</strong>
     <div className="offer-admin-two-prices">
      <label>Producto B · Retirando por fábrica $ por {draft.unit_b.slice(0,-1)}<input type="number" min="0" step=".01" value={draft.price_b_pickup??''} onChange={e=>setDraft(x=>({...x,price_b_pickup:val(e.target.value)}))} placeholder="A consultar"/></label>
      <label>Producto B · Con envío $ por {draft.unit_b.slice(0,-1)}<input type="number" min="0" step=".01" value={draft.price_b_delivery??''} onChange={e=>setDraft(x=>({...x,price_b_delivery:val(e.target.value)}))} placeholder="A consultar"/></label>
     </div>
    </div>
    <div className="wide offer-admin-total-preview"><div><small>Total retirando por fábrica</small><strong>{money(comboTotal(draft,'pickup'))}</strong></div><div><small>Total con envío</small><strong>{money(comboTotal(draft,'delivery'))}</strong></div></div>
   </> : <>
    <label>Cómo expresás el precio<select value={draft.price_mode} onChange={e=>setDraft(x=>({...x,price_mode:e.target.value as Offer['price_mode']}))}><option value="combo">Precio total de la oferta</option><option value="por_bulto">Precio por unidad/bulto</option></select></label>
    <label>Precio oferta retirando $<input type="number" min="0" step=".01" value={draft.price_pickup??''} onChange={e=>setDraft(x=>({...x,price_pickup:val(e.target.value)}))} placeholder="A consultar"/></label>
    <label>Precio oferta con envío $<input type="number" min="0" step=".01" value={draft.price_delivery??''} onChange={e=>setDraft(x=>({...x,price_delivery:val(e.target.value)}))} placeholder="A consultar"/></label>
   </>}
   <label>Precio anterior regular $ (opcional)<input type="number" min="0" step=".01" value={draft.price_old??''} onChange={e=>setDraft(x=>({...x,price_old:val(e.target.value)}))} placeholder="Solo si es real"/></label>
   <label className="checkbox-line"><input type="checkbox" checked={draft.active} onChange={e=>setDraft(x=>({...x,active:e.target.checked}))}/> Publicar promoción</label>
   <div className="campaign-actions"><button className="btn green" disabled={saving||!draft.product_a_id||!offerReady} type="submit">Guardar promoción</button>{draft.id&&<button type="button" className="btn white" onClick={()=>setDraft({...empty})}>Cancelar edición</button>}</div>
  </form>
  {offers.length>0&&<div className="campaign-saved"><h3>Ofertas guardadas</h3>{offers.map(o=><div key={o.id}><strong>{o.title}</strong><span>{detail(o)}</span><button className="btn subtle" onClick={()=>setDraft({...o})}>Editar</button><button className="btn subtle" disabled={saving} onClick={()=>void deleteOffer(o.id)}>Eliminar</button></div>)}</div>}
  <hr/><h3>Video de fábrica y prueba social</h3>
  <form className="campaign-form" onSubmit={saveSettings}>
   <label className="wide">URL de video (YouTube, Vimeo o MP4)<input type="url" value={settings.factory_video_url} placeholder="https://..." onChange={e=>setSettings(x=>({...x,factory_video_url:e.target.value}))}/></label>
   <label>O subí tu video MP4 (hasta 500 MB en Supabase Pro)<input type="file" accept="video/mp4" disabled={saving} onChange={e=>{void uploadVideo(e.target.files?.[0],'video');e.target.value='';}}/></label>
   {uploadProgress!==null&&<div className="video-upload-progress wide" role="status"><strong>Subiendo video: {uploadProgress}%</strong><div className="video-progress-track"><div style={{width:uploadProgress+'%'}}/></div><small>Se sube en fragmentos reanudables de 6 MB. No cierres la pestaña mientras se completa.</small></div>}
   <p className="wide video-storage-note">Supabase Free admite archivos de hasta 50 MB. Para subir uno de 400–500 MB necesitás Supabase Pro, configurar el límite global y ampliar el bucket <code>factory-media</code>. Como alternativa, podés pegar un enlace de YouTube o Vimeo sin subirlo a Supabase.</p>
   <label>Imagen de portada para el video<input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={e=>{void uploadVideo(e.target.files?.[0],'poster');e.target.value='';}}/></label>
   <label className="wide">Título del video<input maxLength={140} value={settings.video_title} onChange={e=>setSettings(x=>({...x,video_title:e.target.value}))}/></label>
   <label className="wide">Descripción del video<input maxLength={240} value={settings.video_caption} onChange={e=>setSettings(x=>({...x,video_caption:e.target.value}))}/></label>
   <label className="wide">Frase de confianza<input maxLength={180} value={settings.social_proof_text} onChange={e=>setSettings(x=>({...x,social_proof_text:e.target.value}))}/></label>
   <label>Número de clientes (solo verificado)<input inputMode="numeric" value={settings.proof_count} placeholder="Ej. 750" onChange={e=>setSettings(x=>({...x,proof_count:e.target.value.replace(/[^0-9]/g,'')}))}/></label>
   <label>Calificación real (si tenés datos)<input type="number" step=".1" min="1" max="5" value={settings.proof_rating} placeholder="Ej. 4.9" onChange={e=>setSettings(x=>({...x,proof_rating:e.target.value}))}/></label>
   <label className="checkbox-line wide"><input type="checkbox" checked={settings.proof_verified==='true'} onChange={e=>setSettings(x=>({...x,proof_verified:e.target.checked?'true':'false'}))}/> Confirmo que puedo respaldar las cifras antes de publicarlas</label>
   <label className="wide">Final real de la promoción semanal (opcional) <input type="datetime-local" value={settings.promo_deadline?settings.promo_deadline.slice(0,16):''} onChange={e=>setSettings(x=>({...x,promo_deadline:e.target.value?new Date(e.target.value).toISOString():''}))}/></label>
   <div className="wide review-admin-head"><h3>Comentarios reales de clientes (opcional)</h3><p>Se mostrarán solo los mensajes que hayas recibido y autorizado. No se generan opiniones ni horarios inventados.</p></div>
   {([1,2,3] as const).map(i=><div className="review-admin-row wide" key={i}><label>Comentario #{i}<textarea rows={2} maxLength={350} value={settings[('review_'+i+'_text') as keyof Settings]} onChange={e=>setSettings(x=>({...x,['review_'+i+'_text']:e.target.value}))} placeholder="Pegá aquí el mensaje real autorizado"/></label><label>Localidad o referencia<input maxLength={80} value={settings[('review_'+i+'_city') as keyof Settings]} onChange={e=>setSettings(x=>({...x,['review_'+i+'_city']:e.target.value}))} placeholder="Ej. Zona Sur"/></label><label className="checkbox-line"><input type="checkbox" checked={settings[('review_'+i+'_verified') as keyof Settings]==='true'} onChange={e=>setSettings(x=>({...x,['review_'+i+'_verified']:e.target.checked?'true':'false'}))}/> Tengo autorización para publicar este comentario</label></div>)}
   <button className="btn green" disabled={saving} type="submit">Guardar video y prueba social</button>
  </form>
  {message&&<p role="status" className="admin-notice">{message}</p>}
 </section>;
 return <>
  <section className="vsl-section wrap" id="fabrica">
   <div className="vsl-intro"><span className="overline">RECORRIDO POR NUESTRA PLANTA EN BURZACO</span><h2>{settings.video_title==='Calidad que podés ver en vivo antes de hacer tu pedido'?<>Calidad que podés ver <em>en vivo antes de hacer tu pedido.</em></>:settings.video_title}</h2><p>{settings.video_caption}</p></div>
   <div className="vsl-shell">
    <div className="vsl-topline"><span className="vsl-source"><span className="vsl-dot"/> PLANTA BURZACO · EXTRUSIÓN PROPIA</span><span className="vsl-audio"><Icon name="music"/> AUDIO DISPONIBLE</span></div>
    <div className="vsl-screen">
      {video ? (!videoStarted ?
        <button type="button" className="vsl-play" onClick={()=>setVideoStarted(true)} style={poster?{backgroundImage:'linear-gradient(#00190b55,#00190b55),url("'+poster+'")'}:{}} aria-label="Reproducir video de fábrica"><span className="vsl-play-circle"><Icon name="play"/></span><strong>Reproducir video de la fábrica</strong></button>
        :video.type==='mp4'?<video src={video.src} poster={poster||undefined} controls playsInline autoPlay preload="metadata"/>:<iframe title="Recorrido por MITOBICEL" src={video.src+(video.src.includes('?')?'&':'?')+'autoplay=1'} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>
      ):<div className="vsl-empty"><span className="vsl-play-circle"><Icon name="play"/></span><strong>Próximamente: recorrido por la planta</strong><small>En el superadmin se podrá publicar el video completo.</small></div>}
    </div>
   </div>
   <div className="vsl-chapters" role="tablist" aria-label="Etapas de la fábrica">{chapters.map((c,i)=><button key={i} type="button" className={'vsl-chapter'+(chapter===i?' selected':'')} role="tab" aria-selected={chapter===i} onClick={()=>setChapter(i)}><span>{String(i+1).padStart(2,'0')}</span><strong>{c.title}</strong></button>)}</div><div className="vsl-chapter-detail" role="tabpanel"><span className="chapter-kicker">ETAPA {String(chapter+1).padStart(2,'0')}</span><p>{chapters[chapter].detail}</p></div>
  </section>
  <SocialProof placement="video"/>
  <DirectComparison/>
  {offerReady&&offers.some(o=>o.active)&&<section className="wrap offer-section" id="promociones">
   <div className="section-top"><div><span className="weekly-promo-badge"><Icon name="flame"/> PROMOCIONES SEMANALES · DIRECTO DE FÁBRICA</span><h2>Ofertas que <em>rinden más.</em></h2><p>Elegí las presentaciones y consultá las condiciones vigentes de la promoción.</p></div></div>
   <div className="offers-grid">{offers.filter(o=>o.active).map(o=>{
    const total=comboTotal(o,'pickup'),delivery=comboTotal(o,'delivery'),before=price(o.price_old,o);
    const showOld=before!==null&&total!==null&&before>total;
    const productA=byId(o.product_a_id),productB=byId(o.product_b_id);
    const detailPrices=hasSeparatePrices(o)?' Producto A: retiro '+money(o.price_a_pickup??null)+' / envío '+money(o.price_a_delivery??null)+' por '+o.unit_a+'. Producto B: retiro '+money(o.price_b_pickup??null)+' / envío '+money(o.price_b_delivery??null)+' por '+o.unit_b+'.':'';
    const waText='Hola MITOBICEL, quiero pedir la promoción '+o.title+': '+detail(o)+'.'+detailPrices+' Total retiro: '+money(total)+'. Total con envío: '+money(delivery)+'. ¿Me confirman disponibilidad?';
    return <article className="offer-card" key={o.id}>
      <div className="offer-sheen"/><span className="offer-tag"><Icon name="flame"/> COMBO MAYORISTA DE LA SEMANA · CONSULTAR STOCK</span><h3>{o.title}</h3><p>{o.description}</p>
      <div className="offer-combo">
       <div className="offer-product">{productA?.image_url?<img src={productA.image_url} alt=""/>:<span className="offer-product-placeholder"><Icon name="package"/></span>}<strong>{o.quantity_a} {o.unit_a}</strong><small>{productA?.title} · {productA?.measure}</small></div>
       {o.product_b_id&&<><span className="offer-plus">+</span><div className="offer-product">{productB?.image_url?<img src={productB.image_url} alt=""/>:<span className="offer-product-placeholder"><Icon name="package"/></span>}<strong>{o.quantity_b} {o.unit_b}</strong><small>{productB?.title} · {productB?.measure}</small></div></>}
      </div>
      {hasSeparatePrices(o)&&<div className="offer-split-prices"><div><strong>Producto A · {productA?.title}</strong><span>Retiro: {money(o.price_a_pickup??null)} / {o.unit_a.slice(0,-1)}</span><span>Con envío: {money(o.price_a_delivery??null)} / {o.unit_a.slice(0,-1)}</span></div><div><strong>Producto B · {productB?.title}</strong><span>Retiro: {money(o.price_b_pickup??null)} / {o.unit_b.slice(0,-1)}</span><span>Con envío: {money(o.price_b_delivery??null)} / {o.unit_b.slice(0,-1)}</span></div></div>}
      <div className="offer-price-row"><div><small>Retirando por fábrica · Total</small>{showOld&&<del>{money(before)}</del>}<strong>{money(total)}</strong>{showOld&&<span className="offer-saving">Ahorrás {money(before!-total!)}</span>}</div><div><small>Con envío</small><strong>{money(delivery)}</strong></div></div>
      <div className="offer-buttons"><a className="btn offer-order" href={wu(waText)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/> Reservar esta promo por WhatsApp ↗</a>{onAdd&&<button type="button" className="offer-add" onClick={()=>onAdd({key:'offer-'+o.id,title:o.title,detail:detail(o),quantity:1,unit:'combo',pricePickup:total,priceDelivery:delivery})}>+ Agregar al pedido</button>}</div>
    </article>;
   })}</div>
  </section>}
 </>;
}
