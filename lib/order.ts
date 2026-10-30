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

export type Catalog2MoneyTotals={
 currency:'ARS'|'USD';
 lines:number;
 pickup:number;
 delivery:number;
 pickupPriced:number;
 deliveryPriced:number;
};
export const hasMoney=(amount:number|null|undefined):amount is number=>
 typeof amount==='number'&&Number.isFinite(amount)&&amount>=0;

// Suma cada moneda por separado y nunca toma productos sin precio
// de envío como si su costo fuera cero.
export function summarizeCatalog2Fulfillment(lines:OrderLine[]):Catalog2MoneyTotals[]{
 const groups:{ARS:Catalog2MoneyTotals;USD:Catalog2MoneyTotals}={
  ARS:{currency:'ARS',lines:0,pickup:0,delivery:0,pickupPriced:0,deliveryPriced:0},
  USD:{currency:'USD',lines:0,pickup:0,delivery:0,pickupPriced:0,deliveryPriced:0}
 };
 for(const line of lines){
  const g=groups[line.currency==='USD'?'USD':'ARS'];
  const qty=Number.isFinite(line.quantity)?Math.max(0,line.quantity):0;
  g.lines++;
  const pickup=line.pricePickup??line.priceList;
  if(hasMoney(pickup)){g.pickup+=pickup*qty;g.pickupPriced++;}
  if(hasMoney(line.priceDelivery)){g.delivery+=line.priceDelivery*qty;g.deliveryPriced++;}
 }
 return [groups.ARS,groups.USD].filter(g=>g.lines>0);
}
export const formatCatalogCartMoney=(value:number,currency:'ARS'|'USD')=>
 currency==='USD'?formatUsd(value):formatArs(value);

export function whatsappQuote(lines:OrderLine[]){
 const sum=summarizeOrder(lines);
 const usesReference=lines.some(line=>line.priceList!==undefined);
 const items=lines.map((line,i)=>{
  const unit=line.unit==='kg'?'kg':line.unit+(line.quantity===1?'':'s');
  const info=String(i+1)+'. '+line.title+' — '+line.detail+' — '+line.quantity+' '+unit;
  if(!usesReference)return info;
  const money=(v:number|null|undefined)=>hasMoney(v)?formatCatalogCartMoney(v,line.currency==='USD'?'USD':'ARS'):'A consultar';
  const pickup=line.pricePickup??line.priceList;
  return info+' — Retiro: '+money(pickup)+' por '+line.unit+
    ' — Con envío: '+money(line.priceDelivery)+' por '+line.unit;
 });
 const totals=usesReference
  ?summarizeCatalog2Fulfillment(lines).flatMap(g=>{
    const format=(value:number)=>formatCatalogCartMoney(value,g.currency);
    const pickup=g.pickupPriced===0
      ?'A consultar'
      :format(g.pickup)+(g.pickupPriced<g.lines?' (parcial)':'');
    const delivery=g.deliveryPriced===0
      ?'A coordinar'
      :format(g.delivery)+(g.deliveryPriced<g.lines?' (parcial, faltan presentaciones)':'');
    return ['Retiro por fábrica '+g.currency+': '+pickup,
            'Con envío '+g.currency+': '+delivery];
   }).concat('Montos estimados; confirmar stock, condiciones y reparto. No se suman pesos y dólares.')
  :[
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
