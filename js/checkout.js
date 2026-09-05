// checkout.js — public, no-auth-required customer flows
import { getProduct, listActiveProductsForCrossSell } from "./products.js";
import {
  submitPayment,
  attachProof,
  getPaymentByBmzId,
  orderWhatsappLink,
  submitLostIdRequest,
} from "./payments.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { naira, formatDate, toast, statusBadge, escapeHtml, logError } from "./ui.js";

// ---------- CHECKOUT ----------

export async function renderCheckoutPage(productId) {
  const root = document.getElementById("app-root");
  root.innerHTML = `<div class="max-w-4xl mx-auto py-16 text-center text-slate-400">Loading product…</div>`;

  const product = await getProduct(productId);
  if (!product) {
    root.innerHTML = `<div class="max-w-lg mx-auto py-24 text-center">
      <div class="text-4xl mb-4">🔍</div>
      <h2 class="text-xl font-bold text-slate-800 mb-2">Product not found</h2>
      <p class="text-slate-500 mb-6">This payment link may have been removed or the product deleted.</p>
      <a href="/" class="text-[#0F6B4C] font-semibold">← Back to MyPayment</a>
    </div>`;
    return;
  }

  const crossSell = product.crossSellEnabled
    ? await listActiveProductsForCrossSell(product.adminId, product.id)
    : [];

  const pct = product.isJointContribution
    ? Math.min(100, Math.round(((product.currentAmount || 0) / (product.targetAmount || 1)) * 100))
    : 0;

  root.innerHTML = `
  <div class="max-w-5xl mx-auto px-4 py-10">
    <a href="/" class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">← MyPayment</a>
    <div class="grid md:grid-cols-2 gap-10">
      <div>
        <div class="aspect-square rounded-2xl bg-slate-100 overflow-hidden mb-5 border border-slate-200">
          ${product.imageUrl
            ? `<img src="${product.imageUrl}" class="w-full h-full object-cover" alt="${escapeHtml(product.name)}">`
            : `<div class="w-full h-full flex items-center justify-center text-5xl text-slate-300">📦</div>`}
        </div>
        <h1 class="text-2xl font-bold text-slate-900">${escapeHtml(product.name)}</h1>
        <p class="text-slate-500 mt-2 leading-relaxed">${escapeHtml(product.description || "")}</p>
        <div class="text-2xl font-bold text-[#0F6B4C] mt-4">${naira(product.price)}</div>

        ${product.isJointContribution ? `
        <div class="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <div class="flex justify-between text-sm mb-2">
            <span class="font-semibold text-emerald-900">${naira(product.currentAmount || 0)} raised</span>
            <span class="text-emerald-700">${pct}% funded</span>
          </div>
          <div class="h-2 rounded-full bg-emerald-100 overflow-hidden">
            <div class="h-full bg-[#0F6B4C] rounded-full" style="width:${pct}%"></div>
          </div>
          <div class="text-xs text-emerald-700 mt-2">Target ${naira(product.targetAmount)} · ${product.contributorCount || 0} contributors</div>
        </div>` : ""}

        <button data-lost-id class="mt-6 text-sm text-slate-500 underline decoration-dotted hover:text-slate-800">
          Lost your BMZ ID?
        </button>

        ${crossSell.length ? `
        <div class="mt-8">
          <div class="text-sm font-semibold text-slate-700 mb-3">You might also like</div>
          <div class="flex gap-3 overflow-x-auto pb-2">
            ${crossSell.map(cs => `
              <a href="/product.html?id=${cs.id}" class="shrink-0 w-32 group">
                <div class="w-32 h-32 rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                  ${cs.imageUrl ? `<img src="${cs.imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition" />` : ""}
                </div>
                <div class="text-xs font-medium text-slate-700 mt-1.5 truncate">${escapeHtml(cs.name)}</div>
                <div class="text-xs text-slate-400">${naira(cs.price)}</div>
              </a>
            `).join("")}
          </div>
        </div>` : ""}
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit">
        <div id="checkout-form-wrap"></div>
      </div>
    </div>
  </div>`;

  renderCheckoutForm(root.querySelector("#checkout-form-wrap"), product);
  root.querySelector("[data-lost-id]")?.addEventListener("click", () => openLostIdModal(product));
}

