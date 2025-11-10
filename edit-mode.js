// ===== Distinctive Craftsman – In-page Editor (v2) =====
// - Single Admin button on every page
// - Password gate (to reveal controls)
// - Edit text on headings/paragraphs/lists/etc.
// - Upload image -> click a spot -> image appears immediately
// - Drag to reposition image (absolute inside clicked container)
// - Save commits the current page's HTML via your Cloudflare Worker
//
// Requires your Worker URL and the ADMIN_PASS secret set in Cloudflare.
// Your Worker already supports: action="save" and action="upload".

const WORKER_URL = "https://dc-commit.evilkingsnowy.workers.dev";

let ADMIN_KEY = "";     // collected after "Admin" login
let editing = false;

// -------- Utilities --------
function pagePath() {
  const p = window.location.pathname.split("/").pop();
  return p && p.length ? p : "index.html";
}

// Which elements should be contentEditable during edit mode
const EDITABLE_SELECTORS = [
  "h1","h2","h3","h4","h5","h6",
  "p","li","span","strong","em","blockquote",
  "a","button","figcaption","label"
].join(",");

function setEditing(on) {
  editing = on;
  // Toggle contentEditable on intended text elements (not admin UI)
  document.querySelectorAll(EDITABLE_SELECTORS).forEach(el => {
    if (!el.classList.contains("dc-admin-ui")) {
      el.contentEditable = on ? "true" : "false";
      el.style.outline = on ? "1px dashed rgba(0,0,0,.2)" : "";
    }
  });
  // Keep admin UI non-editable
  document.querySelectorAll(".dc-admin-ui").forEach(el => (el.contentEditable = "false"));
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
  return b;
}

// Remove admin UI + editing marks before saving
function prepareForSave(docElem) {
  // strip admin UI
  docElem.querySelectorAll(".dc-admin-ui").forEach(el => el.remove());

  // convert preview images to their final src
  docElem.querySelectorAll("img[data-final-src]").forEach(img => {
    img.setAttribute("src", img.getAttribute("data-final-src"));
    img.removeAttribute("data-final-src");
  });

  // remove outlines + contentEditable flags
  docElem.querySelectorAll("[contenteditable]").forEach(el => {
    el.removeAttribute("contenteditable");
    el.style.outline = "";
  });

  return docElem;
}

function nowHtmlForSaving() {
  const clone = document.documentElement.cloneNode(true);
  prepareForSave(clone);
  return "<!DOCTYPE html>\n" + clone.outerHTML;
}

// -------- Dragging for images --------
function makeDraggable(el, container) {
  el.classList.add("dc-draggable");
  el.style.position = "absolute";
  el.style.cursor = "move";

  // ensure container anchors positioning
  const style = getComputedStyle(container);
  if (style.position === "static") container.style.position = "relative";

  function onMouseDown(ev) {
    if (!editing) return;
    ev.preventDefault();
    const rect = container.getBoundingClientRect();
    const startX = ev.clientX - (parseFloat(el.style.left || 0));
    const startY = ev.clientY - (parseFloat(el.style.top || 0));

    function onMove(e) {
      const x = e.clientX - startX - rect.left;
      const y = e.clientY - startY - rect.top;
      el.style.left = Math.max(0, x) + "px";
      el.style.top  = Math.max(0, y) + "px";
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  el.addEventListener("mousedown", onMouseDown);
}

// -------- Buttons --------
const adminBtn = makeBtn("Admin", "#6c757d", 20);
const editBtn  = makeBtn("Edit Site", "#0d6efd", 115);
const saveBtn  = makeBtn("Save Changes", "#198754", 215);
const uploadBtn= makeBtn("Upload Image", "#fd7e14", 350);

editBtn.style.display = "none";
saveBtn.style.display = "none";
uploadBtn.style.display = "none";

adminBtn.addEventListener("click", () => {
  const pass = prompt("Enter admin password:");
  if (!pass) return;
  ADMIN_KEY = pass; // Worker will validate on request

  // Reveal editor controls
  editBtn.style.display = "inline-block";
  saveBtn.style.display = "inline-block";
  uploadBtn.style.display = "inline-block";

  alert("Admin unlocked. Click 'Edit Site' to start editing.");
});

editBtn.addEventListener("click", () => {
  setEditing(!editing);
  editBtn.textContent = editing ? "Exit Edit" : "Edit Site";
});

saveBtn.addEventListener("click", async () => {
  if (!ADMIN_KEY) return alert("Unlock Admin first.");

  // Build final HTML and push to Worker
  const html = nowHtmlForSaving();
  const path = pagePath();

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_KEY
    },
    body: JSON.stringify({
      action: "save",
      path,
      contentText: html,
      message: `Update ${path} via editor`
    })
  });

  if (res.ok) {
    alert("✅ Saved! GitHub Pages may take ~30–90s to reflect new assets.");
    // location.reload(); // optional
  } else {
    alert("❌ Save failed:\n" + (await res.text()));
  }
});

// Upload -> place -> draggable + preview
uploadBtn.addEventListener("click", () => {
  if (!ADMIN_KEY) return alert("Unlock Admin first.");
  if (!editing) return alert("Click 'Edit Site' first.");

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.className = "dc-admin-ui";
  input.style.display = "none";
  document.body.appendChild(input);

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    // Read as DataURL for instant preview
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",", 2)[1];
      const destPath = `assets/gallery/${file.name}`;

      // Upload to repo (background commit)
      const up = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": ADMIN_KEY
        },
        body: JSON.stringify({
          action: "upload",
          path: destPath,
          fileBase64: base64,
          message: `Upload ${destPath}`
        })
      });

      if (!up.ok) {
        alert("❌ Upload failed:\n" + (await up.text()));
        input.remove();
        return;
      }

      alert("✅ Image uploaded. Click anywhere on the page to place it.");

      // One-time click to place image
      function placeOnce(ev) {
        // choose nearest sensible container
        let container = ev.target.closest("section, main, article, .container, body") || document.body;

        const img = new Image();
        img.src = dataUrl;                          // instant preview
        img.dataset.finalSrc = destPath;            // saved HTML will use this
        img.alt = file.name;
        img.className = "dc-admin-ui";              // so it's not editable while placing
        img.style.maxWidth = "300px";
        img.style.left = "0px";
        img.style.top = "0px";

        // actual element we want persistent (not admin UI)
        img.classList.remove("dc-admin-ui");
        container.appendChild(img);
        makeDraggable(img, container);

        // position at click
        const crect = container.getBoundingClientRect();
        img.style.left = (ev.clientX - crect.left - img.width/2) + "px";
        img.style.top  = (ev.clientY - crect.top  - img.height/2) + "px";

        document.removeEventListener("click", placeOnce, true);
      }

      // capture first click (use capture phase to win)
      document.addEventListener("click", placeOnce, true);
      input.remove();
    };
    reader.readAsDataURL(file);
  };

  input.click();
});

// Add buttons to the DOM
document.body.appendChild(adminBtn);
document.body.appendChild(editBtn);
document.body.appendChild(saveBtn);
document.body.appendChild(uploadBtn);
