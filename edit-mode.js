// ===== Distinctive Craftsman — In-Page Editor (v3) =====
// - Admin button (password gate) on every page
// - Edit text anywhere
// - Upload image -> click to place on THIS page -> drag anywhere
// - Delete images you placed
// - Save commits current page HTML via your Cloudflare Worker

const WORKER_URL = "https://dc-commit.evilkingsnowy.workers.dev";

let ADMIN_KEY = "";
let editing = false;
let placingImage = null; // {dataUrl, finalPath, width}

// -------- helpers --------
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const pagePath = () => {
  const p = location.pathname.split("/").pop();
  return p && p.length ? p : "index.html";
};

// build a floating button
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

// keep admin UI out of the save & out of editing
function stripForSave(docElem) {
  // remove controls
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

function currentHtmlForSave() {
  const clone = document.documentElement.cloneNode(true);
  stripForSave(clone);
  return "<!DOCTYPE html>\n" + clone.outerHTML;
}

// ---------- EDIT TEXT ----------
const TEXT_EDIT_SELECTORS = [
  "h1","h2","h3","h4","h5","h6",
  "p","li","span","strong","em","blockquote",
  "a","button","figcaption","label"
].join(",");

function setEditing(on) {
  editing = on;

  // simplest, most compatible: make whole body editable
  // but force admin UI to be non-editable.
  document.body.contentEditable = on ? "true" : "false";
  qsa(".dc-admin-ui").forEach(el => el.contentEditable = "false");

  // add a faint outline for typical text elements so you can see what’s editable
  qsa(TEXT_EDIT_SELECTORS).forEach(el => {
    if (on) {
      el.style.outline = "1px dashed rgba(0,0,0,.2)";
      el.style.outlineOffset = "2px";
    } else {
      el.style.outline = "";
    }
  });

  // images you placed get the drag & toolbar only while editing
  qsa("img[data-dc='1']").forEach(img => {
    if (on) attachDrag(img);
    else detachDrag(img);
  });
}

// ---------- DRAGGING & IMAGE TOOLBAR ----------
function ensureRelative(container) {
  const cs = getComputedStyle(container);
  if (cs.position === "static") container.style.position = "relative";
}

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
  img._dragBound = {onDown, onClick};
}

function detachDrag(img) {
  const b = img._dragBound;
  if (!b) return;
  img.removeEventListener("mousedown", b.onDown);
  img.removeEventListener("click", b.onClick);
  img.style.cursor = "";
  delete img._dragBound;
}

let toolbarDiv = null;
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
function maxGrowWidth(img) {
  const container = img.parentElement;
  const containerW = container ? container.clientWidth : 2000;
  const naturalW = img.naturalWidth || 2000;
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


  // auto hide after a while / or next click away
  setTimeout(() => { if (toolbarDiv) toolbarDiv.remove(); }, 4000);
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

// ---------- IMAGE UPLOAD -> PLACE ON THIS PAGE ----------
async function uploadAndPlace(file) {
  // 1) read for immediate preview
  const dataUrl = await readAsDataURL(file);
  const finalPath = `assets/gallery/${file.name}`;

  // 2) quietly upload to repo via Worker (commit asset)
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
    alert("❌ Upload failed:\n" + await res.text());
    return;
  }

  // 3) ask user to click once to place it on THIS page
  placingImage = { dataUrl, finalPath };
  alert("✅ Image uploaded. Click anywhere on the page to place it. Then drag to reposition.");
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// one-time placement click
document.addEventListener("click", (ev) => {
  if (!placingImage || !editing) return;

  // choose a sensible container near the click
  let container =
    ev.target.closest("section, main, article, .container, .content, .wrapper") ||
    document.body;
  ensureRelative(container);

  // create the image at the clicked spot (absolute)
  const img = new Image();
  img.src = placingImage.dataUrl;          // instant preview
  img.setAttribute("data-final-src", placingImage.finalPath);
  img.setAttribute("data-dc", "1");        // mark as editor-placed
  img.style.position = "absolute";
img.style.maxWidth = "none";   // no cap
img.style.width = "300px";     // starting size; you can grow from here
  img.style.left = "0px";
  img.style.top  = "0px";

  container.appendChild(img);
  attachDrag(img);

  // position centered on the click inside the container
  const crect = container.getBoundingClientRect();
  const x = ev.clientX - crect.left - (img.width / 2);
  const y = ev.clientY - crect.top  - (img.height / 2);
  img.style.left = Math.max(0, x) + "px";
  img.style.top  = Math.max(0, y) + "px";

  placingImage = null;
}, true); // capture so we always get first shot

async function saveCurrentPage() {
  if (!ADMIN_KEY) return alert("Unlock Admin first.");

  // Build final HTML: clone + strip admin UI + add a timestamp marker
  const clone = document.documentElement.cloneNode(true);
  stripForSave(clone);

  const stamp = `<!-- saved:${new Date().toISOString()} -->`;
  const finalHtml = "<!DOCTYPE html>\n" + clone.outerHTML.replace("</body>", `${stamp}\n</body>`);
  const path = (function pagePath(){
    const p = location.pathname.split("/").pop();
    return p && p.length ? p : "index.html";
  })();

  // Send to your Worker (it base64-encodes & commits to GitHub)
  let res, txt;
  try {
    res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": ADMIN_KEY },
      body: JSON.stringify({
        action: "save",
        path,
        contentText: finalHtml,   // primary field
        content: finalHtml,       // fallback field name
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

  // Poll the RAW GitHub file until we see our timestamp, then poll the LIVE site.
  toast("✅ Saved to GitHub. Checking for updates…", 3000);

  const RAW = `https://raw.githubusercontent.com/EvilKingSnowy/Distinctive-Craftsman-LLC/main/${path}`;
  const startRaw = Date.now();
  let rawUpdated = false;

  // Wait up to 60s for raw file to contain our stamp
  while (Date.now() - startRaw < 60000 && !rawUpdated) {
    try {
      const r = await fetch(RAW + "?_=" + Date.now());
      const t = await r.text();
      if (t.includes(stamp)) {
        rawUpdated = true;
        break;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 4000));
  }

  if (!rawUpdated) {
    toast("ℹ️ Commit done, but raw file hasn’t updated yet. It should appear shortly.", 6000);
    return;
  }

  toast("✅ File updated on GitHub. Waiting for GitHub Pages…", 4000);

  // Now wait up to 2 minutes for the LIVE site to serve the new HTML, then auto-reload
  const LIVE_URL = window.location.href.split("#")[0];
  const startLive = Date.now();
  let liveUpdated = false;

  while (Date.now() - startLive < 120000 && !liveUpdated) {
    try {
      const resp = await fetch(LIVE_URL + "?_=" + Date.now(), { cache: "no-store" });
      const txt2 = await resp.text();
      if (txt2.includes(stamp)) {
        liveUpdated = true;
        break;
      }
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
  ADMIN_KEY = pass; // Worker validates it
  editBtn.style.display = "inline-block";
  saveBtn.style.display = "inline-block";
  uploadBtn.style.display = "inline-block";
  alert("Admin unlocked. Click 'Edit Site' to start editing.");
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

// add buttons once
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

document.body.append(adminBtn, editBtn, saveBtn, uploadBtn);
