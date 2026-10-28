'use client';
import {useCallback,useEffect,useState} from 'react';
import {getDb} from '@/lib/client';

type VerifiedProof={rating:string;count:number};
export default function SocialProof({placement}:{placement:'hero'|'video'}){
 const [proof,setProof]=useState<VerifiedProof|null>(null);
 const reload=useCallback(async()=>{
  const db=getDb();if(!db)return;
  const {data,error}=await db.from('site_settings').select('key,value').in('key',['proof_verified','proof_rating','proof_count']);
  if(error)return;
  const settings=Object.fromEntries((data||[]).map(row=>[row.key,row.value]));
  const rating=Number(settings.proof_rating),count=Number(settings.proof_count);
  if(settings.proof_verified==='true'&&settings.proof_count&&settings.proof_rating&&Number.isInteger(count)&&count>0&&rating>=1&&rating<=5){
   setProof({rating:rating.toFixed(1),count});
  }else setProof(null);
 },[]);
 useEffect(()=>{void reload();const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void reload()},30000);return()=>window.clearInterval(interval)},[reload]);
 if(!proof)return null;
 return <div className={'verified-proof verified-proof-'+placement}>
   <span className="verified-proof-stars" aria-label="Cinco estrellas gráficas">★★★★★</span>
   <strong>{proof.rating}/5</strong>
   <span>Más de {proof.count.toLocaleString('es-AR')} papeleras y distribuidores confían en nosotros</span>
 </div>;
}
