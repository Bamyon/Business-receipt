// dashboard-page.js
import { auth, onAuthStateChanged } from "./firebase-config.js";
import { getAdminProfile, logOut } from "./auth.js";
import { initDashboard, wireDashboardModals, openProductModal } from "./dashboard.js";
import { openModal, closeModal, toast, logError, escapeHtml } from "./ui.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }
  try {
    const admin = await getAdminProfile(user.uid);
    if (!admin) {
      logError("loading your profile", new Error("No business profile found for this account"));
      return;
    }
    document.getElementById("topbar-business-name").textContent = admin.businessName;
    document.getElementById("topbar-avatar").textContent = (admin.businessName || "?").charAt(0).toUpperCase();

    wireDashboardModals();
    await initDashboard(admin);

    const params = new URLSearchParams(location.search);
    if (params.get("onboarding") === "1") {
      openModal("onboarding-modal");
      history.replaceState({}, "", "/dashboard.html");
    }
  } catch (err) {
    logError("loading your dashboard", err);
  }
});

document.getElementById("logout-btn")?.addEventListener("click", async () => {
  await logOut();
  window.location.href = "/";
});

document.getElementById("onboarding-create-link")?.addEventListener("click", () => {
  closeModal("onboarding-modal");
  location.hash = "products";
  openProductModal();
});
document.getElementById("onboarding-explore")?.addEventListener("click", () => {
  closeModal("onboarding-modal");
});

window.addEventListener("error", (e) => console.error("[MyPayment] Uncaught error:", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => console.error("[MyPayment] Unhandled rejection:", e.reason));
