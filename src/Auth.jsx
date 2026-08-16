import { useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setMessage("Please enter email and password.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (mode === "login") {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) throw error;

        if (data?.user) {
          onLogin(data.user);
        }
      } else {
        const { data, error } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

        if (error) throw error;

        if (data?.session && data?.user) {
          onLogin(data.user);
        } else {
          setMessage(
            "Account created successfully. Please login."
          );
          setMode("login");
          setPassword("");
        }
      }
    } catch (error) {
      console.error("AUTH ERROR:", error);

      setMessage(
        error?.message ||
          "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          MH
        </div>

        <div className="auth-header">
          <span className="eyebrow">
            MAZA HISHOB
          </span>

          <h1>
            {mode === "login"
              ? "Welcome Back"
              : "Create Account"}
          </h1>

          <p>
            {mode === "login"
              ? "Login to manage your finances securely."
              : "Create your secure Maza Hishob account."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>

            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label>Password</label>

            <input
              className="form-input"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              required
            />
          </div>

          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="primary-btn auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login →"
              : "Create Account →"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
              >
                Create Account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;