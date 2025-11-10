// Handles public review submissions and loads approved reviews
const WORKER_URL = "https://dc-commit.evilkingsnowy.workers.dev";
const listEl = document.getElementById("reviews-list");
const form = document.getElementById("review-form");
const note = document.getElementById("review-note");

// Load and display published reviews
async function renderReviews() {
  if (!listEl) return;
  listEl.innerHTML = "<div>Loading reviews…</div>";
  try {
    const r = await fetch("assets/reviews.json?_=" + Date.now(), { cache: "no-store" });
    const data = r.ok ? await r.json() : [];
    if (!Array.isArray(data) || data.length === 0) {
      listEl.innerHTML = "<div>No reviews yet. Be the first to leave one!</div>";
      return;
    }
    listEl.innerHTML = "";
    data.forEach(rv => {
      const div = document.createElement("div");
      div.style.cssText = "border:1px solid #eee;border-radius:10px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.05)";
      const stars = "★".repeat(rv.rating || 5) + "☆".repeat(5 - (rv.rating || 5));
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <strong>${escapeHtml(rv.name || "")}</strong>
          <span>${stars}</span>
        </div>
        <div style="white-space:pre-wrap;">${escapeHtml(rv.text || "")}</div>
      `;
      listEl.appendChild(div);
    });
  } catch {
    listEl.innerHTML = "<div>Failed to load reviews.</div>";
  }
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

renderReviews();

// Handle new review form
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    note.textContent = "Submitting…";
    const fd = new FormData(form);
    const payload = {
      action: "review-submit",
      name: fd.get("name"),
      rating: Number(fd.get("rating") || 5),
      text: fd.get("text")
    };
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        note.textContent = "✅ Thank you! Your review is pending approval.";
        form.reset();
      } else {
        note.textContent = "❌ Failed to submit review.";
      }
    } catch {
      note.textContent = "❌ Network error. Please try again.";
    }
  });
}
