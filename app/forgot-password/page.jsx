"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);

    // forgotPassword() always resolves success:true unless the request
    // itself was malformed - see the note in AuthContext.jsx on why the
    // backend deliberately never reveals whether the email exists.
    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-background  px-4 py-8">
      {/* Soft ambient glow accents for depth, kept subtle to stay minimal */}
      <div className="absolute -top-32 -left-24 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-24 w-96 h-96 bg-chart-1/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm flex flex-col items-center">
        {/* Card */}
        <div className="relative w-full bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 pt-12 pb-8 px-8">
          {/* Overlapping avatar badge, matching the SalesOps sidebar mark */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-card">
            <DollarSign className="w-7 h-7 text-accent" strokeWidth={2.5} />
          </div>

          {!submitted ? (
            <>
              <h2 className="text-lg font-semibold text-foreground text-center mb-1">
                Forgot password?
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-7">
                Enter your email and we&apos;ll send you a link to reset it.
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 bg-input border border-border rounded-full text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent/90 disabled:bg-secondary disabled:text-muted-foreground text-accent-foreground font-medium py-3 rounded-full transition duration-200 mt-2 text-xs tracking-wide uppercase"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Check your email
              </h2>
              <p className="text-sm text-muted-foreground mb-1">
                If an account exists for
              </p>
              <p className="text-sm font-medium text-foreground mb-4">
                {email}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                a password reset link has been sent. It expires in 1 hour.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                className="text-xs font-medium text-accent hover:text-accent/80"
              >
                Didn&apos;t get it? Try a different email
              </button>
            </div>
          )}

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
