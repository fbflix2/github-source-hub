import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, LogOut, Send, RefreshCw } from "lucide-react";

type Order = { id:string; number:number; status:string; created_at:string };
const parse = (raw:string) => {
 const lines=raw.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const seenIds=new Set<string>(),seenLinks=new Set<string>();
 const items:{id:string;link:string}[]=[];const errors:string[]=[];
 lines.forEach((line,index)=>{
  const parts=line.split("|");
  if(parts.length!==2){errors.push(`Linha ${index+1}: use ID|LINK`);return;}
  const id=parts[0].trim(),link=parts[1].trim();
  if(!/^\d{8,25}$/.test(id)){errors.push(`Linha ${index+1}: ID inválido`);return;}
  let key="";
  try{const u=new URL(link);if(u.protocol!=="https:")throw Error();key=(u.origin+u.pathname.replace(/\/$/,"")).toLowerCase();}catch{errors.push(`Linha ${index+1}: link HTTPS inválido`);return;}
  if(seenIds.has(id)||seenLinks.has(key)){errors.push(`Linha ${index+1}: ID ou link repetido`);return;}
  seenIds.add(id);seenLinks.add(key);items.push({id,link});
 });
 if(items.length>500)errors.push("Máximo de 500 BMs por ordem");
 return {items,errors};
};
export default function BMFornecedorPortal(){
 const [session,setSession]=useState(false),[loading,setLoading]=useState(true);
 const [username,setUsername]=useState(""),[password,setPassword]=useState("");
 const [raw,setRaw]=useState(""),[orders,setOrders]=useState<Order[]>([]),[sending,setSending]=useState(false),[partner,setPartner]=useState(false);
 const result=useMemo(()=>parse(raw),[raw]);
 const refresh=async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setSession(false);setPartner(false);setLoading(false);return;}
  const {data:linked}=await supabase.from("bm_order_partners" as any).select("id").eq("user_id",user.id).eq("active",true).maybeSingle();
  setSession(true);setPartner(!!linked);
  if(linked){
   const {data,error}=await supabase.from("bm_supplier_orders" as any).select("id,number,status,created_at").order("created_at",{ascending:false}).limit(100);
   if(error)toast.error(error.message);else setOrders((data||[]) as unknown as Order[]);
  }
  setLoading(false);
 };
 useEffect(()=>{void refresh();const {data}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void refresh(),0)});return()=>data.subscription.unsubscribe()},[]);
 const login=async()=>{setLoading(true);const {error}=await supabase.auth.signInWithPassword({email:`${username.trim().toLowerCase()}@login.fbflix.com.br`,password});if(error){toast.error("Login ou senha inválidos");setLoading(false);}else{setPassword("");await refresh();}};
 const send=async()=>{
  if(!result.items.length||result.errors.length)return toast.error("Corrija as linhas antes de enviar");
  setSending(true);
  const {data,error}=await supabase.rpc("bm_supplier_submit" as any,{p_lines:result.items} as any);
  setSending(false);
  if(error){toast.error(error.message);return;}
  toast.success("Ordem enviada!");setRaw("");await refresh();
 };
 const copy=(s:string)=>navigator.clipboard.writeText(s).then(()=>toast.success("Copiado"));
 const box="rounded-xl border border-white/10 bg-[#121212] p-5";
 if(loading)return <main className="min-h-screen bg-[#080808] text-white p-10">Carregando...</main>;
 if(!session)return <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-4"><section className={box+" w-full max-w-md space-y-4"}><h1 className="text-2xl font-bold">Portal do Fornecedor · FBFLIX</h1><p className="text-sm text-white/50">Acesso exclusivo para envio de BMs</p><input className="w-full rounded-lg bg-black border border-white/20 p-3" type="text" autoComplete="username" placeholder="Nome de usuário" value={username} onChange={e=>setUsername(e.target.value)}/><input className="w-full rounded-lg bg-black border border-white/20 p-3" type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void login()}/><button onClick={login} className="w-full bg-red-600 rounded-lg p-3 font-semibold">Entrar</button></section></main>;
 if(!partner)return <main className="min-h-screen bg-[#080808] text-white p-10"><p>Este usuário não possui acesso ao portal de fornecedores.</p><button className="mt-4 underline" onClick={()=>supabase.auth.signOut()}>Sair</button></main>;
 return <main className="min-h-screen bg-[#080808] text-white p-4 md:p-10"><div className="max-w-5xl mx-auto space-y-6"><header className="flex justify-between items-center"><div><h1 className="text-2xl font-bold">Nova Ordem de Venda</h1><p className="text-sm text-white/50">Cole as BMs no formato ID|LINK, uma por linha</p></div><button className="flex gap-2 items-center text-sm text-white/70" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sair</button></header><section className={box+" space-y-4"}><p className="text-sm text-white/60">O número da ordem será gerado automaticamente ao enviar.</p><textarea className="w-full min-h-[280px] bg-black border border-white/20 rounded-lg p-4 font-mono text-sm outline-none focus:border-red-500" spellCheck={false} placeholder={"4419007325023647|https://business.facebook.com/...\n2286748615492234|https://business.facebook.com/..."} value={raw} onChange={e=>setRaw(e.target.value)}/><div className={`rounded-lg p-3 text-sm ${result.errors.length?"bg-red-900/20 text-red-300":"bg-emerald-900/20 text-emerald-300"}`}>{result.items.length} BMs válidas · {result.errors.length} erros{result.errors.slice(0,6).map((e,i)=><div key={i}>{e}</div>)}</div><div className="flex gap-3"><button className="rounded-lg border border-white/20 px-5 py-3" onClick={()=>setRaw("")}>Limpar</button><button disabled={sending||!result.items.length||!!result.errors.length} onClick={send} className="flex gap-2 items-center rounded-lg bg-red-600 px-6 py-3 font-semibold disabled:opacity-40"><Send size={16}/> Enviar Ordem</button></div></section><section className={box}><div className="flex justify-between items-center mb-4"><h2 className="font-semibold text-lg">Minhas Ordens</h2><button onClick={()=>void refresh()}><RefreshCw size={16}/></button></div><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-white/50 border-b border-white/10"><tr><th className="py-3">Pedido</th><th>Data</th><th>Status</th><th>Copiar</th></tr></thead><tbody>{orders.map(o=><tr key={o.id} className="border-b border-white/5"><td className="py-3">PED-{String(o.number).padStart(6,"0")}</td><td>{new Date(o.created_at).toLocaleString("pt-BR")}</td><td>{o.status}</td><td><button onClick={()=>void copy("PED-"+String(o.number).padStart(6,"0"))}><Copy size={15}/></button></td></tr>)}</tbody></table></div></section></div></main>;
}