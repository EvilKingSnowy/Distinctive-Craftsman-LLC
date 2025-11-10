// ===== Distinctive Craftsman — In-Page Editor (v4, all-in-one) =====
//
// ✅ Admin button (password gate) on every page
// ✅ Edit text anywhere + mini toolbar (bold / italic / color)
// ✅ Upload image -> click to place on THIS page -> drag anywhere -> resize +/- -> delete
// ✅ Save commits current page HTML via Cloudflare Worker
// ✅ Live auto-refresh after save when GitHub Pages updates
// ✅ Auto-add YouTube icon in footer (no duplicates)
//
// --- CONFIG ---
// Worker URL:
const WORKER_URL = "https://dc-commit.evilkingsnowy.workers.dev";
// Your public YouTube channel URL (auto-injected into footer):
const YOUTUBE_URL = "https://www.youtube.com/@distinctivecraftsman5700";

let ADMIN_KEY = "";
let editing = false;
let placingImage = null; // { dataUrl, finalPath }

// -------- helpers --------
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const pagePath = () => {
  const p = location.pathname.split("/").pop();
  return p && p.length ? p : "index.html";
};
function ensureRelative(container) {
  const cs = getComputedStyle(container);
  if (cs.position === "static") container.style.position = "relative";
}
function toast(msg, ms = 3000, isError = false) {
  const d = document.createElement("div");
  d.className = "dc-admin-ui";
  d.textContent = msg;
  Object.assign(d.style, {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "85px",
    background: isError ? "#dc3545" : "#222",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "10px",
    zIndex: 1000000,
    fontSize: "14px",
    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
    maxWidth: "90vw",
    textAlign: "center"
  });
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function makeBtn(label, bg, rightPx) {
  const b = document.createElement("button");
  b.textContent = label;
  b.className = "dc-admin-ui";
  Object.assign(b.style, {
    position: "fixed",
    bottom: "20px",
    right: rightPx + "px",
    padding: "10px 14px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    cursor: "pointer",
    zIndex: "999999"
  });
  b.contentEditable = "false";
  b.draggable = false;
  return b;
}

// keep admin UI out of the save & clean up previews
function stripForSave(docElem) {
  // remove admin controls
  qsa(".dc-admin-ui", docElem).forEach(el => el.remove());
  // convert preview images to their final src
  qsa("img[data-final-src]", docElem).forEach(img => {
    img.setAttribute("src", img.getAttribute("data-final-src"));
    img.removeAttribute("data-final-src");
    img.removeAttribute("data-dc");
  });
  // clear edit outlines/flags
  qsa("[contenteditable]", docElem).forEach(el => {
    el.removeAttribute("contenteditable");
    el.style.outline = "";
  });
  return docElem;
}

// ---------- EDIT TEXT ----------
const TEXT_EDIT_SELECTORS = [
  "h1","h2","h3","h4","h5","h6",
  "p","li","span","strong","em","blockquote",
  "a","button","figcaption","label"
].join(",");

// Mini text toolbar (bold / italic / color)
let textToolbar = null;
const TEXT_COLORS = ["#111","#6c757d","#0d6efd","#198754","#dc3545","#fd7e14","#ffc107","#20c997","#6f42c1"];
function hideTextToolbar() {
  if (textToolbar) { textToolbar.remove(); textToolbar = null; }
}
function styleMiniBtn(btn, bg) {
  Object.assign(btn.style, {
    background: bg,
    color: "#fff",
    border: "none",
    padding: "6px 8px",
    borderRadius: "6px",
    cursor: "pointer"
  });
  btn.className = "dc-admin-ui";
  btn.contentEditable = "false";
}
function ensureTextToolbar() {
  if (textToolbar) return textToolbar;
  textToolbar = document.createElement("div");
  textToolbar.className = "dc-admin-ui";
  Object.assign(textToolbar.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    transform: "translate(-50%, -120%)",
    background: "#222",
    color: "#fff",
    padding: "6px 8px",
    borderRadius: "8px",
    display: "flex",
    gap: "6px",
    alignItems: "center",
    zIndex: "1000000",
    fontSize: "13px",
    boxShadow: "0 6px 18px rgba(0,0,0,.25)"
  });

  const b = document.createElement("button");
  b.textContent = "B";
  b.style.fontWeight = "700";
  styleMiniBtn(b, "#495057");
  b.onclick = () => document.execCommand("bold", false, null);

  const i = document.createElement("button");
  i.textContent = "I";
  i.style.fontStyle = "italic";
  styleMiniBtn(i, "#495057");
  i.onclick = () => document.execCommand("italic", false, null);

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "4px";
  TEXT_COLORS.forEach(c => {
    const sw = document.createElement("button");
    sw.title = c;
    styleMiniBtn(sw, c);
    sw.style.width = "18px";
    sw.style.height = "18px";
    sw.textContent = "";
    sw.onclick = () => document.execCommand("foreColor", false, c);
    wrap.appendChild(sw);
  });

  textToolbar.append(b, i, wrap);
  document.body.appendChild(textToolbar);
  return textToolbar;
}
function showTextToolbarAtClientXY(x, y) {
  const tb = ensureTextToolbar();
  tb.style.left = x + "px";
  tb.style.top  = y + "px";
}

