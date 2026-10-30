'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {getDb} from '@/lib/client';
import {Icon} from '@/components/Visuals';
import IndustrialBar from '@/components/IndustrialBar';
import Campaigns from '@/components/Campaigns';
import SocialProof from '@/components/SocialProof';
import {SocialQuestions,WholesaleFAQ} from '@/components/Conversion';
import WholesaleCart from '@/components/WholesaleCart';
import type {OrderLine} from '@/lib/order';
import catalogSeedJSON from '@/data/catalogo2.provincias.26-10.json';
import {FULL_CATALOG_PATH,FULL_CATALOG_TABLE,itemPresentation,normalizedSearch,orderUnit,formatCatalogPrice,priceUnitLabel,correctLegacyUnpricedRow,type FullCatalogItem} from '@/lib/fullCatalog';

const wa=(message:string)=>'https://wa.me/541162190702?text='+encodeURIComponent(message);
const fullList=catalogSeedJSON as FullCatalogItem[];
function mergePublishedRows(remote:FullCatalogItem[]){
 const byId=new Map<string,FullCatalogItem>(fullList.map(row=>[row.id,row]));
 const custom:FullCatalogItem[]=[];
 for(const row of remote){
  if(byId.has(row.id))byId.set(row.id,correctLegacyUnpricedRow(row,byId.get(row.id)));
  else if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(row.id))custom.push(row);
 }
 return [...byId.values(),...custom].sort((a,b)=>a.position-b.position);
}

