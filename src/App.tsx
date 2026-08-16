import { useEffect, useState } from "react";
import {
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "./firebase";
import "./styles.css";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setStatus("Connected");
      }
    });

    signInAnonymously(auth).catch((error) => {
      console.error(error);
      setStatus("Connection failed");
    });

    return unsubscribe;
  }, []);

  async function findStranger() {
    if (!user || username.trim().length < 2) return;

    setSearching(true);
    setStatus("Looking for a stranger...");

    try {
      const waitingRef = collection(db, "waitingRoom");

      const existing = await getDocs(
        query(
          waitingRef,
          where("status", "==", "waiting"),
          limit(1)
        )
      );

      if (!existing.empty) {
        const stranger = existing.docs[0];

        if (stranger.id !== user.uid) {
          await deleteDoc(
            doc(db, "waitingRoom", stranger.id)
          );

          setStatus(
            `Stranger found: ${stranger.data().username}`
          );

          setSearching(false);
          return;
        }
      }

      await setDoc(
        doc(db, "waitingRoom", user.uid),
        {
          userId: user.uid,
          username: username.trim(),
          status: "waiting",
          createdAt: serverTimestamp(),
        }
      );

      setStatus("Waiting for a stranger...");
    } catch (error) {
      console.error(error);
      setStatus("Something went wrong");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="screen">
      <section className="card">
        <div className="badge">NO LOGIN REQUIRED</div>

        <h1>Online Stranger Chat</h1>

        <p className="subtitle">
          Meet someone online. No email. No phone. No signup.
        </p>

        <label htmlFor="username">
          Choose a username
        </label>

        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          maxLength={24}
          autoComplete="off"
          disabled={searching}
        />

        <button
          onClick={findStranger}
          disabled={
            !user ||
            username.trim().length < 2 ||
            searching
          }
        >
          {searching
            ? "Searching..."
            : "Find a Stranger"}
        </button>

        <p className="small">
          {status}
        </p>
      </section>
    </main>
  );
}

export default App;
