// product-page.js
import { renderCheckoutPage } from "./checkout.js";

const params = new URLSearchParams(location.search);
const productId = params.get("id");

if (!productId) {
  document.getElementById("app-root").innerHTML = `
    <div class="max-w-lg mx-auto py-24 text-center px-4">
      <div class="text-4xl mb-4">🔗</div>
      <h2 class="text-xl font-bold text-slate-800 mb-2">No product specified</h2>
      <p class="text-slate-500 mb-6">This link is missing a product ID.</p>
      <a href="/" class="text-primary font-semibold">← Back to MyPayment</a>
    </div>`;
} else {
  renderCheckoutPage(productId).catch((err) => {
    console.error("[MyPayment] checkout render failed:", err);
  });
}
