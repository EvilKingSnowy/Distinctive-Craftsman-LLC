// ===== Distinctive Craftsman - Lightweight Edit Mode =====
const DC_PASSCODE = "craftsman123"; // <- change your passcode
const DC_FEATURED_JSON_PATH = "assets/featured.json";
const DC_FEATURED_EDIT_URL =
  "https://github.com/EvilKingSnowy/Distinctive-Craftsman-LLC/edit/main/assets/featured.json";

async function dcLoadFeaturedList() {
  try {
    const res = await fetch(DC_FEATURED_JSON_PATH + "?_=" + Date.now());
    const data = await res.json();
    return Array.isArray(data) ? data : (data.images || []);
  } catch (e) {
    console.error("Load featured.json failed", e);
    return [];
  }
}
function dcDownload(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

(function () {
  const btn = document.createElement("button");
  btn.textContent = "Admin";
  btn.style.position = "fixed";
  btn.style.right = "18px";
  btn.style.bottom = "18px";
  btn.style.zIndex = "9999";
  btn.style.padding = "10px 14px";
  btn.style.border = "none";
  btn.style.borderRadius = "999px";
  btn.style.boxShadow = "0 6px 18px rgba(0,0,0,.18)";
  btn.style.cursor = "pointer";
  btn.style.background = "#7b5a28";
  btn.style.color = "#fff";
  btn.style.fontWeight = "600";
  btn.style.fontFamily = "inherit";
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(btn);
  });
  btn.addEventListener("click", async () => {
    const code = prompt("Enter admin passcode:");
    if (!code) return;
    if (code !== DC_PASSCODE) return alert("Incorrect passcode.");
    dcEnterEditMode();
  });
})();

async function dcEnterEditMode() {
  const wrap = document.getElementById("home-featured");
  if (!wrap) return alert("Edit Mode: 'home-featured' section not found.");

  let files = [];
  wrap.querySelectorAll("img").forEach(img => {
    const src = img.getAttribute("src") || "";
    const name = src.split("/").pop();
    if (name) files.push(name);
  });
  if (!files.length) files = await dcLoadFeaturedList();
  if (!files.length) return alert("No featured images found.");

  const bar = document.createElement("div");
  bar.style.position = "fixed";
  bar.style.right = "18px";
  bar.style.bottom = "78px";
  bar.style.zIndex = "10000";
  bar.style.background = "#0f172a";
  bar.style.color = "#fff";
  bar.style.padding = "12px";
  bar.style.borderRadius = "12px";
  bar.style.boxShadow = "0 10px 28px rgba(0,0,0,.28)";
  bar.style.width = "280px";
  bar.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;">Edit Mode</div>
    <div id="dc-sort-list" style="max-height:260px;overflow:auto;margin-bottom:10px;"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="dc-save" style="flex:1;padding:8px 10px;border:none;border-radius:8px;background:#22c55e;color:#062;font-weight:700">Save JSON</button>
      <button id="dc-open" style="flex:1;padding:8px 10px;border:none;border-radius:8px;background:#60a5fa;color:#021;font-weight:700">Open in GitHub</button>
      <button id="dc-exit" style="flex:1;padding:8px 10px;border:none;border-radius:8px;background:#f59e0b;color:#210;font-weight:700">Exit</button>
    </div>
    <div style="margin-top:8px;font-size:12px;opacity:.8">
      Drag to reorder → Save → paste into GitHub editor and Commit.
    </div>
  `;
  document.body.appendChild(bar);

  const list = bar.querySelector("#dc-sort-list");
  files.forEach(name => {
    const row = document.createElement("div");
    row.draggable = true;
    row.dataset.name = name;
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.padding = "6px";
    row.style.marginBottom = "6px";
    row.style.background = "#111827";
    row.style.border = "1px solid #1f2937";
    row.style.borderRadius = "8px";
    row.innerHTML = `
      <div style="width:34px;height:24px;overflow:hidden;border-radius:6px">
        <img src="assets/gallery/${name}" style="width:100%;height:100%;object-fit:cover" />
      </div>
      <div style="flex:1;word-break:break-all">${name}</div>
      <div style="cursor:grab">☰</div>
    `;
    row.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", name);
      row.style.opacity = ".5";
    });
    row.addEventListener("dragend", () => (row.style.opacity = "1"));
    row.addEventListener("dragover", e => e.preventDefault());
    row.addEventListener("drop", e => {
      e.preventDefault();
      const from = e.dataTransfer.getData("text/plain");
      const to = row.dataset.name;
      const items = [...list.children].map(c => c.dataset.name);
      const fromIdx = items.indexOf(from);
      const toIdx = items.indexOf(to);
      if (fromIdx === -1 || toIdx === -1) return;
      if (fromIdx < toIdx) list.insertBefore(list.children[fromIdx], list.children[toIdx].nextSibling);
      else list.insertBefore(list.children[fromIdx], list.children[toIdx]);
    });
    list.appendChild(row);
  });

  bar.querySelector("#dc-exit").onclick = () => bar.remove();

  bar.querySelector("#dc-save").onclick = () => {
    const newOrder = [...list.children].map(c => c.dataset.name);
    const json = JSON.stringify({ images: newOrder }, null, 2);
    dcDownload("featured.json", json);
    alert("Downloaded featured.json.\nUpload it to assets/featured.json in GitHub and Commit.");
  };

  bar.querySelector("#dc-open").onclick = () => {
    window.open(DC_FEATURED_EDIT_URL, "_blank");
  };
}
