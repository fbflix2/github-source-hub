chrome.storage.local.get("lastCapture", ({ lastCapture }) => {
  const el = document.getElementById("last");
  if (!lastCapture) return;
  const when = new Date(lastCapture.at).toLocaleString("pt-BR");
  el.innerHTML = `<b>${lastCapture.name || "(sem nome)"}</b><br/>
    Amigos: <b>${lastCapture.count.toLocaleString("pt-BR")}</b><br/>
    <span style="color:#94a3b8">${when}</span>`;
});