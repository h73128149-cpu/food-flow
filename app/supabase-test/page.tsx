
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseTest() {
  const [message, setMessage] = useState("در حال اتصال به دیتابیس...");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function testConnection() {
      try {
        const supabase = createClient();

        const { error } = await supabase
          .from("restaurants")
          .select("id")
          .limit(1);

        if (error) {
          console.error("Supabase query error:", error);
          setMessage("خطا در اتصال به دیتابیس: " + error.message);
          setSuccess(false);
        } else {
          setMessage("اتصال به Supabase موفق بود! 🎉");
          setSuccess(true);
        }
      } catch (error) {
        console.error("Supabase connection error:", error);

        setMessage(
          error instanceof Error
            ? error.message
            : "خطای ناشناخته در اتصال به Supabase"
        );

        setSuccess(false);
      } finally {
        setLoading(false);
      }
    }

    testConnection();
  }, []);

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-gray-50 p-6"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-lg">
        <h1 className="mb-3 text-3xl font-black text-orange-600">
          🍔 FoodFlow
        </h1>

        <h2 className="mb-6 text-lg font-bold text-gray-700">
          تست اتصال دیتابیس
        </h2>

        <div
          className={`rounded-2xl p-5 text-sm font-bold leading-8 ${
            loading
              ? "bg-blue-50 text-blue-700"
              : success
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {loading && "⏳ "}
          {!loading && success && "✅ "}
          {!loading && !success && "❌ "}
          {message}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full rounded-xl bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600"
        >
          تلاش مجدد
        </button>
      </div>
    </main>
  );
}
