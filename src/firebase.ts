import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAR3HTkNJwrNDmj5uX4EPhj9YscTUqXq8w",
  authDomain: "myai-88138858.firebaseapp.com",
  projectId: "myai-88138858",
  storageBucket: "myai-88138858.firebasestorage.app",
  messagingSenderId: "403229004643",
  appId: "1:403229004643:web:6d4cc99da03586554bb956"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