function renderCheckoutForm(el, product) {
  el.innerHTML = `
  <h2 class="font-bold text-slate-900 mb-4">Your details</h2>
  <form id="checkout-form" class="space-y-4">
    <div>
      <label class="text-sm font-medium text-slate-700">Full name</label>
      <input required name="fullName" class="mt-1 w-full rounded-lg border-slate-300 focus:border-[#0F6B4C] focus:ring-[#0F6B4C] text-sm" />
    </div>
    <div>
      <label class="text-sm font-medium text-slate-700">WhatsApp number</label>
      <input required name="whatsapp" placeholder="080..." class="mt-1 w-full rounded-lg border-slate-300 focus:border-[#0F6B4C] focus:ring-[#0F6B4C] text-sm" />
    </div>
    <div>
      <label class="text-sm font-medium text-slate-700">Email <span class="text-slate-400">(optional)</span></label>
      <input type="email" name="email" class="mt-1 w-full rounded-lg border-slate-300 focus:border-[#0F6B4C] focus:ring-[#0F6B4C] text-sm" />
    </div>
    <div>
      <label class="text-sm font-medium text-slate-700">Quantity</label>
      <input required type="number" min="1" value="1" name="quantity" class="mt-1 w-full rounded-lg border-slate-300 focus:border-[#0F6B4C] focus:ring-[#0F6B4C] text-sm" />
    </div>

    <div class="pt-2 border-t border-slate-100">
      <label class="text-sm font-medium text-slate-700 block mb-2">Payment method</label>
      <div class="grid grid-cols-2 gap-3">
        ${(product.paymentModes || ["whatsapp", "manual"]).map(mode => `
        <label class="flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer has-[:checked]:border-[#0F6B4C] has-[:checked]:bg-emerald-50 text-sm">
          <input type="radio" name="paymentMode" value="${mode}" ${mode === (product.paymentModes||[])[0] ? "checked" : ""} class="text-[#0F6B4C]">
          ${mode === "whatsapp" ? "WhatsApp" : "Bank Transfer"}
        </label>`).join("")}
      </div>
    </div>

    <button type="submit" class="w-full py-3 rounded-xl bg-[#0F6B4C] text-white font-semibold hover:bg-[#084C36] transition mt-2">
      Confirm payment
    </button>
  </form>`;

  el.querySelector("#checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const customer = {
      fullName: fd.get("fullName"),
      whatsapp: fd.get("whatsapp"),
      email: fd.get("email"),
      quantity: fd.get("quantity"),
      paymentMode: fd.get("paymentMode"),
    };
    if (product.stockRemaining != null && product.stockRemaining <= 0) {
      toast("This product is out of stock", "error");
      return;
    }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Processing…";
    try {
      const bmzId = await submitPayment(product, customer);
      if (customer.paymentMode === "whatsapp") {
        window.location.href = `/status.html?bmz=${bmzId}&justPaid=whatsapp`;
      } else {
        window.location.href = `/status.html?bmz=${bmzId}&justPaid=manual`;
      }
    } catch (err) {
      logError("submitting payment", err);
      btn.disabled = false;
      btn.textContent = "Confirm payment";
    }
  });
}

function openLostIdModal(product) {
  const wrap = document.createElement("div");
  wrap.className = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4";
  wrap.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-md w-full">
      <h3 class="font-bold text-lg text-slate-900 mb-1">Lost your BMZ ID?</h3>
      <p class="text-sm text-slate-500 mb-4">Tell us a bit about your order and the business will help you track it down.</p>
      <form class="space-y-3" id="lost-id-form">
        <input required name="customerName" placeholder="Your name" class="w-full rounded-lg border-slate-300 text-sm">
        <input required name="whatsapp" placeholder="WhatsApp number" class="w-full rounded-lg border-slate-300 text-sm">
        <textarea name="note" placeholder="Additional note (optional)" class="w-full rounded-lg border-slate-300 text-sm" rows="2"></textarea>
        <div class="flex gap-2 pt-1">
          <button type="button" data-cancel class="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 rounded-lg bg-[#0F6B4C] text-white text-sm font-semibold">Submit</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector("[data-cancel]").onclick = () => wrap.remove();
  wrap.querySelector("#lost-id-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await submitLostIdRequest(product.adminId, {
      customerName: fd.get("customerName"),
      whatsapp: fd.get("whatsapp"),
      productName: product.name,
      note: fd.get("note"),
    });
    toast("Request sent — the business will reach out on WhatsApp");
    wrap.remove();
  });
}

// ---------- STATUS LOOKUP ----------

