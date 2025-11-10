(function(){
  const el = document.getElementById("home-featured");
  if(!el) return;
  fetch("assets/featured.json?cache="+Date.now())
    .then(r=>r.json())
    .then(list=>{
      if(!Array.isArray(list)||!list.length){ el.innerHTML='<p>Add filenames to assets/featured.json</p>'; return; }
      const grid=document.createElement('div');
      grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(auto-fit,minmax(180px,1fr))'; grid.style.gap='12px';
      list.forEach(name=>{
        const href="assets/gallery/"+name;
        const a=document.createElement('a'); a.href=href; a.target="_blank";
        const img=document.createElement('img'); img.src=href; img.alt=name;
        img.style.width='100%'; img.style.borderRadius='12px'; img.style.boxShadow='0 8px 22px rgba(0,0,0,.12)';
        a.appendChild(img); grid.appendChild(a);
      });
      el.appendChild(grid);
    })
    .catch(()=>{ el.innerHTML='<p>Could not load featured images.</p>'; });
})();
