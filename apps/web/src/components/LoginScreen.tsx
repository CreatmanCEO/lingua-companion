"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignupSuccess(false);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        onSuccess();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;
        // Supabase returns user but session may be null if email confirmation required
        if (data.session) {
          onSuccess();
        } else {
          // Email confirmation required
          setSignupSuccess(true);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-void px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">LinguaCompanion</h1>
          <p className="text-muted text-size-sm mt-1">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={async () => {
            setError(null);
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: window.location.origin,
              },
            });
            if (error) setError(error.message);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-subtle rounded-lg hover:bg-white/5 transition-colors text-primary text-size-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/40">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Signup success message */}
        {signupSuccess && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
            <p className="text-green-400 text-size-sm font-medium">Account created!</p>
            <p className="text-green-400/70 text-xs mt-1">
              Check your email for a verification link, then sign in.
            </p>
            <button
              type="button"
              onClick={() => { setMode("login"); setSignupSuccess(false); }}
              className="mt-2 text-xs text-accent hover:text-accent/80"
            >
              Go to Sign in
            </button>
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-size-sm font-medium text-secondary mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-xl border border-subtle bg-card text-primary text-size-sm placeholder:text-white/30 focus:outline-none focus:border-accent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-size-sm font-medium text-secondary mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              className="w-full px-3 py-2.5 rounded-xl border border-subtle bg-card text-primary text-size-sm placeholder:text-white/30 focus:outline-none focus:border-accent transition-colors"
              placeholder="Min 6 characters"
            />
          </div>

          {error && (
            <div className="text-red-400 text-size-sm bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-accent text-white font-medium text-size-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "..." : mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="text-size-sm text-accent hover:text-accent/80 transition-colors"
          >
            {mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>

        {/* Auth required — no demo mode */}
      </div>
    </div>
  );
}
