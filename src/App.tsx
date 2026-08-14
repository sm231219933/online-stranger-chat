import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import "./styles.css";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    signInAnonymously(auth).catch((error) => {
      console.error(error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <main className="screen">
        <div className="card">
          <h1>Online Stranger Chat</h1>
          <p>Connecting...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <section className="card">
        <div className="badge">NO LOGIN REQUIRED</div>

        <h1>Online Stranger Chat</h1>

        <p className="subtitle">
          Choose a username and meet someone online.
        </p>

        <label htmlFor="username">Username</label>

        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          maxLength={24}
          autoComplete="off"
        />

        <button disabled={!user || username.trim().length < 2}>
          Find a Stranger
        </button>

        <p className="small">
          Guest connection: {user ? "Connected" : "Connecting"}
        </p>
      </section>
    </main>
  );
}

export default App;
