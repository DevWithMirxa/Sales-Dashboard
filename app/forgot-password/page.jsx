"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BarChart3, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
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
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-linear-to-br from-blue-600 to-teal-400  px-4 py-8">
      {/* Soft ambient glow accents for depth, kept subtle to stay minimal */}
      <div className="absolute -top-32 -left-24 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-24 w-96 h-96 bg-indigo-400/30 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-sky-300/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm flex flex-col items-center">
        {/* Card */}
        <div className="relative w-full bg-white rounded-2xl shadow-2xl shadow-black/20 pt-12 pb-8 px-8">
          {/* Overlapping avatar badge */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>

          {!submitted ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">
                Forgot password?
              </h2>
              <p className="text-sm text-gray-500 text-center mb-7">
                Enter your email and we&apos;ll send you a link to reset it.
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-full transition duration-200 mt-2 text-xs tracking-wide uppercase"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Check your email
              </h2>
              <p className="text-sm text-gray-500 mb-1">
                If an account exists for
              </p>
              <p className="text-sm font-medium text-gray-900 mb-4">{email}</p>
              <p className="text-sm text-gray-500 mb-6">
                a password reset link has been sent. It expires in 1 hour.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Didn&apos;t get it? Try a different email
              </button>
            </div>
          )}

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mt-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
