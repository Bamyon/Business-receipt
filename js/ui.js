// ui.js — shared render/UX helpers
export function naira(amount) {
  const n = Number(amount) || 0;
  return "₦" + n.toLocaleString("en-NG");
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

let toastTimer = null;
export function toast(message, tone = "success") {
  const el = document.getElementById("toast");
  if (!el) return;
  const colors = {
    success: "bg-emerald-900 text-emerald-50",
    error: "bg-rose-900 text-rose-50",
    info: "bg-slate-900 text-slate-50",
  };
  el.className =
    "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 " +
    (colors[tone] || colors.info);
  el.textContent = message;
  el.classList.remove("hidden", "opacity-0", "translate-y-4");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add("opacity-0", "translate-y-4");
    setTimeout(() => el.classList.add("hidden"), 300);
  }, 3200);
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hidden");
  requestAnimationFrame(() => {
    el.querySelector("[data-modal-panel]")?.classList.remove("scale-95", "opacity-0");
  });
  document.body.classList.add("overflow-hidden");
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector("[data-modal-panel]")?.classList.add("scale-95", "opacity-0");
  setTimeout(() => el.classList.add("hidden"), 150);
  document.body.classList.remove("overflow-hidden");
}

export function statusBadge(status) {
  const map = {
    pending: ["Pending", "bg-amber-100 text-amber-800"],
    needs_upload: ["Needs Upload", "bg-orange-100 text-orange-800"],
    approved: ["Approved", "bg-emerald-100 text-emerald-800"],
    rejected: ["Rejected", "bg-rose-100 text-rose-800"],
    refunded: ["Refunded", "bg-slate-200 text-slate-700"],
  };
  const [label, cls] = map[status] || ["Unknown", "bg-slate-100 text-slate-600"];
  return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cls}">${label}</span>`;
}

export function emptyState({ icon, title, body, actionLabel, actionAttr }) {
  return `
  <div class="flex flex-col items-center justify-center text-center py-16 px-6">
    <div class="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl mb-4">${icon}</div>
    <h3 class="font-semibold text-slate-800 mb-1">${title}</h3>
    <p class="text-sm text-slate-500 max-w-sm mb-5">${body}</p>
    ${actionLabel ? `<button ${actionAttr} class="px-5 py-2.5 rounded-xl bg-[#0F6B4C] text-white text-sm font-semibold hover:bg-[#084C36] transition">${actionLabel}</button>` : ""}
  </div>`;
}

/** Logs full error detail to console (for real debugging) and shows a short toast to the user. */
export function logError(context, err) {
  console.error(`[MyPayment] ${context}:`, err);
  toast(err?.message || `Something went wrong (${context})`, "error");
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
