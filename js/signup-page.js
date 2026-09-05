// signup-page.js
import { auth, onAuthStateChanged } from "./firebase-config.js";
import { signUpAdmin } from "./auth.js";
import { logError } from "./ui.js";

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "/dashboard.html";
});

const form = document.getElementById("signup-form");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Creating your account…";
  try {
    await signUpAdmin({
      fullName: fd.get("fullName"),
      businessName: fd.get("businessName"),
      email: fd.get("email"),
      password: fd.get("password"),
      whatsapp: fd.get("whatsapp"),
      category: fd.get("category"),
    });
    window.location.href = "/dashboard.html?onboarding=1";
  } catch (err) {
    logError("signing up", err);
    btn.disabled = false;
    btn.textContent = "Create account";
  }
});
