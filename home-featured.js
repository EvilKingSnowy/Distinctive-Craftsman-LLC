fetch("assets/featured.json")
  .then(res => res.json())
  .then(data => {
    // Handle both array form and object form (for compatibility)
    const files = Array.isArray(data) ? data : (data.images || []);

    const container = document.getElementById("home-featured");
    if (!container) return;

    // ✅ Clear previous images so duplicates don’t appear
    container.replaceChildren();

    // ✅ Make sure it only runs once per page load
    if (window.__homeFeaturedLoaded) return;
    window.__homeFeaturedLoaded = true;

    // Grid styling
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
    container.style.gap = "10px";

    // Render images
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
