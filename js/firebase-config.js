// firebase-config.js
// Firebase client config is safe to expose publicly — real protection comes from
// Firestore/Storage security rules (see firestore.rules in this project).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  runTransaction,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  getStorage,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCD8vQv1YCwcZ_CJWunnKwsToOOLXeajIc",
  authDomain: "my-business-receipts.firebaseapp.com",
  projectId: "my-business-receipts",
  storageBucket: "my-business-receipts.firebasestorage.app",
  messagingSenderId: "131689566222",
  appId: "1:131689566222:web:b59aaeec10807eb441ec5f",
  measurementId: "G-T52TE3JCGC",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  runTransaction,
  serverTimestamp,
  increment,
};
