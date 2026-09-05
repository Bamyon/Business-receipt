// payments.js
import {
  db,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
} from "./firebase-config.js";
import { generateBmzId } from "./bmz.js";

const BUSINESS_WHATSAPP = "2348025892143"; // configurable per-admin in Settings later

export function whatsappLink(number, message) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Creates a payment document keyed by its BMZ ID.
 */
export async function submitPayment(product, customer) {
  const bmzId = await generateBmzId(product.id, product.name);

  const amount = Number(product.price) * Number(customer.quantity || 1);

  await setDoc(doc(db, "payments", bmzId), {
    bmzId,
    productId: product.id,
    productName: product.name,
    adminId: product.adminId,
    customerName: customer.fullName,
    email: customer.email || "",
    whatsapp: customer.whatsapp,
    quantity: Number(customer.quantity || 1),
    variantSelected: customer.variantSelected || null,
    customFieldAnswers: customer.customFieldAnswers || {},
    amount,
    paymentMode: customer.paymentMode, // "whatsapp" | "manual"
    status: customer.paymentMode === "manual" ? "needs_upload" : "pending",
    proofUrl: "",
    createdAt: serverTimestamp(),
    approvedAt: null,
  });

  // Joint contribution running total
  if (product.isJointContribution) {
    await updateDoc(doc(db, "products", product.id), {
      currentAmount: increment(amount),
      contributorCount: increment(1),
    });
  }

  return bmzId;
}

export async function attachProof(bmzId, proofUrl) {
  await updateDoc(doc(db, "payments", bmzId), {
    proofUrl,
    status: "pending",
  });
}

export async function getPaymentByBmzId(bmzId) {
  const snap = await getDoc(doc(db, "payments", bmzId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listPaymentsForAdmin(adminId, statusFilter) {
  const constraints = [where("adminId", "==", adminId)];
  if (statusFilter && statusFilter !== "all") {
    constraints.push(where("status", "==", statusFilter));
  }
  const q = query(collection(db, "payments"), ...constraints, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function approvePayment(bmzId, product) {
  await updateDoc(doc(db, "payments", bmzId), {
    status: "approved",
    approvedAt: serverTimestamp(),
  });

  if (product?.stockRemaining != null) {
    await updateDoc(doc(db, "products", product.id), {
      stockRemaining: increment(-1),
    });
  }
}

export async function rejectPayment(bmzId) {
  await updateDoc(doc(db, "payments", bmzId), { status: "rejected" });
}

export async function refundPayment(bmzId) {
  await updateDoc(doc(db, "payments", bmzId), { status: "refunded" });
}

export async function requestProof(bmzId) {
  await updateDoc(doc(db, "payments", bmzId), { status: "needs_upload" });
}

export function buildWhatsappOrderMessage({ productName, quantity, amount, bmzId, customerName }) {
  return `Hello, I want to make a payment.\n\nProduct: ${productName}\nQuantity: ${quantity}\nAmount: ₦${amount.toLocaleString()}\nBMZ ID: ${bmzId}\nCustomer: ${customerName}`;
}

export function buildWhatsappConfirmationMessage({ customerName, productName, amount, bmzId }) {
  return `Hello ${customerName} 👋\n\nYour payment has been confirmed.\n\nProduct: ${productName}\nAmount: ₦${amount.toLocaleString()}\nBMZ ID: ${bmzId}\n\nThank you for your patronage.`;
}

export function orderWhatsappLink(payment) {
  return whatsappLink(
    BUSINESS_WHATSAPP,
    buildWhatsappOrderMessage({
      productName: payment.productName,
      quantity: payment.quantity,
      amount: payment.amount,
      bmzId: payment.bmzId,
      customerName: payment.customerName,
    })
  );
}

export function confirmationWhatsappLink(payment) {
  return whatsappLink(
    payment.whatsapp.replace(/[^0-9]/g, ""),
    buildWhatsappConfirmationMessage(payment)
  );
}

export async function submitLostIdRequest(adminId, data) {
  await addDoc(collection(db, "lostIdRequests"), {
    adminId,
    customerName: data.customerName,
    whatsapp: data.whatsapp,
    productName: data.productName,
    note: data.note || "",
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function listLostIdRequests(adminId) {
  const q = query(
    collection(db, "lostIdRequests"),
    where("adminId", "==", adminId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Groups approved+pending payments into a customer list for the CRM view. */
export function deriveCustomers(payments) {
  const map = new Map();
  for (const p of payments) {
    const key = p.whatsapp || p.email || p.customerName;
    if (!map.has(key)) {
      map.set(key, {
        name: p.customerName,
        whatsapp: p.whatsapp,
        email: p.email,
        totalOrders: 0,
        totalSpent: 0,
        lastPaymentAt: p.createdAt,
        payments: [],
      });
    }
    const c = map.get(key);
    c.totalOrders += 1;
    if (p.status === "approved") c.totalSpent += p.amount;
    c.payments.push(p);
  }
  return Array.from(map.values());
}
