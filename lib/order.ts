export type OrderLine={
 key:string;
 title:string;
 detail:string;
 quantity:number;
 unit:'bulto'|'caja'|'combo'|'rollo'|'paquete'|'kg'|'unidad'|'tubo'|'atado';
 pricePickup?:number|null;
 priceDelivery?:number|null;
 priceList?:number|null;
 currency?:'ARS'|'USD';
};

export type OrderSummary={
 totalUnits:number;
 lineCount:number;
 pickupTotal:number;
 deliveryTotal:number;
 pickupMissing:number;
 deliveryMissing:number;
 referenceArs:number;
 referenceUsd:number;
 referenceArsCount:number;
 referenceUsdCount:number;
 referenceArsMissing:number;
 referenceUsdMissing:number;
};

export const formatArs=(value:number)=>new Intl.NumberFormat('es-AR',{
 style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:2
}).format(value);
export const formatUsd=(value:number)=>new Intl.NumberFormat('es-AR',{
 style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2
}).format(value);

export function summarizeOrder(lines:OrderLine[]):OrderSummary {
 return lines.reduce<OrderSummary>((sum,line)=>{
  const qty=Number.isFinite(line.quantity)?Math.max(0,line.quantity):0;
  const isUsd=line.currency==='USD';
  const usesReference=line.priceList!==undefined;
  const hasReference=typeof line.priceList==='number'&&Number.isFinite(line.priceList)&&line.priceList>=0;
  const hasPickup=typeof line.pricePickup==='number'&&Number.isFinite(line.pricePickup)&&line.pricePickup>=0;
  const hasDelivery=typeof line.priceDelivery==='number'&&Number.isFinite(line.priceDelivery)&&line.priceDelivery>=0;
  return {
   totalUnits:sum.totalUnits+qty,
   lineCount:sum.lineCount+1,
   pickupTotal:sum.pickupTotal+(hasPickup&&!isUsd?line.pricePickup!*qty:0),
   deliveryTotal:sum.deliveryTotal+(hasDelivery&&!isUsd?line.priceDelivery!*qty:0),
   pickupMissing:sum.pickupMissing+(hasPickup&&!isUsd?0:1),
   deliveryMissing:sum.deliveryMissing+(hasDelivery&&!isUsd?0:1),
   referenceArs:sum.referenceArs+(usesReference&&!isUsd&&hasReference?line.priceList!*qty:0),
   referenceUsd:sum.referenceUsd+(usesReference&&isUsd&&hasReference?line.priceList!*qty:0),
   referenceArsCount:sum.referenceArsCount+(usesReference&&!isUsd?1:0),
   referenceUsdCount:sum.referenceUsdCount+(usesReference&&isUsd?1:0),
   referenceArsMissing:sum.referenceArsMissing+(usesReference&&!isUsd&&!hasReference?1:0),
   referenceUsdMissing:sum.referenceUsdMissing+(usesReference&&isUsd&&!hasReference?1:0)
  };
 },{totalUnits:0,lineCount:0,pickupTotal:0,deliveryTotal:0,pickupMissing:0,deliveryMissing:0,referenceArs:0,referenceUsd:0,referenceArsCount:0,referenceUsdCount:0,referenceArsMissing:0,referenceUsdMissing:0});
}

export function whatsappQuote(lines:OrderLine[]){
 const sum=summarizeOrder(lines);
 const usesReference=lines.some(line=>line.priceList!==undefined);
 const items=lines.map((line,i)=>{
  const unit=line.unit==='kg'?'kg':line.unit+(line.quantity===1?'':'s');
  const info=String(i+1)+'. '+line.title+' — '+line.detail+' — '+line.quantity+' '+unit;
  if(!usesReference)return info;
  const formatted=line.priceList==null?'a confirmar':(line.currency==='USD'?formatUsd(line.priceList):formatArs(line.priceList));
  return info+' — Precio lista: '+formatted;
 });
 const totals=usesReference?[
  ...(sum.referenceArsCount?[sum.referenceArsMissing===sum.referenceArsCount
   ?'Total lista en ARS: a confirmar'
   :'Subtotal de lista ARS'+(sum.referenceArsMissing?' (parcial)':'')+': '+formatArs(sum.referenceArs)]:[]),
  ...(sum.referenceUsdCount?[sum.referenceUsdMissing===sum.referenceUsdCount
   ?'Total lista en USD: a confirmar'
   :'Subtotal de lista USD'+(sum.referenceUsdMissing?' (parcial)':'')+': '+formatUsd(sum.referenceUsd)]:[]),
  'Importes de lista de referencia; retiro, envío y total final a confirmar con MITOBICEL.'
 ]:[
  sum.pickupMissing===0
   ?'Total estimado retirando por fábrica: '+formatArs(sum.pickupTotal)
   :sum.pickupMissing===lines.length
     ?'Total retirando por fábrica: a consultar (sin precios cargados)'
     :'Subtotal conocido retirando por fábrica: '+formatArs(sum.pickupTotal)+' ('+sum.pickupMissing+' presentación(es) sin precio)',
  sum.deliveryMissing===0
   ?'Total estimado con envío: '+formatArs(sum.deliveryTotal)
   :sum.deliveryMissing===lines.length
     ?'Total con envío: a consultar (sin precios cargados)'
     :'Subtotal conocido con envío: '+formatArs(sum.deliveryTotal)+' ('+sum.deliveryMissing+' presentación(es) sin precio)'
 ];
 return 'https://wa.me/541162190702?text='+encodeURIComponent([
  'Hola MITOBICEL. Quiero cotizar este pedido mayorista:',
  ...items,'',...totals,
  'Por favor confirmen los precios vigentes, el stock y el importe final del pedido.',
  '¡Gracias!'
 ].join('\n'));
}
