
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppControls, useApp } from "@/components/app-provider";

type Category = {
  id: string;
  name: string;
  sort_order: number;
};

type Food = {
  id: string;
  name: string;
  categoryId: string | null;
  category: string;
  price: number;
  description: string;
  imageUrl: string | null;
  isAvailable: boolean;
};

type CartItem = {
  food: Food;
  quantity: number;
};

type TrackedOrder = {
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  estimated_ready_at: string | null;
  items: { food_name: string; unit_price: number; quantity: number }[];
};

export default function Home() {
  const [supabase] = useState(() => createClient());
  const { language, direction, t } = useApp();
  const locale = language === "fa" ? "fa-IR" : "en-US";

  const [categories, setCategories] = useState<Category[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // اطلاعات مشتری و آخرین سفارش فقط در همین مرورگر نگهداری می‌شود.
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [savedOrderNumber, setSavedOrderNumber] = useState("");
  const [savedCustomerPhone, setSavedCustomerPhone] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    try {
      const savedName = localStorage.getItem("foodflow_customer_name") ?? "";
      const savedPhone = localStorage.getItem("foodflow_customer_phone") ?? "";
      const savedNumber = localStorage.getItem("foodflow_last_order_number") ?? "";
      setCustomerName(savedName);
      setCustomerPhone(savedPhone);
      setSavedCustomerPhone(savedPhone);
      setSavedOrderNumber(savedNumber);
    } catch (error) {
      console.warn("Could not restore customer details:", error);
    }
  }, []);

  function formatPrice(price: number) {
    return (
      new Intl.NumberFormat(locale).format(price) +
      (language === "fa" ? " تومان" : " toman")
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      setLoading(true);
      setLoadError("");

      try {
        const { data: restaurant, error: restaurantError } =
          await supabase
            .from("restaurants")
            .select("id")
            .eq("name", "فست فود ژنرال")
            .single();

        if (restaurantError) throw restaurantError;
        if (!restaurant) throw new Error("Restaurant not found");

        const { data: categoryData, error: categoryError } =
          await supabase
            .from("categories")
            .select("id, name, sort_order")
            .eq("restaurant_id", restaurant.id)
            .eq("is_active", true)
            .order("sort_order", { ascending: true });

        if (categoryError) throw categoryError;

        const { data: foodData, error: foodError } =
          await supabase
            .from("foods")
            .select(
              "id, name, category_id, price, description, image_url, is_available"
            )
            .eq("restaurant_id", restaurant.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (foodError) throw foodError;
        if (cancelled) return;

        const loadedCategories = (categoryData ?? []) as Category[];

        const categoryMap = new Map(
          loadedCategories.map((category) => [
            category.id,
            category.name,
          ])
        );

        const loadedFoods: Food[] = (foodData ?? []).map((food) => ({
          id: food.id,
          name: food.name,
          categoryId: food.category_id,
          category:
            categoryMap.get(food.category_id) ??
            (language === "fa" ? "بدون دسته‌بندی" : "Uncategorized"),
          price: Number(food.price),
          description: food.description ?? "",
          imageUrl: food.image_url,
          isAvailable: food.is_available,
        }));

        setCategories(loadedCategories);
        setFoods(loadedFoods);
      } catch (error) {
        console.error("Menu loading error:", error);

        if (!cancelled) {
          setLoadError(
            t(
              "دریافت منو با مشکل مواجه شد. اتصال دیتابیس را بررسی کن.",
              "Could not load the menu. Please check the database connection."
            )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMenu();

    return () => {
      cancelled = true;
    };
  }, [supabase, language, t]);

  const filteredFoods = useMemo(() => {
    return foods.filter((food) => {
      const matchesCategory =
        selectedCategory === "all" ||
        food.category === selectedCategory;

      const matchesSearch = food.name
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [foods, selectedCategory, search]);

  const cartCount = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.food.price * item.quantity,
    0
  );

  function addToCart(food: Food) {
    if (!food.isAvailable) return;

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.food.id === food.id
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.food.id === food.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentItems, { food, quantity: 1 }];
    });

    setCartOpen(true);
  }

  function decreaseQuantity(foodId: string) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.food.id === foodId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function submitOrder() {
    if (isSubmitting) return;

    setFormError("");

    if (!customerName.trim()) {
      setFormError(t("نام خود را وارد کن.", "Please enter your name."));
      return;
    }

    if (!/^09\d{9}$/.test(customerPhone)) {
      setFormError(
        t(
          "شماره موبایل معتبر نیست.",
          "Please enter a valid mobile number."
        )
      );
      return;
    }

    if (cartItems.length === 0) {
      setFormError(t("سبد خرید خالی است.", "Your cart is empty."));
      return;
    }

    if (cartItems.some((item) => !item.food.isAvailable)) {
      setFormError(
        t("یکی از غذاهای سفارش موجود نیست.", "An item is unavailable.")
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const items = cartItems.map((item) => ({
        id: item.food.id,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.rpc(
        "create_foodflow_order",
        {
          p_customer_name: customerName.trim(),
          p_customer_phone: customerPhone,
          p_customer_note: customerNote.trim(),
          p_items: items,
          p_table_id: null,
        }
      );

      if (error) throw error;

      const result = data as {
        success?: boolean;
        order_number?: string;
      };

      if (!result?.success || !result.order_number) {
        throw new Error("Invalid order response");
      }

      setOrderNumber(result.order_number);
      setSavedOrderNumber(result.order_number);
      setSavedCustomerPhone(customerPhone);
      try {
        localStorage.setItem("foodflow_customer_name", customerName.trim());
        localStorage.setItem("foodflow_customer_phone", customerPhone);
        localStorage.setItem("foodflow_last_order_number", result.order_number);
      } catch (storageError) {
        console.warn("Could not save order details in this browser:", storageError);
      }
      setOrderSubmitted(true);
    } catch (error: unknown) {
      console.error("Order submission failed:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : t("خطا در ثبت سفارش.", "Order submission failed.")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetOrder() {
    setCartItems([]);
    setCustomerNote("");
    setOrderNumber("");
    setOrderSubmitted(false);
    setCheckoutOpen(false);
    setCartOpen(false);
    setFormError("");
  }

  async function fetchTrackedOrder() {
    if (!savedOrderNumber || !savedCustomerPhone) {
      setTrackError(
        t(
          "هنوز سفارشی در این مرورگر ثبت نشده است. ابتدا سفارش خود را ثبت کن.",
          "No saved order was found in this browser. Please place an order first."
        )
      );
      return;
    }

    setTrackLoading(true);
    setTrackError("");
    try {
      const { data, error } = await supabase.rpc("track_foodflow_order", {
        p_order_number: savedOrderNumber,
        p_customer_phone: savedCustomerPhone,
      });

      if (error) throw error;
      if (!data) {
        setTrackedOrder(null);
        setTrackError(
          t("سفارشی با اطلاعات ذخیره‌شده پیدا نشد.", "No order was found.")
        );
        return;
      }

      setTrackedOrder(data as TrackedOrder);
      setLastUpdated(new Date().toLocaleTimeString(locale));
    } catch (error) {
      console.error("Order tracking failed:", error);
      setTrackError(
        t("دریافت وضعیت سفارش با مشکل مواجه شد. دوباره تلاش کن.", "Could not load order status. Please try again.")
      );
    } finally {
      setTrackLoading(false);
    }
  }

  useEffect(() => {
    if (!trackOpen || !savedOrderNumber || !savedCustomerPhone) return;

    void fetchTrackedOrder();
    const timer = window.setInterval(() => {
      void fetchTrackedOrder();
    }, 10000);

    return () => window.clearInterval(timer);
    // fetchTrackedOrder intentionally uses the saved order credentials.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackOpen, savedOrderNumber, savedCustomerPhone]);

  function formatDateTime(value: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      Pending: t("در انتظار تأیید", "Pending"),
      Preparing: t("در حال آماده‌سازی", "Preparing"),
      Ready: t("آماده تحویل", "Ready"),
      Completed: t("تکمیل‌شده", "Completed"),
      Delivered: t("تحویل‌شده", "Delivered"),
      Cancelled: t("لغوشده", "Cancelled"),
    };
    return labels[status] ?? status;
  }

  const redButton =
    "bg-[#ed263b] text-white shadow-lg shadow-red-950/40 transition duration-300 hover:-translate-y-0.5 hover:bg-[#ff3349] hover:shadow-red-600/30 active:translate-y-0";

  const panel =
    "border border-white/[0.08] bg-[#191a1e] shadow-xl shadow-black/20";

  const gold = "text-[#f4c65e]";

  return (
    <main
      dir={direction}
      className="min-h-screen overflow-hidden bg-[#0b0c0f] text-white selection:bg-red-600 selection:text-white"
    >
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap");

        body {
          background: #0b0c0f;
          font-family: "Vazirmatn", sans-serif;
        }

        @keyframes street-enter {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes street-glow {
          0%, 100% {
            box-shadow: 0 0 15px rgba(237, 38, 59, 0.15);
          }
          50% {
            box-shadow: 0 0 35px rgba(237, 38, 59, 0.45);
          }
        }

        @keyframes street-float {
          0%, 100% {
            transform: translateY(0) rotate(-3deg);
          }
          50% {
            transform: translateY(-13px) rotate(3deg);
          }
        }

        .street-enter {
          animation: street-enter 0.75s cubic-bezier(.2,.8,.2,1) both;
        }

        .street-glow {
          animation: street-glow 2.5s ease-in-out infinite;
        }

        .street-float {
          animation: street-float 5s ease-in-out infinite;
        }

        .street-card {
          animation: street-enter 0.65s ease both;
          transition:
            transform 0.35s ease,
            border-color 0.35s ease,
            box-shadow 0.35s ease;
        }

        .street-card:hover {
          transform: translateY(-9px);
          border-color: rgba(244, 198, 94, 0.45);
          box-shadow: 0 20px 55px rgba(0,0,0,.45);
        }

        .street-card img {
          transition: transform 0.65s cubic-bezier(.2,.8,.2,1);
        }

        .street-card:hover img {
          transform: scale(1.09);
        }

        .street-scroll::-webkit-scrollbar {
          height: 5px;
          width: 5px;
        }

        .street-scroll::-webkit-scrollbar-thumb {
          background: #ed263b;
          border-radius: 20px;
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0e11]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-red-600/30 blur-lg" />
              <img
                src="/general-logo.png"
                alt="General"
                className="relative h-12 w-12 rounded-xl object-contain sm:h-14 sm:w-14"
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-black sm:text-2xl">
                {t("ژنرال", "GENERAL")}
                <span className="ms-2 text-[#ed263b]">
                  {t("فست فود", "FOOD")}
                </span>
              </h1>
              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                {t("فست فود ژنرال", "GENERAL FAST FOOD")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <AppControls />

            <button
              type="button"
              onClick={() => {
                setTrackError("");
                setTrackOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-[#f4c65e]/40 bg-[#f4c65e]/10 px-3 py-3 text-xs font-black text-[#f4c65e] transition hover:border-[#f4c65e] hover:bg-[#f4c65e]/20 sm:px-4 sm:text-sm"
            >
              <span className="text-base">📦</span>
              <span>{t("پیگیری سفارش", "TRACK ORDER")}</span>
            </button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className={`relative flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-black sm:px-5 ${redButton}`}
            >
              <span className="text-lg">🛒</span>
              <span className="hidden sm:inline">
                {t("سبد خرید", "CART")}
              </span>

              {cartCount > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1 text-xs font-black text-red-600">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        {/* HERO */}
        <section className="relative mt-5 min-h-[440px] overflow-hidden rounded-[2rem] border border-red-500/20 bg-[#151216] sm:mt-8 sm:min-h-[510px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_50%,rgba(237,38,59,.25),transparent_55%),linear-gradient(120deg,#191316,#0b0c0f_65%)]" />

          <div className="absolute -end-24 -top-28 h-80 w-80 rounded-full border-[35px] border-red-600/10" />
          <div className="absolute -bottom-40 -start-20 h-96 w-96 rounded-full border-[45px] border-[#f4c65e]/[0.06]" />

          <div className="relative z-10 grid min-h-[440px] items-center gap-5 p-7 sm:min-h-[510px] sm:grid-cols-[1.1fr_.9fr] sm:p-12">
            <div className="street-enter">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                {t("طعم خیابان، کیفیت ژنرال", "STREET TASTE. GENERAL QUALITY.")}
              </div>

              <h2 className="max-w-2xl text-4xl font-black leading-[1.35] sm:text-6xl sm:leading-[1.25]">
                {t("گرسنگی؟", "HUNGRY?")}
                <br />
                <span className="text-[#ed263b]">
                  {t("وقتشه", "IT'S TIME")}
                </span>
                <br />
                <span className="text-[#f4c65e]">
                  {t("خفن بخوری!", "TO EAT BIG!")}
                </span>
              </h2>

              <p className="mt-5 max-w-lg text-sm leading-8 text-gray-400 sm:text-base">
                {t(
                  "از برگرهای آبدار تا طعم‌های هیجان‌انگیز ژنرال؛ غذای مورد علاقه‌ات رو انتخاب کن و سفارش بده.",
                  "From juicy burgers to bold General flavors. Choose your favorite and order now."
                )}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("street-menu")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className={`street-glow rounded-xl px-7 py-4 font-black ${redButton}`}
                >
                  {t("بزن بریم سراغ غذا", "EXPLORE THE MENU")} ←
                </button>

                <span className="text-xs font-bold text-gray-500">
                  ★ GENERAL STREET FOOD
                </span>
              </div>
            </div>

            <div className="relative hidden h-full min-h-[350px] items-center justify-center sm:flex">
              <div className="absolute h-72 w-72 rounded-full bg-red-600/20 blur-[80px]" />

              <div className="street-float relative z-10 flex h-64 w-64 items-center justify-center rounded-full border border-[#f4c65e]/30 bg-gradient-to-br from-[#30221e] to-[#141114] text-[145px] shadow-[0_0_80px_rgba(237,38,59,.2)]">
                🍔
              </div>

              <div className="absolute end-4 top-12 rotate-12 rounded-xl border border-[#f4c65e]/40 bg-[#201a16] px-4 py-3 text-sm font-black text-[#f4c65e]">
                FRESH & HOT
              </div>

              <div className="absolute bottom-10 start-0 -rotate-6 rounded-xl bg-[#ed263b] px-5 py-3 text-sm font-black shadow-xl shadow-red-950/50">
                TASTE THE FIRE 🔥
              </div>
            </div>
          </div>
        </section>

        {/* QUICK FEATURES */}
        <section className="my-6 grid grid-cols-2 gap-3 sm:my-9 sm:grid-cols-4">
          {[
            { icon: "🔥", title: t("طعم جسور", "BOLD TASTE"), sub: t("مخصوص ژنرال", "GENERAL STYLE") },
            { icon: "🍔", title: t("برگر جذاب", "JUICY BURGERS"), sub: t("انتخاب خوشمزه", "GREAT CHOICES") },
            { icon: "⚡", title: t("سفارش آسان", "EASY ORDER"), sub: t("سریع و راحت", "FAST & SIMPLE") },
            { icon: "★", title: t("کیفیت ژنرال", "GENERAL QUALITY"), sub: t("تجربه متفاوت", "A NEW EXPERIENCE") },
          ].map((item) => (
            <div
              key={item.title}
              className={`${panel} rounded-2xl p-4 transition duration-300 hover:-translate-y-1 hover:border-red-500/30`}
            >
              <div className="mb-3 text-2xl">{item.icon}</div>
              <p className="text-sm font-black">{item.title}</p>
              <p className="mt-1 text-[10px] font-bold tracking-wider text-gray-500">
                {item.sub}
              </p>
            </div>
          ))}
        </section>

        {/* MENU */}
        <section id="street-menu" className="scroll-mt-28 pb-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-black tracking-[0.3em] text-[#ed263b]">
                THE GENERAL MENU
              </p>
              <h2 className="text-3xl font-black sm:text-4xl">
                {t("منوی ژنرال", "THE MENU")}
                <span className="ms-2 text-[#ed263b]">.</span>
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {t("انتخاب کن، سفارش بده، لذت ببر.", "CHOOSE. ORDER. ENJOY.")}
              </p>
            </div>

            <span className="rounded-xl border border-white/10 bg-[#191a1e] px-4 py-2 text-xs text-gray-400">
              {filteredFoods.length.toLocaleString(locale)}{" "}
              {t("محصول", "ITEMS")}
            </span>
          </div>

          {/* SEARCH */}
          <div className="mb-5">
            <div className="relative">
              <span className="absolute start-5 top-1/2 -translate-y-1/2 text-xl text-[#ed263b]">
                ⌕
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t(
                  "دنبال چی می‌گردی؟",
                  "WHAT ARE YOU CRAVING?"
                )}
                className="w-full rounded-2xl border border-white/10 bg-[#191a1e] py-4 pe-5 ps-14 text-white outline-none transition placeholder:text-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
              />
            </div>
          </div>

          {/* CATEGORY FILTER */}
          <div className="street-scroll mb-8 flex gap-2 overflow-x-auto pb-3">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`shrink-0 rounded-xl border px-5 py-3 text-sm font-black transition ${
                selectedCategory === "all"
                  ? "border-red-500 bg-[#ed263b] text-white shadow-lg shadow-red-950/40"
                  : "border-white/10 bg-[#191a1e] text-gray-400 hover:border-red-500/50 hover:text-white"
              }`}
            >
              {t("همه غذاها", "ALL")}
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.name)}
                className={`shrink-0 rounded-xl border px-5 py-3 text-sm font-bold transition ${
                  selectedCategory === category.name
                    ? "border-red-500 bg-[#ed263b] text-white shadow-lg shadow-red-950/40"
                    : "border-white/10 bg-[#191a1e] text-gray-400 hover:border-red-500/50 hover:text-white"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className={`${panel} rounded-3xl p-14 text-center`}>
              <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#ed263b]" />
              <p className="font-bold text-gray-400">
                {t("داریم منو رو آماده می‌کنیم...", "LOADING THE MENU...")}
              </p>
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-8 text-center text-red-200">
              {loadError}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`mt-5 block w-full rounded-xl py-3 font-bold ${redButton}`}
              >
                {t("تلاش دوباره", "TRY AGAIN")}
              </button>
            </div>
          ) : filteredFoods.length === 0 ? (
            <div className={`${panel} rounded-3xl p-12 text-center`}>
              <div className="mb-4 text-6xl">🍽️</div>
              <p className="text-gray-400">
                {t("غذایی پیدا نشد.", "NO FOOD FOUND.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFoods.map((food, index) => (
                <article
                  key={food.id}
                  style={{ animationDelay: `${index * 90}ms` }}
                  className={`street-card overflow-hidden rounded-3xl border border-white/[0.08] bg-[#191a1e] ${
                    !food.isAvailable ? "opacity-90" : ""
                  }`}
                >
                  <div className="relative flex h-60 items-center justify-center overflow-hidden bg-gradient-to-br from-[#292126] to-[#111216]">
                    {food.imageUrl ? (
                      <img
                        src={food.imageUrl}
                        alt={food.name}
                        className={`h-full w-full object-cover ${
                          !food.isAvailable ? "grayscale" : ""
                        }`}
                      />
                    ) : (
                      <div className="text-8xl transition duration-500 group-hover:scale-110">
                        🍔
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />

                    <span className="absolute start-4 top-4 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs font-bold text-white backdrop-blur">
                      {food.category}
                    </span>

                    {!food.isAvailable && (
                      <span className="absolute end-4 top-4 rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white shadow-lg">
                        {t("ناموجود", "SOLD OUT")}
                      </span>
                    )}

                    {food.isAvailable && (
                      <span className="absolute bottom-4 start-4 rounded-full border border-emerald-400/30 bg-emerald-950/80 px-3 py-1 text-[10px] font-bold text-emerald-300">
                        ● {t("آماده سفارش", "AVAILABLE")}
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="mb-2 text-xl font-black">
                      {food.name}
                    </h3>

                    <p className="mb-5 min-h-[48px] text-sm leading-7 text-gray-400">
                      {food.description ||
                        t("توضیحاتی ثبت نشده است.", "No description available.")}
                    </p>

                    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                      <div>
                        <p className="mb-1 text-[10px] font-bold tracking-wider text-gray-500">
                          {t("قیمت", "PRICE")}
                        </p>
                        <p className={`text-lg font-black ${gold}`}>
                          {formatPrice(food.price)}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={!food.isAvailable}
                        onClick={() => addToCart(food)}
                        className={`rounded-xl px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-[#292b30] disabled:text-gray-500 ${
                          food.isAvailable ? redButton : ""
                        }`}
                      >
                        {food.isAvailable
                          ? `+ ${t("افزودن", "ADD")}`
                          : t("ناموجود", "SOLD OUT")}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* CART BACKDROP */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
          onClick={() => setCartOpen(false)}
        />
      )}

      {/* CART DRAWER */}
      <aside
        dir={direction}
        className={`fixed ${
          direction === "rtl" ? "right-0" : "left-0"
        } top-0 z-50 flex h-full w-full max-w-md flex-col border-white/10 bg-[#17181c] shadow-2xl transition-transform duration-300 ${
          direction === "rtl" ? "border-l" : "border-r"
        } ${
          cartOpen
            ? "translate-x-0"
            : direction === "rtl"
              ? "translate-x-full"
              : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <p className="mb-1 text-[10px] font-black tracking-[0.25em] text-red-500">
              YOUR ORDER
            </p>
            <h2 className="text-xl font-black">
              🛒 {t("سبد خرید", "YOUR CART")}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="rounded-xl bg-white/5 px-4 py-3 text-gray-300 hover:bg-red-600/20"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cartItems.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <div className="mb-4 text-6xl">🛒</div>
              {t("سبد خرید خالی است.", "YOUR CART IS EMPTY.")}
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.food.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#222328] p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {item.food.imageUrl ? (
                      <img
                        src={item.food.imageUrl}
                        alt={item.food.name}
                        className="h-14 w-14 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="text-3xl">🍔</span>
                    )}

                    <div className="min-w-0">
                      <h3 className="truncate font-bold">
                        {item.food.name}
                      </h3>
                      <p className={`mt-1 text-xs ${gold}`}>
                        {formatPrice(item.food.price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decreaseQuantity(item.food.id)}
                      className="h-8 w-8 rounded-lg bg-[#303136] font-bold hover:bg-red-600"
                    >
                      −
                    </button>

                    <span className="min-w-5 text-center font-bold">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => addToCart(item.food)}
                      disabled={!item.food.isAvailable}
                      className="h-8 w-8 rounded-lg bg-red-600 font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-[#111216] p-5">
          <div className="mb-5 flex items-center justify-between gap-2">
            <span className="font-bold text-gray-400">
              {t("مبلغ کل", "TOTAL")}
            </span>
            <span className={`text-xl font-black ${gold}`}>
              {formatPrice(totalPrice)}
            </span>
          </div>

          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={() => {
              setCartOpen(false);
              setCheckoutOpen(true);
            }}
            className={`w-full rounded-2xl py-4 font-black disabled:opacity-40 ${redButton}`}
          >
            {t("ادامه و ثبت سفارش", "CONTINUE TO CHECKOUT")}
          </button>
        </div>
      </aside>

      {/* CHECKOUT */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md">
          <div
            dir={direction}
            className="my-8 w-full max-w-md rounded-3xl border border-white/10 bg-[#191a1e] p-6 shadow-2xl"
          >
            {!orderSubmitted ? (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-[10px] font-black tracking-[0.25em] text-red-500">
                      CHECKOUT
                    </p>
                    <h2 className="text-xl font-black">
                      {t("تکمیل سفارش", "COMPLETE ORDER")}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isSubmitting) {
                        setCheckoutOpen(false);
                        setFormError("");
                      }
                    }}
                    className="rounded-lg bg-white/5 px-3 py-2"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm leading-7 text-red-200">
                  {t(
                    "این سفارش به‌صورت آنلاین ثبت می‌شود و به میز خاصی متصل نیست.",
                    "This is an online order and is not assigned to a table."
                  )}
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold">
                    {t("نام و نام خانوادگی", "FULL NAME")}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder={t("نام شما", "Your name")}
                    className="w-full rounded-xl border border-white/10 bg-[#25262b] px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold">
                    {t("شماره موبایل", "MOBILE NUMBER")}
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    dir="ltr"
                    value={customerPhone}
                    onChange={(event) =>
                      setCustomerPhone(
                        event.target.value.replace(/\D/g, "").slice(0, 11)
                      )
                    }
                    placeholder="09123456789"
                    className="w-full rounded-xl border border-white/10 bg-[#25262b] px-4 py-3 text-left text-white outline-none focus:border-red-500"
                  />
                </div>

                <div className="mb-5">
                  <label className="mb-2 block text-sm font-bold">
                    {t("توضیحات سفارش", "ORDER NOTES")}
                  </label>
                  <textarea
                    value={customerNote}
                    onChange={(event) =>
                      setCustomerNote(event.target.value.slice(0, 1000))
                    }
                    rows={3}
                    maxLength={1000}
                    placeholder={t("توضیحات دلخواه...", "Any special requests...")}
                    className="w-full resize-y rounded-xl border border-white/10 bg-[#25262b] px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div className="mb-5 rounded-2xl border border-white/10 bg-[#222328] p-4">
                  <div className="mb-3 flex justify-between text-sm">
                    <span className="text-gray-400">
                      {t("تعداد اقلام", "ITEMS")}
                    </span>
                    <span className="font-bold">
                      {cartCount.toLocaleString(locale)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">{t("مبلغ کل", "TOTAL")}</span>
                    <span className={`font-black ${gold}`}>
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                </div>

                {formError && (
                  <div
                    dir="auto"
                    className="mb-4 break-words rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200"
                  >
                    {formError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={isSubmitting}
                  className={`w-full rounded-2xl py-4 font-black disabled:opacity-50 ${redButton}`}
                >
                  {isSubmitting
                    ? t("در حال ثبت سفارش...", "SUBMITTING...")
                    : t("ثبت نهایی سفارش", "PLACE ORDER")}
                </button>
              </>
            ) : (
              <div className="py-6 text-center">
                <div className="mb-5 text-7xl">🔥</div>
                <h2 className="mb-3 text-2xl font-black text-emerald-400">
                  {t("سفارش ثبت شد!", "ORDER CONFIRMED!")}
                </h2>
                <p className="mb-5 text-gray-400">
                  {customerName}، {t("ممنون از انتخابت!", "THANK YOU!")}
                </p>

                <div className="mb-6 rounded-2xl border border-[#f4c65e]/30 bg-[#f4c65e]/10 p-5">
                  <p className="mb-2 text-sm text-gray-400">
                    {t("شماره سفارش", "ORDER NUMBER")}
                  </p>
                  <p dir="ltr" className="text-4xl font-black text-[#f4c65e]">
                    {orderNumber}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetOrder}
                  className={`w-full rounded-2xl py-4 font-black ${redButton}`}
                >
                  {t("بازگشت به منو", "BACK TO MENU")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ORDER TRACKING MODAL */}
      {trackOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
          onClick={(event) => {
            if (event.target === event.currentTarget) setTrackOpen(false);
          }}
        >
          <section
            dir={direction}
            className="my-6 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-[#f4c65e]/20 bg-[#17181c] shadow-[0_25px_100px_rgba(0,0,0,.65)]"
          >
            <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#32151b] via-[#1c1519] to-[#17181c] p-6">
              <div className="absolute -end-12 -top-16 h-44 w-44 rounded-full bg-red-600/15 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-black tracking-[0.25em] text-[#f4c65e]">
                    GENERAL · ORDER STATUS
                  </p>
                  <h2 className="text-2xl font-black">
                    {t("پیگیری سفارش", "TRACK YOUR ORDER")}
                  </h2>
                  <p className="mt-2 text-sm text-gray-400">
                    {t("وضعیت سفارش خودت رو همین‌جا ببین.", "Your order status, right here.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTrackOpen(false)}
                  aria-label={t("بستن", "Close")}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gray-300 transition hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {savedOrderNumber && savedCustomerPhone ? (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#222328] p-4">
                    <div>
                      <p className="text-xs text-gray-500">{t("شماره سفارش شما", "YOUR ORDER NUMBER")}</p>
                      <p dir="ltr" className="mt-1 text-2xl font-black tracking-wider text-[#f4c65e]">
                        {savedOrderNumber}
                      </p>
                    </div>
                    <span className="text-3xl">🧾</span>
                  </div>

                  {trackLoading && !trackedOrder ? (
                    <div className="py-8 text-center">
                      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[#ed263b]" />
                      <p className="text-sm text-gray-400">{t("در حال دریافت وضعیت سفارش...", "Loading order status...")}</p>
                    </div>
                  ) : trackedOrder ? (
                    <>
                      <div className={`rounded-2xl border p-5 text-center ${
                        trackedOrder.status === "Ready"
                          ? "border-emerald-400/30 bg-emerald-950/35"
                          : trackedOrder.status === "Cancelled"
                            ? "border-red-500/30 bg-red-950/30"
                            : "border-[#f4c65e]/20 bg-[#f4c65e]/[0.06]"
                      }`}>
                        <div className="mb-2 text-4xl">
                          {trackedOrder.status === "Ready" ? "🎉" : trackedOrder.status === "Cancelled" ? "✕" : "🍳"}
                        </div>
                        <p className="text-xs text-gray-400">{t("وضعیت فعلی سفارش", "CURRENT STATUS")}</p>
                        <p className={`mt-2 text-xl font-black ${
                          trackedOrder.status === "Ready" ? "text-emerald-300" :
                          trackedOrder.status === "Cancelled" ? "text-red-300" : "text-[#f4c65e]"
                        }`}>
                          {statusLabel(trackedOrder.status)}
                        </p>
                        {trackedOrder.status === "Ready" && (
                          <p className="mt-3 font-bold leading-7 text-emerald-200">
                            {t("سفارش شما آماده تحویل است. نوش جان!", "Your order is ready for pickup. Enjoy!")}
                          </p>
                        )}
                        {trackedOrder.status === "Preparing" && trackedOrder.estimated_ready_at && (
                          <div className="mt-4 rounded-xl border border-[#f4c65e]/20 bg-black/20 p-3">
                            <p className="text-xs text-gray-400">{t("زمان تقریبی آماده‌شدن", "ESTIMATED READY TIME")}</p>
                            <p className="mt-1 text-lg font-black text-[#f4c65e]">
                              {formatDateTime(trackedOrder.estimated_ready_at)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#202126] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-black">{t("خلاصه سفارش", "ORDER SUMMARY")}</h3>
                          <span className="text-xs text-gray-500">{formatPrice(Number(trackedOrder.total_amount))}</span>
                        </div>
                        <div className="space-y-3">
                          {trackedOrder.items?.map((item, index) => (
                            <div key={`${item.food_name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-300">{item.food_name} × {item.quantity}</span>
                              <span className="shrink-0 text-gray-400">{formatPrice(Number(item.unit_price) * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500">
                        <span>{t("به‌روزرسانی خودکار هر ۱۰ ثانیه", "Auto-refresh every 10 seconds")}</span>
                        <span>{lastUpdated ? `${t("آخرین بررسی:", "Last checked:")} ${lastUpdated}` : ""}</span>
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#222328] p-5 text-center">
                  <div className="mb-3 text-5xl">📦</div>
                  <h3 className="font-black">{t("هنوز سفارشی ثبت نکردی", "No order yet")}</h3>
                  <p className="mt-2 text-sm leading-7 text-gray-400">
                    {t("بعد از ثبت سفارش، شماره و اطلاعات پیگیری به‌صورت خودکار در همین مرورگر ذخیره می‌شود و دیگر نیازی به وارد کردن دوباره شماره موبایل نیست.", "After placing an order, its tracking details are saved in this browser. You won't need to enter your phone number again.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTrackOpen(false);
                      document.getElementById("street-menu")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`mt-5 w-full rounded-xl py-3 font-black ${redButton}`}
                  >
                    {t("رفتن به منو", "GO TO MENU")}
                  </button>
                </div>
              )}

              {trackError && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm leading-6 text-red-200">
                  {trackError}
                </div>
              )}

              {savedOrderNumber && savedCustomerPhone && (
                <button
                  type="button"
                  onClick={() => void fetchTrackedOrder()}
                  disabled={trackLoading}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-bold text-gray-200 transition hover:border-[#f4c65e]/40 hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {trackLoading ? t("در حال بررسی...", "Checking...") : t("به‌روزرسانی وضعیت", "REFRESH STATUS")}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#101115] px-4 py-12 text-center">
        <img
          src="/general-logo.png"
          alt="General Fast Food"
          className="mx-auto mb-4 h-14 w-14 object-contain"
        />

        <h3 className="text-xl font-black">
          GENERAL <span className="text-[#ed263b]">FAST FOOD</span>
        </h3>

        <div className="mx-auto mt-7 h-px max-w-xs bg-gradient-to-r from-transparent via-red-600/60 to-transparent" />

        <p className="mt-5 text-[10px] tracking-[0.2em] text-gray-600">
          © GENERAL FAST FOOD
        </p>
      </footer>
    </main>
  );
}
