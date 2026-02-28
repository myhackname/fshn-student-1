import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDBFw4Fi14is8ZmpIZgKHqamCZ07wYDRVo",
  authDomain: "fshn-student-portal.firebaseapp.com",
  projectId: "fshn-student-portal",
  storageBucket: "fshn-student-portal.firebasestorage.app",
  messagingSenderId: "296895231814",
  appId: "1:296895231814:web:348de2d5df24b91e645747"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
