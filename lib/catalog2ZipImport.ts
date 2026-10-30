/** Small, dependency-free ZIP reader for the MITOBICEL 4K bundle.
 * The supplied ZIP stores the PNG files without recompression (ZIP method 0).
 * Deflated entries are supported on browsers exposing deflate-raw.
 * Reads slices; never holds the entire ~200 MB ZIP in memory.
 */
export type ZipEntry={name:string;method:number;compressed:number;uncompressed:number;offset:number};
export type Catalog2ImageMapping={
 categoria_num:string;nombre_archivo:string;revision:'LISTO'|'REVISAR';observaciones:string
};
export type Catalog2Bundle={file:File;entries:Map<string,ZipEntry>;mapping:Catalog2ImageMapping[]};
const decode=new TextDecoder('utf-8');
const u16=(v:DataView,pos:number)=>v.getUint16(pos,true);
const u32=(v:DataView,pos:number)=>v.getUint32(pos,true);

export async function inspectCatalog2Zip(file:File):Promise<Catalog2Bundle>{
 if(!/\.zip$/i.test(file.name))throw Error('Seleccioná el archivo ZIP de imágenes de MITOBICEL.');
 const trailerLength=Math.min(file.size,65557);
 const trailer=new DataView(await file.slice(file.size-trailerLength).arrayBuffer());
 let eocd=-1;
 for(let i=trailer.byteLength-22;i>=0;i--){
  if(u32(trailer,i)===0x06054b50){eocd=i;break;}
 }
 if(eocd===-1)throw Error('No encontré el directorio del ZIP. Volvé a descargar el paquete completo.');
 const centralLength=u32(trailer,eocd+12),centralOffset=u32(trailer,eocd+16);
 const totalEntries=u16(trailer,eocd+10);
 if(totalEntries>2000||centralLength>10000000||centralOffset+centralLength>file.size)throw Error('ZIP no compatible o dañado.');
 const bytes=await file.slice(centralOffset,centralOffset+centralLength).arrayBuffer();
 const view=new DataView(bytes),entries=new Map<string,ZipEntry>();
 let pos=0;
 for(let i=0;i<totalEntries;i++){
  if(pos+46>view.byteLength||u32(view,pos)!==0x02014b50)throw Error('Directorio de imágenes incompleto.');
  const filenameLength=u16(view,pos+28),extraLength=u16(view,pos+30),commentLength=u16(view,pos+32);
  const end=pos+46+filenameLength+extraLength+commentLength;
  if(end>view.byteLength)throw Error('Archivo ZIP inconsistente.');
  const name=decode.decode(new Uint8Array(bytes,pos+46,filenameLength));
  const entry={name,method:u16(view,pos+10),compressed:u32(view,pos+20),
   uncompressed:u32(view,pos+24),offset:u32(view,pos+42)};
  if(entry.compressed>30000000||entry.uncompressed>30000000)throw Error('Imagen demasiado grande dentro del ZIP.');
  entries.set(name,entry);
  pos=end;
 }
 const index=entries.get('mapeo_categorias_cat2.json');
 if(!index)throw Error('No encontré mapeo_categorias_cat2.json. Usá el ZIP completo del Catálogo 2.');
 const mapped=JSON.parse(decode.decode(await readZipEntry(file,index))) as Catalog2ImageMapping[];
 if(!Array.isArray(mapped)||mapped.length!==53||mapped.some(m=>
  !/^\d{2}$/.test(m.categoria_num)||!/^[\w.-]+\.png$/i.test(m.nombre_archivo)||
  !entries.has('png/'+m.nombre_archivo)))
  throw Error('El mapa de imágenes no coincide con este ZIP.');
 return {file,entries,mapping:mapped};
}
export async function readZipEntry(file:File,entry:ZipEntry):Promise<Uint8Array>{
 const header=new DataView(await file.slice(entry.offset,entry.offset+30).arrayBuffer());
 if(header.byteLength!==30||u32(header,0)!==0x04034b50)throw Error('Encabezado ZIP inválido: '+entry.name);
 const begin=entry.offset+30+u16(header,26)+u16(header,28);
 const payload=file.slice(begin,begin+entry.compressed);
 if(entry.method===0)return new Uint8Array(await payload.arrayBuffer());
 if(entry.method===8){
  if(typeof DecompressionStream==='undefined')throw Error('Tu navegador no admite este ZIP comprimido.');
  const unzipped=payload.stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(unzipped).arrayBuffer());
 }
 throw Error('Tipo de compresión no admitido en '+entry.name);
}
/** Transparent WebP 1800px, suitable for fast catalog cards; 4K PNG remains in ZIP. */
export async function optimizeProductImage(raw:Uint8Array):Promise<Blob>{
 const source=new Blob([raw as BlobPart],{type:'image/png'});
 const picture=await createImageBitmap(source);
 try{
  const width=Math.min(1800,picture.width),height=Math.max(1,Math.round(picture.height*width/picture.width));
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('No se pudo procesar la imagen en este navegador.');
  ctx.drawImage(picture,0,0,width,height);
  const result=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.9));
  if(!result||result.type!=='image/webp')throw Error('Este navegador no admite imágenes WebP.');
  if(result.size>3*1024*1024)throw Error('Imagen demasiado pesada después de optimizar.');
  return result;
 }finally{picture.close();}
}
