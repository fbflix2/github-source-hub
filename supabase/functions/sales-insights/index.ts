import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { salesData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um consultor de vendas especialista em negócios digitais (venda de perfis, BMs, páginas e proxies para Facebook/Meta Ads).

Analise os dados de vendas fornecidos e gere EXATAMENTE 4 insights/estratégias práticas e acionáveis para aumentar as vendas.

Regras:
- Seja direto, prático e específico para o contexto do negócio
- Cada insight deve ter: um emoji relevante, um título curto (máx 6 palavras), e uma descrição prática (máx 2 frases)
- Baseie-se nos padrões reais dos dados: categorias mais vendidas, frequência, margem, sazonalidade
- Use linguagem informal brasileira
- Responda SOMENTE com um JSON array válido, sem markdown, sem explicações extras

Formato de resposta (JSON array):
[
  { "emoji": "🔥", "title": "Título curto", "description": "Descrição prática da estratégia." },
  ...
]`;

    const userPrompt = `Dados de vendas do período:

Receita por categoria: ${JSON.stringify(salesData.categories)}
Evolução diária (últimos registros): ${JSON.stringify(salesData.chartData?.slice(-7))}
Total de unidades vendidas: ${salesData.totalUnitsSold}
Receita total: R$ ${salesData.totalRevenue?.toFixed(2)}
Custo total: R$ ${salesData.totalCost?.toFixed(2)}
Lucro líquido: R$ ${salesData.netProfit?.toFixed(2)}
Margem: ${salesData.margin}%
Ponto de equilíbrio: ${salesData.breakEvenUnits} unidades
Vendas realizadas: ${salesData.totalUnitsSold} unidades
Break-even atingido: ${salesData.breakEvenReached ? "Sim" : "Não"}
Custos fixos mensais: R$ ${salesData.fixedCosts?.toFixed(2)}
Lucro médio por unidade: R$ ${salesData.avgProfitPerUnit?.toFixed(2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON from the AI response
    let insights;
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      insights = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      insights = [];
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sales-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