function setEditing(on) {
  editing = on;

  // simplest: whole body editable; keep admin UI not editable
  document.body.contentEditable = on ? "true" : "false";
  qsa(".dc-admin-ui").forEach(el => el.contentEditable = "false");

  // show faint outlines on texty elements
  qsa(TEXT_EDIT_SELECTORS).forEach(el => {
    el.style.outline = on ? "1px dashed rgba(0,0,0,.2)" : "";
    el.style.outlineOffset = on ? "2px" : "";
  });

  // toggle drag handlers for editor-placed images
  qsa("img[data-dc='1']").forEach(img => {
    if (on) attachDrag(img);
    else detachDrag(img);
  });

  // show/hide text toolbar on selection while editing
  const onSelChange = () => {
    if (!editing) return hideTextToolbar();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return hideTextToolbar();
    const r = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    if (!r || (!r.width && !r.height)) return hideTextToolbar();
    showTextToolbarAtClientXY(r.left + r.width / 2, r.top);
  };
  if (on) {
    document.addEventListener("selectionchange", onSelChange);
    document.addEventListener("click", onSelChange, true);
  } else {
    document.removeEventListener("selectionchange", onSelChange);
    document.removeEventListener("click", onSelChange, true);
    hideTextToolbar();
  }
}

// ---------- DRAGGING & IMAGE TOOLBAR ----------
let toolbarDiv = null;
function attachDrag(img) {
  if (img._dragBound) return;
  img.style.cursor = "move";
  img.style.position = img.style.position || "absolute";

  const container = img.parentElement;
  ensureRelative(container);

  function onDown(ev) {
    if (!editing) return;
    ev.preventDefault();
    const rectC = container.getBoundingClientRect();
    const rectI = img.getBoundingClientRect();
    const offsetX = ev.clientX - rectI.left;
    const offsetY = ev.clientY - rectI.top;

    function onMove(e) {
      img.style.left = Math.max(0, e.clientX - rectC.left - offsetX) + "px";
      img.style.top  = Math.max(0, e.clientY - rectC.top  - offsetY) + "px";
    }
    function onUp() {
      removeEventListener("mousemove", onMove);
      removeEventListener("mouseup", onUp);
    }
    addEventListener("mousemove", onMove);
    addEventListener("mouseup", onUp);
  }

  function onClick(e) {
    if (!editing) return;
    showImageToolbar(img, e.clientX, e.clientY);
  }

  img.addEventListener("mousedown", onDown);
  img.addEventListener("click", onClick);
  img._dragBound = { onDown, onClick };
}
function detachDrag(img) {
  const b = img._dragBound;
  if (!b) return;
  img.removeEventListener("mousedown", b.onDown);
  img.removeEventListener("click", b.onClick);
  img.style.cursor = "";
  delete img._dragBound;
}

function showImageToolbar(img, x, y) {
  if (toolbarDiv) toolbarDiv.remove();
  toolbarDiv = document.createElement("div");
  toolbarDiv.className = "dc-admin-ui";
  Object.assign(toolbarDiv.style, {
    position: "fixed",
    left: (x + 8) + "px",
    top:  (y + 8) + "px",
    background: "#222",
    color: "#fff",
    padding: "6px 8px",
    borderRadius: "8px",
    zIndex: "999999",
    display: "flex",
    gap: "6px",
    fontSize: "13px",
    alignItems: "center"
  });

  const del = document.createElement("button");
  del.textContent = "🗑️ Delete";
  styleMiniBtn(del, "#dc3545");
  del.onclick = () => { img.remove(); toolbarDiv.remove(); };

  // create toolbar buttons
  const smaller = document.createElement("button");
  smaller.textContent = "−";
  styleMiniBtn(smaller, "#6c757d");

  const bigger = document.createElement("button");
  bigger.textContent = "+";
  styleMiniBtn(bigger, "#6c757d");

  // helper to limit image growth
  function maxGrowWidth(imgEl) {
    const container = imgEl.parentElement;
    const containerW = container ? container.clientWidth : 2000;
    const naturalW = imgEl.naturalWidth || 2000;
    return Math.min(containerW, naturalW);
  }

  // resize handlers
  smaller.onclick = () => {
    const cur = img.clientWidth || parseFloat(img.style.width) || 300;
    const next = Math.max(50, cur - 20);
    img.style.width = next + "px";
  };
  bigger.onclick = () => {
    const cur = img.clientWidth || parseFloat(img.style.width) || 300;
    const cap = maxGrowWidth(img);
    const next = Math.min(cap, cur + 20);
    img.style.width = next + "px";
  };

  // build toolbar
  toolbarDiv.append(smaller, bigger, del);
  document.body.appendChild(toolbarDiv);

  // auto hide after a while
  setTimeout(() => { if (toolbarDiv) toolbarDiv.remove(); }, 4000);
}

