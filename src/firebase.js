import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyC47c3p689QVIWpkb_5hUngqBAjgmZ0dg0",
  authDomain: "blackspot-156b7.firebaseapp.com",
  projectId: "blackspot-156b7",
  storageBucket: "blackspot-156b7.firebasestorage.app",
  messagingSenderId: "529134667652",
  appId: "1:529134667652:web:576d764f0e0b952f17ffd1",
  measurementId: "G-5ZPFMNSVSR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  db,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
};
