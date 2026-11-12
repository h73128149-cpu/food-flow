
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp, AppControls } from "@/components/app-provider";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t, direction } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(
          t(
            "ایمیل یا رمز عبور اشتباه است.",
            "Incorrect email or password."
          )
        );
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      console.error("Admin login error:", err);

      setError(
        t(
          "ورود انجام نشد. لطفاً دوباره تلاش کنید.",
          "Login failed. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir={direction}
      className="admin-login-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 text-white"
    >
      {/* Background */}
      <div className="admin-login-background pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#8e3043]/20 blur-[110px]" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-[#d2b06c]/10 blur-[110px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
      </div>

      {/* Controls */}
      <div className="admin-login-controls absolute left-5 top-5 z-20">
        <AppControls />
      </div>

      {/* Login */}
      <div className="admin-login-wrapper relative z-10 w-full max-w-[440px]">
        <form
          onSubmit={handleLogin}
          className="admin-login-card overflow-hidden rounded-[30px]"
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#d2b06c] to-transparent" />

          <div className="px-7 pb-8 pt-10 sm:px-10">
            {/* Logo */}
            <div className="mb-7 flex justify-center">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-[28px] border border-[#d2b06c]/30 bg-gradient-to-br from-[#292326] to-[#171719] shadow-[0_10px_40px_rgba(210,176,108,0.12)]">
                <div className="absolute inset-2 rounded-[21px] border border-white/[0.06]" />

                <img
                  src="/general-logo.png"
                  alt="General Fast Food"
                  className="relative h-20 w-20 rounded-2xl object-contain"
                />
              </div>
            </div>

            {/* Heading */}
            <div className="mb-9 text-center">
              <p className="mb-3 text-[10px] font-bold tracking-[0.35em] text-[#d2b06c]">
                GENERAL FAST FOOD
              </p>

              <h1 className="mb-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {t("خوش آمدید", "Welcome Back")}
              </h1>

              <p className="text-sm leading-7 text-[#aaa3a6]">
                {t(
                  "برای ورود به مرکز مدیریت، اطلاعات حساب خود را وارد کنید.",
                  "Sign in to access your management dashboard."
                )}
              </p>
            </div>

            {/* Email */}
            <div className="mb-5">
              <label className="mb-2.5 block text-sm font-bold text-[#e9e5dc]">
                {t("ایمیل مدیر", "Admin Email")}
              </label>

              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="admin-login-input"
                placeholder={t(
                  "ایمیل حساب مدیریت",
                  "Admin account email"
                )}
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="mb-2.5 block text-sm font-bold text-[#e9e5dc]">
                {t("رمز عبور", "Password")}
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="admin-login-input pl-16"
                  placeholder={t("رمز عبور حساب", "Account password")}
                  dir="ltr"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="admin-login-show-password"
                >
                  {showPassword
                    ? t("مخفی کردن", "Hide")
                    : t("نمایش", "Show")}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                dir="auto"
                role="alert"
                className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="admin-login-submit group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl font-black text-white transition duration-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span className="relative flex items-center gap-2">
                {loading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}

                {loading
                  ? t("در حال ورود...", "Signing in...")
                  : t("ورود به پنل مدیریت", "Enter Dashboard")}
              </span>
            </button>

            {/* Footer */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <div className="h-px flex-1 bg-white/[0.08]" />

              <p className="text-xs font-medium text-[#77747a]">
                {t(
                  "مدیریت هوشمند فست فود ژنرال",
                  "GENERAL MANAGEMENT"
                )}
              </p>

              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] text-[#aaa3a6]">
          © 2026 General Fast Food · All rights reserved
        </p>
      </div>
    </main>
  );
}
