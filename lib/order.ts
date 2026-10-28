export type OrderLine={
 key:string;
 title:string;
 detail:string;
 quantity:number;
 unit:'bulto'|'caja'|'combo';
 pricePickup?:number|null;
 priceDelivery?:number|null;
};

export type OrderSummary={
 totalUnits:number;
 lineCount:number;
 pickupTotal:number;
 deliveryTotal:number;
 pickupMissing:number;
 deliveryMissing:number;
};

export const formatArs=(value:number)=>new Intl.NumberFormat('es-AR',{
 style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:2
}).format(value);

export function summarizeOrder(lines:OrderLine[]):OrderSummary {
 return lines.reduce<OrderSummary>((summary,line)=>{
  const qty=Number.isFinite(line.quantity)?Math.max(0,line.quantity):0;
  const hasPickup=typeof line.pricePickup==='number'&&Number.isFinite(line.pricePickup)&&line.pricePickup>=0;
  const hasDelivery=typeof line.priceDelivery==='number'&&Number.isFinite(line.priceDelivery)&&line.priceDelivery>=0;
  return {
   totalUnits:summary.totalUnits+qty,
   lineCount:summary.lineCount+1,
   pickupTotal:summary.pickupTotal+(hasPickup?line.pricePickup!*qty:0),
   deliveryTotal:summary.deliveryTotal+(hasDelivery?line.priceDelivery!*qty:0),
   pickupMissing:summary.pickupMissing+(hasPickup?0:1),
   deliveryMissing:summary.deliveryMissing+(hasDelivery?0:1)
  };
 },{totalUnits:0,lineCount:0,pickupTotal:0,deliveryTotal:0,pickupMissing:0,deliveryMissing:0});
}

export function whatsappQuote(lines:OrderLine[]){
 const sum=summarizeOrder(lines);
 const pickupComplete=sum.pickupMissing===0;
 const deliveryComplete=sum.deliveryMissing===0;
 const items=lines.map((line,i)=>
  String(i+1)+'. '+line.title+' — '+line.detail+' — '+line.quantity+' '+line.unit+(line.quantity===1?'':'s')
 );
 const totals=[
  pickupComplete
   ?'Total estimado retirando por fábrica: '+formatArs(sum.pickupTotal)
   :sum.pickupMissing===lines.length
     ?'Total retirando por fábrica: a consultar (sin precios cargados)'
     :'Subtotal conocido retirando por fábrica: '+formatArs(sum.pickupTotal)+' ('+sum.pickupMissing+' presentación(es) sin precio)',
  deliveryComplete
   ?'Total estimado con envío: '+formatArs(sum.deliveryTotal)
   :sum.deliveryMissing===lines.length
     ?'Total con envío: a consultar (sin precios cargados)'
     :'Subtotal conocido con envío: '+formatArs(sum.deliveryTotal)+' ('+sum.deliveryMissing+' presentación(es) sin precio)'
 ];
 return 'https://wa.me/541162190702?text='+encodeURIComponent([
  'Hola MITOBICEL. Quiero cotizar este pedido mayorista:',
  ...items,
  '',
  ...totals,
  'Por favor confirmen los precios vigentes, el stock y el importe final del pedido.',
  '¡Gracias!'
 ].join('\n'));
}