// ---------- IMAGE UPLOAD -> PLACE ON THIS PAGE ----------
async function uploadAndPlace(file) {
  // 1) read for immediate preview
  const dataUrl = await readAsDataURL(file);
  const finalPath = `assets/gallery/${file.name}`;

  // 2) commit asset to repo via Worker
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": ADMIN_KEY },
    body: JSON.stringify({
      action: "upload",
      path: finalPath,
      fileBase64: dataUrl.split(",",2)[1],
      message: `Upload ${finalPath}`
    })
  });
  if (!res.ok) {
    toast("❌ Upload failed:\n" + await res.text(), 6000, true);
    return;
  }

  // 3) click once to place it on THIS page
  placingImage = { dataUrl, finalPath };
  toast("✅ Image uploaded. Click anywhere on the page to place it. Then drag/resize.", 4000);
}

document.addEventListener("click", (ev) => {
  // place uploaded image
  if (placingImage && editing) {
    let container =
      ev.target.closest("section, main, article, .container, .content, .wrapper") ||
      document.body;
    ensureRelative(container);

    const img = new Image();
    img.src = placingImage.dataUrl;                 // instant preview
    img.setAttribute("data-final-src", placingImage.finalPath);
    img.setAttribute("data-dc", "1");               // mark as editor-placed
    img.style.position = "absolute";
    img.style.maxWidth = "none";
    img.style.width = "300px";                      // start size
    img.style.left = "0px";
    img.style.top  = "0px";

    container.appendChild(img);
    attachDrag(img);

    const crect = container.getBoundingClientRect();
    const x = ev.clientX - crect.left - (img.width / 2);
    const y = ev.clientY - crect.top  - (img.height / 2);
    img.style.left = Math.max(0, x) + "px";
    img.style.top  = Math.max(0, y) + "px";

    placingImage = null;
  }
}, true);

// ---------- SAVE with Live Refresh ----------
async function saveCurrentPage() {
  if (!ADMIN_KEY) return alert("Unlock Admin first.");

  // Build final HTML: clone + strip admin UI + add a timestamp marker
  const clone = document.documentElement.cloneNode(true);
  stripForSave(clone);

  const stamp = `<!-- saved:${new Date().toISOString()} -->`;
  const finalHtml = "<!DOCTYPE html>\n" + clone.outerHTML.replace("</body>", `${stamp}\n</body>`);
  const path = pagePath();

  // Send to Worker
  let res, txt;
  try {
    res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": ADMIN_KEY },
      body: JSON.stringify({
        action: "save",
        path,
        contentText: finalHtml,   // primary field
        content: finalHtml,       // fallback field
        message: `Update ${path} via in-page editor`
      })
    });
    txt = await res.text();
  } catch (e) {
    console.error(e);
    toast("❌ Save failed: network error", 5000, true);
    return;
  }
  if (!res.ok) {
    console.error("Worker save error:", txt);
    toast("❌ Save failed (Worker): " + txt.slice(0, 200), 6000, true);
    return;
  }

  toast("✅ Saved to GitHub. Checking for updates…", 3000);

  // 1) Wait for raw file to update
  const RAW = `https://raw.githubusercontent.com/EvilKingSnowy/Distinctive-Craftsman-LLC/main/${path}`;
  const startRaw = Date.now();
  let rawUpdated = false;
  while (Date.now() - startRaw < 60000 && !rawUpdated) {
    try {
      const r = await fetch(RAW + "?_=" + Date.now());
      const t = await r.text();
      if (t.includes(stamp)) { rawUpdated = true; break; }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 4000));
  }
  if (!rawUpdated) {
    toast("ℹ️ Commit done, but raw file hasn’t updated yet. It should appear shortly.", 6000);
    return;
  }
  toast("✅ File updated on GitHub. Waiting for GitHub Pages…", 4000);

  // 2) Wait for live site to update, then reload automatically
  const LIVE_URL = window.location.href.split("#")[0];
  const startLive = Date.now();
  let liveUpdated = false;
  while (Date.now() - startLive < 120000 && !liveUpdated) {
    try {
      const resp = await fetch(LIVE_URL + "?_=" + Date.now(), { cache: "no-store" });
      const txt2 = await resp.text();
      if (txt2.includes(stamp)) { liveUpdated = true; break; }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 5000));
  }
  if (liveUpdated) {
    toast("✅ Live site updated — reloading…", 2500);
    setTimeout(() => window.location.reload(true), 2500);
  } else {
    toast("ℹ️ Pages hasn’t refreshed yet. It’ll update soon — try a hard reload in ~1–2 min.", 7000);
  }
}