export async function renderStatusPage(bmzId, justPaid) {
  const root = document.getElementById("app-root");
  root.innerHTML = `<div class="max-w-2xl mx-auto py-16 text-center text-slate-400">Looking up your payment…</div>`;

  const payment = bmzId ? await getPaymentByBmzId(bmzId) : null;

  if (!payment) {
    root.innerHTML = `
    <div class="max-w-lg mx-auto py-20 text-center px-4">
      <div class="text-4xl mb-4">🧾</div>
      <h2 class="text-xl font-bold text-slate-800 mb-2">We couldn't find that payment ID</h2>
      <p class="text-slate-500 mb-6">Please check the ID and try again.</p>
      ${renderLookupForm()}
    </div>`;
    wireLookupForm(root);
    return;
  }

  const statusCopy = {
    pending: { icon: "⏳", title: "Payment received", body: "Your payment is waiting for confirmation." },
    needs_upload: { icon: "📎", title: "Proof of payment needed", body: "Please upload your transfer receipt below." },
    approved: { icon: "🎉", title: "Payment confirmed", body: "Your order has been approved." },
    rejected: { icon: "⚠️", title: "Payment not approved", body: "Please contact the business for assistance." },
    refunded: { icon: "↩️", title: "Payment refunded", body: "Your payment has been marked as refunded." },
  }[payment.status];

  root.innerHTML = `
  <div class="max-w-xl mx-auto px-4 py-14">
    <a href="/" class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">← MyPayment</a>
    <div class="bg-white border border-slate-200 rounded-2xl p-8 text-center">
      <div class="text-4xl mb-3">${statusCopy.icon}</div>
      <h2 class="text-xl font-bold text-slate-900">${statusCopy.title}</h2>
      <p class="text-slate-500 mt-1 mb-6">${statusCopy.body}</p>

      <div class="text-left bg-slate-50 rounded-xl p-4 text-sm space-y-2 mb-6">
        <div class="flex justify-between"><span class="text-slate-500">BMZ ID</span><span class="font-mono font-semibold">${payment.bmzId}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Product</span><span class="font-medium">${escapeHtml(payment.productName)}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Amount</span><span class="font-medium">${naira(payment.amount)}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Status</span>${statusBadge(payment.status)}</div>
      </div>

      <div id="status-actions" class="space-y-3"></div>
    </div>
  </div>`;

  const actions = root.querySelector("#status-actions");

  if (justPaid === "whatsapp") {
    actions.innerHTML = `<a target="_blank" href="${orderWhatsappLink(payment)}" class="block w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold">Continue to WhatsApp</a>`;
  } else if (payment.status === "needs_upload") {
    actions.innerHTML = `
      <div class="text-left">
        <label class="text-sm font-medium text-slate-700 block mb-1.5">Upload proof of payment</label>
        <input type="file" id="proof-input" accept="image/*" class="w-full text-sm border border-slate-300 rounded-lg p-2">
        <button id="proof-submit" class="w-full mt-3 py-3 rounded-xl bg-[#0F6B4C] text-white font-semibold">Submit proof</button>
      </div>`;
    actions.querySelector("#proof-submit").addEventListener("click", async () => {
      const file = actions.querySelector("#proof-input").files[0];
      if (!file) return toast("Choose a screenshot first", "error");
      const btn = actions.querySelector("#proof-submit");
      btn.disabled = true;
      btn.textContent = "Uploading…";
      try {
        const url = await uploadToCloudinary(file);
        await attachProof(payment.bmzId, url);
        toast("Proof submitted — awaiting confirmation");
        renderStatusPage(bmzId);
      } catch (err) {
        logError("uploading proof of payment", err);
        btn.disabled = false;
        btn.textContent = "Submit proof";
      }
    });
  } else if (payment.status === "approved") {
    actions.innerHTML = `<button id="view-receipt" class="w-full py-3 rounded-xl bg-[#0F6B4C] text-white font-semibold">View / print receipt</button>`;
    actions.querySelector("#view-receipt").addEventListener("click", () => {
      import("./dashboard.js").then((m) => m.openReceiptStandalone(payment));
    });
  }
}

function renderLookupForm() {
  return `
  <form id="bmz-lookup-form" class="flex gap-2">
    <input name="bmz" placeholder="Enter your BMZ ID" class="flex-1 rounded-lg border-slate-300 text-sm" />
    <button class="px-5 py-2.5 rounded-lg bg-[#0F6B4C] text-white text-sm font-semibold">Check</button>
  </form>`;
}

function wireLookupForm(root) {
  root.querySelector("#bmz-lookup-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = new FormData(e.target).get("bmz").trim();
    if (id) window.location.href = `/status.html?bmz=${encodeURIComponent(id)}`;
  });
}
