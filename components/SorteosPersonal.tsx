'use client';
import {useCallback,useEffect,useState} from 'react';
import {getDb,getDbConfigIssue} from '@/lib/client';

type ActiveCampaign={id:string;period:string;title:string;starts_at:string;ends_at:string};

export default function SorteosPersonal(){
 const [checking,setChecking]=useState(true);
 const [signedIn,setSignedIn]=useState(false),[allowed,setAllowed]=useState(false);
 const [registerMode,setRegisterMode]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [campaign,setCampaign]=useState<ActiveCampaign|null>(null);
 const [code,setCode]=useState(''),[recent,setRecent]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');

 const refresh=useCallback(async()=>{
  const db=getDb();
  if(!db){setError(getDbConfigIssue()||'No se pudo conectar con Supabase.');setChecking(false);return;}
  setChecking(true);
  try{
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user){setSignedIn(false);setAllowed(false);setCampaign(null);return;}
   setSignedIn(true);
   const {data:permission,error:permError}=await db.rpc('raffle_code_operator_authorized');
   if(permError){
    setAllowed(false);
    setError(permError.code==='PGRST202'?
     'Falta instalar la actualización SQL de Sorteos en Supabase. Avisá al administrador.':
     'No se pudieron validar tus permisos: '+permError.message);
    return;
   }
   const access=permission===true;
   setAllowed(access);
   if(!access){setCampaign(null);return;}
   const {data:rows,error:campaignError}=await db.from('raffle_campaigns')
    .select('id,period,title,starts_at,ends_at')
    .eq('status','live').order('period',{ascending:false}).limit(12);
   if(campaignError)throw campaignError;
   const now=Date.now();
   setCampaign(((rows||[]) as ActiveCampaign[]).find(c=>
    now>=new Date(c.starts_at).getTime()&&now<=new Date(c.ends_at).getTime())||null);
  }catch(err){
   setError(err instanceof Error?err.message:'No se pudo consultar la edición.');
  }finally{setChecking(false);}
 },[]);

 useEffect(()=>{void refresh();},[refresh]);

 async function submitLogin(e:React.FormEvent){
  e.preventDefault();const db=getDb();if(!db||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(registerMode){
    const {data,error:signupError}=await db.auth.signUp({email:email.trim(),password});
    if(signupError)throw signupError;
    setNotice(data.session?
     'Cuenta creada. Pedile al administrador que habilite este correo para generar códigos.':
     'Revisá tu correo para confirmar la cuenta. Después, el administrador podrá habilitarte.');
    setRegisterMode(false);setPassword('');
   }else{
    const {error:loginError}=await db.auth.signInWithPassword({email:email.trim(),password});
    if(loginError)throw loginError;
    setPassword('');
    await refresh();
   }
  }catch(err){
   setError(err instanceof Error?err.message:'No se pudo ingresar.');
  }finally{setBusy(false);}
 }

 async function logout(){
  const db=getDb();if(!db)return;
  await db.auth.signOut();
  setSignedIn(false);setAllowed(false);setCampaign(null);setCode('');setRecent([]);setError('');setNotice('');
 }

 async function generate(){
  const db=getDb();if(!db||busy||!allowed||!campaign)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error:issueError}=await db.rpc('raffle_issue_purchase_code',{p_campaign_id:campaign.id});
   if(issueError)throw issueError;
   const next=String(data||'');
   if(!/^\d{4}$/.test(next))throw new Error('El servidor no devolvió un código válido.');
   setCode(next);
   setRecent(previous=>[next,...previous].slice(0,8));
   setNotice('Código guardado correctamente. Entregalo al participante.');
  }catch(err){
   const e=err as {code?:string;message?:string};
   setError(e?.code==='PGRST202'?
    'El generador todavía no está instalado en la base de datos. El administrador debe aplicar la actualización SQL.':
    (e?.message||'No se pudo generar el código.'));
  }finally{setBusy(false);}
 }

 async function copy(){
  if(!code)return;
  try{await navigator.clipboard.writeText(code);setNotice('Código copiado.');}
  catch{setNotice('Seleccioná los cuatro números para copiarlos.');}
 }

 function print(){
  if(!/^\d{4}$/.test(code))return;
  const win=window.open('','_blank','width=450,height=500');
  if(!win){setError('Permití las ventanas emergentes para imprimir.');return;}
  win.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante Sorteos MITOBICEL</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:35px}strong{font-size:20px}code{display:block;font-size:64px;letter-spacing:10px;font-weight:900;margin:35px 0}p{font-size:13px}</style></head><body><strong>MITOBICEL · SORTEOS</strong><p>Tu código de participación</p><code>'+code+'</code><p>Ingresalo en el QR general del comercio. De un solo uso.</p><script>window.print()<\/script></body></html>');
  win.document.close();
 }

 return <main className="raffle-staff-page">
  <div className="raffle-staff-shell">
   <header className="raffle-staff-header">
    <img src="/logo-mitobicel.png" alt="MITOBICEL"/>
    <div><span>PERSONAL AUTORIZADO</span><h1>Generador de códigos</h1></div>
   </header>
   {checking?<div className="raffle-staff-panel"><p>Verificando acceso…</p></div>:
    !signedIn?
     <form className="raffle-staff-panel raffle-staff-login" onSubmit={e=>void submitLogin(e)}>
      <h2>{registerMode?'Crear acceso de empleado':'Ingresar como empleado'}</h2>
      <p>Este acceso es independiente del superadministrador. El empleado solamente podrá emitir códigos una vez habilitado.</p>
      <label>Correo del empleado<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Contraseña propia<input type="password" required minLength={6} autoComplete={registerMode?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="raffle-staff-primary" type="submit" disabled={busy}>{busy?'Procesando…':registerMode?'Crear cuenta':'Ingresar'}</button>
      <button type="button" className="raffle-staff-text" onClick={()=>{setRegisterMode(!registerMode);setError('');}}>
       {registerMode?'Ya tengo cuenta':'Primera vez: crear mi cuenta'}
      </button>
     </form>:
    !allowed?
     <section className="raffle-staff-panel">
      <h2>Cuenta pendiente de autorización</h2>
      <p>Tu usuario está conectado, pero todavía no tiene permiso para emitir códigos. Pedile al superadministrador que habilite tu correo en el Centro de Sorteos.</p>
      <div className="raffle-staff-actions"><button onClick={()=>{setError('');void refresh();}}>Verificar acceso</button><button onClick={()=>void logout()}>Salir</button></div>
     </section>:
     <section className="raffle-staff-panel raffle-staff-generator">
      <div className="raffle-staff-status"><span className="raffle-staff-status-dot"/> Acceso de empleado habilitado</div>
      <h2>{campaign?'Generá un código en un clic':'No hay inscripciones abiertas'}</h2>
      <p>{campaign?'Edición '+campaign.period+' · Sin pedir DNI ni datos al comprador. Cada código es de un solo uso.':
       'El administrador tiene que publicar una edición y habilitar su período de inscripción.'}</p>
      <div className="raffle-staff-code" aria-live="polite">{code||'····'}</div>
      <button type="button" className="raffle-staff-primary raffle-staff-big" onClick={()=>void generate()} disabled={!campaign||busy}>
       {busy?'Generando…':'Generar código de 4 números'}
      </button>
      {code&&<div className="raffle-staff-actions"><button type="button" onClick={()=>void copy()}>Copiar código</button><button type="button" onClick={print}>Imprimir</button></div>}
      {recent.length>0&&<div className="raffle-staff-recent"><strong>Generados en esta sesión</strong><div>{recent.map((c,i)=><span key={c+'-'+i}>{c}</span>)}</div></div>}
      <div className="raffle-staff-actions raffle-staff-bottom"><button type="button" onClick={()=>{setError('');void refresh();}}>Actualizar edición</button><button type="button" onClick={()=>void logout()}>Cerrar sesión</button></div>
     </section>}
   {error&&<p role="alert" className="raffle-staff-alert">{error}</p>}
   {notice&&<p role="status" className="raffle-staff-notice">{notice}</p>}
   <p className="raffle-staff-footer">Solo para personal de MITOBICEL autorizado. Los códigos se registran en la base de datos, no se generan localmente.</p>
  </div>
 </main>;
}
