"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";

type Category = {
  id: string;
  name: string;
};

type Food = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  is_active: boolean;
  is_available: boolean;
};

const restaurantId = "48e90063-e96f-45d2-92fb-25b3ce34dda9";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category_id: "",
};

export default function AdminMenuPage() {
  const supabase = createClient();
  const { language, theme, t } = useApp();

  const [foods, setFoods] = useState<Food[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  const isFa = language === "fa";

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const [foodsResult, categoriesResult] = await Promise.all([
      supabase
        .from("foods")
        .select(
          "id, name, description, price, category_id, is_active, is_available"
        )
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false }),

      supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (foodsResult.error || categoriesResult.error) {
      setMessage(
        isFa
          ? "دریافت اطلاعات ناموفق بود. دسترسی‌ها و اتصال را بررسی کنید."
          : "Could not load data. Check connection and permissions."
      );
    } else {
      setFoods(foodsResult.data || []);
      setCategories(categoriesResult.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setShowForm(true);
  };

  const openEditForm = (food: Food) => {
    setEditingId(food.id);
    setForm({
      name: food.name,
      description: food.description || "",
      price: String(food.price),
      category_id: food.category_id || "",
    });
    setMessage("");
    setShowForm(true);
  };

  const saveFood = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const price = Number(form.price);

    if (!form.name.trim() || !form.price.trim() || !Number.isFinite(price) || price <= 0) {
      setMessage(isFa ? "نام و قیمت معتبر را وارد کنید." : "Enter a valid name and price.");
      return;
    }

    setSaving(true);
    setMessage("");

    const foodData = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Math.round(price),
      category_id: form.category_id || null,
    };

    const result = editingId
      ? await supabase.from("foods").update(foodData).eq("id", editingId).eq("restaurant_id", restaurantId)
      : await supabase.from("foods").insert({
          ...foodData,
          is_active: true,
          is_available: true,
        });

    if (result.error) {
      setMessage(
        isFa
          ? `ذخیره انجام نشد: ${result.error.message}`
          : `Save failed: ${result.error.message}`
      );
    } else {
      setMessage(isFa ? "اطلاعات غذا با موفقیت ذخیره شد." : "Food saved successfully.");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadData();
    }

    setSaving(false);
  };

  const updateFoodStatus = async (
    food: Food,
    field: "is_active" | "is_available",
    value: boolean
  ) => {
    setMessage("");

    const { error } = await supabase
      .from("foods")
      .update({ [field]: value })
      .eq("id", food.id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      setMessage(isFa ? "تغییر وضعیت انجام نشد." : "Could not update status.");
    } else {
      setFoods((current) =>
        current.map((item) =>
          item.id === food.id ? { ...item, [field]: value } : item
        )
      );
    }
  };

  const formatPrice = (price: number) =>
    `${new Intl.NumberFormat(isFa ? "fa-IR" : "en-US").format(price)} ${
      isFa ? "تومان" : "Toman"
    }`;

  const categoryName = (id: string | null) =>
    categories.find((category) => category.id === id)?.name ||
    (isFa ? "بدون دسته‌بندی" : "Uncategorized");

  const panelClass =
    "rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm";
  const inputClass =
    "w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-3 text-[var(--foreground)] outline-none focus:border-[var(--red)]";

  return (
    <main dir={isFa ? "rtl" : "ltr"} className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {isFa ? "مدیریت منو و غذاها" : "Menu Management"}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {isFa ? "افزودن، ویرایش و مدیریت وضعیت غذاها" : "Add, edit and manage food items"}
            </p>
          </div>

          <button
            onClick={openNewForm}
            className="rounded-xl bg-[var(--red)] px-5 py-3 font-bold text-white hover:opacity-90"
          >
            + {isFa ? "افزودن غذای جدید" : "Add New Food"}
          </button>
        </div>

        {message && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
            {message}
          </div>
        )}

        {showForm && (
          <section className={panelClass}>
            <h2 className="mb-4 text-lg font-bold">
              {editingId
                ? isFa ? "ویرایش غذا" : "Edit Food"
                : isFa ? "افزودن غذای جدید" : "Add New Food"}
            </h2>

            <form onSubmit={saveFood} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm">{isFa ? "نام غذا" : "Food name"}</span>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                  placeholder={isFa ? "مثلاً چیزبرگر مخصوص" : "e.g. Cheeseburger"}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm">{isFa ? "قیمت به تومان" : "Price in Toman"}</span>
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  required
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm">{isFa ? "توضیحات" : "Description"}</span>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder={isFa ? "توضیحات غذا..." : "Food description..."}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm">{isFa ? "دسته‌بندی" : "Category"}</span>
                <select
                  className={inputClass}
                  value={form.category_id}
                  onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                >
                  <option value="">{isFa ? "بدون دسته‌بندی" : "Uncategorized"}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button
                  disabled={saving}
                  className="rounded-xl bg-[var(--red)] px-6 py-3 font-bold text-white disabled:opacity-50"
                  type="submit"
                >
                  {saving
                    ? isFa ? "در حال ذخیره..." : "Saving..."
                    : isFa ? "ذخیره غذا" : "Save Food"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-[var(--line)] px-6 py-3"
                >
                  {isFa ? "انصراف" : "Cancel"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className={panelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              {isFa ? "فهرست غذاها" : "Food List"}
            </h2>
            <span className="text-sm text-[var(--muted)]">
              {foods.length} {isFa ? "غذا" : "items"}
            </span>
          </div>

          {loading ? (
            <p className="py-8 text-center text-[var(--muted)]">
              {isFa ? "در حال دریافت اطلاعات..." : "Loading..."}
            </p>
          ) : foods.length === 0 ? (
            <p className="py-8 text-center text-[var(--muted)]">
              {isFa ? "هنوز غذایی ثبت نشده است." : "No food items yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {foods.map((food) => (
                <article
                  key={food.id}
                  className="rounded-xl border border-[var(--line)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold">{food.name}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {categoryName(food.category_id)}
                      </p>
                      {food.description && (
                        <p className="mt-2 text-sm">{food.description}</p>
                      )}
                      <p className="mt-2 font-bold text-[var(--red)]">
                        {formatPrice(food.price)}
                      </p>
                    </div>

                    <button
                      onClick={() => openEditForm(food)}
                      className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
                    >
                      {isFa ? "ویرایش" : "Edit"}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-5 border-t border-[var(--line)] pt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={food.is_active}
                        onChange={(event) =>
                          updateFoodStatus(food, "is_active", event.target.checked)
                        }
                      />
                      {isFa ? "نمایش در منوی مشتری" : "Visible in customer menu"}
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={food.is_available}
                        disabled={!food.is_active}
                        onChange={(event) =>
                          updateFoodStatus(food, "is_available", event.target.checked)
                        }
                      />
                      {isFa ? "قابل سفارش" : "Available to order"}
                    </label>
                  </div>

                  {!food.is_active && (
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      {isFa ? "این غذا از منوی مشتری مخفی است." : "This item is hidden from customers."}
                    </p>
                  )}

                  {food.is_active && !food.is_available && (
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      {isFa ? "این غذا نمایش داده می‌شود اما قابل سفارش نیست." : "Visible but unavailable for ordering."}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}