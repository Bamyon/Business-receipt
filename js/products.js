// products.js
import {
  db,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "./firebase-config.js";

export async function createProduct(adminId, data) {
  const ref = await addDoc(collection(db, "products"), {
    adminId,
    name: data.name,
    description: data.description || "",
    price: Number(data.price) || 0,
    imageUrl: data.imageUrl || "",
    stockLimit: data.stockLimit ? Number(data.stockLimit) : null,
    stockRemaining: data.stockLimit ? Number(data.stockLimit) : null,
    deadline: data.deadline || null,
    paymentModes: data.paymentModes || ["whatsapp", "manual"],
    isJointContribution: !!data.isJointContribution,
    targetAmount: data.isJointContribution ? Number(data.targetAmount) || 0 : null,
    currentAmount: 0,
    contributorCount: 0,
    crossSellEnabled: !!data.crossSellEnabled,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(productId, data) {
  await updateDoc(doc(db, "products", productId), data);
}

export async function deleteProduct(productId) {
  await deleteDoc(doc(db, "products", productId));
}

export async function getProduct(productId) {
  const snap = await getDoc(doc(db, "products", productId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listProductsForAdmin(adminId) {
  const q = query(
    collection(db, "products"),
    where("adminId", "==", adminId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listActiveProductsForCrossSell(adminId, excludeId) {
  const products = await listProductsForAdmin(adminId);
  return products.filter((p) => p.active && p.id !== excludeId).slice(0, 4);
}
