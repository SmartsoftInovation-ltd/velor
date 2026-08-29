import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

const getMatches = (query: string): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia(query).matches;
};

const useIsMobile = (breakpoint: number = MOBILE_BREAKPOINT): boolean => {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(() => getMatches(query));

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return isMobile;
};

export default useIsMobile;
