import { createClient } from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return reply({error:"Método inválido"},405);
 try{
  const bearer=req.headers.get("Authorization")||"";
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const client=createClient(url,anon,{global:{headers:{Authorization:bearer}}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return reply({error:"Faça login como administrador"},401);
  const admin=createClient(url,service);
  const {data:allowed,error:roleError}=await admin.rpc("has_role",{_user_id:user.id,_role:"admin"});
  if(roleError||!allowed)return reply({error:"Acesso negado"},403);
  const body=await req.json();
  if(body.action==="reset_password"){
    const partnerId=String(body.partner_id||"");
    const newPassword=String(body.password||"");
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(partnerId)||newPassword.length<6)
      return reply({error:"Informe o parceiro e uma nova senha com no mínimo 6 caracteres"},400);
    const {data:partner,error:pError}=await admin.from("bm_order_partners").select("id,user_id,username,name").eq("id",partnerId).maybeSingle();
    if(pError||!partner)return reply({error:"Parceiro não encontrado"},404);
    const {error:updateError}=await admin.auth.admin.updateUserById(partner.user_id,{password:newPassword});
    if(updateError)return reply({error:updateError.message||"Falha ao redefinir senha"},400);
    return reply({ok:true,message:"Senha do parceiro redefinida com sucesso"});
  }
  if(body.action==="delete_partner"){
    const partnerId=String(body.partner_id||"");
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(partnerId))return reply({error:"Parceiro inválido"},400);
    const {data:partner,error:lookupError}=await admin.from("bm_order_partners").select("id,user_id,active").eq("id",partnerId).maybeSingle();
    if(lookupError||!partner)return reply({error:"Parceiro não encontrado"},404);
    if(!partner.active)return reply({error:"Parceiro já excluído"},409);
    const {error:banError}=await admin.auth.admin.updateUserById(partner.user_id,{ban_duration:"876000h"});
    if(banError)return reply({error:banError.message||"Falha ao bloquear acesso"},400);
    const {error:disableError}=await admin.from("bm_order_partners").update({active:false}).eq("id",partnerId);
    if(disableError){
      await admin.auth.admin.updateUserById(partner.user_id,{ban_duration:"none"});
      return reply({error:disableError.message},400);
    }
    return reply({ok:true,message:"Parceiro excluído do acesso; ordens preservadas"});
  }
  if(body.action!=="create")return reply({error:"Ação inválida"},400);
  const name=String(body.name||"").trim().slice(0,120);
  const username=String(body.username||"").trim().toLowerCase();
  const email=`${username}@login.fbflix.com.br`;
  const password=String(body.password||"");
  if(name.length<2||!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)||password.length<6)return reply({error:"Informe nome, usuário (3 a 40 caracteres, sem espaços) e senha de no mínimo 6 caracteres"},400);
  const {data:existing}=await admin.from("bm_order_partners").select("id").eq("username",username).maybeSingle();
  if(existing)return reply({error:"Nome de usuário já cadastrado"},409);
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
  if(createError||!created.user)return reply({error:createError?.message||"Falha ao criar usuário"},400);
  const {error:insertError}=await admin.from("bm_order_partners").insert({user_id:created.user.id,name,username});
  if(insertError){
   await admin.auth.admin.deleteUser(created.user.id);
   return reply({error:insertError.message},400);
  }
  return reply({ok:true,user_id:created.user.id});
 }catch(e){console.error("bm-supplier-access",e);return reply({error:"Falha interna"},500);}
});