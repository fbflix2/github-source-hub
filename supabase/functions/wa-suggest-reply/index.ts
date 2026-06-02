import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin","moderator"]).maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Acesso restrito à equipe" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone, tone } = await req.json();
    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ error: "phone obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msgs } = await supabase
      .from("whatsapp_messages")
      .select("direction, body, message_type, created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(15);

    const history = (msgs || []).reverse().map((m: any) => {
      const who = m.direction === "in" ? "Cliente" : "Atendente";
      const txt = m.body || `[${m.message_type}]`;
      return `${who}: ${txt}`;
    }).join("\n");

    const systemPrompt = `Você é um atendente de suporte da FBFlix, empresa que vende perfis, BMs, páginas e proxies para Facebook Ads.
Gere UMA sugestão de resposta curta, cordial e objetiva em português brasileiro para a próxima mensagem do atendente.
Tom: ${tone || "profissional e amigável"}.
Regras:
- Não invente informações de pedidos, prazos ou preços que não estejam no histórico.
- Se faltar contexto, peça gentilmente a informação necessária.
- Máximo 3 frases. Sem emojis exagerados. Sem markdown.
- Responda apenas com o texto da mensagem, sem aspas nem prefixos.`;

    const userPrompt = `Histórico da conversa (mais recente por último):\n\n${history || "(sem histórico)"}\n\nGere a próxima resposta do atendente.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de IA atingido, tente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const suggestion = (data.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wa-suggest-reply error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});