import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCMzCef6lcIKPcZBXrPwg8UsVY1sQ__JkY",
  authDomain: "hadi-2c413.firebaseapp.com",
  projectId: "hadi-2c413",
  storageBucket: "hadi-2c413.firebasestorage.app",
  messagingSenderId: "254411808277",
  appId: "1:254411808277:web:6b0c7789e4299fa232381c",
  measurementId: "G-3DG2YHHBJD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