// ---------- UI ----------
const adminBtn  = makeBtn("Admin", "#6c757d", 20);
const editBtn   = makeBtn("Edit Site", "#0d6efd", 110);
const saveBtn   = makeBtn("Save Changes", "#198754", 210);
const uploadBtn = makeBtn("Upload Image", "#fd7e14", 340);

editBtn.style.display = "none";
saveBtn.style.display = "none";
uploadBtn.style.display = "none";

adminBtn.onclick = () => {
  const pass = prompt("Enter admin password:");
  if (!pass) return;
  ADMIN_KEY = pass; // Worker validates it server-side
  editBtn.style.display = "inline-block";
  saveBtn.style.display = "inline-block";
  uploadBtn.style.display = "inline-block";
  toast("Admin unlocked. Click 'Edit Site' to start editing.", 3000);
};
editBtn.onclick = () => {
  setEditing(!editing);
  editBtn.textContent = editing ? "Exit Edit" : "Edit Site";
};
saveBtn.onclick = () => {
  if (!ADMIN_KEY) return alert("Unlock Admin first.");
  saveCurrentPage();
};
uploadBtn.onclick = () => {
  if (!ADMIN_KEY) return alert("Unlock Admin first.");
  if (!editing)   return alert("Click 'Edit Site' first.");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.className = "dc-admin-ui";
  input.style.display = "none";
  document.body.appendChild(input);
  input.onchange = async () => {
    const f = input.files[0];
    if (f) await uploadAndPlace(f);
    input.remove();
  };
  input.click();
};
document.body.append(adminBtn, editBtn, saveBtn, uploadBtn);

// ---------- Auto-inject YouTube icon in footer (no duplicates) ----------
function injectYouTubeIcon() {
  const footer = document.querySelector("footer") || document.body;
  if (!footer || footer.querySelector(".dc-yt-link")) return; // already added

  const wrap = footer.querySelector(".footer-social") || (() => {
    const d = document.createElement("div");
    d.className = "footer-social dc-admin-ui-allow"; // helper class for your CSS, not stripped
    d.style.display = "flex";
    d.style.gap = "10px";
    d.style.marginTop = "10px";
    footer.appendChild(d);
    return d;
  })();

  const a = document.createElement("a");
  a.href = YOUTUBE_URL;
  a.target = "_blank";
  a.rel = "noopener";
  a.ariaLabel = "YouTube";
  a.className = "dc-yt-link";
  a.style.display = "inline-flex";
  a.style.width = "36px";
  a.style.height = "36px";
  a.style.borderRadius = "999px";
  a.style.alignItems = "center";
  a.style.justifyContent = "center";
  a.style.background = "#cc0000";
  a.style.color = "#fff";
  a.style.boxShadow = "0 6px 16px rgba(0,0,0,.2)";
  a.style.textDecoration = "none";

  a.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M23.5 6.2c-.3-1.2-1.2-2.2-2.4-2.5C19 3.3 12 3.3 12 3.3s-7 0-9.1.4C1.7 4 0.8 5 0.5 6.2 0 8.3 0 12 0 12s0 3.7.5 5.8c.3 1.2 1.2 2.1 2.4 2.4 2.1.5 9.1.5 9.1.5s7 0 9.1-.5c1.2-.3 2.1-1.2 2.4-2.4.5-2.1.5-5.8.5-5.8s0-3.7-.5-5.8zM9.6 15.5V8.5l6.2 3.5-6.2 3.5z"/>
    </svg>
  `;
  wrap.appendChild(a);
}
document.addEventListener("DOMContentLoaded", injectYouTubeIcon, { once: true });
