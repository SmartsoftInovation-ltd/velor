import React from "react";
import { Link } from "react-router";
import { FiChevronLeft, FiMoon, FiShield, FiSun, FiTrendingUp } from "react-icons/fi";
import { HiOutlineHome } from "react-icons/hi2";
import { useTheme } from "../../context/ThemeContext";
import BrandMark from "../../components/auth/BrandMark";

const FEATURES = [
  { icon: HiOutlineHome, title: "Real-time inventory & order tracking", text: "Stock moves the moment a sale lands" },
  { icon: FiTrendingUp, title: "Sales analytics at a glance", text: "Daily, weekly and per-category views" },
  { icon: FiShield, title: "Secure, role-based access", text: "Owners, managers and cashiers" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-white font-outfit dark:bg-gray-900">
      {/* Form side */}
      <div className="flex min-h-screen w-full flex-col px-5 py-5 sm:px-7 lg:w-[53.6%]">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <FiChevronLeft className="size-4" />
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex size-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
          >
            {theme === "dark" ? <FiMoon className="size-4" /> : <FiSun className="size-4" />}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
      </div>

      {/* Brand panel */}
      <aside className="relative hidden flex-1 flex-col overflow-hidden bg-[#0a1812] px-10 py-8 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-emerald-500/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 size-[28rem] rounded-full bg-emerald-400/[0.06] blur-3xl" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="size-7 rounded-lg" />
            <span className="text-sm font-semibold tracking-wide">ECOMPOS</span>
          </div>
          <span className="rounded border border-white/15 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-white/60">
            BAIG DIGITAL
          </span>
        </div>

        <div className="relative flex flex-1 flex-col justify-center">
          <h2 className="max-w-[26rem] text-[32px] font-bold leading-[1.15] tracking-tight">
            Everything you need to run the store, in one clean dashboard.
          </h2>

          <ul className="mt-6 flex flex-col gap-2.5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-xs text-white/50">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-5 text-xs text-white/45">
          <span>
            Crafted by <span className="font-semibold text-white/80">Smartsoft Innovation</span>
          </span>
          <span className="flex items-center gap-4">
            <a href="tel:01999878862" className="transition hover:text-emerald-400">01999878862</a>
            <a href="https://smartsoftinnovation.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-emerald-400">
              smartsoftinnovation.com
            </a>
          </span>
        </footer>
      </aside>
    </div>
  );
}
