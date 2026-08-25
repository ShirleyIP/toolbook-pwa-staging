// Shared book-style card → PNG exporter for Toolbook tools.
// Draws the same warm-paper / slate-blue card and triggers a download.
export function downloadCardPNG(o) {
  const W = 1080, pad = 104, maxW = W - pad * 2;
  const accent = o.accent || "#35456a", ink = "#241f18", muted = "#8a8372", paper = "#fbf9f4", frame = "#cec6b4";
  const probe = document.createElement("canvas").getContext("2d");
  function wrap(text, font) {
    probe.font = font; const out = [];
    String(text == null || text === "" ? "—" : text).split("\n").forEach(part => {
      let ln = "";
      for (const ch of Array.from(part || " ")) { const nx = ln + ch; if (ln && probe.measureText(nx).width > maxW) { out.push(ln); ln = ch; } else ln = nx; }
      out.push(ln || " ");
    });
    return out;
  }
  const blocks = (o.blocks || []).filter(Boolean).map(b => {
    const vf = b.big ? '600 40px "Noto Serif TC",serif' : (b.serif ? '34px "Noto Serif TC",serif' : "34px sans-serif");
    return { k: b.k || "", vf, lines: wrap(b.v, vf), big: b.big, meta: b.meta || "" };
  });
  let bodyH = 0; blocks.forEach(b => { bodyH += (b.k ? 52 : 0) + b.lines.length * (b.big ? 58 : 52) + (b.meta ? 36 : 0) + 34; });
  const H = Math.max(1200, 360 + bodyH + 210);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = paper; x.fillRect(0, 0, W, H);
  x.strokeStyle = frame; x.lineWidth = 3; x.strokeRect(40, 40, W - 80, H - 80); x.lineWidth = 1; x.strokeRect(56, 56, W - 112, H - 112);
  x.textAlign = "center"; x.fillStyle = accent; x.font = '42px "Noto Serif TC",serif'; x.fillText("\u2766", W / 2, 138);
  x.fillStyle = ink; x.font = '600 44px "Noto Serif TC",serif'; x.fillText(o.title || "", W / 2, 208);
  if (o.sub) { x.fillStyle = muted; x.font = "18px sans-serif"; x.fillText(o.sub, W / 2, 252); }
  x.strokeStyle = accent; x.beginPath(); x.moveTo(W / 2 - 34, 290); x.lineTo(W / 2 + 34, 290); x.stroke();
  let y = 362; x.textAlign = "left";
  blocks.forEach(b => {
    if (b.k) { x.fillStyle = muted; x.font = "20px sans-serif"; x.fillText(b.k, pad, y); y += 52; }
    x.fillStyle = b.big ? accent : ink; x.font = b.vf;
    b.lines.forEach(l => { x.fillText(l, pad, y); y += b.big ? 58 : 52; });
    if (b.meta) { x.fillStyle = muted; x.font = "22px sans-serif"; x.fillText(b.meta, pad, y); y += 36; }
    y += 34;
  });
  x.textAlign = "center"; x.fillStyle = accent; x.font = '30px "Noto Serif TC",serif'; x.fillText(o.mantra || "", W / 2, y + 26);
  x.fillStyle = muted; x.font = "16px sans-serif"; x.fillText(o.edition || "", W / 2, H - 82);
  return new Promise(resolve => {
    c.toBlob(blob => {
      if (!blob) { resolve(false); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = (o.filename || "card") + ".png"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); resolve(true);
    }, "image/png");
  });
}
