'use client';
import {useEffect,useState} from 'react';
import {getDb,getDbConfigIssue} from '@/lib/client';

export default function SorteosPersonal(){
 const [token,setToken]=useState('');
 const [ready,setReady]=useState(false);
 const [dni,setDni]=useState('');
 const [entered,setEntered]=useState(false);
 const [code,setCode]=useState('');
 const [recent,setRecent]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 useEffect(()=>{
  const params=new URLSearchParams(window.location.hash.slice(1));
  const raw=params.get('clave')||'';
  if(/^[0-9a-f]{64}$/.test(raw))setToken(raw);
  else setError('Este enlace de personal no tiene una clave válida. Pedí al encargado el enlace privado completo.');
  setReady(true);
 },[]);

 function begin(e:React.FormEvent){
  e.preventDefault();setError('');setNotice('');
  if(!/^\d{7,9}$/.test(dni)){
   setError('Ingresá un DNI válido de 7 a 9 números.');return;
  }
  if(!token){setError('El enlace privado es inválido. Pedí uno nuevo al encargado.');return;}
  setEntered(true);
 }

 async function generate(){
  if(!token||!/^\d{7,9}$/.test(dni)||busy)return;
  const db=getDb();
  if(!db){setError(getDbConfigIssue()||'No se pudo conectar con la base de datos.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error:rpcError}=await db.rpc('raffle_staff_issue_code',{
    p_token:token,p_employee_dni:dni
   });
   if(rpcError)throw rpcError;
   const issued=String(data||'');
   if(!/^\d{4}$/.test(issued))throw new Error('El servidor no devolvió un código de cuatro cifras.');
   setCode(issued);
   setRecent(v=>[issued,...v].slice(0,8));
   setNotice('Código generado y registrado. Entregalo al comprador.');
  }catch(err){
   const e=err as {code?:string;message?:string};
   setError(e?.code==='PGRST202'?
    'Falta instalar la actualización de Sorteos en Supabase. Avisá al administrador.':
    (e?.message||'No se pudo generar el código.'));
  }finally{setBusy(false);}
 }

 async function copy(){
  if(!code)return;
  try{await navigator.clipboard.writeText(code);setNotice('Código copiado.');}
  catch{setNotice('Seleccioná el código para copiarlo.');}
 }

 function print(){
  if(!/^\d{4}$/.test(code))return;
  const win=window.open('','_blank','width=450,height=500');
  if(!win){setError('Permití la ventana emergente para imprimir.');return;}
  win.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante MITOBICEL</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:35px}strong{font-size:20px}code{display:block;font-size:64px;letter-spacing:10px;font-weight:900;margin:35px 0}p{font-size:13px}</style></head><body><strong>MITOBICEL · SORTEOS</strong><p>Código de participación</p><code>'+code+'</code><p>Escaneá el QR general y registrá tu participación. De un solo uso.</p><script>window.print()<\/script></body></html>');
  win.document.close();
 }

 return <main className="raffle-staff-page">
  <div className="raffle-staff-shell">
   <header className="raffle-staff-header">
    <img src="/logo-mitobicel.png" alt="MITOBICEL"/>
    <div><span>PERSONAL MITOBICEL</span><h1>Generador de códigos</h1></div>
   </header>
   {!ready?<div className="raffle-staff-panel"><p>Preparando el generador…</p></div>:
    !token?<section className="raffle-staff-panel">
     <h2>Se necesita el enlace privado</h2>
     <p>Solicitá al encargado el enlace completo para emitir códigos de sorteos. No se necesita usuario ni contraseña.</p>
    </section>:
    !entered?<form className="raffle-staff-panel raffle-staff-login" onSubmit={begin}>
      <h2>Ingresá tu DNI</h2>
      <p>Este acceso es exclusivo para el personal que recibió el enlace privado. No hace falta crear cuenta, usar contraseña ni pedir autorización individual.</p>
      <label>DNI del empleado
       <input inputMode="numeric" autoComplete="off" pattern="[0-9]{7,9}" minLength={7} maxLength={9} required
        value={dni} onChange={e=>setDni(e.target.value.replace(/\D/g,'').slice(0,9))}
        placeholder="7 a 9 números"/>
      </label>
      <button className="raffle-staff-primary" type="submit">Entrar al generador</button>
      <p className="raffle-staff-info">El DNI no es una contraseña: la seguridad está en el enlace privado. Tu DNI se registra únicamente como huella digital no reversible en la auditoría de emisiones.</p>
    </form>:
    <section className="raffle-staff-panel raffle-staff-generator">
      <div className="raffle-staff-status"><span className="raffle-staff-status-dot"/> Enlace privado · Personal autorizado</div>
      <h2>Generá un código en un clic</h2>
      <p>Códigos únicos de cuatro números, registrados en Supabase. No necesitás pedir el DNI del comprador.</p>
      <div className="raffle-staff-code" aria-live="polite">{code||'····'}</div>
      <button className="raffle-staff-primary raffle-staff-big" type="button" disabled={busy} onClick={()=>void generate()}>
       {busy?'Generando…':'Generar código de 4 números'}
      </button>
      {code&&<div className="raffle-staff-actions">
       <button type="button" onClick={()=>void copy()}>Copiar código</button>
       <button type="button" onClick={print}>Imprimir</button>
      </div>}
      {recent.length>0&&<div className="raffle-staff-recent"><strong>Generados en esta sesión</strong><div>{recent.map((c,i)=><span key={c+'-'+i}>{c}</span>)}</div></div>}
      <div className="raffle-staff-actions raffle-staff-bottom">
       <button type="button" onClick={()=>{setEntered(false);setDni('');setCode('');setRecent([]);setError('');setNotice('');}}>Cambiar DNI del empleado</button>
      </div>
    </section>}
   {error&&<p className="raffle-staff-alert" role="alert">{error}</p>}
   {notice&&<p className="raffle-staff-notice" role="status">{notice}</p>}
   <p className="raffle-staff-footer">Solo para personal autorizado. No compartas ni publiques el enlace. El administrador puede revocarlo en cualquier momento.</p>
  </div>
 </main>;
}
