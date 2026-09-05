// dashboard.js — everything behind the authenticated admin dashboard
import { db, doc, updateDoc } from "./firebase-config.js";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  listProductsForAdmin,
} from "./products.js";
import {
  listPaymentsForAdmin,
  approvePayment,
  rejectPayment,
  refundPayment,
  requestProof,
  confirmationWhatsappLink,
  deriveCustomers,
  listLostIdRequests,
} from "./payments.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { naira, formatDate, toast, statusBadge, openModal, closeModal, emptyState, escapeHtml, logError } from "./ui.js";

let state = {
  admin: null,       // {id, name, businessName, ...}
  products: [],
  payments: [],
  section: "overview",
};

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "products", label: "Products", icon: "📦" },
  { id: "payments", label: "Payments", icon: "💳" },
  { id: "customers", label: "Customers", icon: "👥" },
  { id: "receipts", label: "Receipts", icon: "🧾" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export async function initDashboard(admin) {
  state.admin = admin;
  await refreshData();
  renderShell();
  goToSection(location.hash.replace("#", "") || "overview");
}

async function refreshData() {
  const [products, payments] = await Promise.all([
    listProductsForAdmin(state.admin.id),
    listPaymentsForAdmin(state.admin.id),
  ]);
  state.products = products;
  state.payments = payments;
}

function renderShell() {
  const root = document.getElementById("app-root");
  root.innerHTML = `
  <div class="flex min-h-[calc(100vh-64px)]">
    <aside class="hidden md:flex flex-col w-60 shrink-0 border-r border-slate-200 bg-white py-6 px-3">
      ${NAV_ITEMS.map(n => `
        <button data-nav="${n.id}" class="nav-btn flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 mb-1 text-left">
          <span>${n.icon}</span><span>${n.label}</span>
        </button>`).join("")}
    </aside>

    <div class="flex-1 min-w-0">
      <div class="md:hidden flex overflow-x-auto gap-2 px-4 py-3 border-b border-slate-200 bg-white">
        ${NAV_ITEMS.map(n => `<button data-nav="${n.id}" class="nav-btn shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${n.icon} ${n.label}</button>`).join("")}
      </div>
      <div id="dashboard-content" class="p-5 md:p-8 max-w-6xl mx-auto"></div>
    </div>
  </div>`;

  root.querySelectorAll("[data-nav]").forEach((btn) =>
    btn.addEventListener("click", () => (location.hash = btn.dataset.nav))
  );

  window.addEventListener("hashchange", () => goToSection(location.hash.replace("#", "")));
}

function goToSection(id) {
  if (!NAV_ITEMS.find((n) => n.id === id)) id = "overview";
  state.section = id;
  document.querySelectorAll(".nav-btn").forEach((b) => {
    const active = b.dataset.nav === id;
    b.classList.toggle("bg-emerald-50", active);
    b.classList.toggle("text-[#0F6B4C]", active);
  });
  const renderers = {
    overview: renderOverview,
    products: renderProducts,
    payments: renderPayments,
    customers: renderCustomers,
    receipts: renderReceipts,
    analytics: renderAnalytics,
    settings: renderSettings,
  };
  renderers[id]?.();
}

// ---------------- OVERVIEW ----------------

function renderOverview() {
  const el = document.getElementById("dashboard-content");
  const totalRevenue = state.payments.filter(p => p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const pending = state.payments.filter(p => p.status === "pending" || p.status === "needs_upload").length;
  const completed = state.payments.filter(p => p.status === "approved").length;
  const activeProducts = state.products.filter(p => p.active).length;

  el.innerHTML = `
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-slate-900">Good to see you, ${escapeHtml(state.admin.name?.split(" ")[0] || "there")} 👋</h1>
    <p class="text-slate-500 mt-1">Here's what's happening with your payments today.</p>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    ${statCard("Total Revenue", naira(totalRevenue), "bg-[#0F6B4C]", "text-white")}
    ${statCard("Pending Payments", pending, "bg-white border border-slate-200", "text-slate-900")}
    ${statCard("Completed Orders", completed, "bg-white border border-slate-200", "text-slate-900")}
    ${statCard("Active Products", activeProducts, "bg-white border border-slate-200", "text-slate-900")}
  </div>

  <div class="grid md:grid-cols-3 gap-4 mb-8">
    ${quickAction("📦", "Create Product", "open-product-modal")}
    ${quickAction("💳", "View Payments", "goto-payments")}
    ${quickAction("🧾", "Generate Receipt", "goto-receipts")}
  </div>

  <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Recent payments</div>
    <div id="recent-payments"></div>
  </div>`;

  const recentWrap = el.querySelector("#recent-payments");
  if (!state.payments.length) {
    recentWrap.innerHTML = emptyState({
      icon: "💳",
      title: "Your payment activity will appear here",
      body: "Create your first payment link and start collecting payments.",
      actionLabel: "Create Payment Link",
      actionAttr: 'data-action="open-product-modal"',
    });
  } else {
    recentWrap.innerHTML = paymentsTable(state.payments.slice(0, 6));
  }

  el.querySelectorAll('[data-action="open-product-modal"]').forEach(b => b.addEventListener("click", () => openProductModal()));
  el.querySelector('[data-action="goto-payments"]')?.addEventListener("click", () => (location.hash = "payments"));
  el.querySelector('[data-action="goto-receipts"]')?.addEventListener("click", () => (location.hash = "receipts"));
  el.querySelectorAll("[data-view-bmz]").forEach(row =>
    row.addEventListener("click", () => openPaymentDetail(row.dataset.viewBmz))
  );
}

function statCard(label, value, bg, text) {
  return `<div class="${bg} ${text} rounded-2xl p-5">
    <div class="text-xs font-medium opacity-70 mb-1">${label}</div>
    <div class="text-2xl font-bold">${value}</div>
  </div>`;
}

function quickAction(icon, label, action) {
  return `<button data-action="${action}" class="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-[#0F6B4C]/40 transition text-left">
    <span class="text-xl">${icon}</span><span class="font-medium text-sm text-slate-700">${label}</span>
  </button>`;
}

function paymentsTable(payments) {
  return `<div class="overflow-x-auto">
  <table class="w-full text-sm">
    <thead><tr class="text-left text-slate-400 text-xs uppercase tracking-wide">
      <th class="px-5 py-3">Customer</th><th class="px-5 py-3">Product</th><th class="px-5 py-3">Amount</th>
      <th class="px-5 py-3">BMZ ID</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Date</th>
    </tr></thead>
    <tbody>
    ${payments.map(p => `
      <tr data-view-bmz="${p.bmzId}" class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
        <td class="px-5 py-3 font-medium text-slate-800">${escapeHtml(p.customerName)}</td>
        <td class="px-5 py-3 text-slate-600">${escapeHtml(p.productName)}</td>
        <td class="px-5 py-3 text-slate-800">${naira(p.amount)}</td>
        <td class="px-5 py-3 font-mono text-xs text-slate-500">${p.bmzId}</td>
        <td class="px-5 py-3">${statusBadge(p.status)}</td>
        <td class="px-5 py-3 text-slate-400">${formatDate(p.createdAt)}</td>
      </tr>`).join("")}
    </tbody>
  </table></div>`;
}

// ---------------- PRODUCTS ----------------

function renderProducts() {
  const el = document.getElementById("dashboard-content");
  el.innerHTML = `
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-900">Products</h1>
    <button data-action="new-product" class="px-4 py-2.5 rounded-xl bg-[#0F6B4C] text-white text-sm font-semibold">+ New Product</button>
  </div>
  <div id="products-grid" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>`;

  el.querySelector('[data-action="new-product"]').addEventListener("click", () => openProductModal());

  const grid = el.querySelector("#products-grid");
  if (!state.products.length) {
    grid.className = "";
    grid.innerHTML = emptyState({
      icon: "📦",
      title: "No products yet",
      body: "Create a product to generate your first shareable payment link.",
      actionLabel: "Create Product",
      actionAttr: 'data-action="new-product-empty"',
    });
    grid.querySelector('[data-action="new-product-empty"]').addEventListener("click", () => openProductModal());
    return;
  }

  grid.innerHTML = state.products.map(productCard).join("");
  grid.querySelectorAll("[data-share]").forEach(b => b.addEventListener("click", () => openShareModal(b.dataset.share)));
  grid.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openProductModal(state.products.find(p => p.id === b.dataset.edit))));
  grid.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    await deleteProduct(b.dataset.delete);
    toast("Product deleted");
    await refreshData();
    renderProducts();
  }));
}

function productCard(p) {
  return `<div class="bg-white border border-slate-200 rounded-2xl overflow-hidden group">
    <div class="aspect-video bg-slate-100">
      ${p.imageUrl ? `<img src="${p.imageUrl}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-3xl text-slate-300">📦</div>`}
    </div>
    <div class="p-4">
      <div class="flex items-center justify-between mb-1">
        <span class="font-semibold text-slate-800 truncate">${escapeHtml(p.name)}</span>
        <span class="text-xs px-2 py-0.5 rounded-full ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}">${p.active ? "Active" : "Inactive"}</span>
      </div>
      <div class="text-[#0F6B4C] font-bold mb-1">${naira(p.price)}</div>
      <div class="text-xs text-slate-400 mb-3">${p.stockRemaining != null ? p.stockRemaining + " in stock" : "Unlimited stock"}</div>
      <div class="flex gap-2">
        <button data-share="${p.id}" class="flex-1 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold">Share Link</button>
        <button data-edit="${p.id}" class="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium">Edit</button>
        <button data-delete="${p.id}" class="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-xs font-medium">Del</button>
      </div>
    </div>
  </div>`;
}

export function openProductModal(existing) {
  const modal = document.getElementById("product-modal");
  const form = modal.querySelector("#product-form");
  form.reset();
  form.dataset.editingId = existing?.id || "";
  modal.querySelector("#product-modal-title").textContent = existing ? "Edit product" : "Create product";
  modal.querySelector("#product-image-preview").innerHTML = existing?.imageUrl
    ? `<img src="${existing.imageUrl}" class="w-full h-full object-cover rounded-xl">`
    : "";
  form.imageUrl.value = existing?.imageUrl || "";
  if (existing) {
    form.name.value = existing.name;
    form.description.value = existing.description || "";
    form.price.value = existing.price;
    form.stockLimit.value = existing.stockLimit ?? "";
    form.isJointContribution.checked = !!existing.isJointContribution;
    form.targetAmount.value = existing.targetAmount || "";
    form.crossSellEnabled.checked = !!existing.crossSellEnabled;
    form.querySelectorAll('input[name="paymentModes"]').forEach(cb => {
      cb.checked = (existing.paymentModes || []).includes(cb.value);
    });
  }
  toggleJointFields(form);
  openModal("product-modal");
}

function toggleJointFields(form) {
  form.querySelector("#joint-fields").classList.toggle("hidden", !form.isJointContribution.checked);
}

// ---------------- PAYMENTS ----------------

function renderPayments(filter = "all") {
  const el = document.getElementById("dashboard-content");
  const tabs = ["all", "pending", "needs_upload", "approved", "rejected"];
  const labels = { all: "All", pending: "Pending", needs_upload: "Needs Upload", approved: "Approved", rejected: "Rejected" };

  el.innerHTML = `
  <h1 class="text-2xl font-bold text-slate-900 mb-5">Payments Queue</h1>
  <div class="flex gap-2 mb-5 overflow-x-auto">
    ${tabs.map(t => `<button data-tab="${t}" class="tab-btn shrink-0 px-4 py-2 rounded-full text-sm font-medium border ${t === filter ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600"}">${labels[t]}</button>`).join("")}
  </div>
  <div id="payments-list" class="bg-white border border-slate-200 rounded-2xl overflow-hidden"></div>`;

  el.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => renderPayments(b.dataset.tab)));

  const list = filter === "all" ? state.payments : state.payments.filter(p => p.status === filter);
  const wrap = el.querySelector("#payments-list");
  if (!list.length) {
    wrap.innerHTML = emptyState({ icon: "💳", title: "Nothing here", body: "No payments match this filter yet." });
    return;
  }
  wrap.innerHTML = paymentsTable(list);
  wrap.querySelectorAll("[data-view-bmz]").forEach(row => row.addEventListener("click", () => openPaymentDetail(row.dataset.viewBmz)));
}

async function openPaymentDetail(bmzId) {
  const payment = state.payments.find(p => p.bmzId === bmzId);
  if (!payment) return;
  const product = state.products.find(p => p.id === payment.productId);

  const modal = document.getElementById("payment-modal");
  modal.querySelector("#payment-modal-body").innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-mono text-xs text-slate-400">${payment.bmzId}</div>
          <div class="font-bold text-lg text-slate-900">${escapeHtml(payment.customerName)}</div>
        </div>
        ${statusBadge(payment.status)}
      </div>
      <div class="grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-xl p-4">
        <div><span class="text-slate-400 block text-xs">Product</span>${escapeHtml(payment.productName)}</div>
        <div><span class="text-slate-400 block text-xs">Amount</span>${naira(payment.amount)}</div>
        <div><span class="text-slate-400 block text-xs">WhatsApp</span>${escapeHtml(payment.whatsapp)}</div>
        <div><span class="text-slate-400 block text-xs">Date</span>${formatDate(payment.createdAt)}</div>
      </div>
      ${payment.proofUrl ? `<div><span class="text-slate-400 block text-xs mb-1.5">Proof of payment</span><img src="${payment.proofUrl}" class="rounded-xl border border-slate-200 max-h-64"></div>` : ""}
      <div class="flex flex-wrap gap-2 pt-2">
        ${payment.status !== "approved" ? `<button data-act="approve" class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">Approve Payment</button>` : ""}
        ${payment.status !== "rejected" ? `<button data-act="reject" class="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold">Reject Payment</button>` : ""}
        ${payment.status === "pending" ? `<button data-act="request-proof" class="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium">Request Proof</button>` : ""}
        <a data-act="whatsapp" target="_blank" class="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium">Send WhatsApp</a>
        ${payment.status === "approved" ? `<button data-act="receipt" class="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium">Generate Receipt</button>` : ""}
      </div>
    </div>`;

  const body = modal.querySelector("#payment-modal-body");
  body.querySelector('[data-act="whatsapp"]')?.setAttribute("href", confirmationWhatsappLink(payment));
  body.querySelector('[data-act="approve"]')?.addEventListener("click", async () => {
    await approvePayment(payment.bmzId, product);
    toast("Payment approved 🎉");
    await refreshData();
    closeModal("payment-modal");
    goToSection(state.section);
  });
  body.querySelector('[data-act="reject"]')?.addEventListener("click", async () => {
    await rejectPayment(payment.bmzId);
    toast("Payment rejected", "info");
    await refreshData();
    closeModal("payment-modal");
    goToSection(state.section);
  });
  body.querySelector('[data-act="request-proof"]')?.addEventListener("click", async () => {
    await requestProof(payment.bmzId);
    toast("Proof requested from customer");
    await refreshData();
    closeModal("payment-modal");
    goToSection(state.section);
  });
  body.querySelector('[data-act="receipt"]')?.addEventListener("click", () => {
    closeModal("payment-modal");
    openReceiptStandalone(payment);
  });

  openModal("payment-modal");
}

// ---------------- CUSTOMERS ----------------

function renderCustomers() {
  const el = document.getElementById("dashboard-content");
  const customers = deriveCustomers(state.payments);
  el.innerHTML = `<h1 class="text-2xl font-bold text-slate-900 mb-5">Customers</h1>
  <div id="customers-list" class="bg-white border border-slate-200 rounded-2xl overflow-hidden"></div>`;

  const wrap = el.querySelector("#customers-list");
  if (!customers.length) {
    wrap.innerHTML = emptyState({ icon: "👥", title: "No customers yet", body: "Once people start paying, they'll show up here." });
    return;
  }
  wrap.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-slate-400 text-xs uppercase tracking-wide">
      <th class="px-5 py-3">Name</th><th class="px-5 py-3">WhatsApp</th><th class="px-5 py-3">Orders</th><th class="px-5 py-3">Total Spent</th><th class="px-5 py-3"></th>
    </tr></thead>
    <tbody>
    ${customers.map(c => `<tr class="border-t border-slate-100">
      <td class="px-5 py-3 font-medium text-slate-800">${escapeHtml(c.name)}</td>
      <td class="px-5 py-3 text-slate-500">${escapeHtml(c.whatsapp || "—")}</td>
      <td class="px-5 py-3">${c.totalOrders}</td>
      <td class="px-5 py-3 font-semibold text-slate-800">${naira(c.totalSpent)}</td>
      <td class="px-5 py-3">${c.whatsapp ? `<a target="_blank" href="https://wa.me/${c.whatsapp.replace(/[^0-9]/g, "")}" class="text-[#0F6B4C] text-xs font-semibold">Message</a>` : ""}</td>
    </tr>`).join("")}
    </tbody></table></div>`;
}

// ---------------- RECEIPTS ----------------

function renderReceipts() {
  const el = document.getElementById("dashboard-content");
  const approved = state.payments.filter(p => p.status === "approved");
  el.innerHTML = `<h1 class="text-2xl font-bold text-slate-900 mb-5">Receipts</h1>
  <div id="receipts-list" class="bg-white border border-slate-200 rounded-2xl overflow-hidden"></div>`;
  const wrap = el.querySelector("#receipts-list");
  if (!approved.length) {
    wrap.innerHTML = emptyState({ icon: "🧾", title: "No receipts yet", body: "Receipts appear here once a payment is approved." });
    return;
  }
  wrap.innerHTML = paymentsTable(approved);
  wrap.querySelectorAll("[data-view-bmz]").forEach(row => {
    row.addEventListener("click", () => {
      const p = state.payments.find(x => x.bmzId === row.dataset.viewBmz);
      openReceiptStandalone(p);
    });
  });
}

export function openReceiptStandalone(payment) {
  const modal = document.getElementById("receipt-modal");
  modal.querySelector("#receipt-body").innerHTML = `
    <div id="receipt-print" class="p-6">
      <div class="text-center mb-6">
        <div class="font-bold text-lg text-[#0F6B4C]">MyPayment</div>
        <div class="text-xs text-slate-400">${escapeHtml(state.admin?.businessName || "")}</div>
      </div>
      <div class="text-center mb-6">
        <div class="text-xs uppercase tracking-wide text-slate-400">Receipt</div>
        <div class="font-mono text-sm font-semibold">${payment.bmzId}</div>
      </div>
      <div class="space-y-2 text-sm border-t border-b border-dashed border-slate-200 py-4">
        <div class="flex justify-between"><span class="text-slate-400">Customer</span><span class="font-medium">${escapeHtml(payment.customerName)}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">Product</span><span class="font-medium">${escapeHtml(payment.productName)}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">Quantity</span><span class="font-medium">${payment.quantity}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">Amount</span><span class="font-medium">${naira(payment.amount)}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">Date</span><span class="font-medium">${formatDate(payment.approvedAt || payment.createdAt)}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">Status</span>${statusBadge(payment.status)}</div>
      </div>
      <div class="text-center text-xs text-slate-400 mt-6">Thank you for your patronage 🙏</div>
    </div>`;
  openModal("receipt-modal");
}

// ---------------- ANALYTICS ----------------

function renderAnalytics() {
  const el = document.getElementById("dashboard-content");
  const approved = state.payments.filter(p => p.status === "approved");
  const totalRevenue = approved.reduce((s, p) => s + p.amount, 0);
  const avgOrder = approved.length ? Math.round(totalRevenue / approved.length) : 0;

  const byProduct = {};
  approved.forEach(p => { byProduct[p.productName] = (byProduct[p.productName] || 0) + p.amount; });
  const top = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top.length ? top[0][1] : 1;

  el.innerHTML = `
  <h1 class="text-2xl font-bold text-slate-900 mb-5">Analytics</h1>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    ${statCard("Total Revenue", naira(totalRevenue), "bg-[#0F6B4C]", "text-white")}
    ${statCard("Completed", approved.length, "bg-white border border-slate-200", "text-slate-900")}
    ${statCard("Pending", state.payments.filter(p => p.status === "pending" || p.status === "needs_upload").length, "bg-white border border-slate-200", "text-slate-900")}
    ${statCard("Avg. Order", naira(avgOrder), "bg-white border border-slate-200", "text-slate-900")}
  </div>
  <div class="bg-white border border-slate-200 rounded-2xl p-6">
    <div class="font-semibold text-slate-800 mb-4">Top products by revenue</div>
    ${top.length ? top.map(([name, amt]) => `
      <div class="mb-3">
        <div class="flex justify-between text-sm mb-1"><span class="text-slate-600">${escapeHtml(name)}</span><span class="font-semibold">${naira(amt)}</span></div>
        <div class="h-2 rounded-full bg-slate-100"><div class="h-full rounded-full bg-[#0F6B4C]" style="width:${Math.round((amt/max)*100)}%"></div></div>
      </div>`).join("") : `<p class="text-sm text-slate-400">No completed sales yet.</p>`}
  </div>`;
}

// ---------------- SETTINGS ----------------

function renderSettings() {
  const el = document.getElementById("dashboard-content");
  const a = state.admin;
  el.innerHTML = `
  <h1 class="text-2xl font-bold text-slate-900 mb-5">Settings</h1>
  <form id="settings-form" class="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg space-y-4">
    <div><label class="text-sm font-medium text-slate-700">Business name</label>
      <input name="businessName" value="${escapeHtml(a.businessName || "")}" class="mt-1 w-full rounded-lg border-slate-300 text-sm"></div>
    <div><label class="text-sm font-medium text-slate-700">WhatsApp number</label>
      <input name="whatsapp" value="${escapeHtml(a.whatsapp || "")}" class="mt-1 w-full rounded-lg border-slate-300 text-sm"></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-sm font-medium text-slate-700">Bank name</label>
        <input name="bankName" value="${escapeHtml(a.bankName || "")}" class="mt-1 w-full rounded-lg border-slate-300 text-sm"></div>
      <div><label class="text-sm font-medium text-slate-700">Account name</label>
        <input name="accountName" value="${escapeHtml(a.accountName || "")}" class="mt-1 w-full rounded-lg border-slate-300 text-sm"></div>
    </div>
    <div><label class="text-sm font-medium text-slate-700">Account number</label>
      <input name="accountNumber" value="${escapeHtml(a.accountNumber || "")}" class="mt-1 w-full rounded-lg border-slate-300 text-sm"></div>
    <button class="w-full py-3 rounded-xl bg-[#0F6B4C] text-white font-semibold">Save changes</button>
  </form>`;

  el.querySelector("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updates = Object.fromEntries(fd.entries());
    await updateDoc(doc(db, "admins", state.admin.id), updates);
    Object.assign(state.admin, updates);
    toast("Settings saved");
  });
}

