'use client';
import {useEffect,useState} from 'react';
import type {OrderLine} from '@/lib/order';
import {formatArs,formatUsd,summarizeOrder,whatsappQuote} from '@/lib/order';
import {Icon} from '@/components/Visuals';

export default function WholesaleCart({lines,onQuantity,onRemove}:{
 lines:OrderLine[];
 onQuantity:(key:string,qty:number)=>void;
 onRemove:(key:string)=>void;
}){
 const [open,setOpen]=useState(false);
 const totals=summarizeOrder(lines);
 const hasList=lines.some(line=>line.priceList!==undefined);
 useEffect(()=>{if(lines.length)setOpen(true)},[lines.length]);
 if(!lines.length)return null;
 const pickupPending=totals.pickupMissing>0;
 const deliveryPending=totals.deliveryMissing>0;
 const moneyOrPending=(amount:number,missing:number)=>
  missing===lines.length?'A consultar':formatArs(amount);

 return <aside className={'express-cart'+(open?' expanded':'')} aria-label="Cotización mayorista">
  <div className="cart-bar">
   <div className="cart-title">
    <span className="cart-counter">{totals.totalUnits}</span>
    <div><strong>Tu pedido mayorista</strong><small>{totals.lineCount} {totals.lineCount===1?'presentación':'presentaciones'} seleccionadas</small></div>
   </div>
   <div className="cart-header-totals" aria-live="polite" aria-atomic="true">
    {hasList?<>
     {totals.referenceArsCount>0&&<div><span>Lista ARS{totals.referenceArsMissing?' · parcial':''}</span><strong>{totals.referenceArsMissing===totals.referenceArsCount?'A confirmar':formatArs(totals.referenceArs)}</strong></div>}
     {totals.referenceUsdCount>0&&<div><span>Lista USD{totals.referenceUsdMissing?' · parcial':''}</span><strong>{totals.referenceUsdMissing===totals.referenceUsdCount?'A confirmar':formatUsd(totals.referenceUsd)}</strong></div>}
    </>:<>
     <div><span>Retiro en fábrica{pickupPending?' · parcial':''}</span><strong>{moneyOrPending(totals.pickupTotal,totals.pickupMissing)}</strong></div>
     <div><span>Con envío{deliveryPending?' · parcial':''}</span><strong>{moneyOrPending(totals.deliveryTotal,totals.deliveryMissing)}</strong></div>
    </>}
   </div>
   <button type="button" className="cart-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
    {open?'Ocultar':'Ver pedido'} <span aria-hidden="true">{open?'⌄':'⌃'}</span>
   </button>
  </div>
  {open&&<div className="cart-details">
   <div className="cart-lines">{lines.map(line=><div className="cart-line" key={line.key}>
    <div className="cart-product">
     <strong>{line.title}</strong>
     <small>{line.detail}</small>
     <div className="cart-line-prices">
      {hasList?<span>Precio de lista: {line.priceList==null?'A confirmar':line.currency==='USD'?formatUsd(line.priceList*line.quantity):formatArs(line.priceList*line.quantity)}</span>:<>
       <span>Retiro: {line.pricePickup==null? 'A consultar':formatArs(line.pricePickup*line.quantity)}</span>
       <span>Envío: {line.priceDelivery==null? 'A consultar':formatArs(line.priceDelivery*line.quantity)}</span>
      </>}
     </div>
    </div>
    <div className="cart-controls">
     <button type="button" aria-label={'Restar '+line.title} onClick={()=>onQuantity(line.key,Math.max(1,line.quantity-1))}>−</button>
     <input type="number" min={1} max={9999} value={line.quantity} aria-label={'Cantidad de '+line.title} onChange={e=>onQuantity(line.key,Math.max(1,Math.min(9999,Math.floor(Number(e.target.value)||1))))}/>
     <button type="button" aria-label={'Sumar '+line.title} onClick={()=>onQuantity(line.key,Math.min(9999,line.quantity+1))}>+</button>
     <span>{line.unit}{line.quantity!==1?'s':''}</span>
     <button type="button" className="cart-remove" onClick={()=>onRemove(line.key)} aria-label={'Quitar '+line.title}>×</button>
    </div>
   </div>)}</div>
   <div className="cart-summary" aria-live="polite" aria-atomic="true">
    {hasList?<>
     {totals.referenceArsCount>0&&<div className="cart-summary-row"><span>Total de lista ARS{totals.referenceArsMissing?' (parcial)':''}</span><strong>{totals.referenceArsMissing===totals.referenceArsCount?'A confirmar':formatArs(totals.referenceArs)}</strong></div>}
     {totals.referenceUsdCount>0&&<div className="cart-summary-row"><span>Total de lista USD{totals.referenceUsdMissing?' (parcial)':''}</span><strong>{totals.referenceUsdMissing===totals.referenceUsdCount?'A confirmar':formatUsd(totals.referenceUsd)}</strong></div>}
     <p className="cart-pending">Son subtotales de referencia, sin sumar distintas monedas. Las presentaciones sin precio no se incluyen. Retiro, envío e importe final a confirmar con la fábrica.</p>
    </>:<>
     <div className="cart-summary-row"><span>Total retirando por fábrica{pickupPending?' (parcial)':''}</span><strong>{moneyOrPending(totals.pickupTotal,totals.pickupMissing)}</strong></div>
     <div className="cart-summary-row"><span>Total con envío{deliveryPending?' (parcial)':''}</span><strong>{moneyOrPending(totals.deliveryTotal,totals.deliveryMissing)}</strong></div>
     {(pickupPending||deliveryPending)&&<p className="cart-pending">Los importes parciales no incluyen las presentaciones sin precio cargado. El total definitivo se confirma por WhatsApp.</p>}
    </>}
   </div>
   <p className="cart-help">Compra mínima: medio pallet (50 bultos). Envíos desde 100 bultos. Precios sujetos a confirmación de fábrica.</p>
   <a className="cart-send" href={whatsappQuote(lines)} target="_blank" rel="noopener noreferrer">
    <Icon name="whatsapp"/> Enviar pedido completo a fábrica por WhatsApp
   </a>
  </div>}
 </aside>;
}
