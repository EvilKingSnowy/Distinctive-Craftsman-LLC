// Render full gallery strictly from assets/gallery.json
(function(){
  const grid = document.getElementById("gallery-grid");
  if (!grid || grid.dataset.populated === "1") return;

  (async () => {
    let files = [];
    try {
      const r = await fetch("assets/gallery.json?_=" + Date.now(), { cache: "no-store" });
      files = r.ok ? await r.json() : [];
    } catch {}
    files = Array.isArray(files) ? files : [];

    grid.innerHTML = "";              // ensure empty before paint
    grid.dataset.populated = "1";

    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
    grid.style.gap = "10px";

    files.forEach(name => {
      const wrap = document.createElement("figure");
      wrap.style.margin = "0";
      wrap.innerHTML = `<img src="assets/gallery/${name}" alt="" style="width:100%; display:block; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,.15)">`;
      grid.appendChild(wrap);
    });
  })();
})();
