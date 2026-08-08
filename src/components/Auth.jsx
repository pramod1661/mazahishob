import { useState } from "react";
import { supabase } from "../supabaseClient";

function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Account created successfully.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      }
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <h1>Maza Hishob</h1>

        <p className="auth-subtitle">
          Money Tracker & Personal Finance Manager
        </p>

        <h2>{isSignUp ? "Create Account" : "Welcome Back"}</h2>

        <form onSubmit={handleSubmit}>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isSignUp
              ? "Create Account"
              : "Login"}
          </button>

        </form>

        {message && <p className="auth-message">{message}</p>}

        <div className="auth-switch">
          {isSignUp
            ? "Already have an account?"
            : "Don't have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage("");
            }}
          >
            {isSignUp ? "Login" : "Sign Up"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default Auth;