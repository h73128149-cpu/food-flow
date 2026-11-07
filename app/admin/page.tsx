
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  order_number: string | number;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  status: string;
  created_at: string;
};

const RESTAURANT_NAME = "فست فود ژنرال";

function money(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value) + " تومان";
}

function statusName(status: string) {
  const labels: Record<string, string> = {
    Pending: "در انتظار بررسی",
    Preparing: "در حال آماده‌سازی",
    Completed: "تکمیل‌شده",
    Delivered: "تحویل‌شده",
    Cancelled: "لغوشده",
  };

  return labels[status] || status;
}

function statusColor(status: string) {
  if (status === "Pending")
    return "bg-amber-400/10 text-amber-300 border-amber-400/20";

  if (status === "Preparing")
    return "bg-sky-400/10 text-sky-300 border-sky-400/20";

  if (status === "Cancelled")
    return "bg-red-400/10 text-red-300 border-red-400/20";

  return "bg-emerald-400/10 text-emerald-300 border-emerald-400/20";
}

export default function AdminDashboard() {
  const [supabase] = useState(() => createClient());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setError("");

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("name", RESTAURANT_NAME)
        .single();

      if (restaurantError) throw restaurantError;

      if (!restaurant) throw new Error("رستوران پیدا نشد.");

      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      const { data, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_phone, total_amount, status, created_at"
        )
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", startOfDay.toISOString())
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      setOrders((data || []) as Order[]);
    } catch (err) {
      console.error(err);
      setError("دریافت اطلاعات داشبورد با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function start() {
      await loadOrders();

      if (cancelled) return;

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id")
        .eq("name", RESTAURANT_NAME)
        .single();

      if (cancelled || !restaurant) return;

      channel = supabase
        .channel("general-live-dashboard")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${restaurant.id}`,
          },
          () => {
            void loadOrders();
          }
        )
        .subscribe();
    }

    void start();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, loadOrders]);

  const pending = orders.filter((o) => o.status === "Pending");
  const preparing = orders.filter((o) => o.status === "Preparing");
  const completed = orders.filter(
    (o) => o.status === "Completed" || o.status === "Delivered"
  );

  const sales = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const cards = [
    {
      title: "سفارش‌های امروز",
      value: orders.length.toLocaleString("fa-IR"),
      icon: "🧾",
    },
    {
      title: "در انتظار بررسی",
      value: pending.length.toLocaleString("fa-IR"),
      icon: "⏳",
    },
    {
      title: "در حال آماده‌سازی",
      value: preparing.length.toLocaleString("fa-IR"),
      icon: "🍳",
    },
    {
      title: "فروش امروز",
      value: money(sales),
      icon: "💰",
    },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-[#0b0c0f] p-4 text-white sm:p-7">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold tracking-widest text-[#c9a85c]">
              GENERAL MANAGEMENT
            </p>
            <h1 className="text-3xl font-black">داشبورد مدیریت</h1>
            <p className="mt-2 text-sm text-gray-500">
              نمای کلی عملکرد فست فود ژنرال
            </p>
          </div>

          <button
            onClick={() => void loadOrders()}
            className="rounded-xl border border-[#c9a85c]/30 bg-[#c9a85c]/10 px-5 py-3 text-sm font-bold text-[#e9c875] hover:bg-[#c9a85c]/20"
          >
            ↻ به‌روزرسانی
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#202024] to-[#131417] p-5 shadow-xl transition hover:-translate-y-1 hover:border-[#c9a85c]/30"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm text-gray-400">{card.title}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#c9a85c]/20 bg-[#c9a85c]/10 text-xl">
                  {card.icon}
                </span>
              </div>
              <p className="text-2xl font-black text-[#e9c875]">
                {loading ? "..." : card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-[#17181c] p-5">
            <p className="text-sm text-gray-400">سفارش‌های تکمیل‌شده</p>
            <p className="mt-3 text-3xl font-black text-emerald-300">
              {loading ? "..." : completed.length.toLocaleString("fa-IR")}
            </p>
          </div>

          <div className="rounded-2xl border border-[#c9a85c]/20 bg-gradient-to-br from-[#302719] to-[#191713] p-5">
            <p className="text-sm text-[#c9a85c]">وضعیت سیستم</p>
            <p className="mt-3 text-xl font-black text-[#f0d89e]">
              دریافت سفارش‌ها به‌صورت زنده
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#17181c]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5">
            <div>
              <p className="text-xs font-bold tracking-widest text-[#c9a85c]">
                LIVE ORDERS
              </p>
              <h2 className="mt-2 text-xl font-black">
                آخرین سفارش‌های امروز
              </h2>
            </div>
            <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">
              {orders.length.toLocaleString("fa-IR")} سفارش
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">
              در حال دریافت سفارش‌ها...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mb-4 text-5xl">📭</div>
              <p className="font-bold text-gray-300">
                هنوز سفارشی برای امروز ثبت نشده است.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-right text-sm">
                <thead className="bg-[#202126] text-xs text-gray-400">
                  <tr>
                    <th className="px-5 py-4">شماره سفارش</th>
                    <th className="px-5 py-4">مشتری</th>
                    <th className="px-5 py-4">مبلغ</th>
                    <th className="px-5 py-4">وضعیت</th>
                    <th className="px-5 py-4">زمان</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map((order) => (
                    <tr
                      key={order.id}
                      className="border-t border-white/[0.06] hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-4 font-black text-[#e9c875]">
                        #{order.order_number}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold">
                          {order.customer_name || "مشتری"}
                        </p>
                        <p dir="ltr" className="mt-1 text-xs text-gray-500">
                          {order.customer_phone || "—"}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-bold">
                        {money(Number(order.total_amount || 0))}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-lg border px-3 py-2 text-xs font-bold ${statusColor(order.status)}`}
                        >
                          {statusName(order.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400">
                        {new Date(order.created_at).toLocaleTimeString(
                          "fa-IR",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
