"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminOrdersPanel } from "@/components/AdminOrdersPanel";
import { AdminMenuPanel } from "@/components/AdminMenuPanel";

const RESTAURANT_NAME = "فست فود ژنرال";
type Tab = "overview" | "orders" | "menu" | "customers" | "reports";
type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  status: string;
  created_at: string;
};
type Customer = {
  id: string;
  full_name: string | null;
  phone: string;
  created_at: string;
};

function tehranDayStart() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const utc = Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")));
  return new Date(utc - 210 * 60 * 1000).toISOString();
}
const money = (value: number) =>
  `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export default function AdminLiveDashboard() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState<Tab>("overview");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [foodCount, setFoodCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const [ordersResult, customersResult, foodsResult] = await Promise.all([
        supabase.from("orders")
          .select("id, order_number, customer_name, customer_phone, total_amount, status, created_at")
          .eq("restaurant_id", id)
          .gte("created_at", tehranDayStart())
          .order("created_at", { ascending: false }),
        supabase.from("customers")
          .select("id, full_name, phone, created_at")
          .eq("restaurant_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("foods")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", id)
          .eq("is_active", true),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (customersResult.error) throw customersResult.error;
      if (foodsResult.error) throw foodsResult.error;
      setOrders((ordersResult.data ?? []) as Order[]);
      setCustomers((customersResult.data ?? []) as Customer[]);
      setFoodCount(foodsResult.count ?? 0);
      setLastUpdated(new Date());
    } catch (cause) {
      console.error("Admin dashboard data error:", cause);
      setError("دریافت آمار با مشکل مواجه شد. دسترسی حساب و اتصال دیتابیس را بررسی کنید.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    async function authorize() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.replace("/admin/login");
          return;
        }
        const { data: restaurant, error: restaurantError } = await supabase
          .from("restaurants").select("id").eq("name", RESTAURANT_NAME).single();
        if (restaurantError || !restaurant) throw restaurantError ?? new Error("Restaurant not found");
        const { data: isMember, error: memberError } = await supabase.rpc(
          "is_restaurant_member", { p_restaurant_id: restaurant.id }
        );
        if (memberError) throw memberError;
        if (!isMember) {
          await supabase.auth.signOut();
          router.replace("/admin/login");
          return;
        }
        if (!active) return;
        setRestaurantId(restaurant.id);
        setChecking(false);
        await loadDashboard(restaurant.id);
      } catch (cause) {
        console.error("Admin authorization error:", cause);
        if (active) {
          setError("حساب شما به شعبه ژنرال دسترسی مدیریتی ندارد یا بررسی دسترسی ناموفق بود.");
          setChecking(false);
          setLoading(false);
        }
      }
    }
    void authorize();
    return () => { active = false; };
  }, [supabase, router, loadDashboard]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase.channel("foodflow-admin-dashboard")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => { void loadDashboard(restaurantId); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, restaurantId, loadDashboard]);

  const stats = useMemo(() => {
    const validOrders = orders.filter((item) => !["Cancelled", "Rejected"].includes(item.status));
    const revenue = validOrders.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
    const pending = orders.filter((item) => item.status === "Pending").length;
    const preparing = orders.filter((item) => item.status === "Preparing").length;
    const ready = orders.filter((item) => item.status === "Ready").length;
    const completed = orders.filter((item) => ["Completed", "Delivered"].includes(item.status)).length;
    const newCustomers = customers.filter((item) => item.created_at >= tehranDayStart()).length;
    return {
      revenue, count: orders.length,
      average: validOrders.length ? Math.round(revenue / validOrders.length) : 0,
      pending, preparing, ready, completed, newCustomers,
    };
  }, [orders, customers]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  const nav: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "نمای کلی", icon: "⌂" },
    { id: "orders", label: "سفارش‌ها", icon: "▤" },
    { id: "menu", label: "مدیریت منو", icon: "▦" },
    { id: "customers", label: "مشتریان", icon: "♙" },
    { id: "reports", label: "گزارش‌ها", icon: "▥" },
  ];

  if (checking) return <main className="gen-admin ga-auth-state" dir="rtl"><div>در حال بررسی دسترسی مدیر…</div></main>;

  return (
    <main className="gen-admin" dir="rtl">
      <div className="ga-shell">
        <aside className="ga-sidebar">
          <div className="ga-brand"><div className="ga-mark">G<span>.</span></div><div><b>ژنرال</b><small>GENERAL FAST FOOD</small></div></div>
          <div className="ga-branch"><span className="ga-branch-icon">⌖</span><div><small>شعبه فعال</small><b>فست فود ژنرال</b></div><span className="ga-chevron">⌄</span></div>
          <div className="ga-nav-label">منوی اصلی</div>
          <nav className="ga-nav">
            {nav.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? "active" : ""}>
              <span className="ga-nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === "orders" && stats.pending > 0 && <i>{number(stats.pending)}</i>}
            </button>)}
          </nav>
          <div className="ga-sidebar-bottom">
            <div className="ga-help"><div className="ga-help-icon">✦</div><b>مدیریت یکپارچه ژنرال</b><p>آمار و سفارش‌ها مستقیماً از دیتابیس دریافت می‌شوند.</p><button onClick={() => void loadDashboard(restaurantId)}>به‌روزرسانی اطلاعات <span>↻</span></button></div>
            <div className="ga-profile"><div className="ga-avatar">م</div><div><b>حساب مدیریت</b><small>عضو تأییدشده شعبه</small></div><button onClick={() => void signOut()} title="خروج">خروج</button></div>
          </div>
        </aside>

        <section className="ga-main">
          <header className="ga-topbar">
            <div className="ga-breadcrumb"><span>ژنرال</span><b>/</b>{nav.find((item) => item.id === tab)?.label}</div>
            <div className="ga-top-actions"><div className="ga-live"><i/> اتصال دیتابیس</div><div className="ga-date">{lastUpdated ? `آخرین بروزرسانی: ${lastUpdated.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}` : "در حال اتصال…"}</div><button className="ga-icon-btn" onClick={() => void loadDashboard(restaurantId)} aria-label="به‌روزرسانی">↻</button></div>
          </header>

          <div className="ga-content">
            <div className="ga-page-heading">
              <div><div className="ga-eyebrow">GENERAL <span>•</span> MANAGEMENT STUDIO</div><h1>{tab === "overview" ? "خوش آمدید، مدیر ژنرال" : nav.find((item) => item.id === tab)?.label}</h1><p>اطلاعات واقعی و به‌روز رستوران شما</p></div>
              <div className="ga-heading-actions"><a className="ga-btn ga-btn-quiet" href="/" target="_blank" rel="noreferrer">مشاهده سایت ↗</a><button className="ga-btn ga-btn-gold" onClick={() => setTab(tab === "menu" ? "menu" : "orders")}>{tab === "menu" ? "+ مدیریت غذاها" : "+ مشاهده سفارش‌ها"}</button></div>
            </div>

            {error && <div className="ga-error" role="alert">{error}<button onClick={() => restaurantId ? void loadDashboard(restaurantId) : router.replace("/admin/login")}>تلاش دوباره</button></div>}

            {tab === "overview" && <>
              <section className="ga-stats">
                <article className="ga-stat"><div className="ga-stat-top"><span>فروش امروز</span><span className="ga-stat-icon gold">ت</span></div><strong>{loading ? "…" : number(stats.revenue)} <small>تومان</small></strong><div className="ga-stat-foot">بر اساس سفارش‌های غیرلغوشده امروز</div></article>
                <article className="ga-stat"><div className="ga-stat-top"><span>سفارش‌های امروز</span><span className="ga-stat-icon burgundy">▤</span></div><strong>{loading ? "…" : number(stats.count)} <small>سفارش</small></strong><div className="ga-stat-foot">تمام وضعیت‌های ثبت‌شده امروز</div></article>
                <article className="ga-stat"><div className="ga-stat-top"><span>میانگین سبد خرید</span><span className="ga-stat-icon blue">◈</span></div><strong>{loading ? "…" : number(stats.average)} <small>تومان</small></strong><div className="ga-stat-foot">میانگین سفارش‌های معتبر امروز</div></article>
                <article className="ga-stat"><div className="ga-stat-top"><span>غذاهای فعال</span><span className="ga-stat-icon green">♙</span></div><strong>{loading ? "…" : number(foodCount)} <small>آیتم</small></strong><div className="ga-stat-foot">آیتم‌های فعال منوی رستوران</div></article>
              </section>
              <section className="ga-grid-main">
                <article className="ga-panel"><div className="ga-panel-head"><div><h2>وضعیت سفارش‌های امروز</h2><p>بر اساس آخرین اطلاعات دیتابیس</p></div><button className="ga-more" onClick={() => setTab("orders")}>مدیریت سفارش‌ها ←</button></div>
                  <div className="ga-live-status-grid">
                    <div><i className="dot red-dot"/><span>در انتظار بررسی</span><b>{number(stats.pending)}</b></div>
                    <div><i className="dot gold-dot"/><span>در حال آماده‌سازی</span><b>{number(stats.preparing)}</b></div>
                    <div><i className="dot blue-dot"/><span>آماده تحویل</span><b>{number(stats.ready)}</b></div>
                    <div><i className="dot green-dot"/><span>تکمیل‌شده</span><b>{number(stats.completed)}</b></div>
                  </div>
                  <div className="ga-live-total"><span>مجموع سفارش‌های امروز</span><b>{number(stats.count)}</b></div>
                </article>
                <article className="ga-panel"><div className="ga-panel-head"><div><h2>خلاصه عملکرد</h2><p>آمار زنده از دیتابیس</p></div><span className="ga-goal-icon">✦</span></div>
                  <div className="ga-summary-list"><div><span>مشتریان ثبت‌شده</span><b>{number(customers.length)}</b></div><div><span>مشتریان جدید امروز</span><b>{number(stats.newCustomers)}</b></div><div><span>غذاهای فعال</span><b>{number(foodCount)}</b></div></div>
                  <p className="ga-goal-note">آمار فقط بر اساس داده‌هایی نمایش داده می‌شود که حساب مدیر اجازه مشاهده آن‌ها را دارد.</p>
                </article>
              </section>
              <section className="ga-panel ga-recent"><div className="ga-panel-head"><div><h2>آخرین سفارش‌های امروز</h2><p>آخرین سفارش‌های ثبت‌شده در شعبه</p></div><button className="ga-more" onClick={() => setTab("orders")}>همه سفارش‌ها ←</button></div>
                {orders.length === 0 ? <div className="ga-empty-note">امروز هنوز سفارشی ثبت نشده است.</div> : <div className="ga-table-wrap"><table className="ga-table"><thead><tr><th>شماره سفارش</th><th>مشتری</th><th>مبلغ</th><th>زمان</th><th>وضعیت</th></tr></thead><tbody>{orders.slice(0, 6).map((order) => <tr key={order.id}><td><b className="ga-order-id">#{order.order_number}</b></td><td>{order.customer_name || "مشتری"}<small className="ga-cell-sub">{order.customer_phone || "—"}</small></td><td className="ga-money">{money(Number(order.total_amount))}</td><td className="ga-time">{new Date(order.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</td><td><span className={`ga-status ${order.status === "Completed" ? "green" : order.status === "Ready" ? "blue" : order.status === "Preparing" ? "amber" : order.status === "Cancelled" || order.status === "Rejected" ? "red" : "amber"}`}>{({ Pending: "در انتظار", Preparing: "در حال آماده‌سازی", Ready: "آماده تحویل", Completed: "تکمیل‌شده", Cancelled: "لغوشده", Rejected: "ردشده" } as Record<string, string>)[order.status] ?? order.status}</span></td></tr>)}</tbody></table></div>}
              </section>
            </>}

            {tab === "orders" && <div className="ga-embedded"><AdminOrdersPanel /></div>}
            {tab === "menu" && <div className="ga-embedded"><AdminMenuPanel /></div>}

            {tab === "customers" && <section className="ga-panel ga-full-panel">
              <div className="ga-panel-head"><div><h2>باشگاه مشتریان</h2><p>فهرست مشتریانی که در جدول مشتریان رستوران ثبت شده‌اند</p></div><span className="ga-count-pill">{number(customers.length)} مشتری</span></div>
              <div className="ga-customer-stats"><div><small>کل مشتریان ثبت‌شده</small><b>{number(customers.length)}</b></div><div><small>مشتری جدید امروز</small><b>{number(stats.newCustomers)}</b></div><div><small>سفارش امروز</small><b>{number(stats.count)}</b></div></div>
              <div className="ga-table-wrap"><table className="ga-table"><thead><tr><th>نام مشتری</th><th>شماره تماس</th><th>تاریخ عضویت</th></tr></thead><tbody>{customers.slice(0, 100).map((customer) => <tr key={customer.id}><td>{customer.full_name || "بدون نام"}</td><td dir="ltr" className="ga-time">{customer.phone}</td><td>{new Date(customer.created_at).toLocaleDateString("fa-IR")}</td></tr>)}</tbody></table></div>
              {customers.length === 0 && <div className="ga-empty-note">هنوز مشتری‌ای در جدول مشتریان ثبت نشده است. سفارش‌های قدیمی ممکن است فقط نام و تلفن ذخیره‌شده در خود سفارش را داشته باشند.</div>}
            </section>}

            {tab === "reports" && <section className="ga-panel ga-full-panel">
              <div className="ga-panel-head"><div><h2>گزارش عملکرد امروز</h2><p>گزارش محاسبه‌شده از سفارش‌های امروز؛ بدون داده نمایشی</p></div><span className="ga-count-pill">امروز</span></div>
              <div className="ga-report-grid"><div><small>فروش معتبر امروز</small><b>{number(stats.revenue)} <i>تومان</i></b></div><div><small>تعداد سفارش‌ها</small><b>{number(stats.count)}</b></div><div><small>میانگین سبد خرید</small><b>{number(stats.average)} <i>تومان</i></b></div><div><small>نرخ تکمیل سفارش‌ها</small><b>{number(stats.count ? Math.round(stats.completed / stats.count * 100) : 0)}٪</b></div></div>
              <div className="ga-report-note">گزارش مقایسه‌ای هفتگی و ماهانه در این نسخه فعال نشده؛ برای جلوگیری از نمایش عدد ساختگی، فقط آمار واقعی امروز نشان داده می‌شود.</div>
            </section>}
          </div>
          <footer className="ga-footer"><span>© ژنرال فست‌فود</span><span>FOODFLOW MANAGEMENT</span><span><i/> داده‌ها از Supabase</span></footer>
        </section>
      </div>
    </main>
  );
}
