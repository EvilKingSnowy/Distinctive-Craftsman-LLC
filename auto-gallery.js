(function() {
  const GITHUB_USER = "EvilKingSnowy";      // your GitHub username
  const REPO_NAME   = "Distinctive-Craftsman-LLC"; // your repo name
  const GALLERY_PATH = "assets/gallery";    // folder for your photos
  const container = document.getElementById("auto-gallery");
  if (!container) return;

  const api = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/${GALLERY_PATH}`;

  fetch(api)
    .then(r => r.json())
    .then(items => {
      if (!Array.isArray(items)) return;
      const images = items.filter(it => /\.(png|jpe?g|webp|gif)$/i.test(it.name));
      if (!images.length) {
        container.innerHTML = '<p>Upload images to <code>assets/gallery</code> and they will appear here automatically.</p>';
        return;
      }
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
      grid.style.gap = '12px';
      images.forEach(it => {
        const a = document.createElement('a');
        a.href = it.download_url;
        a.target = '_blank';
        const img = document.createElement('img');
        img.src = it.download_url;
        img.alt = it.name;
        img.style.width = '100%';
        img.style.borderRadius = '12px';
        img.style.boxShadow = '0 8px 22px rgba(0,0,0,.12)';
        a.appendChild(img);
        grid.appendChild(a);
      });
      container.appendChild(grid);
    })
    .catch(err => {
      console.error('AutoGallery error:', err);
      container.innerHTML = '<p>Could not load gallery. Try reloading the page.</p>';
    });
})();
