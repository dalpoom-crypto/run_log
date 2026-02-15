import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyA4KFdLVKVy6WdAfTGuLWDJsV_tcuNp7kw",
  authDomain: "run-log-31420.firebaseapp.com",
  projectId: "run-log-31420",
  storageBucket: "run-log-31420.firebasestorage.app",
  messagingSenderId: "325067679087",
  appId: "1:325067679087:web:727201211a34ac6c1fb49a",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export { httpsCallable };

// Firebase 함수들 export
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';

export {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';

export {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
