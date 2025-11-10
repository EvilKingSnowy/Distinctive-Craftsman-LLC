fetch("assets/featured.json")
  .then(res => res.json())
  .then(data => {
    const files = Array.isArray(data) ? data : (data.images || []);
    const container = document.getElementById("home-featured");
    if (!container) return;
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
    container.style.gap = "10px";
    files.forEach(file => {
      const img = document.createElement("img");
      img.src = `assets/gallery/${file}`;
      img.alt = "Featured project";
      img.style.width = "100%";
      img.style.borderRadius = "8px";
      img.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
      container.appendChild(img);
    });
  });
