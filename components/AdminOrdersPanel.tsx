
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  order_number: string | number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_note?: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  estimated_ready_at?: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  food_name: string;
  unit_price: number;
  quantity: number;
};

type Filter =
  | "All"
  | "Pending"
  | "Preparing"
  | "Ready"
  | "Completed"
  | "Cancelled";

const RESTAURANT_NAME = "فست فود ژنرال";

function money(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value) + " تومان";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    Pending: "در انتظار بررسی",
    Preparing: "در حال آماده‌سازی",
    Ready: "آماده تحویل",
    Completed: "تکمیل‌شده",
    Delivered: "تحویل‌شده",
    Cancelled: "لغوشده",
  };

  return labels[status] ?? status;
}

function statusStyle(status: string) {
  const styles: Record<string, string> = {
    Pending: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    Preparing: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    Ready: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    Completed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    Delivered: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    Cancelled: "border-red-400/20 bg-red-400/10 text-red-300",
  };

  return styles[status] ?? "border-white/10 bg-white/5 text-gray-300";
}

function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();

    const playTone = (frequency: number, start: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(start);
      oscillator.stop(start + 0.3);
    };

    void context.resume().then(() => {
      const now = context.currentTime;
      playTone(880, now);
      playTone(1175, now + 0.35);

      window.setTimeout(() => {
        void context.close();
      }, 1200);
    });
  } catch (error) {
    console.error("Notification sound error:", error);
  }
}

