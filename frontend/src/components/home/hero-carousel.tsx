"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Swiper as SwiperType } from "swiper";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { AppImage } from "@/components/ui/app-image";
import { buttonClassName } from "@/components/ui/button";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import type { HeroSlide } from "@/lib/hero-slides";
import "swiper/css";
import "swiper/css/pagination";

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const swiperRef = useRef<SwiperType | null>(null);

  return (
    <div className="relative">
      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        autoplay={{ delay: 5500, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        onBeforeInit={(swiper) => {
          swiperRef.current = swiper;
        }}
        loop
        className="hero-swiper h-[520px] w-full sm:h-[440px] lg:h-[460px]"
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={slide.id}>
            <div className="flex h-full w-full flex-col bg-brand-500 sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-5 px-6 py-10 sm:px-10 lg:pl-[max(2rem,calc((100vw-var(--container-content))/2+2rem))]">
                {slide.eyebrow && (
                  <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-caption font-semibold uppercase tracking-wide text-white">
                    {slide.eyebrow}
                  </span>
                )}
                <h1 className="max-w-md text-h1 font-extrabold text-white sm:text-display">
                  {slide.title}
                </h1>
                <p className="max-w-sm text-body text-white/90">
                  {slide.description}
                </p>
                {/* The seller's banner link: a page on this shop or another site */}
                <Link
                  href={slide.ctaHref}
                  className={`${buttonClassName("onBrand", "lg")} mt-2 w-fit rounded-full`}
                >
                  <span className="relative z-2">{slide.ctaLabel}</span>
                  <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
                    <ArrowRightIcon />
                  </span>
                </Link>
              </div>

              <div className="relative h-56 w-full shrink-0 sm:h-full sm:w-[45%] lg:w-[38%]">
                <AppImage
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  sizes="(min-width: 640px) 45vw, 100vw"
                  loading={index === 0 ? "eager" : "lazy"}
                  className="object-cover"
                />
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => swiperRef.current?.slidePrev()}
        className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--orange-700)] shadow-md backdrop-blur-sm transition-[background-color,box-shadow] duration-200 ease-[var(--ease-hover)] hover:bg-white hover:shadow-lg sm:left-5"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => swiperRef.current?.slideNext()}
        className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--orange-700)] shadow-md backdrop-blur-sm transition-[background-color,box-shadow] duration-200 ease-[var(--ease-hover)] hover:bg-white hover:shadow-lg sm:right-5"
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  );
}
