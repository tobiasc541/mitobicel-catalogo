'use client';
import {useEffect,useState} from 'react';
import {getDb} from '@/lib/client';
const maps='https://www.google.com/maps/search/?api=1&query=Avenida+San+Martin+249+Burzaco+Buenos+Aires';
function countDown(iso:string,now:number){
 if(!iso)return '';
 const ms=new Date(iso).getTime()-now;
 if(!Number.isFinite(ms)||ms<=0)return '';
 const s=Math.floor(ms/1000);
 return [Math.floor(s/86400),Math.floor((s%86400)/3600),Math.floor((s%3600)/60),s%60].map((n,i)=>i===0?String(n):String(n).padStart(2,'0')).join(':');
}
export default function IndustrialBar(){
 const [deadline,setDeadline]=useState('');
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{
   setNow(Date.now());
   const tick=window.setInterval(()=>setNow(Date.now()),1000);
   const db=getDb();
   if(db)void db.from('site_settings').select('value').eq('key','promo_deadline').maybeSingle().then(({data})=>{if(data?.value)setDeadline(data.value);});
   return()=>clearInterval(tick);
 },[]);
 const remaining=now===null?'':countDown(deadline,now);
 return <div className="industrial-bar"><div className="wrap scoreboard-inner">
  <div className="scoreboard-plant"><span className="scoreboard-led" aria-hidden="true"/><strong>FÁBRICA DIRECTA · BURZACO</strong><span className="scoreboard-sep">/</span><span>Catálogo mayorista de MITOBICEL</span></div>
  <div className="scoreboard-tools">{remaining?<div className="scoreboard-timer"><span>VIGENCIA DE PROMO</span><strong>{remaining.split('').map((x,i)=><b key={i} className={x===':'?'timer-colon':'timer-digit'}>{x}</b>)}</strong></div>:<span className="scoreboard-stock">Promos semanales · Consultá disponibilidad</span>}<a href={maps} target="_blank" rel="noopener noreferrer" className="scoreboard-map">⌖ Av. San Martín 249, Burzaco <span>↗</span></a></div>
 </div></div>;
}
