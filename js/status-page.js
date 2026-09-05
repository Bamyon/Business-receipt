// status-page.js
import { renderStatusPage } from "./checkout.js";

const params = new URLSearchParams(location.search);
const bmz = params.get("bmz");
const justPaid = params.get("justPaid");

renderStatusPage(bmz, justPaid).catch((err) => {
  console.error("[MyPayment] status render failed:", err);
});
