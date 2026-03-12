import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Retry up to 2 times since image generation can intermittently fail
    let imageUrl: string | undefined;
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `Generate a professional product image for an e-commerce store. The product is: ${prompt}. Make it clean, modern, with a dark background suitable for a tech/digital products store. High quality, centered composition. Only generate the image, no text needed.`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes para gerar imagem." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error(`AI gateway error (attempt ${attempt + 1}):`, response.status, t);
        lastError = `AI gateway error: ${response.status}`;
        continue;
      }

      const data = await response.json();
      console.log(`Attempt ${attempt + 1} response keys:`, JSON.stringify(Object.keys(data)));
      console.log(`Attempt ${attempt + 1} choices structure:`, JSON.stringify({
        hasChoices: !!data.choices,
        choicesLen: data.choices?.length,
        messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
        imagesLen: data.choices?.[0]?.message?.images?.length,
      }));

      imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (imageUrl) break;
      
      lastError = "Model did not return an image";
      console.warn(`Attempt ${attempt + 1}: no image in response, retrying...`);
    }

    if (!imageUrl) {
      throw new Error(lastError || "No image was generated after retries");
    }

    return new Response(JSON.stringify({ image_url: imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-product-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
