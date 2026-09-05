// landing.js
import { auth, onAuthStateChanged } from "./firebase-config.js";

onAuthStateChanged(auth, (user) => {
  const authArea = document.getElementById("nav-auth-area");
  if (!authArea) return;
  if (user) {
    authArea.innerHTML = `
      <a href="/dashboard.html" class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primarydark transition">Go to dashboard</a>`;
  } else {
    authArea.innerHTML = `
      <a href="/login.html" class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-900">Log in</a>
      <a href="/signup.html" class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primarydark transition">Get started</a>`;
  }
});

document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
  document.getElementById("mobile-menu")?.classList.toggle("hidden");
});

const lookupForm = document.getElementById("status-lookup-form");
lookupForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = new FormData(e.target).get("bmz")?.trim();
  if (!id) return;
  window.location.href = `/status.html?bmz=${encodeURIComponent(id)}`;
});
