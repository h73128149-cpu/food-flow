
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppControls } from "@/components/app-provider";

const navigation = [
  {
    title: "داشبورد",
    href: "/admin",
    icon: "▦",
  },
  {
    title: "مدیریت سفارش‌ها",
    href: "/admin/orders",
    icon: "▤",
  },
  {
    title: "مدیریت منو و غذاها",
    href: "/admin/menu",
    icon: "🍔",
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // صفحه ورود بدون منوی مدیریت نمایش داده شود.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0b0c0f] text-white"
    >
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden w-72 shrink-0 border-l border-[#c9a85c]/15 bg-[#111215] lg:flex lg:flex-col">
          <div className="border-b border-white/[0.07] px-6 py-7">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#c9a85c]/30 bg-[#c9a85c]/10 p-2">
                <img
                  src="/general-logo.png"
                  alt="ژنرال"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <h1 className="text-xl font-black tracking-wide">
                  ژنرال
                </h1>
                <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-[#c9a85c]">
                  GENERAL ADMIN
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 pt-8">
            <p className="mb-4 px-3 text-[10px] font-bold tracking-[0.2em] text-gray-600">
              MAIN MENU
            </p>

            <nav className="space-y-2">
              {navigation.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-4 rounded-xl border px-4 py-4 transition duration-200 ${
                      active
                        ? "border-[#c9a85c]/30 bg-gradient-to-l from-[#c9a85c]/15 to-[#c9a85c]/5 text-[#f0d89e] shadow-lg shadow-black/20"
                        : "border-transparent text-gray-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                        active
                          ? "bg-[#c9a85c]/15 text-[#e9c875]"
                          : "bg-white/[0.05] text-gray-400"
                      }`}
                    >
                      {item.icon}
                    </span>

                    <span className="text-sm font-bold">
                      {item.title}
                    </span>

                    {active && (
                      <span className="mr-auto h-2 w-2 rounded-full bg-[#e9c875] shadow-[0_0_12px_#c9a85c]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-5">
            <div className="rounded-2xl border border-[#c9a85c]/20 bg-gradient-to-br from-[#302719] to-[#171511] p-4">
              <p className="text-xs font-black text-[#e9c875]">
                GENERAL FAST FOOD
              </p>
              <p className="mt-2 text-[10px] leading-6 text-gray-400">
                پنل یکپارچه مدیریت رستوران ژنرال
              </p>
            </div>

            <p className="mt-5 text-center text-[9px] tracking-widest text-gray-700">
              POWERED BY FOODFLOW
            </p>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* TOP BAR */}
          <header className="sticky top-0 z-30 border-b border-[#c9a85c]/15 bg-[#101114]/95 px-4 py-3 backdrop-blur-xl sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c9a85c]/25 bg-[#c9a85c]/10 p-1 lg:hidden">
                  <img
                    src="/general-logo.png"
                    alt="ژنرال"
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <p className="text-sm font-black text-[#e9c875]">
                    ژنرال
                  </p>
                  <p className="mt-1 text-[10px] text-gray-500">
                    پنل مدیریت
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 sm:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-300">
                    سیستم فعال
                  </span>
                </div>

                <AppControls />
              </div>
            </div>
          </header>

          {/* MOBILE NAVIGATION */}
          <nav className="flex gap-2 overflow-x-auto border-b border-white/[0.07] bg-[#111215] px-4 py-3 lg:hidden">
            {navigation.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold transition ${
                    active
                      ? "border-[#c9a85c]/30 bg-[#c9a85c]/10 text-[#e9c875]"
                      : "border-white/[0.07] bg-[#191a1e] text-gray-400"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.title}
                </Link>
              );
            })}
          </nav>

          {/* PAGE */}
          <div className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
