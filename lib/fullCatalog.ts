/** Catálogo 2: sus registros NO comparten tabla con el catálogo del QR. */
export const FULL_CATALOG_TABLE='catalog_full_items' as const;
export const FULL_CATALOG_PATH='/catalogo-clientes';
export const FULL_CATALOG_ADMIN_PATH='/admin/catalogo-2';

export type FullCatalogItem={
 id:string;
 category:string;
 title:string;
 subtitle:string;
 measure:string;
 presentation:string;
 packages:number|null;
 bags_per_roll:number|null;
 units_per_box:number|null;
 price_pickup:number|null;
 price_delivery:number|null;
 price_list?:number|null;
 currency?:'ARS'|'USD';
 source_original_price?:number|null;
 source_page?:number|null;
 requires_quote?:boolean;
 featured:boolean;
 enabled:boolean;
 image_url?:string|null;
 position:number;
};

export const normalizedSearch=(value:string)=>
 value.toLocaleLowerCase('es')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[×x]/g,'x')
  .replace(/\s+/g,'');

export const makeCategorySlug=(value:string)=>
 value.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-')
  .replace(/^-|-$/g,'')
  .slice(0,72);

export const itemPresentation=(item:FullCatalogItem)=>{
 const parts:string[]=[];
 if(item.packages!==null)
  parts.push(item.packages+(item.category==='arranque'?' rollos/bulto':' paquetes/bulto'));
 else if(item.units_per_box!==null)
  parts.push('Caja x '+item.units_per_box+' unidades');
 else
  parts.push(item.presentation||'Consultar presentación');
 if(item.bags_per_roll!==null)
  parts.push(item.bags_per_roll+' bolsas/rollito');
 return parts.join(' · ');
};

export const orderUnit=(presentation:string):'bulto'|'caja'|'combo'|'rollo'|'paquete'|'kg'|'unidad'|'tubo'=>{
 const p=presentation.toLowerCase();
 if(p.includes('por kg')||p.includes('/kg'))return 'kg';
 if(p.includes('unidad'))return 'unidad';
 if(p.includes('tubo'))return 'tubo';
 if(p.includes('caja'))return 'caja';
 if(p.includes('rollo'))return 'rollo';
 if(p.includes('paquete'))return 'paquete';
 return 'bulto';
};

export const formatCatalogPrice=(value:number|null|undefined,currency:'ARS'|'USD'='ARS')=>{
 if(value===null||value===undefined||!Number.isFinite(value))return 'A confirmar';
 return new Intl.NumberFormat('es-AR',{
  style:'currency',currency,maximumFractionDigits:2,minimumFractionDigits:0
 }).format(value);
};
