import {createClient,type SupabaseClient} from '@supabase/supabase-js';

let browser:SupabaseClient|null=null;

function publicConfig(){
 const rawUrl=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()||'';
 const key=(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim()||'';
 if(!rawUrl)return {url:null,key,issue:'La URL pública de Supabase no está disponible en esta versión de la web. Confirmá que esté en Production y volvé a desplegar Vercel.'};
 if(!key)return {url:null,key,issue:'La clave pública de Supabase no está disponible en esta versión de la web. Confirmá que esté en Production y volvé a desplegar Vercel.'};
 if(key.startsWith('sb_secret_')||key.startsWith('service_role'))return {url:null,key:'',issue:'No utilices la clave secreta de Supabase en NEXT_PUBLIC_. Usá la publishable key.'};
 try{
  const parsed=new URL(rawUrl);
  if(parsed.protocol!=='https:'||!parsed.hostname||parsed.search||parsed.hash){
   return {url:null,key,issue:'La URL de Supabase debe empezar por https:// y no incluir parámetros.'};
  }
  if(parsed.hostname==='supabase.com'||parsed.hostname==='www.supabase.com'){
   return {url:null,key,issue:'Pegaste una dirección del dashboard. Copiá la Project URL de Supabase → Connect (https://TU-PROYECTO.supabase.co).'};
  }
  if(parsed.pathname!=='/' && !/^\/(rest|auth|storage)\/v1\/?$/.test(parsed.pathname)){
   return {url:null,key,issue:'La URL de Supabase tiene una ruta adicional. Usá solo la Project URL, sin /dashboard ni rutas internas.'};
  }
  return {url:parsed.origin,key,issue:null};
 }catch{
  return {url:null,key,issue:'La URL de Supabase no tiene un formato válido. Revisá que no incluya comillas ni espacios.'};
 }
}

export function getDbConfigIssue(){return publicConfig().issue;}
export function getDb(){
 const config=publicConfig();
 if(config.issue||!config.url)return null;
 if(!browser)browser=createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return browser;
}
