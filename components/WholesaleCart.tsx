'use client';
import {useEffect,useState} from 'react';
import type {OrderLine} from '@/lib/order';
import {whatsappQuote} from '@/lib/order';
import {Icon} from '@/components/Visuals';
export default function WholesaleCart({lines,onQuantity,onRemove}:{
 lines:OrderLine[];onQuantity:(key:string,qty:number)=>void;onRemove:(key:string)=>void;
}){
 const [open,setOpen]=useState(false);
 const count=lines.reduce((n,x)=>n+x.quantity,0);
 useEffect(()=>{if(lines.length)setOpen(true)},[lines.length]);
 if(lines.length===0)return null;
 return <aside className={'express-cart'+(open?' expanded':'')} aria-label="Cotización mayorista">
 <div className="cart-bar">
 <div className="cart-title"><span className="cart-counter">{count}</span><div><strong>Tu pedido mayorista</strong><small>{lines.length} {lines.length===1?'presentación':'presentaciones'} seleccionadas</small></div></div>
 <button type="button" className="cart-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?'Ocultar':'Ver pedido'} <span aria-hidden="true">{open?'⌄':'⌃'}</span></button>
 </div>
 {open&&<div className="cart-details">
 <div className="cart-lines">{lines.map(line=><div className="cart-line" key={line.key}>
 <div className="cart-product"><strong>{line.title}</strong><small>{line.detail}</small></div>
 <div className="cart-controls"><button type="button" aria-label={'Restar '+line.title} onClick={()=>onQuantity(line.key,Math.max(1,line.quantity-1))}>−</button><input type="number" min={1} max={9999} value={line.quantity} aria-label={'Cantidad de '+line.title} onChange={e=>onQuantity(line.key,Math.max(1,Math.min(9999,Math.floor(Number(e.target.value)||1))))}/><button type="button" aria-label={'Sumar '+line.title} onClick={()=>onQuantity(line.key,line.quantity+1)}>+</button><span>{line.unit}{line.quantity!==1?'s':''}</span><button type="button" className="cart-remove" onClick={()=>onRemove(line.key)} aria-label={'Quitar '+line.title}>×</button></div>
 </div>)}</div>
 <p className="cart-help">Compra mínima: medio pallet (50 bultos). Envíos desde 100 bultos. La disponibilidad y los precios se confirman por WhatsApp.</p>
 <a className="cart-send" href={whatsappQuote(lines)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/> Enviar pedido completo a fábrica por WhatsApp</a>
 </div>}
 </aside>
}