export default function FullCatalog(){
 const [items,setItems]=useState<FullCatalogItem[]>(fullList);
 const [promoItems,setPromoItems]=useState<FullCatalogItem[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [orderLines,setOrderLines]=useState<OrderLine[]>([]);
 const addOrder=(line:OrderLine)=>setOrderLines(previous=>{
  const existing=previous.find(x=>x.key===line.key);
  return existing?previous.map(x=>x.key===line.key?{...x,quantity:x.quantity+line.quantity}:x):[...previous,line];
 });
 const changeQuantity=(key:string,quantity:number)=>setOrderLines(previous=>previous.map(x=>x.key===key?{...x,quantity}:x));
 const removeItem=(key:string)=>setOrderLines(previous=>previous.filter(x=>x.key!==key));
 const refresh=useCallback(async()=>{
  const db=getDb();
  if(!db){setLoading(false);return;}
  const {data,error:loadError}=await db.from(FULL_CATALOG_TABLE).select('*').order('position',{ascending:true});
  if(loadError)setItems(fullList);
  else setItems(mergePublishedRows((data||[]) as FullCatalogItem[]));
  setError('');setLoading(false);
 },[]);
 useEffect(()=>{
  void refresh();
  const db=getDb();
  if(!db)return;
  void db.from('catalog_items').select('id,title,measure,presentation,enabled,image_url').eq('enabled',true)
   .then(({data})=>{if(data)setPromoItems(data as FullCatalogItem[]);});
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},20000);
  return()=>window.clearInterval(timer);
 },[refresh]);

 const groups=useMemo(()=>{
  const matching=items.filter(item=>item.enabled&&
   normalizedSearch(item.title+' '+item.measure+' '+item.subtitle+' '+item.presentation)
    .includes(normalizedSearch(search))
  );
  const order:string[]=[];
  for(const item of matching)if(!order.includes(item.category))order.push(item.category);
  return order.map(category=>({category,items:matching.filter(item=>item.category===category)}));
 },[items,search]);
 const categoryCount=new Set(items.filter(item=>item.enabled).map(item=>item.category)).size;
 // Evitar columnas completas de «Consultar» hasta que el admin haya publicado
 // precios diferenciados para retiro o envío en este catálogo.
 const showPickup=items.some(item=>item.enabled&&item.price_pickup!=null);
 const showDelivery=items.some(item=>item.enabled&&item.price_delivery!=null);
 const addMeasure=(item:FullCatalogItem)=>addOrder({
  key:'full-'+item.id,
  title:item.title,
  detail:item.measure+' · '+itemPresentation(item),
  quantity:1,
  unit:orderUnit(item.presentation),
  pricePickup:item.price_pickup,
  priceDelivery:item.price_delivery,
  priceList:item.price_list??null,
  currency:item.currency||'ARS'
 });

 return <div className="app full-catalog-app">
  <IndustrialBar/>
  <header className="header"><div className="wrap head-inner">
   <a href={FULL_CATALOG_PATH} className="logo brand-logo" aria-label="MITOBICEL Catálogo completo"><img src="/logo-mitobicel.png" alt="MITOBICEL"/></a>
   <nav><a href="#promociones">Promociones</a><a href="#productos">Productos</a><a href="#compra">Cómo comprar</a></nav>
   <div className="head-cta"><a className="btn green" href={wa('Hola MITOBICEL, quiero hacer un pedido desde el catálogo completo')} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/> WhatsApp para pedidos <span>↗</span></a></div>
  </div></header>
  <main>
   <section className="hero wrap">
    <div className="hero-left">
     <div className="eyebrow hero-pill"><span className="live-dot"/> CATÁLOGO COMPLETO · CLIENTES MAYORISTAS</div>
     <h1>Calidad que se nota.<br/><em>Precio que conviene.</em></h1>
     <p className="lead">Fabricando calidad al mejor precio hace más de <strong>15 años.</strong> Todos nuestros productos para papeleras, distribuidores y comercios, directamente de fábrica.</p>
     <div className="hero-buttons"><a className="btn red" href="#productos">VER CATÁLOGO COMPLETO Y PRECIOS <span>↓</span></a></div>
     <SocialProof placement="hero"/>
     <div className="hero-stats">
      <div><small>DESDE</small><b>50 <i>bultos</i></b><span>Pedido mínimo</span></div>
      <div><small>ORIGEN</small><b>100%</b><span>Directo de fábrica</span></div>
      <div><small>CATÁLOGO</small><b>{categoryCount||'—'} <i>líneas</i></b><span>Presentaciones mayoristas</span></div>
     </div>
    </div>
    <div className="hero-right">
     <div className="hero-image-label">VISITANOS EN FÁBRICA</div>
     <img src="/mitobicel-fabrica.png" className="factory-picture" alt="MITOBICEL, fábrica de bolsas en Burzaco"/>
     <div className="factory-location"><div><strong><Icon name="map-pin"/> Av. San Martín 249, Burzaco</strong><small>Vení a conocer la fábrica y probar nuestra calidad.</small></div>
      <a className="factory-map" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=Avenida+San+Martin+249+Burzaco+Buenos+Aires"><Icon name="map-pin"/> ABRIR EN GOOGLE MAPS ↗</a>
     </div>
    </div>
   </section>
   <div className="trust-strip"><div className="wrap trust-grid">
    <div><span><Icon name="factory"/></span><b>Fabricante directo</b><small>Sin intermediarios</small></div>
    <div><span><Icon name="award"/></span><b>Calidad premium</b><small>Precios competitivos</small></div>
    <div><span><Icon name="package"/></span><b>Retiro por fábrica</b><small>Conocé nuestros productos</small></div>
    <div><span><Icon name="truck"/></span><b>Envíos</b><small>Desde 100 bultos</small></div>
   </div></div>

   <Campaigns products={promoItems} onAdd={addOrder}/>

   <section className="wrap section" id="productos">
    <div className="section-top"><div><span className="overline">CATÁLOGO COMPLETO · LISTA DEL 26/10/2026</span>
     <h2>Todo lo que tu <em>negocio necesita.</em></h2>
     <p>176 presentaciones de la lista Provincias. Precios de lista y opciones de cotización para compras mayoristas.</p>
    </div></div>
    <div className="full-catalog-notice">Los <strong>precios de lista</strong> corresponden al PDF del 26/10: los bultos y presentaciones mayoristas en pesos llevan $4.000 de descuento; los precios por kilo, unidad y paquete suelto de bajo importe conservan su valor original. Los USD siguen expresados en dólares. Retiro y envío se confirman con la fábrica.</div>
    <div className="filters"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto o medida..." aria-label="Buscar producto, línea o medida"/></div>
    {loading&&<div className="full-catalog-message" role="status">Cargando catálogo completo…</div>}
    {!loading&&error&&<div className="full-catalog-message" role="status"><strong>Catálogo en preparación</strong><p>{error}</p><a className="btn green" href={wa('Hola MITOBICEL, quiero consultar el catálogo completo mayorista')} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/> Consultar por WhatsApp</a></div>}
    {!loading&&!error&&groups.length===0&&<div className="empty">
      {items.length===0?'Estamos preparando el catálogo completo. Consultá por WhatsApp las presentaciones disponibles.':'No encontramos productos con esa búsqueda.'}
    </div>}
    {!loading&&!error&&groups.length>0&&<div className="product-grid masonry-grid">
     {[0,1].map(column=><div className="masonry-column" key={column}>
      {groups.filter((_,index)=>index%2===column).map(group=>{
       const first=group.items[0];
       const image=group.items.find(item=>item.image_url)?.image_url;
       const lower=first.title.toLocaleLowerCase('es');const icon=lower.includes('camiseta')?'shopping-bag':lower.includes('residuo')||lower.includes('consorcio')?'trash':lower.includes('lámina')||lower.includes('separador')?'layers':lower.includes('film')?'film':'package';
       return <article className="product-card" key={group.category}>
        <div className="product-head"><div className="product-title-area">
         <div className="product-picture">{image?<img src={image} alt={first.title}/>:<Icon name={icon}/>}</div>
         <div><span className="overline">DIRECTO DE NUESTRA FÁBRICA</span><h3>{first.title}</h3><p>{first.subtitle}</p></div>
        </div><span className="sku-count">{group.items.length} {group.items.length===1?'MEDIDA':'MEDIDAS'}</span></div>
        <div className="table-scroller"><table>
         <thead><tr><th>MEDIDA</th><th>PRESENTACIÓN</th><th>PRECIO LISTA</th>{showPickup&&<th>RETIRO FÁBRICA</th>}{showDelivery&&<th>CON ENVÍO</th>}<th>ACCIÓN</th></tr></thead>
         <tbody>{group.items.map(item=><tr key={item.id}>
          <td className="size" data-label="Medida">{item.measure}</td>
          <td data-label="Presentación">{itemPresentation(item)}</td>
          <td className="price price-list" data-label="Precio lista">{formatCatalogPrice(item.price_list,item.currency||'ARS')}{item.price_list!=null&&<small className="price-denominator"> {priceUnitLabel(item.presentation)}</small>}{item.requires_quote&&<small> Consultar</small>}</td>
          {showPickup&&<td className="price" data-label="Retiro por fábrica">{item.price_pickup==null?'Consultar precio':formatCatalogPrice(item.price_pickup,item.currency||'ARS')}</td>}
          {showDelivery&&<td className="price price-green" data-label="Con envío">{item.price_delivery==null?'Consultar precio':formatCatalogPrice(item.price_delivery,item.currency||'ARS')}</td>}
          <td className="add-cell"><button type="button" className="add-product" onClick={()=>addMeasure(item)}>+ Cotizar / Agregar</button></td>
         </tr>)}</tbody>
        </table></div>
        <div className="product-bottom"><span>¿Buscás otra presentación de esta línea?</span>
         <a target="_blank" rel="noopener noreferrer" href={wa('Hola MITOBICEL, quiero consultar otras medidas de '+first.title)}><Icon name="whatsapp"/> Consultar más medidas por WhatsApp ↗</a>
        </div>
       </article>;
      })}
     </div>)}
    </div>}
   </section>
   <section className="wrap section" id="compra"><div className="buy-card">
    <span className="overline">TRES PASOS PARA TU PEDIDO MAYORISTA</span><h2>Elegís, cotizás <em>y coordinamos.</em></h2>
    <div className="steps">
     <div><span>01</span><h3>Seleccioná las medidas</h3><p>Agregá al pedido las presentaciones y cantidades que necesita tu negocio.</p></div>
     <div><span>02</span><h3>Enviá la cotización</h3><p>Revisá tu carrito express y enviá todas las cantidades en un solo mensaje.</p></div>
     <div><span>03</span><h3>Confirmá la operación</h3><p>Te respondemos con stock disponible, importe final, forma de pago y coordinación de entrega o retiro.</p></div>
    </div><a className="btn red" href="#productos">Seleccionar productos ↑</a>
   </div></section>
   <SocialQuestions/>
   <WholesaleFAQ/>
   <footer className="site-footer"><div className="wrap footer-row">
    <div className="footer-identity"><a href={FULL_CATALOG_PATH} className="footer-brand" aria-label="Catálogo completo MITOBICEL"><img src="/logo-mitobicel.png" alt="MITOBICEL"/></a><p>Fabricando calidad al mejor precio hace más de 15 años.</p><small>«El Señor es mi pastor; nada me faltará». — Salmos 23:1</small></div>
    <div className="footer-details"><strong>Fábrica y atención</strong><p>Avenida San Martín 249, Burzaco, Buenos Aires.</p><p>Lunes a viernes: 8:30–13 y 13:30–17 h<br/>Sábados: 8:30–13 h</p><a href="https://www.google.com/maps/search/?api=1&query=Avenida+San+Martin+249+Burzaco+Buenos+Aires" target="_blank" rel="noopener noreferrer">Cómo llegar ↗</a></div>
    <div className="footer-contact"><strong>Pedí directo por WhatsApp</strong><a className="btn green" href={wa('Hola MITOBICEL, quiero consultar un pedido mayorista del catálogo completo')} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/> 11 6219-0702</a><p>Venta exclusiva por mayor.</p></div>
   </div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} MITOBICEL · Todos los derechos reservados.</span><span>Industria argentina · Fabricante directo</span></div></footer>
   <a className="floating-wa" href={wa('Hola MITOBICEL, quiero consultar precios mayoristas del catálogo completo')} aria-label="Consultar por WhatsApp" target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/></a>
   <WholesaleCart lines={orderLines} onQuantity={changeQuantity} onRemove={removeItem}/>
  </main>
 </div>;
}