// ---------------- SHARE MODAL ----------------

function openShareModal(productId) {
  const link = `${location.origin}/product.html?id=${productId}`;
  const modal = document.getElementById("share-modal");
  modal.querySelector("#share-link-input").value = link;
  modal.querySelector("#share-whatsapp").href = `https://wa.me/?text=${encodeURIComponent(link)}`;
  modal.querySelector("#share-open").href = link;
  openModal("share-modal");
}

// ---------------- WIRE STATIC MODALS (called once from app.js) ----------------

export function wireDashboardModals() {
  // Product modal
  const productModal = document.getElementById("product-modal");
  const form = productModal.querySelector("#product-form");

  form.isJointContribution.addEventListener("change", () => toggleJointFields(form));

  productModal.querySelector("#product-image-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = productModal.querySelector("#product-image-preview");
    preview.innerHTML = `<div class="text-xs text-slate-400 p-2">Uploading…</div>`;
    try {
      const url = await uploadToCloudinary(file);
      form.imageUrl.value = url;
      preview.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-xl">`;
    } catch (err) {
      logError("uploading product image", err);
      preview.innerHTML = "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {
      name: fd.get("name"),
      description: fd.get("description"),
      price: fd.get("price"),
      imageUrl: fd.get("imageUrl"),
      stockLimit: fd.get("stockLimit") || null,
      isJointContribution: fd.get("isJointContribution") === "on",
      targetAmount: fd.get("targetAmount"),
      crossSellEnabled: fd.get("crossSellEnabled") === "on",
      paymentModes: fd.getAll("paymentModes"),
    };
    const editingId = form.dataset.editingId;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      if (editingId) {
        await updateProduct(editingId, data);
        toast("Product updated");
      } else {
        const id = await createProduct(state.admin.id, data);
        toast("Payment link created 🎉");
        await refreshData();
        closeModal("product-modal");
        openShareModal(id);
        goToSection(state.section);
        btn.disabled = false;
        btn.textContent = "Save product";
        return;
      }
      await refreshData();
      closeModal("product-modal");
      goToSection(state.section);
    } catch (err) {
      logError("saving product", err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save product";
    }
  });

  document.querySelectorAll("[data-close-modal]").forEach(btn =>
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal))
  );

  document.getElementById("share-copy").addEventListener("click", () => {
    const input = document.getElementById("share-link-input");
    input.select();
    navigator.clipboard.writeText(input.value);
    toast("Link copied");
  });

  document.getElementById("receipt-print-btn").addEventListener("click", () => window.print());
}
