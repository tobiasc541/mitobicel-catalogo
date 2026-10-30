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

export const orderUnit=(presentation:string):'bulto'|'caja'|'combo'|'rollo'|'paquete'|'kg'|'unidad'|'tubo'|'atado'=>{
 const p=presentation.trim().toLocaleLowerCase('es');
 if(/^precio por (kg|kilo)\b/.test(p))return 'kg';
 if(/^unidad\b/.test(p))return 'unidad';
 if(/^tubo\b/.test(p))return 'tubo';
 if(/^caja\b/.test(p))return 'caja';
 if(/^paquete\b/.test(p))return 'paquete';
 if(/^rollo\b/.test(p))return 'rollo';
 // La presentación principal define la unidad. Un atado puede incluir
 // varios paquetes, pero se cotiza por atado, no por paquete.
 if(/^bulto\/atado|^atado\b/.test(p))return 'atado';
 if(/^bulto\b/.test(p))return 'bulto';
 return 'bulto';
};

// Denominador visible junto al importe: evita confundir precio/kg con
// precio/bobina, o paquete suelto con bulto/atado.
export const priceUnitLabel=(presentation:string)=>{
 const p=presentation.trim().toLocaleLowerCase('es');
 if(/^precio por (kg|kilo)\b/.test(p))return '/kg';
 if(/^unidad\b/.test(p))return '/unidad';
 if(/^paquete\b/.test(p))return '/paquete';
 if(/^tubo\b/.test(p))return '/tubo';
 if(/^caja\b/.test(p))return '/caja';
 if(/^bulto\/atado|^atado\b/.test(p))return '/atado';
 if(/^rollo\b/.test(p))return '/rollo';
 if(/^bulto\b/.test(p))return '/bulto';
 return '';
};

// Corregir únicamente importes mal cargados en la versión anterior. Nunca
// sobrescribir precios modificados en Superadmin.
export const correctLegacyUnpricedRow=(remote:FullCatalogItem,official?:FullCatalogItem):FullCatalogItem=>{
 if(!official||official.id!==remote.id||official.currency!=='ARS'||
    (remote.currency||'ARS')!=='ARS'||
    remote.source_original_price!==official.source_original_price||
    official.price_list==null||official.price_list!==official.source_original_price)
   return remote;
 if(official.source_original_price!=null&&official.source_original_price<4000&&
    remote.price_list==null&&remote.requires_quote===true)
   return {...remote,price_list:official.price_list,requires_quote:false};
 if(/^tubo\b/i.test(official.presentation.trim())&&
    official.source_original_price!=null&&
    remote.price_list===official.source_original_price-4000)
   return {...remote,price_list:official.price_list,requires_quote:false};
 return remote;
};


// Política de precios de MITOBICEL Catálogo 2:
// retiro = valor ya ajustado de la lista de Provincias;
// envío = retiro + ARS $1.000 por bulto/caja/atado mayorista.
// No sumar pesos a los importes expresados en USD ni fijar envíos de unidades sueltas.
export const isWholesalePresentation=(presentation:string)=>
 /^(?:bulto(?:\b|\/)|caja\b|atado\b)/i.test(presentation.trim());

export const resolveCatalog2Prices=(remote:FullCatalogItem,official?:FullCatalogItem):FullCatalogItem=>{
 const corrected=correctLegacyUnpricedRow(remote,official);
 // Reparar también el retiro si provino exactamente del tubo mal descontado
 // en la primera versión; cualquier importe personalizado se conserva.
 const badLegacyTubePickup=Boolean(official&&
   /^tubo\b/i.test(official.presentation.trim())&&
   official.currency==='ARS'&&
   official.source_original_price!=null&&
   remote.price_list===official.source_original_price-4000&&
   remote.price_pickup===remote.price_list&&
   remote.source_original_price===official.source_original_price);
 const pickup=badLegacyTubePickup?official!.price_pickup:
   (corrected.price_pickup??corrected.price_list??official?.price_pickup??null);
 const delivery=corrected.price_delivery??
   ((corrected.currency||official?.currency||'ARS')==='ARS'&&
     isWholesalePresentation(corrected.presentation)&&pickup!=null
     ?pickup+1000:null);
 return {...corrected,price_pickup:pickup,price_delivery:delivery};
};

export const cleanCatalog2Title=(title:string)=>title
 .replace(" (la imagen dice Blue; texto incrustado dice Negra)","")
 .replace(" (imagen, página sin texto extraíble)","");

export const formatCatalogPrice=(value:number|null|undefined,currency:'ARS'|'USD'='ARS')=>{
 if(value===null||value===undefined||!Number.isFinite(value))return 'A confirmar';
 return new Intl.NumberFormat('es-AR',{
  style:'currency',currency,maximumFractionDigits:2,minimumFractionDigits:0
 }).format(value);
};
