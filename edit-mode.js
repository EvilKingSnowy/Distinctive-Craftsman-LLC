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

  const smaller = document.createElement("button");
  smaller.textContent = "−";
  styleMiniBtn(smaller, "#6c757d");
  smaller.onclick = () => img.style.width = Math.max(50, img.clientWidth - 20) + "px";

  const bigger = document.createElement("button");
  bigger.textContent = "+";
  styleMiniBtn(bigger, "#6c757d");
  bigger.onclick = () => img.style.width = (img.clientWidth + 20) + "px";

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
  img.style.maxWidth = "320px";
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

// ---------- SAVE ----------
async function saveCurrentPage() {
  const html = currentHtmlForSave();
  const path = pagePath();

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": ADMIN_KEY },
    body: JSON.stringify({ action: "save", path, contentText: html, message: `Update ${path}` })
  });
  if (res.ok) alert("✅ Saved!");
  else alert("❌ Save failed:\n" + await res.text());
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
document.body.append(adminBtn, editBtn, saveBtn, uploadBtn);
