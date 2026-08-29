import React from "react";
import GridShape from "../../components/common/GridShape";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";
import { FaPhoneAlt, FaEnvelope, FaGlobe, FaBuilding, FaChartLine, FaBoxes, FaShieldAlt } from "react-icons/fa";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {children}
        <div className="relative hidden w-full h-full overflow-hidden lg:w-1/2 bg-brand-950 dark:bg-gray-950 lg:flex lg:flex-col">
          {/* Decorative glow orbs */}
          <div className="absolute -top-32 -left-32 size-[28rem] rounded-full bg-brand-500/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-24 size-[28rem] rounded-full bg-brand-400/15 blur-3xl pointer-events-none" />

          {/* <!-- ===== Common Grid Shape Start ===== --> */}
          <div className="absolute inset-0 z-0 opacity-60">
            <GridShape />
          </div>

          {/* Main content — vertically & horizontally centered */}
          <div className="relative z-1 flex flex-1 flex-col items-center justify-center px-12">
            <div className="flex flex-col items-center w-full max-w-sm">
              {/* Logo mark */}
              <div className="relative mb-7">
                <div className="absolute inset-0 rounded-2xl bg-brand-500/50 blur-2xl" />
                <Link
                  to="/"
                  className="relative flex p-4 rounded-2xl bg-gradient-to-br from-white/15 to-white/[0.04] ring-1 ring-white/20 backdrop-blur-sm shadow-2xl transition-transform hover:scale-105"
                >
                  <img
                    width={44}
                    height={28}
                    src="/images/logo/logo-icon.svg"
                    alt="Logo"
                  />
                </Link>
              </div>

              {/* Headline */}
              <h2 className="text-center text-white text-[26px] leading-tight font-bold tracking-tight">
                Powerful ecommerce management
              </h2>
              <p className="mt-3 text-center text-gray-400 text-sm leading-relaxed max-w-[19rem]">
                Everything you need to run your store, in one clean dashboard.
              </p>

              {/* Divider */}
              <div className="my-8 h-px w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent" />

              {/* Feature highlights */}
              <ul className="flex flex-col gap-3 w-full">
                {[
                  { icon: FaBoxes, text: "Real-time inventory & order tracking" },
                  { icon: FaChartLine, text: "Sales analytics at a glance" },
                  { icon: FaShieldAlt, text: "Secure, role-based access control" },
                ].map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-center gap-3.5 rounded-xl px-4 py-3 bg-white/[0.04] ring-1 ring-white/[0.07] backdrop-blur-sm transition-colors hover:bg-white/[0.07]"
                  >
                    <span className="flex items-center justify-center size-9 rounded-lg bg-brand-500/15 text-brand-400 shrink-0">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm text-gray-200">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Developer / vendor credit — minimal inline footer */}
          <div className="relative z-1 shrink-0 px-12 pb-8 pt-4">
            <div className="mx-auto h-px w-full max-w-sm bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="mt-5 flex flex-col items-center gap-2.5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                <FaBuilding className="size-2.5" />
                <span>
                  Crafted &amp; maintained by{" "}
                  <span className="text-gray-300 font-semibold normal-case tracking-normal">
                    Smartsoft Innovation
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap justify-center text-xs text-gray-400">
                <a
                  href="tel:01999878862"
                  className="flex items-center gap-1.5 hover:text-brand-400 transition-colors"
                >
                  <FaPhoneAlt className="size-2.5" />
                  01999878862
                </a>
                <span className="text-white/10">|</span>
                <a
                  href="mailto:smartsoftinnovationbd@gmail.com"
                  className="flex items-center gap-1.5 hover:text-brand-400 transition-colors"
                >
                  <FaEnvelope className="size-2.5" />
                  smartsoftinnovationbd@gmail.com
                </a>
                <span className="text-white/10">|</span>
                <a
                  href="https://smartsoftinnovation.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-brand-400 transition-colors"
                >
                  <FaGlobe className="size-2.5" />
                  smartsoftinnovation.com
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
