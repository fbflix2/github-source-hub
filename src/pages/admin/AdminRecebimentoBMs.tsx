import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink, RefreshCw, Save, UserPlus } from "lucide-react";
type Partner={id:string;name:string;user_id:string;active:boolean};
type Order={id:string;number:number;partner_id:string;created_at:string;status:string};
type BM={id:string;order_id:string;bm_id:string;bm_link:string;profile:string;status:string;notes:string;amount:number|null;created_at:string};
const money=(v:number|null)=>v===null?"—":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=(v:string)=>new Date(v).toLocaleDateString("pt-BR");
export default function AdminRecebimentoBMs(){
 const [partners,setPartners]=useState<Partner[]>([]),[orders,setOrders]=useState<Order[]>([]),[items,setItems]=useState<BM[]>([]);
 const [loading,setLoading]=useState(true),[search,setSearch]=useState(""),[orderId,setOrderId]=useState("all");
 const [name,setName]=useState(""),[password,setPassword]=useState(""),[creating,setCreating]=useState(false);
 const load=async()=>{
  setLoading(true);
  const [p,o,i]=await Promise.all([
   supabase.from("bm_order_partners" as any).select("id,name,user_id,active").order("created_at",{ascending:false}),
   supabase.from("bm_supplier_orders" as any).select("id,number,partner_id,status,created_at").order("created_at",{ascending:false}).limit(500),
   supabase.from("bm_supplier_order_items" as any).select("id,order_id,bm_id,bm_link,profile,status,notes,amount,created_at").order("created_at",{ascending:false}).limit(2000)
  ]);
  if(p.error||o.error||i.error)toast.error(p.error?.message||o.error?.message||i.error?.message||"Erro ao carregar");
  setPartners((p.data||[]) as unknown as Partner[]);setOrders((o.data||[]) as unknown as Order[]);setItems((i.data||[]) as unknown as BM[]);
  setLoading(false);
 };
 useEffect(()=>{void load()},[]);
 const create=async()=>{
  const username=name.trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))return toast.error("O nome de acesso precisa ter 3 a 40 caracteres, sem espaços ou acentos.");
  if(password.length<6)return toast.error("A senha precisa ter pelo menos 6 caracteres.");
  setCreating(true);
  try {
    const {data,error}=await supabase.functions.invoke("bm-supplier-access",{body:{action:"create",name,username,password}});
    if(error){
      let message=error.message;
      const response=(error as {context?: Response}).context;
      if(response && typeof response.json==="function"){
        try { const details=await response.json(); message=details?.error||details?.message||message; } catch { /* Preserve the original error */ }
      }
      toast.error(message);return;
    }
    if(data?.error){toast.error(data.error);return;}
  } catch(e) {
    toast.error(e instanceof Error?e.message:"Erro ao criar acesso");return;
  } finally {setCreating(false);}

  toast.success("Parceiro cadastrado");setName("");setPassword("");await load();
 };
 const visible=useMemo(()=>items.filter(i=>{
  const order=orders.find(o=>o.id===i.order_id);
  const partner=partners.find(p=>p.id===order?.partner_id);
  const q=search.toLowerCase();
  return (orderId==="all"||i.order_id===orderId)&&[i.bm_id,i.bm_link,i.profile,i.status,i.notes,partner?.name||"",String(order?.number||"")].some(v=>v.toLowerCase().includes(q));
 }),[items,orders,partners,search,orderId]);
 const save=async(item:BM)=>{
  const {error}=await supabase.rpc("bm_supplier_admin_update" as any,{p_item:item.id,p_profile:item.profile,p_status:item.status,p_notes:item.notes,p_amount:item.amount} as any);
  if(error)toast.error(error.message);else toast.success("BM atualizada");
 };
 const update=(id:string,key:keyof BM,value:string)=>setItems(current=>current.map(i=>i.id===id?{...i,[key]:key==="amount"?(value===""?null:Number(value)):value}:i));
 const copy=(value:string)=>navigator.clipboard.writeText(value).then(()=>toast.success("Copiado"));
 const input="bg-black border border-white/15 rounded-md p-2 text-xs text-white w-full min-w-[90px]";
 return <div className="space-y-5 py-6 text-white"><header className="flex flex-wrap justify-between gap-3 items-center"><div><h1 className="text-2xl font-bold">Recebimento de BMs · Fornecedor</h1><p className="text-sm text-white/50">Ordens recebidas de parceiros e conferência de BMs</p></div><button onClick={()=>void load()} className="flex gap-2 items-center border border-white/15 rounded-lg p-2 text-sm"><RefreshCw size={16}/> Atualizar</button></header>
 <section className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3"><h2 className="font-semibold flex items-center gap-2"><UserPlus size={18}/> Criar acesso para parceiro</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><input className={input} placeholder="Nome de acesso do parceiro" value={name} onChange={e=>setName(e.target.value)}/><input className={input} type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={create} disabled={creating} className="bg-red-600 rounded-lg p-2 text-sm font-semibold disabled:opacity-40">Criar acesso</button></div><p className="text-xs text-white/50">Portal do parceiro: <a className="underline" href="/fornecedor-bms" target="_blank" rel="noreferrer">/fornecedor-bms <ExternalLink size={12} className="inline"/></a> · Cada parceiro vê somente suas ordens.</p></section>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["BMs recebidas",items.length],["Ordens",orders.length],["Parceiros",partners.length],["Com perfil",items.filter(i=>i.profile.trim()).length]].map(([label,value])=><div key={String(label)} className="border border-white/10 rounded-xl bg-black/40 p-4"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-white/50">{label}</div></div>)}</div>
 <section className="border border-white/10 rounded-xl bg-black/40 p-4"><h2 className="font-semibold mb-3">Ordens recebidas</h2><div className="flex flex-wrap gap-2">{orders.map(o=><button key={o.id} onClick={()=>setOrderId(o.id)} className={`text-xs px-3 py-2 rounded-lg border ${orderId===o.id?"border-red-500 bg-red-500/10":"border-white/10"}`}>PED-{String(o.number).padStart(6,"0")} · {partners.find(p=>p.id===o.partner_id)?.name||"Parceiro"} · {date(o.created_at)}</button>)}<button onClick={()=>setOrderId("all")} className="text-xs px-3 py-2 rounded-lg border border-white/10">Todas</button></div></section>
 <section className="border border-white/10 rounded-xl bg-black/40 p-4 space-y-3"><div className="flex justify-between items-center gap-3"><h2 className="font-semibold">BMs recebidas ({visible.length})</h2><input className={input+" max-w-sm"} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar ID, link, pedido ou perfil..."/></div><div className="overflow-x-auto"><table className="w-full text-xs text-left whitespace-nowrap"><thead className="text-white/50 border-b border-white/10"><tr>{["DATA","VALOR","ID","LINK","PERFIL","STATUS","OBSERVAÇÃO","SALVAR"].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(i=><tr key={i.id} className="border-b border-white/10"><td className="p-2">{date(i.created_at)}</td><td className="p-2"><input aria-label="Valor" className={input+" w-28"} type="number" min="0" step=".01" placeholder="R$" value={i.amount??""} onChange={e=>update(i.id,"amount",e.target.value)}/></td><td className="p-2"><span className="font-mono">{i.bm_id}</span><button className="ml-2" title="Copiar ID" onClick={()=>void copy(i.bm_id)}><Copy size={14}/></button></td><td className="p-2"><button title="Copiar link" onClick={()=>void copy(i.bm_link)}><Copy size={15}/></button><a className="ml-2 text-blue-400" href={i.bm_link} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} className="inline"/></a></td><td className="p-2"><input className={input+" w-36"} value={i.profile} onChange={e=>update(i.id,"profile",e.target.value)} placeholder="Perfil"/></td><td className="p-2"><select className={input+" w-36"} value={i.status} onChange={e=>update(i.id,"status",e.target.value)}>{["recebida","em análise","no perfil","vendida","remover","cancelada"].map(s=><option key={s}>{s}</option>)}</select></td><td className="p-2"><input className={input+" w-48"} value={i.notes} onChange={e=>update(i.id,"notes",e.target.value)} placeholder="Observações"/></td><td className="p-2"><button title="Salvar" onClick={()=>void save(i)} className="text-emerald-400"><Save size={17}/></button></td></tr>)}</tbody></table>{!loading&&!visible.length&&<p className="text-center text-sm text-white/50 p-8">Nenhuma BM encontrada</p>}</div></section></div>;
}