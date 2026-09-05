// bmz.js — unique, human-readable payment IDs: BMZ-PRODUCTCODE-001
import { db, doc, runTransaction } from "./firebase-config.js";

export function productCodeFromName(name) {
  const clean = (name || "ITEM").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean.substring(0, 6) || "ITEM";
}

/**
 * Atomically increments a per-product counter and returns a new BMZ ID.
 * Uses a transaction so two simultaneous checkouts never collide.
 */
export async function generateBmzId(productId, productName) {
  const code = productCodeFromName(productName);
  const counterRef = doc(db, "products", productId, "meta", "counter");

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().count || 0 : 0;
    const updated = current + 1;
    tx.set(counterRef, { count: updated }, { merge: true });
    return updated;
  });

  const padded = String(next).padStart(3, "0");
  return `BMZ-${code}-${padded}`;
}
