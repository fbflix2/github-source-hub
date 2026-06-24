(function () {
  const ENDPOINT = "https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/fb-friends-update";
  const BLOCKED = new Set(["profile.php","people","pages","watch","reel","marketplace","groups","login","settings","help","photo","photos","stories","messages","notifications","gaming","events","bookmarks"]);

  function isProfileUrl(href) {
    try {
      const u = new URL(href);
      if (!/facebook\.com$/i.test(u.hostname) && !/\.facebook\.com$/i.test(u.hostname)) return false;
      if (u.searchParams.get("id")) return true;
      const seg = u.pathname.split("/").filter(Boolean)[0];
      if (!seg) return false;
      return !BLOCKED.has(seg.toLowerCase());
    } catch { return false; }
  }

  // Detecta tela "Esse conteúdo não está disponível" / checkpoint / login wall
  function detectBlocked() {
    const href = location.href;
    if (/\/checkpoint/i.test(href) || /\/login/i.test(href)) {
      return { blocked: true, reason: "checkpoint_or_login_redirect" };
    }
    const body = (document.body && document.body.innerText) || "";
    const patterns = [
      /este conte[uú]do n[ãa]o est[áa] dispon[íi]vel/i,
      /esta p[áa]gina n[ãa]o est[áa] dispon[íi]vel/i,
      /conte[uú]do n[ãa]o est[áa] dispon[íi]vel no momento/i,
      /this content isn'?t available/i,
      /this page isn'?t available/i,
      /sorry,?\s*this content isn'?t available/i,
      /a conta foi desativada/i,
      /account has been disabled/i,
      /perfil n[ãa]o est[áa] dispon[íi]vel/i,
      /o link que voc[êe] seguiu pode estar quebrado/i,
      /the link you followed may be broken/i,
    ];
    for (const re of patterns) {
      if (re.test(body)) return { blocked: true, reason: re.source.slice(0, 60) };
    }
    return { blocked: false };
  }

  function parseCount(text) {
    if (!text) return null;
    const t = text.replace(/\u00a0/g, " ").trim();
    // "1.234 amigos", "1,234 friends", "1.2K friends", "2 mi amigos"
    const m = t.match(/([\d.,]+)\s*(K|M|mil|mi)?\s*(amigos?|friends?)/i);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    if (!isFinite(n)) {
      n = parseFloat(m[1].replace(/,/g, ""));
    }
    const suf = (m[2] || "").toLowerCase();
    if (suf === "k" || suf === "mil") n *= 1000;
    if (suf === "m" || suf === "mi") n *= 1000000;
    return Math.round(n);
  }

  function findFriendsCount() {
    // 1) Scan anchors that link to /friends
    const anchors = document.querySelectorAll('a[href*="/friends"]');
    for (const a of anchors) {
      const c = parseCount(a.textContent || "");
      if (c != null) return c;
    }
    // 2) Scan whole document text for first match (fallback)
    const body = document.body ? document.body.innerText : "";
    const m = body.match(/([\d.,]+\s*(?:K|M|mil|mi)?)\s*(amigos?|friends?)\b/i);
    if (m) {
      const c = parseCount(m[0]);
      if (c != null) return c;
    }
    return null;
  }

  function findName() {
    const h1 = document.querySelector("h1");
    const txt = (h1?.textContent || "").trim();
    if (txt && txt.length < 80) return txt;
    const og = document.querySelector('meta[property="og:title"]');
    return og?.getAttribute("content") || null;
  }

  function showBadge(ok, msg) {
    const id = "__fbflix_badge__";
    document.getElementById(id)?.remove();
    const el = document.createElement("div");
    el.id = id;
    el.textContent = msg;
    el.style.cssText = `
      position:fixed;bottom:18px;right:18px;z-index:2147483647;
      background:${ok ? "#16a34a" : "#dc2626"};color:#fff;
      padding:10px 14px;border-radius:10px;font:600 13px system-ui;
      box-shadow:0 8px 24px rgba(0,0,0,.25);transition:opacity .4s;`;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; }, 3500);
    setTimeout(() => el.remove(), 4200);
  }

  let lastSent = { url: "", at: 0 };

  async function attemptCapture(reason) {
    const href = location.href;
    if (!isProfileUrl(href)) return;

    // 1) Primeiro verifica se a página é de bloqueio/checkpoint
    const block = detectBlocked();
    if (block.blocked) {
      if (lastSent.url === href && Date.now() - lastSent.at < 60000) return;
      lastSent = { url: href, at: Date.now() };
      try {
        const r = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile_url: href, blocked: true, blocked_reason: block.reason }),
        });
        const j = await r.json().catch(() => ({}));
        if (j?.ok) {
          showBadge(false, `🚫 FBFlix: perfil bloqueado/checkpoint`);
          chrome.storage.local.set({ lastCapture: { url: href, blocked: true, at: Date.now() } });
        }
      } catch (e) {
        console.warn("[FBFlix] block send error", e);
      }
      return;
    }

    const count = findFriendsCount();
    if (count == null) return;
    const name = findName();
    // Avoid duplicate sends for same URL within 60s
    if (lastSent.url === href && Date.now() - lastSent.at < 60000) return;
    lastSent = { url: href, at: Date.now() };
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_url: href, friends_count: count, name, blocked: false }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) {
        showBadge(true, `✅ FBFlix: ${count.toLocaleString("pt-BR")} amigos${name ? " · " + name : ""}`);
        chrome.storage.local.set({ lastCapture: { url: href, name, count, at: Date.now() } });
      } else {
        // Profile not registered in DB — silent (don't spam operator)
        console.debug("[FBFlix]", j);
      }
    } catch (e) {
      console.warn("[FBFlix] send error", e);
    }
  }

  // Trigger on load + when SPA navigations happen + after content settles
  let tries = 0;
  const tryLoop = setInterval(() => {
    tries++;
    attemptCapture("loop");
    if (tries > 20) clearInterval(tryLoop); // ~20s
  }, 1000);

  // Detect URL changes (Facebook is SPA)
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      lastSent = { url: "", at: 0 };
      tries = 0;
      const loop = setInterval(() => {
        tries++;
        attemptCapture("nav");
        if (tries > 20) clearInterval(loop);
      }, 1000);
    }
  }, 800);
})();