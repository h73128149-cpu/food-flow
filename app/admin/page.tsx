
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  phone: string;
  created_at: string;
};

export default function AdminPage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);

  async function loadMembers() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setAuthorized(false);
        setMembers([]);
        throw new Error("برای مشاهده این بخش ابتدا وارد شوید.");
      }

      setUserEmail(user.email ?? "");

      // نام جدول مطابق دیتابیس: admins
      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) throw adminError;

      if (!admin) {
        setAuthorized(false);
        setMembers([]);
        throw new Error("این حساب دسترسی مدیر ندارد.");
      }

      const { data, error: membersError } = await supabase
        .from("club_members")
        .select("id, phone, created_at")
        .order("created_at", { ascending: false });

      if (membersError) throw membersError;

      setMembers((data ?? []) as Member[]);
      setAuthorized(true);
    } catch (e) {
      setAuthorized(false);
      setMembers([]);
      setError(e instanceof Error ? e.message : "خطای نامشخص");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      setError("ورود ناموفق بود. ایمیل و رمز عبور را بررسی کنید.");
      setLoading(false);
      return;
    }

    await loadMembers();
  }

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setAuthorized(false);
    setMembers([]);
    setUserEmail("");
    setPassword("");
    setError("");
    setLoading(false);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f3eee7] p-5 text-[#203d32] sm:p-10"
    >
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#d96b45]">
              GENERAL FAST FOOD
            </p>
            <h1 className="mt-2 text-3xl font-black">پنل مدیریت</h1>
          </div>

          {authorized && (
            <button
              onClick={signOut}
              disabled={loading}
              className="rounded-xl border border-[#203d32]/20 px-4 py-2 text-sm font-bold"
            >
              خروج
            </button>
          )}
        </header>

        {loading && !authorized ? (
          <div className="max-w-md rounded-3xl bg-white p-7 shadow-xl">
            در حال بررسی حساب کاربری...
          </div>
        ) : !authorized ? (
          <form
            onSubmit={signIn}
            className="max-w-md rounded-3xl bg-white p-7 shadow-xl"
          >
            <h2 className="mb-5 text-xl font-black">
              ورود مدیر با حساب Supabase
            </h2>

            <label className="mb-2 block text-sm font-bold">ایمیل</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-xl border p-3"
            />

            <label className="mb-2 block text-sm font-bold">
              رمز عبور
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-5 w-full rounded-xl border p-3"
            />

            <button
              disabled={loading}
              className="w-full rounded-xl bg-[#203d32] p-3 font-bold text-white disabled:opacity-50"
            >
              {loading ? "در حال بررسی..." : "ورود"}
            </button>

            {error && (
              <p className="mt-4 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </form>
        ) : (
          <section className="rounded-3xl bg-white p-6 shadow-xl sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">
                  اعضای باشگاه مشتریان
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {userEmail}
                </p>
              </div>

              <button
                onClick={() => void loadMembers()}
                disabled={loading}
                className="rounded-xl bg-[#edf0e9] px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                بروزرسانی
              </button>
            </div>

            <p className="mb-5 text-sm text-gray-600">
              تعداد اعضا: <strong>{members.length}</strong>
            </p>

            {loading ? (
              <p>در حال دریافت اطلاعات...</p>
            ) : members.length === 0 ? (
              <p className="rounded-xl bg-[#f7f5ef] p-5">
                هنوز عضوی ثبت‌نام نکرده است.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="p-3">ردیف</th>
                      <th className="p-3">شماره موبایل</th>
                      <th className="p-3">تاریخ عضویت</th>
                    </tr>
                  </thead>

                  <tbody>
                    {members.map((member, index) => (
                      <tr
                        key={member.id}
                        className="border-b last:border-0"
                      >
                        <td className="p-3">{index + 1}</td>
                        <td
                          dir="ltr"
                          className="p-3 text-right font-semibold"
                        >
                          {member.phone}
                        </td>
                        <td className="p-3">
                          {new Date(member.created_at).toLocaleString(
                            "fa-IR"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {!authorized && error && (
          <p className="mt-4 max-w-md text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
