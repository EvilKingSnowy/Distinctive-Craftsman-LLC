// === Live Edit Mode Script ===
// Allows in-browser editing for authorized users

const WORKER_URL = "https://dc-commit.evilkingsnowy.workers.dev"; // Cloudflare Worker
const USERNAME = "DistinctiveJeff"; // change if you want
const PASSWORD = "TheBetkerSteffensens1107"; // choose any password

let isEditing = false;

function enableEditMode() {
  if (isEditing) return;

  document.body.contentEditable = true;
  document.designMode = "on";
  isEditing = true;
  alert("Edit Mode Enabled — click 'Save Changes' to commit.");
}

async function saveChanges() {
  const html = document.documentElement.outerHTML;
  const page = window.location.pathname.split("/").pop() || "index.html";

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page, html, username: USERNAME, password: PASSWORD }),
  });

  if (res.ok) {
    alert("✅ Changes saved!");
  } else {
    alert("❌ Save failed. Check credentials or Worker logs.");
  }
}

// Add floating edit button
const editButton = document.createElement("button");
editButton.innerText = "✏️ Edit Site";
editButton.style.position = "fixed";
editButton.style.bottom = "20px";
editButton.style.right = "20px";
editButton.style.padding = "10px 15px";
editButton.style.background = "#007bff";
editButton.style.color = "white";
editButton.style.border = "none";
editButton.style.borderRadius = "10px";
editButton.style.cursor = "pointer";
editButton.style.zIndex = "9999";

editButton.onclick = () => {
  const enteredPass = prompt("Enter admin password:");
  if (enteredPass === PASSWORD) enableEditMode();
  else alert("Incorrect password.");
};

document.body.appendChild(editButton);

// Save button (appears after editing)
const saveButton = document.createElement("button");
saveButton.innerText = "💾 Save Changes";
saveButton.style.position = "fixed";
saveButton.style.bottom = "20px";
saveButton.style.right = "120px";
saveButton.style.padding = "10px 15px";
saveButton.style.background = "#28a745";
saveButton.style.color = "white";
saveButton.style.border = "none";
saveButton.style.borderRadius = "10px";
saveButton.style.cursor = "pointer";
saveButton.style.zIndex = "9999";
saveButton.onclick = saveChanges;
document.body.appendChild(saveButton);
