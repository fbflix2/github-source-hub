import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { proxy, is_rotating } = await req.json();
    if (!proxy || typeof proxy !== "string") {
      return new Response(JSON.stringify({ error: "Proxy string is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts = proxy.trim().split(":");
    if (parts.length < 2) {
      return new Response(JSON.stringify({ error: "Formato inválido. Use host:porta:usuario:senha" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For rotating proxies, test all endpoint variants
    if (is_rotating) {
      const host = parts[0];
      const username = parts[2] || "";
      const password = parts[3] || "";

      // Resolve converted host
      let convertedHost: string | null = null;
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        try {
          const dnsResp = await fetch(`https://dns.google/resolve?name=${host}&type=A`);
          const dnsData = await dnsResp.json();
          const answers = Array.isArray(dnsData?.Answer) ? dnsData.Answer : [];
          convertedHost = answers.find((a: any) => a?.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(a?.data || ""))?.data ?? null;
        } catch {}
      }

      const endpoints = [
        { label: "HTTP :80", host, port: 80, protocol: "http" },
        { label: "HTTP :3128", host, port: 3128, protocol: "http" },
        { label: "SOCKS5 :1080", host, port: 1080, protocol: "socks5" },
      ];

      if (convertedHost) {
        endpoints.push(
          { label: `HTTP IP :80`, host: convertedHost, port: 80, protocol: "http" },
          { label: `HTTP IP :3128`, host: convertedHost, port: 3128, protocol: "http" },
        );
      }

      const results: any[] = [];
      for (const ep of endpoints) {
        let working = false;
        let epError = "";
        let epIp = "";
        try {
          const conn = await Promise.race([
            Deno.connect({ hostname: ep.host, port: ep.port }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TCP timeout")), 5000)),
          ]) as Deno.Conn;

          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          const authHeader = username ? `Proxy-Authorization: Basic ${btoa(`${username}:${password}`)}\r\n` : "";
          const httpReq = `GET http://ip-api.com/json/?fields=status,query HTTP/1.1\r\nHost: ip-api.com\r\n${authHeader}\r\n`;
          await conn.write(encoder.encode(httpReq));

          const buf = new Uint8Array(4096);
          const readPromise = conn.read(buf);
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
          const bytesRead = await Promise.race([readPromise, timeoutPromise]);

          if (bytesRead && typeof bytesRead === "number" && bytesRead > 0) {
            const responseText = decoder.decode(buf.subarray(0, bytesRead));
            if (responseText.includes("HTTP/")) {
              if (responseText.includes("407")) {
                epError = "Autenticação recusada";
              } else {
                const jsonMatch = responseText.match(/\{[^}]+\}/);
                if (jsonMatch) {
                  try {
                    const j = JSON.parse(jsonMatch[0]);
                    if (j.status === "success" && j.query) { working = true; epIp = j.query; }
                    else { working = true; }
                  } catch { working = true; }
                } else { working = true; }
              }
            }
          } else {
            epError = "Sem resposta (timeout)";
          }
          conn.close();
        } catch (err: any) {
          const msg = err?.message || String(err);
          if (msg.includes("TCP timeout") || msg.includes("timed out")) epError = "Timeout";
          else if (msg.includes("Connection refused")) epError = "Porta fechada";
          else epError = msg.slice(0, 60);
        }
        results.push({ label: ep.label, host: ep.host, port: ep.port, protocol: ep.protocol, success: working, error: working ? undefined : epError, exit_ip: epIp || undefined });
      }

      const anyWorking = results.some(r => r.success);
      const bestEndpoint = results.find(r => r.success);

      return new Response(JSON.stringify({
        success: anyWorking,
        is_rotating: true,
        converted_host: convertedHost,
        endpoints: results,
        recommended: bestEndpoint ? `${bestEndpoint.host}:${bestEndpoint.port}` : undefined,
        ip: bestEndpoint?.exit_ip || undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const host = parts[0];
    const port = parts[1];
    const username = parts[2] || "";
    const password = parts[3] || "";
    const portNum = parseInt(port);

    // Auto-detect SOCKS5 by common ports (Webshare uses 6xxx range for SOCKS5)
    const isSocks5 = portNum === 1080 || (portNum >= 6000 && portNum <= 6999);

    // Step 1: Test actual connectivity through the proxy
    let proxyWorking = false;
    let realIp = "";
    let connectError = "";

    try {
      // Use Deno.connect to test TCP connectivity first
      const conn = await Promise.race([
        Deno.connect({ hostname: host, port: portNum }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TCP timeout")), 8000)),
      ]) as Deno.Conn;

      // SOCKS5 path
      if (isSocks5) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        try {
          // 1. Greeting: VER=5, NMETHODS=2, METHODS=[0x00 no-auth, 0x02 user/pass]
          await conn.write(new Uint8Array([0x05, 0x02, 0x00, 0x02]));
          const greetResp = new Uint8Array(2);
          const greetRead = await Promise.race([
            conn.read(greetResp),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
          ]);

          if (!greetRead || greetResp[0] !== 0x05) {
            throw new Error("SOCKS5 handshake falhou");
          }

          // 2. Auth if required
          if (greetResp[1] === 0x02 && username) {
            const userBytes = encoder.encode(username);
            const passBytes = encoder.encode(password);
            const authReq = new Uint8Array([0x01, userBytes.length, ...userBytes, passBytes.length, ...passBytes]);
            await conn.write(authReq);
            const authResp = new Uint8Array(2);
            const authRead = await Promise.race([
              conn.read(authResp),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
            ]);
            if (!authRead || authResp[1] !== 0x00) {
              throw new Error("Autenticação SOCKS5 recusada");
            }
          } else if (greetResp[1] === 0xff) {
            throw new Error("SOCKS5 requer autenticação");
          }

          // 3. CONNECT to ip-api.com:80 (use domain to test DNS through proxy)
          const targetHost = "ip-api.com";
          const hostBytes = encoder.encode(targetHost);
          const connectReq = new Uint8Array([
            0x05, 0x01, 0x00, 0x03, hostBytes.length, ...hostBytes, 0x00, 0x50, // port 80
          ]);
          await conn.write(connectReq);
          const connectResp = new Uint8Array(10);
          const connectRead = await Promise.race([
            conn.read(connectResp),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
          ]);

          if (!connectRead || connectResp[1] !== 0x00) {
            throw new Error("SOCKS5 CONNECT falhou");
          }

          // 4. Send HTTP request through tunnel
          const httpReq = `GET /json/?fields=status,query HTTP/1.1\r\nHost: ip-api.com\r\nConnection: close\r\n\r\n`;
          await conn.write(encoder.encode(httpReq));

          const buf = new Uint8Array(4096);
          const bytesRead = await Promise.race([
            conn.read(buf),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
          ]);

          if (bytesRead && typeof bytesRead === "number" && bytesRead > 0) {
            const text = decoder.decode(buf.subarray(0, bytesRead));
            const jsonMatch = text.match(/\{[^}]+\}/);
            if (jsonMatch) {
              try {
                const j = JSON.parse(jsonMatch[0]);
                if (j.status === "success" && j.query) {
                  proxyWorking = true;
                  realIp = j.query;
                }
              } catch {
                proxyWorking = true; // tunnel works even if parse failed
              }
            } else if (text.includes("HTTP/")) {
              proxyWorking = true;
            }
          } else {
            proxyWorking = true; // tunnel established successfully
          }

          conn.close();
        } catch (sockErr: any) {
          connectError = sockErr?.message || "Erro SOCKS5";
          try { conn.close(); } catch {}
        }
      } else {

      // TCP connection succeeded - proxy port is reachable
      // Now try an HTTP CONNECT through the proxy
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Send HTTP request through the proxy to get exit IP
      const httpReq = username
        ? `GET http://ip-api.com/json/?fields=status,query,country,countryCode,regionName,city,isp HTTP/1.1\r\nHost: ip-api.com\r\nProxy-Authorization: Basic ${btoa(`${username}:${password}`)}\r\n\r\n`
        : `GET http://ip-api.com/json/?fields=status,query,country,countryCode,regionName,city,isp HTTP/1.1\r\nHost: ip-api.com\r\n\r\n`;

      await conn.write(encoder.encode(httpReq));

      // Read response with timeout
      const buf = new Uint8Array(4096);
      const readPromise = conn.read(buf);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
      const bytesRead = await Promise.race([readPromise, timeoutPromise]);

      if (bytesRead && typeof bytesRead === "number" && bytesRead > 0) {
        const responseText = decoder.decode(buf.subarray(0, bytesRead));
        
        // Extract JSON body from HTTP response
        const bodyStart = responseText.indexOf("\r\n\r\n");
        if (bodyStart !== -1) {
          const body = responseText.substring(bodyStart + 4).trim();
          // Find the JSON object in the body (might have chunked encoding)
          const jsonMatch = body.match(/\{[^}]+\}/);
          if (jsonMatch) {
            try {
              const jsonData = JSON.parse(jsonMatch[0]);
              if (jsonData.status === "success" && jsonData.query) {
                proxyWorking = true;
                realIp = jsonData.query;
              }
            } catch {
              // JSON parse failed, but connection worked
            }
          }
        }

        // Check if we got a valid HTTP response (even if we couldn't parse JSON)
        if (!proxyWorking && responseText.includes("HTTP/")) {
          // Got HTTP response - proxy is responding
          if (responseText.includes("407") || responseText.includes("Proxy Authentication Required")) {
            connectError = "Proxy requer autenticação (credenciais inválidas)";
          } else if (responseText.includes("403")) {
            connectError = "Proxy recusou a conexão (403 Forbidden)";
          } else if (responseText.includes("200")) {
            proxyWorking = true;
          } else {
            // Got some HTTP response - proxy is at least responding
            proxyWorking = true;
          }
        }
      } else {
        connectError = "Proxy não respondeu dentro do tempo limite";
      }

      conn.close();
      } // end else (HTTP path)
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("TCP timeout") || msg.includes("timed out")) {
        connectError = "O endpoint do proxy não respondeu ao servidor de teste (timeout). Isso normalmente indica IP/porta inacessível neste momento, bloqueio de rede ou proxy offline — não significa, por si só, assinatura vencida.";
      } else if (msg.includes("Connection refused") || msg.includes("connection refused")) {
        connectError = "Conexão recusada — proxy pode estar offline";
      } else if (msg.includes("No route") || msg.includes("unreachable")) {
        connectError = "Host inacessível — verifique o endereço do proxy";
      } else {
        connectError = `Erro de conexão: ${msg}`;
      }
    }

    // Step 2: Geo lookup (use real exit IP if available, otherwise use host IP)
    const lookupIp = realIp || host;
    const geoUrl = `http://ip-api.com/json/${lookupIp}?fields=status,message,country,countryCode,regionName,city,isp,query`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    const countryNames: Record<string, string> = {
      BR: "Brasil", US: "Estados Unidos", CA: "Canadá", GB: "Reino Unido",
      DE: "Alemanha", FR: "França", JP: "Japão", AU: "Austrália",
      IN: "Índia", MX: "México", AR: "Argentina", CL: "Chile",
      CO: "Colômbia", PT: "Portugal", ES: "Espanha", IT: "Itália",
      NL: "Holanda", SE: "Suécia", NO: "Noruega", RU: "Rússia",
      CN: "China", KR: "Coreia do Sul", SG: "Singapura",
    };

    const geoOk = geoData.status !== "fail";

    return new Response(JSON.stringify({
      success: proxyWorking,
      error: proxyWorking ? undefined : (connectError || "Proxy não está respondendo"),
      ip: geoOk ? geoData.query : lookupIp,
      country: geoOk ? (countryNames[geoData.countryCode] || geoData.country) : undefined,
      countryCode: geoOk ? geoData.countryCode : undefined,
      region: geoOk ? geoData.regionName : undefined,
      city: geoOk ? geoData.city : undefined,
      isp: geoOk ? geoData.isp : undefined,
      host,
      port,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Test proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
