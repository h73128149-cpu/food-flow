
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OrderItem = {
  food_name: string;
  quantity: number;
  unit_price: number;
};

type TrackedOrder = {
  order_number: string | number;
  status: string;
  total_amount: number;
  created_at: string;
  estimated_ready_at: string | null;
  items: OrderItem[];
};

function money(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value) + " تومان";
}

function getStatus(status: string) {
  const statuses: Record<
    string,
    { title: string; description: string; step: number }
  > = {
    Pending: {
      title: "در انتظار تأیید",
      description: "سفارش شما ثبت شده و منتظر بررسی رستوران است.",
      step: 1,
    },
    Preparing: {
      title: "در حال آماده‌سازی",
      description: "سفارش شما تأیید شده و آشپزخانه در حال آماده‌کردن آن است.",
      step: 2,
    },
    Ready: {
      title: "آماده تحویل",
      description: "سفارش شما آماده است. می‌توانید برای دریافت آن اقدام کنید.",
      step: 3,
    },
    Completed: {
      title: "سفارش تکمیل شد",
      description: "سفارش شما آماده و تکمیل شده است.",
      step: 3,
    },
    Delivered: {
      title: "سفارش تحویل شد",
      description: "سفارش شما تحویل داده شده است.",
      step: 3,
    },
    Cancelled: {
      title: "سفارش لغو شد",
      description: "این سفارش توسط رستوران لغو شده است.",
      step: 0,
    },
  };

  return (
    statuses[status] ?? {
      title: status,
      description: "وضعیت سفارش شما در حال بررسی است.",
      step: 1,
    }
  );
}

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOrder = useCallback(
    async (showError = true) => {
      const cleanOrderNumber = orderNumber.trim();
      const cleanToken = trackingToken.trim();

      const supabase = createClient();

      const { data, error: rpcError } = await supabase.rpc(
        "track_foodflow_order",
        {
          p_order_number: cleanOrderNumber,
          p_tracking_token: cleanToken,
        }
      );

      if (rpcError) {
        if (showError) {
          setError("دریافت وضعیت سفارش با مشکل مواجه شد. دوباره تلاش کن.");
        }
        return;
      }

      if (!data) {
        if (showError) {
          setOrder(null);
          setError("سفارشی با این شماره سفارش و کد پیگیری پیدا نشد.");
        }
        return;
      }

      setOrder(data as TrackedOrder);
      setLastUpdated(new Date());
      setError("");
    },
    [orderNumber, trackingToken]
  );

  async function trackOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setOrder(null);
    setLastUpdated(null);

    const cleanToken = trackingToken.trim();

    if (!orderNumber.trim()) {
      setError("شماره سفارش را وارد کن.");
      return;
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(cleanToken)) {
      setError("کد پیگیری معتبر نیست.");
      return;
    }

    setLoading(true);

    try {
      await fetchOrder(true);
    } catch (err) {
      console.error("Order tracking error:", err);
      setError("دریافت وضعیت سفارش با مشکل مواجه شد. دوباره تلاش کن.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!order || order.status === "Delivered" || order.status === "Cancelled") {
      return;
    }

    const interval = window.setInterval(() => {
      fetchOrder(false);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [order, fetchOrder]);

  const currentStatus = order ? getStatus(order.status) : null;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#0b0c0f] px-4 py-10 text-white sm:py-16"
    >
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center">
          <p className="mb-3 text-xs font-bold tracking-[0.3em] text-[#c9a85c]">
            GENERAL FAST FOOD
          </p>

          <h1 className="text-3xl font-black sm:text-4xl">
            پیگیری سفارش
          </h1>

          <p className="mt-3 text-sm text-gray-400">
            وضعیت سفارش خود را در هر لحظه مشاهده کن.
          </p>
        </header>

        <section className="rounded-3xl border border-[#c9a85c]/20 bg-[#17181c] p-5 shadow-2xl shadow-black/30 sm:p-7">
          <form onSubmit={trackOrder} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                شماره سفارش
              </label>

              <input
                type="text"
                inputMode="numeric"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="مثلاً 10025"
                className="w-full rounded-xl border border-white/10 bg-[#0d0e11] px-4 py-4 text-white outline-none transition placeholder:text-gray-600 focus:border-[#c9a85c]"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                کد محرمانه پیگیری
              </label>
              <input
                type="text"
                dir="ltr"
                value={trackingToken}
                onChange={(e) => setTrackingToken(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                maxLength={36}
                className="w-full rounded-xl border border-white/10 bg-[#0d0e11] px-4 py-4 text-left text-white outline-none transition placeholder:text-gray-600 focus:border-[#c9a85c]"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#c9a85c] px-5 py-4 font-black text-[#17130a] transition hover:bg-[#e1c47d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "در حال بررسی سفارش..." : "پیگیری سفارش"}
            </button>
          </form>
        </section>

        {order && currentStatus && (
          <section className="mt-6 space-y-5 rounded-3xl border border-[#c9a85c]/20 bg-[#17181c] p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs text-gray-500">شماره سفارش</p>
                <h2 className="mt-2 text-2xl font-black text-[#e9c875]">
                  #{order.order_number}
                </h2>
              </div>

              <span className="rounded-xl border border-[#c9a85c]/30 bg-[#c9a85c]/10 px-3 py-2 text-sm font-bold text-[#e9c875]">
                {currentStatus.title}
              </span>
            </div>

            <div className="rounded-2xl bg-[#0d0e11] p-5">
              <p className="text-lg font-black text-white">
                {currentStatus.title}
              </p>

              <p className="mt-2 text-sm leading-7 text-gray-400">
                {currentStatus.description}
              </p>

              {order.status === "Preparing" && order.estimated_ready_at && (
                <div className="mt-5 rounded-xl border border-[#c9a85c]/30 bg-[#c9a85c]/10 p-4">
                  <p className="text-sm text-gray-300">
                    زمان تقریبی آماده‌شدن سفارش
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#e9c875]">
                    {new Date(order.estimated_ready_at).toLocaleTimeString(
                      "fa-IR",
                      { hour: "2-digit", minute: "2-digit" }
                    )}
                  </p>
                </div>
              )}

              {order.status === "Ready" && (
                <div className="mt-5 rounded-xl border border-green-500/40 bg-green-500/10 p-5 text-center">
                  <p className="text-xl font-black text-green-400">
                    ✓ سفارش شما آماده تحویل است
                  </p>
                  <p className="mt-2 text-sm text-green-200">
                    برای دریافت سفارش خود به فست فود ژنرال مراجعه کنید.
                  </p>
                </div>
              )}

              {order.status !== "Cancelled" && (
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[
                    { step: 1, label: "ثبت سفارش" },
                    { step: 2, label: "آماده‌سازی" },
                    { step: 3, label: "آماده تحویل" },
                  ].map((item) => (
                    <div key={item.step} className="text-center">
                      <div
                        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black ${
                          currentStatus.step >= item.step
                            ? "border-[#c9a85c] bg-[#c9a85c] text-black"
                            : "border-white/15 bg-white/5 text-gray-500"
                        }`}
                      >
                        {currentStatus.step >= item.step ? "✓" : item.step}
                      </div>

                      <p
                        className={`mt-2 text-[10px] sm:text-xs ${
                          currentStatus.step >= item.step
                            ? "text-[#e9c875]"
                            : "text-gray-500"
                        }`}
                      >
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-4 font-black text-[#e9c875]">
                اقلام سفارش
              </h3>

              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-bold text-gray-200">
                        {item.food_name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        تعداد: {item.quantity.toLocaleString("fa-IR")}
                      </p>
                    </div>

                    <p className="text-sm font-bold text-[#e9c875]">
                      {money(Number(item.unit_price) * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-5">
              <span className="font-bold text-gray-400">مبلغ کل</span>
              <span className="text-lg font-black text-[#e9c875]">
                {money(Number(order.total_amount))}
              </span>
            </div>

            <p className="text-center text-xs text-gray-500">
              زمان ثبت: {new Date(order.created_at).toLocaleString("fa-IR")}
            </p>

            {lastUpdated && (
              <p className="text-center text-xs text-gray-500">
                آخرین بررسی: {lastUpdated.toLocaleTimeString("fa-IR")}
                {" · "}به‌روزرسانی خودکار هر ۱۰ ثانیه
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setOrder(null);
                setError("");
                setLastUpdated(null);
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-gray-300 transition hover:bg-white/10"
            >
              پیگیری سفارش دیگر
            </button>
          </section>
        )}

        <footer className="mt-8 text-center text-xs text-gray-600">
          GENERAL FAST FOOD · ORDER TRACKING
        </footer>
      </div>
    </main>
  );
}
