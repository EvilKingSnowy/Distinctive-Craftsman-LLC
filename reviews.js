// Public: render published reviews + submit new review (goes to pending)
const WORKER_URL = "https://dc-commit.evilkingsnowy.workers.dev";

const listEl = document.getElementById("reviews-list");
const form   = document.getElementById("review-form");
const note   = document.getElementById("review-note");

// Render published reviews from assets/reviews.json
async function renderPublished() {
  if (!listEl) return;
  listEl.innerHTML = "<div>Loading reviews…</div>";
  try {
    const r = await fetch("assets/reviews.json?_=" + Date.now(), { cache: "no-store" });
    const arr = r.ok ? await r.json() : [];
    if (!Array.isArray(arr) || !arr.length) {
      listEl.innerHTML = "<div>No reviews yet.</div>";
      return;
    }
    listEl.innerHTML = "";
    arr.forEach(rv => {
      const card = document.createElement("div");
      card.style.cssText = "border:1px solid #eee; border-radius:10px; padding:14px; box-shadow:0 2px 10px rgba(0,0,0,.04)";
      const stars = "★".repeat(rv.rating || 5) + "☆".repeat(5 - (rv.rating || 5));
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong>${escapeHtml(rv.name||"")}</strong>
          <span aria-label="${rv.rating||5} out of 5">${stars}</span>
        </div>
        <div style="white-space:pre-wrap">${escapeHtml(rv.text||"")}</div>
      `;
      listEl.appendChild(card);
    });
  } catch {
    listEl.innerHTML = "<div>Failed to load reviews.</div>";
  }
}

function escapeHtml(s){return (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}

renderPublished();

// Handle new review submission (no admin key)
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      action: "review-submit",
      name: fd.get("name"),
      rating: Number(fd.get("rating") || 5),
      text: fd.get("text")
    };
    note.textContent = "Submitting…";
    try {
      const r = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        note.textContent = "Thanks! Your review was submitted and is awaiting approval.";
        form.reset();
      } else {
        const t = await r.text();
        note.textContent = "Submission failed: " + t.slice(0,150);
      }
    } catch {
      note.textContent = "Network error. Please try again.";
    }
  });
}
