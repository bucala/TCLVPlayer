function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

/** Standalone local confirmation. No scripts, provider URLs, session tokens or external assets. */
export function pairingPage({ origin = "", id = "", csrf = "", status = "pending" } = {}) {
  const pending = status === "pending";
  const titles = {
    pending: ["Pripojiť TCLVPlayer", "Connect TCLVPlayer"],
    approved: ["Pripojenie povolené", "Connection approved"],
    denied: ["Pripojenie odmietnuté", "Connection declined"],
    expired: ["Platnosť požiadavky vypršala", "This request has expired"],
  };
  const title = titles[status] || titles.expired;
  return `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title[0]} · TCLV Bridge</title><style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#111113;color:#f6f4f2}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:min(100%,520px);padding:30px;background:#202023;border:1px solid #414146;border-radius:20px;box-shadow:0 20px 60px #0005}.brand{color:#ffa378;font-size:14px;font-weight:700;letter-spacing:.03em}h1{font-size:28px;line-height:1.2;margin:18px 0 7px}.translation{color:#c5c2c8;margin-top:0}p{line-height:1.55}.origin{display:block;padding:16px;border:1px solid #776052;border-radius:12px;background:#2b2421;color:#fff;overflow-wrap:anywhere;font-size:16px}form{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}button{flex:1;min-width:160px;min-height:48px;border-radius:10px;border:1px solid #77717b;background:#303035;color:#fff;font:inherit;font-weight:650;padding:12px 16px;cursor:pointer}button[value=approve]{background:#ed7c43;border-color:#ed7c43;color:#20120b}button:focus-visible{outline:3px solid #fff;outline-offset:4px}.small{font-size:13px;color:#c5c2c8;margin-top:22px}.note{border-top:1px solid #414146;padding-top:18px}
</style></head><body><main><div class="brand">TCLV BRIDGE · LOKÁLNE PRIPOJENIE / LOCAL CONNECTION</div>
<h1>${title[0]}</h1><p class="translation" lang="en">${title[1]}</p>
${pending ? `<p>Povoliť tejto webovej stránke používať prehrávanie cez tento počítač?</p><p class="translation" lang="en">Allow this website to play through this computer?</p>
<strong class="origin" id="request-origin">${escapeHtml(origin)}</strong>
<form method="post" action="/pair/approve/${escapeHtml(id)}"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
<button type="submit" name="action" value="approve">Povoliť / Allow</button><button type="submit" name="action" value="deny">Odmietnuť / Deny</button></form>
<p class="small">Potvrďte iba vtedy, ak ste pripojenie práve spustili v TCLVPlayeri. Požiadavka platí 2 minúty.<br><span lang="en">Confirm only if you just requested this connection in TCLVPlayer. The request expires after 2 minutes.</span></p>` :
`<p>${status === "expired" ? "Vráťte sa do TCLVPlayera a skúste pripojenie znova." : "Vráťte sa do pôvodného okna TCLVPlayera. Toto okno môžete zatvoriť."}</p><p class="translation" lang="en">${status === "expired" ? "Return to TCLVPlayer and start a new connection request." : "Return to your original TCLVPlayer tab. You can close this window."}</p>`}
<p class="small note">Video ide od poskytovateľa cez tento počítač do prehliadača. Neprechádza cez Vercel.<br><span lang="en">Video travels from the provider through this computer to your browser, without passing through Vercel.</span></p>
</main></body></html>`;
}
