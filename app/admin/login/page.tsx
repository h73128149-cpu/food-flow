
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

      router.push("/admin/orders");
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
      className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 text-[var(--foreground)] transition-colors"
    >
      <div className="fixed top-4 left-4 z-10">
        <AppControls />
      </div>

      <form
        onSubmit={handleLogin}
        className="general-surface w-full max-w-md rounded-3xl p-7 sm:p-9"
      >
        <div className="mb-6 flex justify-center">
          <img
            src="/general-logo.png"
            alt="General Fast Food"
            className="h-24 w-24 rounded-2xl object-contain"
          />
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-black">
            {t("مدیریت فست فود ژنرال", "General Fast Food Admin")}
          </h1>

          <p className="text-sm leading-7 text-[var(--muted)]">
            {t(
              "برای ورود به پنل مدیریت، اطلاعات حساب خود را وارد کنید.",
              "Enter your account details to access the admin panel."
            )}
          </p>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-bold">
            {t("ایمیل مدیر", "Admin email")}
          </label>

          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="general-input"
            placeholder={t("ایمیل حساب مدیریت", "Admin account email")}
            dir="ltr"
          />
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-bold">
            {t("رمز عبور", "Password")}
          </label>

          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="general-input"
            placeholder={t("رمز عبور", "Password")}
            dir="ltr"
          />
        </div>

        {error && (
          <div
            dir="auto"
            className="mb-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="general-red w-full rounded-xl p-4 font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? t("در حال ورود...", "Signing in...")
            : t("ورود به پنل مدیریت", "Sign in to admin panel")}
        </button>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          {t("فست فود ژنرال", "General Fast Food")}
        </p>
      </form>
    </main>
  );
}
