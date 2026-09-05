// auth.js
import {
  auth,
  db,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from "./firebase-config.js";

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signUpAdmin({
  fullName,
  businessName,
  email,
  password,
  whatsapp,
  category,
}) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: fullName });

  await setDoc(doc(db, "admins", cred.user.uid), {
    name: fullName,
    businessName,
    email,
    whatsapp,
    category,
    logoUrl: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut() {
  await fbSignOut(auth);
}

export async function getAdminProfile(uid) {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