function readyTime(value?: string | null) {
  if (!value) return "ثبت نشده";

  return new Date(value).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminOrdersPanel() {
  const [supabase] = useState(() => createClient());

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [filter, setFilter] = useState<Filter>("All");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [prepMinutes, setPrepMinutes] = useState<Record<string, string>>({});

  const knownOrderIds = useRef<Set<string> | null>(null);
  const soundEnabledRef = useRef(false);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

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
          "id, order_number, customer_name, customer_phone, customer_note, total_amount, status, created_at, estimated_ready_at"
        )
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", startOfDay.toISOString())
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      const freshOrders = (data ?? []) as Order[];

      setOrders(freshOrders);
      setLastUpdated(new Date());

      if (knownOrderIds.current === null) {
        knownOrderIds.current = new Set(freshOrders.map((o) => o.id));
      }
    } catch (err) {
      console.error("Orders loading error:", err);
      setError("دریافت سفارش‌ها با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function startRealtime() {
      await loadOrders();

      if (cancelled) return;

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("name", RESTAURANT_NAME)
        .single();

      if (cancelled || restaurantError || !restaurant) return;

      channel = supabase
        .channel("general-live-order-management")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${restaurant.id}`,
          },
          (payload) => {
            const newOrder = payload.new as Order;

            if (
              newOrder.id &&
              !knownOrderIds.current?.has(newOrder.id)
            ) {
              knownOrderIds.current?.add(newOrder.id);

              if (soundEnabledRef.current) {
                playNotificationSound();
              }
            }

            void loadOrders();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${restaurant.id}`,
          },
          () => {
            void loadOrders();
          }
        )
        .subscribe((status) => {
          console.log("Orders realtime:", status);
        });
    }

    void startRealtime();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [supabase, loadOrders]);

  async function toggleOrderDetails(orderId: string) {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }

    setExpandedOrder(orderId);

    if (orderItems[orderId]) return;

    setItemsLoading(orderId);
    setActionError("");

    try {
      const { data, error: itemsError } = await supabase
        .from("order_items")
        .select("id, order_id, food_name, unit_price, quantity")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      setOrderItems((current) => ({
        ...current,
        [orderId]: (data ?? []) as OrderItem[],
      }));
    } catch (err) {
      console.error("Order items error:", err);
      setActionError("دریافت جزئیات این سفارش با مشکل مواجه شد.");
    } finally {
      setItemsLoading(null);
    }
  }

  async function changeOrderStatus(
    orderId: string,
    newStatus: "Preparing" | "Cancelled" | "Ready"
  ) {
    if (busyOrder) return;

    const minutes = Number(prepMinutes[orderId] || "20");

    if (
      newStatus === "Preparing" &&
      (!Number.isInteger(minutes) || minutes < 1 || minutes > 240)
    ) {
      setActionError("زمان آماده‌سازی باید بین ۱ تا ۲۴۰ دقیقه باشد.");
      return;
    }

    const message =
      newStatus === "Cancelled"
        ? "آیا از لغو این سفارش مطمئن هستی؟"
        : newStatus === "Ready"
          ? "آیا آماده‌سازی این سفارش تمام شده است؟"
          : `سفارش تأیید شود و با زمان آماده‌سازی ${minutes} دقیقه وارد آشپزخانه شود؟`;

    if (!window.confirm(message)) return;

    setBusyOrder(orderId);
    setActionError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "respond_to_foodflow_order",
        {
          p_order_id: orderId,
          p_new_status: newStatus,
          p_prep_minutes: newStatus === "Preparing" ? minutes : null,
        }
      );

      if (rpcError) throw rpcError;

      const result = data as { success?: boolean; status?: string };

      if (!result?.success) {
        throw new Error("تغییر وضعیت سفارش تأیید نشد.");
      }

      await loadOrders();
    } catch (err) {
      console.error("Order status update error:", err);

      setActionError(
        err instanceof Error
          ? err.message
          : "تغییر وضعیت سفارش انجام نشد."
      );
    } finally {
      setBusyOrder(null);
    }
  }

  const pendingCount = orders.filter(
    (o) => o.status === "Pending"
  ).length;

  const preparingCount = orders.filter(
    (o) => o.status === "Preparing"
  ).length;

  const readyCount = orders.filter(
    (o) => o.status === "Ready"
  ).length;

  const completedCount = orders.filter(
    (o) =>
      o.status === "Completed" ||
      o.status === "Delivered"
  ).length;

  const filteredOrders = orders.filter((order) => {
    if (filter === "All") return true;

    if (filter === "Completed") {
      return (
        order.status === "Completed" ||
        order.status === "Delivered"
      );
    }

    return order.status === filter;
  });

  const filters: { value: Filter; label: string }[] = [
    { value: "All", label: "همه سفارش‌ها" },
    { value: "Pending", label: "سفارش‌های جدید" },
    { value: "Preparing", label: "در حال آماده‌سازی" },
    { value: "Ready", label: "آماده تحویل" },
    { value: "Completed", label: "تکمیل‌شده" },
    { value: "Cancelled", label: "لغوشده" },
  ];

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#0b0c0f] p-4 text-white sm:p-7"
    >
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#c9a85c]">
              GENERAL ORDER CONTROL
            </p>

            <h1 className="text-2xl font-black sm:text-3xl">
              مرکز مدیریت سفارش‌ها
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              بررسی، تأیید و پیگیری سفارش‌های ژنرال
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((current) => !current)}
              className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                soundEnabled
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 bg-white/5 text-gray-300"
              }`}
            >
              {soundEnabled ? "🔔 صدای اعلان روشن" : "🔕 روشن کردن صدا"}
            </button>

            <button
              type="button"
              onClick={() => void loadOrders()}
              className="rounded-xl border border-[#c9a85c]/30 bg-[#c9a85c]/10 px-4 py-3 text-sm font-bold text-[#e9c875] transition hover:bg-[#c9a85c]/20"
            >
              ↻ به‌روزرسانی
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#17181c] p-4">
          <div>
            <p className="text-sm font-bold">وضعیت دریافت سفارش‌ها</p>
            <p className="mt-1 text-xs text-gray-500">
              {lastUpdated
                ? `آخرین دریافت: ${lastUpdated.toLocaleTimeString("fa-IR")}`
                : "در حال اتصال..."}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            اتصال زنده در حال اجرا
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "سفارش‌های جدید",
              value: pendingCount,
              icon: "⏳",
              color: "text-amber-300",
            },
            {
              label: "در حال آماده‌سازی",
              value: preparingCount,
              icon: "🍳",
              color: "text-sky-300",
            },
            {
              label: "آماده تحویل",
              value: readyCount,
              icon: "✓",
              color: "text-emerald-300",
            },
            {
              label: "تکمیل‌شده",
              value: completedCount,
              icon: "✓",
              color: "text-emerald-300",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#202024] to-[#131417] p-5 transition hover:border-[#c9a85c]/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  {item.label}
                </span>
                <span className="text-2xl">{item.icon}</span>
              </div>

              <p className={`mt-4 text-3xl font-black ${item.color}`}>
                {item.value.toLocaleString("fa-IR")}
              </p>
            </div>
          ))}
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
            <button
              onClick={() => void loadOrders()}
              className="mr-3 underline"
            >
              تلاش دوباره
            </button>
          </div>
        )}

        {actionError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError("")}
              className="text-lg"
            >
              ×
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#17181c]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest text-[#c9a85c]">
                  LIVE ORDERS
                </p>
                <h2 className="mt-2 text-xl font-black">
                  فهرست سفارش‌ها
                </h2>
              </div>

              <span className="rounded-lg border border-[#c9a85c]/20 bg-[#c9a85c]/10 px-3 py-2 text-xs font-bold text-[#e9c875]">
                {filteredOrders.length.toLocaleString("fa-IR")} سفارش
              </span>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`shrink-0 rounded-xl border px-4 py-3 text-xs font-bold transition ${
                    filter === item.value
                      ? "border-[#c9a85c]/40 bg-[#c9a85c]/15 text-[#f0d89e]"
                      : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-14 text-center text-gray-400">
              در حال دریافت سفارش‌ها...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-14 text-center">
              <div className="mb-4 text-5xl">📭</div>
              <p className="font-bold text-gray-300">
                سفارشی در این بخش وجود ندارد.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {filteredOrders.map((order) => (
                <article key={order.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#c9a85c]/20 bg-[#c9a85c]/10 text-xl">
                        🧾
                      </div>

                      <div className="min-w-0">
                        <p className="font-black text-[#e9c875]">
                          سفارش #{order.order_number}
                        </p>

                        <p className="mt-1 text-sm text-gray-300">
                          {order.customer_name || "مشتری"}
                        </p>

                        <p
                          dir="ltr"
                          className="mt-1 text-right text-xs text-gray-500"
                        >
                          {order.customer_phone || "شماره ثبت نشده"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-lg border px-3 py-2 text-xs font-bold ${statusStyle(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>

                      <div className="text-left">
                        <p className="text-xs text-gray-500">مبلغ سفارش</p>
                        <p className="mt-1 font-black text-[#e9c875]">
                          {money(Number(order.total_amount))}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1 text-xs text-gray-500">
                      <p>
                        زمان ثبت:{" "}
                        {new Date(order.created_at).toLocaleString("fa-IR")}
                      </p>

                      {order.status === "Preparing" && (
                        <p className="font-bold text-sky-300">
                          زمان تخمینی آماده‌شدن: {readyTime(order.estimated_ready_at)}
                        </p>
                      )}

                      {order.status === "Ready" && (
                        <p className="font-bold text-emerald-300">
                          این سفارش آماده تحویل است.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleOrderDetails(order.id)}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/10"
                      >
                        {expandedOrder === order.id
                          ? "بستن جزئیات"
                          : "مشاهده جزئیات"}
                      </button>

                      {order.status === "Pending" && (
                        <>
                          <select
                            aria-label="زمان آماده‌سازی"
                            value={prepMinutes[order.id] || "20"}
                            onChange={(event) =>
                              setPrepMinutes((current) => ({
                                ...current,
                                [order.id]: event.target.value,
                              }))
                            }
                            className="rounded-lg border border-white/10 bg-[#101114] px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#c9a85c]"
                          >
                            <option value="5">۵ دقیقه</option>
                            <option value="10">۱۰ دقیقه</option>
                            <option value="15">۱۵ دقیقه</option>
                            <option value="20">۲۰ دقیقه</option>
                            <option value="25">۲۵ دقیقه</option>
                            <option value="30">۳۰ دقیقه</option>
                            <option value="40">۴۰ دقیقه</option>
                            <option value="45">۴۵ دقیقه</option>
                            <option value="60">۶۰ دقیقه</option>
                            <option value="90">۹۰ دقیقه</option>
                            <option value="120">۱۲۰ دقیقه</option>
                          </select>

                          <button
                            type="button"
                            disabled={busyOrder === order.id}
                            onClick={() =>
                              void changeOrderStatus(order.id, "Preparing")
                            }
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {busyOrder === order.id
                              ? "در حال ثبت..."
                              : "✓ تأیید و شروع آماده‌سازی"}
                          </button>

                          <button
                            type="button"
                            disabled={busyOrder === order.id}
                            onClick={() =>
                              void changeOrderStatus(order.id, "Cancelled")
                            }
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            لغو سفارش
                          </button>
                        </>
                      )}

                      {order.status === "Preparing" && (
                        <button
                          type="button"
                          disabled={busyOrder === order.id}
                          onClick={() =>
                            void changeOrderStatus(order.id, "Ready")
                          }
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {busyOrder === order.id
                            ? "در حال ثبت..."
                            : "✓ اتمام آماده‌سازی"}
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedOrder === order.id && (
                    <div className="mt-5 rounded-xl border border-[#c9a85c]/15 bg-[#101114] p-4">
                      <h3 className="mb-4 font-bold text-[#e9c875]">
                        جزئیات سفارش #{order.order_number}
                      </h3>

                      {itemsLoading === order.id ? (
                        <p className="text-sm text-gray-400">
                          در حال دریافت اقلام سفارش...
                        </p>
                      ) : (orderItems[order.id] ?? []).length === 0 ? (
                        <p className="text-sm text-gray-400">
                          قلمی برای این سفارش پیدا نشد.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {orderItems[order.id].map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3 last:border-0"
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
                      )}

                      {order.customer_note && (
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <p className="mb-2 text-xs font-bold text-gray-400">
                            توضیحات مشتری
                          </p>
                          <p className="whitespace-pre-wrap text-sm text-gray-200">
                            {order.customer_note}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex justify-between border-t border-white/[0.08] pt-4">
                        <span className="font-bold text-gray-400">
                          مبلغ کل
                        </span>
                        <span className="font-black text-[#e9c875]">
                          {money(Number(order.total_amount))}
                        </span>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-white/[0.07] pt-5 text-center text-xs text-gray-600">
          GENERAL FAST FOOD · LIVE ORDER CONTROL
        </footer>
      </div>
    </main>
  );
}
