// login-page.js
import { auth, onAuthStateChanged } from "./firebase-config.js";
import { logIn } from "./auth.js";
import { logError } from "./ui.js";

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "/dashboard.html";
});

const form = document.getElementById("login-form");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Logging in…";
  try {
    await logIn(fd.get("email"), fd.get("password"));
    window.location.href = "/dashboard.html";
  } catch (err) {
    logError("logging in", err);
    btn.disabled = false;
    btn.textContent = "Log in";
  }
});
