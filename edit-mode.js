// ============ Distinctive Craftsman – Edit Mode ============
// Shows an Admin button on every page. After login, allows
// in-browser editing, saving the page HTML, and uploading images.

const WORKER_URL = "https://dc-commit.evilkingsnowy.workers.dev";

let ADMIN_KEY = "";     // set after login
let editing = false;

// Utility: find current page path (index.html when path ends with /)
function currentPagePath() {
  const p = window.location.pathname.split("/").pop();
  return p && p.length ? p : "index.html";
}

// Build a small admin UI button
function makeBtn(label, bg, rightPx) {
  const b = document.createElement("button");
  b.textContent = label;
  b.className = "dc-admin-ui";
  b.style.position = "fixed";
  b.style.bottom = "20px";
  b.style.right = rightPx + "px";
  b.style.padding = "10px 14px";
  b.style.background = bg;
  b.style.color = "#fff";
  b.style.border = "none";
  b.style.borderRadius = "10px";
  b.style.fontSize = "14px";
  b.style.cursor = "pointer";
  b.style.zIndex = "999999";
  b.contentEditable = "false";
  return b;
}

// Remove admin UI before capturing HTML for saving
function stripAdminUIFrom(docElem) {
  docElem.querySelectorAll(".dc-admin-ui").forEach(el => el.remove());
  return docElem;
}

// ---- Login (password prompt) ----
const adminBtn = makeBtn("Admin", "#6c757d", 20);
adminBtn.addEventListener("click", async () => {
  const pass = prompt("Enter admin password:");
  if (!pass) return;

  // We don't validate here; Worker will reject if wrong.
  ADMIN_KEY = pass;

  // Show edit/upload/save buttons
  editBtn.style.display = "inline-block";
  saveBtn.style.display = "inline-block";
  uploadBtn.style.display = "inline-block";
  alert("Admin unlocked. You can now edit.");
});

document.body.appendChild(adminBtn);

// ---- Edit on/off ----
const editBtn = makeBtn("Edit Site", "#0d6efd", 110);
editBtn.style.display = "none";
editBtn.addEventListener("click", () => {
  editing = !editing;
  document.body.contentEditable = editing ? "true" : "false";
  document.designMode = editing ? "on" : "off";
  // keep controls non-editable
  document.querySelectorAll(".dc-admin-ui").forEach(el => (el.contentEditable = "false"));
  editBtn.textContent = editing ? "Exit Edit" : "Edit Site";
});

// ---- Save current page HTML ----
const saveBtn = makeBtn("Save Changes", "#198754", 210);
saveBtn.style.display = "none";
saveBtn.addEventListener("click", async () => {
  if (!ADMIN_KEY) return alert("Unlock Admin first.");

  // Clone current document, strip admin UI, serialize HTML
  const clone = document.documentElement.cloneNode(true);
  stripAdminUIFrom(clone);

  // ensure our script tag stays (so buttons show next time)
  // (no-op here because we never removed it)

  const fullHtml = "<!DOCTYPE html>\n" + clone.outerHTML;
  const path = currentPagePath();

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_KEY,
    },
    body: JSON.stringify({
      action: "save",
      path: path,                 // e.g. index.html, about.html
      contentText: fullHtml,      // Worker base64-encodes it
      message: `Update ${path} via in-page editor`,
    }),
  });

  if (res.ok) {
    alert("✅ Saved!");
    // Optionally refresh to see the new content
    // location.reload();
  } else {
    const t = await res.text();
    alert("❌ Save failed:\n" + t);
  }
});
document.body.appendChild(saveBtn);

// ---- Upload image to assets/gallery/ ----
const uploadBtn = makeBtn("Upload Image", "#fd7e14", 340);
uploadBtn.style.display = "none";
uploadBtn.addEventListener("click", async () => {
  if (!ADMIN_KEY) return alert("Unlock Admin first.");

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.className = "dc-admin-ui";
  input.style.display = "none";
  document.body.appendChild(input);

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    // read file into base64
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result; // e.g., "data:image/png;base64,AAA..."
      const base64 = dataUrl.split(",", 2)[1]; // strip the prefix

      const destPath = `assets/gallery/${file.name}`;

      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": ADMIN_KEY,
        },
        body: JSON.stringify({
          action: "upload",
          path: destPath,
          fileBase64: base64,          // already base64
          message: `Upload ${destPath}`,
        }),
      });

      if (res.ok) {
        alert("✅ Image uploaded to " + destPath);
      } else {
        alert("❌ Upload failed: " + (await res.text()));
      }
      input.remove();
    };
    reader.readAsDataURL(file);
  };

  input.click();
});
document.body.appendChild(uploadBtn);
