import { createClient } from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const paid=new Set(["completed","paid","approved","succeeded"]);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try {
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer=req.headers.get("Authorization")||"";
  if(!bearer.startsWith("Bearer ") && !req.headers.get("x-lauth-daily-secret"))return reply({error:"Authentication required"},401);
  const admin=createClient(url,service);
  const userClient=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:bearer}}});
  const body=await req.json();

  if(body.action==="daily-report"){
    const token=req.headers.get("x-lauth-daily-secret")||"";
    if(!/^[a-f0-9]{64}$/.test(token))return reply({error:"Unauthorized"},401);
    const {data:verified,error:verifyError}=await admin.rpc("verify_lauth_daily_report_secret",{p_secret:token});
    if(verifyError||verified!==true)return reply({error:"Unauthorized"},401);
    const now=new Date();
    const yesterday=new Date(now.getTime()-86400000);
    const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(yesterday);
    const start=new Date(date+"T03:00:00Z");
    const end=new Date(start.getTime()+86400000);
    const {data:orders,error:ordersError}=await admin.from("orders").select("id,code,status,created_at").gte("created_at",start.toISOString()).lt("created_at",end.toISOString()).eq("status","completed").limit(1000);
    if(ordersError)throw ordersError;
    const ids=(orders||[]).map(o=>o.id);
    let items:any[]=[];
    let payments:any[]=[];
    for(let i=0;i<ids.length;i+=100){
      const batch=ids.slice(i,i+100);
      const [it,pa]=await Promise.all([
        admin.from("order_items").select("id,order_id,name,delivery_data").in("order_id",batch),
        admin.from("payments").select("order_id,status").in("order_id",batch)
      ]);
      if(it.error||pa.error)throw it.error||pa.error;
      items.push(...(it.data||[]));payments.push(...(pa.data||[]));
    }
    const paidIds=new Set(payments.filter(p=>paid.has(String(p.status).toLowerCase())).map(p=>p.order_id));
    const orderMap=new Map((orders||[]).map(o=>[o.id,o]));
    const found=new Map<string,{id:string,order:string}>();
    for(const item of items){
      if(!paidIds.has(item.order_id))continue;
      const d=item.delivery_data||{};
      const profileIds=new Set<string>();
      for(const v of [d.idPerfil,d.lauthProfileId])if(typeof v==="string"&&/^\d{8,25}$/.test(v))profileIds.add(v);
      for(const file of Array.isArray(d.manualFiles)?d.manualFiles:[]){
        const match=String(file?.name||"").match(/^(\d{8,25})\.txt$/i);
        if(match)profileIds.add(match[1]);
      }
      for(const id of profileIds)found.set(item.order_id+":"+id,{id,order:orderMap.get(item.order_id)?.code||item.order_id});
    }
    const profiles=[...found.values()];
    const {error:claimError}=await admin.from("lauth_daily_reports").insert({report_date:date,status:"processing",profile_count:profiles.length});
    if(claimError){
      if(claimError.code==="23505")return reply({ok:true,skipped:"already_registered",date});
      throw claimError;
    }
    const message=[
      "*FBFLIX | RELATÓRIO DIÁRIO DE PERFIS*",
      "Vendas de "+date+" (00:00 às 23:59, Brasília)",
      "Perfis com pagamento confirmado: "+profiles.length,
      "",
      ...(profiles.length?profiles.map((p,i)=>(i+1)+". "+p.id+" | Pedido "+p.order):["Nenhum perfil vendido com pagamento confirmado neste dia."]),
      "",
      "Lauth: nenhuma movimentação automática. Aguardando sua aprovação."
    ].join("\n");
    try{
      const {data:result,error:sendError}=await admin.functions.invoke("wapi-send",{body:{action:"send-text",phone:"5519995081355",message,event_key:"lauth-daily-report:"+date,metadata:{source:"lauth-daily-report",date,profile_count:profiles.length}}});
      if(sendError||!result||result.success!==true)throw new Error(String(sendError?.message||result?.error||"WAPI did not confirm sending"));
      await admin.from("lauth_daily_reports").update({status:"sent",sent_at:new Date().toISOString()}).eq("report_date",date);
      return reply({ok:true,sent:true,date,count:profiles.length});
    }catch(e){
      await admin.from("lauth_daily_reports").update({status:"failed",error:String(e).slice(0,500)}).eq("report_date",date);
      return reply({error:"WhatsApp send failed",date},502);
    }
  }


  if(body.action==="auto-order" && bearer==="Bearer "+service){
    const orderId=String(body.order_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(orderId))return reply({error:"Invalid order"},400);
    const {data:settings,error:settingsError}=await admin.from("lauth_automation_settings").select("alerts_enabled,movement_requires_approval").eq("id",1).single();
    if(settingsError)throw settingsError;
    if(!settings.alerts_enabled)return reply({ok:true,skipped:"disabled"});
    if(!settings.movement_requires_approval)return reply({error:"Manual approval required"},409);
    const {data:order,error:orderError}=await admin.from("orders").select("id,code,status").eq("id",orderId).single();
    if(orderError||!order)return reply({error:"Order not found"},404);
    if(order.status!=="completed")return reply({ok:true,skipped:"not_completed"});
    const {data:payments,error:paymentError}=await admin.from("payments").select("status").eq("order_id",orderId);
    if(paymentError)throw paymentError;
    if(!(payments||[]).some(p=>paid.has(String(p.status).toLowerCase())))return reply({ok:true,skipped:"not_paid"});
    const {data:items,error:itemError}=await admin.from("order_items").select("id,name,delivery_data").eq("order_id",orderId);
    if(itemError)throw itemError;
    const ids=new Set<string>();
    for(const item of items||[]){
      const d=item.delivery_data||{};
      for(const v of [d.idPerfil,d.lauthProfileId])if(typeof v==="string"&&/^\d{8,25}$/.test(v))ids.add(v);
      for(const file of Array.isArray(d.manualFiles)?d.manualFiles:[]){
        const match=String(file?.name||"").match(/^(\d{8,25})\.txt$/i);
        if(match)ids.add(match[1]);
      }
    }
    if(!ids.size)return reply({ok:true,skipped:"no_profile_ids"});
    const {error:claimError}=await admin.from("lauth_auto_alerts").insert({order_id:orderId,status:"processing",profile_ids:[...ids]});
    if(claimError){
      if(claimError.code==="23505")return reply({ok:true,skipped:"already_registered"});
      throw claimError;
    }
    const message=["*FBFLIX | VENDA CONFIRMADA*","Pedido: "+order.code,"Perfis pagos: "+ids.size,"",...[...ids].map((v,i)=>(i+1)+". ID: "+v),"","Movimentação Lauth: aguardando aprovação.","LOJA FBFLIX → VENDIDOS 2026 (não movimentado)."].join("\n");
    try{
      const {data:result,error:sendError}=await admin.functions.invoke("wapi-send",{body:{action:"send-text",phone:"5519995081355",message,event_key:"lauth-auto-order:"+orderId,metadata:{source:"lauth-auto-order",order_id:orderId,profile_ids:[...ids]}}});
      if(sendError||!result||result.success===false||result.error)throw new Error(String(sendError?.message||result?.error||"Provider error"));
      await admin.from("lauth_auto_alerts").update({status:"sent",sent_at:new Date().toISOString()}).eq("order_id",orderId);
      return reply({ok:true,sent:true,count:ids.size});
    }catch(sendFailure){
      await admin.from("lauth_auto_alerts").update({status:"failed",error:String(sendFailure).slice(0,500)}).eq("order_id",orderId);
      return reply({error:"Alert delivery failed"},502);
    }
  }
  const {data:{user},error:authError}=await userClient.auth.getUser();
  if(authError||!user)return reply({error:"Invalid session"},401);
  const {data:isAdmin,error:roleError}=await admin.rpc("has_role",{_user_id:user.id,_role:"admin"});
  if(roleError||!isAdmin)return reply({error:"Admin only"},403);
  if(body.action==="settings"){
    const {data:settings,error}=await admin.from("lauth_automation_settings").select("alerts_enabled,movement_requires_approval").eq("id",1).single();
    if(error)throw error;
    return reply({ok:true,settings});
  }
  if(!["preview","send"].includes(body.action))return reply({error:"Invalid action"},400);
  const date=String(body.date||"2026-11-03");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return reply({error:"Invalid date"},400);
  const start=new Date(date+"T03:00:00Z"),end=new Date(start.getTime()+86400000);
  const {data:orders,error:orderError}=await admin.from("orders").select("id,code,status,created_at").gte("created_at",start.toISOString()).lt("created_at",end.toISOString()).eq("status","completed").limit(500);
  if(orderError)throw orderError;
  const orderIds=(orders||[]).map(o=>o.id);
  if(!orderIds.length)return reply({ok:true,profiles:[],sent:false});
  const [{data:items,error:itemError},{data:payments,error:paymentError}]=await Promise.all([
   admin.from("order_items").select("id,order_id,name,delivery_data").in("order_id",orderIds),
   admin.from("payments").select("order_id,status").in("order_id",orderIds)
  ]);
  if(itemError||paymentError)throw itemError||paymentError;
  const paidIds=new Set((payments||[]).filter(p=>paid.has(String(p.status).toLowerCase())).map(p=>p.order_id));
  const orderMap=new Map((orders||[]).map(o=>[o.id,o]));
  const profiles=[];
  for(const item of items||[]){
   if(!paidIds.has(item.order_id))continue;
   const d=item.delivery_data||{};
   const ids=new Set<string>();
   for(const v of [d.idPerfil,d.lauthProfileId]){
    if(typeof v==="string"&&/^\d{8,25}$/.test(v))ids.add(v);
   }
   for(const file of Array.isArray(d.manualFiles)?d.manualFiles:[]){
    const filename=String(file?.name||"");
    const match=filename.match(/^(\d{8,25})\.txt$/i);
    if(match)ids.add(match[1]);
   }
   for(const id of ids)profiles.push({order:orderMap.get(item.order_id)?.code,profile_id:id,item_id:item.id,product:item.name});
  }
  const unique=[...new Map(profiles.map(p=>[p.order+":"+p.profile_id,p])).values()];
  const eventKey="lauth-sale-alert:"+date;
  const {data:existing,error:logError}=await admin.from("whatsapp_logs").select("id,status").eq("event_key",eventKey).limit(1);
  if(logError)throw logError;
  if(body.action==="preview")return reply({ok:true,date,profiles:unique,already_sent:(existing||[]).length>0});
  if((existing||[]).length)return reply({error:"Alert already registered",already_sent:true},409);
  if(!unique.length)return reply({error:"No confirmed paid profiles"},409);
  const message=["*FBFLIX | PERFIS VENDIDOS*","Data: "+date,"Perfis com pagamento confirmado: "+unique.length,"",...unique.map((p,i)=>`${i+1}. ID: ${p.profile_id} | Pedido: ${p.order}`),"","Aguardando sua aprovação para mover no Lauth: LOJA FBFLIX → VENDIDOS 2026.","Nenhum perfil foi movido."].join("\n");
  const {data:result,error:sendError}=await admin.functions.invoke("wapi-send",{body:{action:"send-text",phone:"5519995081355",message,event_key:eventKey,metadata:{source:"lauth-sale-alert",date,profile_ids:unique.map(p=>p.profile_id)}}});
  if(sendError||!result||result.success===false||result.error)return reply({error:"WhatsApp delivery request failed",details:String(sendError?.message||result?.error||"provider error")},502);
  return reply({ok:true,sent:true,count:unique.length,provider:result});
 }catch(e){console.error("lauth-sold-alert",e);return reply({error:"Internal error"},500)}
});