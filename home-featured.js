// Render "Featured Work" on home page from assets/featured.json or gallery.json
(function(){
  const container = document.getElementById("home-featured");
  if (!container || container.dataset.populated === "1") return;

  async function loadList() {
    // Prefer featured.json; fallback to gallery.json
    const tryFetch = async (p) => {
      try {
        const r = await fetch(p + "?_=" + Date.now(), { cache: "no-store" });
        if (r.ok) return await r.json();
      } catch {}
      return null;
    };
    let files = await tryFetch("assets/featured.json");
    if (!Array.isArray(files) || !files.length) {
      files = await tryFetch("assets/gallery.json");
    }
    return Array.isArray(files) ? files : [];
  }

  (async () => {
    const files = await loadList();
    container.innerHTML = "";                 // clear any hard-coded imgs
    container.dataset.populated = "1";        // do not render twice
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
    container.style.gap = "10px";

    files.forEach(file => {
      const img = document.createElement("img");
      img.src = `assets/gallery/${file}`;
      img.alt = "Featured project";
      img.style.width = "100%";
      img.style.borderRadius = "8px";
      img.style.boxShadow = "0 2px 6px rgba(0,0,0,.15)";
      container.appendChild(img);
    });
  })();
})();
