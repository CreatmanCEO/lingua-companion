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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;
      }
      onSuccess();
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

        {/* Form */}
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
              className="w-full px-3 py-2.5 rounded-xl border border-subtle bg-card text-primary text-size-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
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
              className="w-full px-3 py-2.5 rounded-xl border border-subtle bg-card text-primary text-size-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
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

        {/* Skip auth for demo */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={onSuccess}
            className="text-size-xs text-muted hover:text-secondary transition-colors"
          >
            Continue without account (demo)
          </button>
        </div>
      </div>
    </div>
  );
}
