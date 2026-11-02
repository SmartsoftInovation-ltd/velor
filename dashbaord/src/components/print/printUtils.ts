import { useQuery } from "@tanstack/react-query";
import axiosSecure from "../../hooks/useAxiosSecure";

export interface StoreInformation {
  storeName: string;
  propiterSlogan?: string;
  adress: string;
  phone: string;
  email?: string;
  footer?: string;
  image?: { url?: string };
}

export const useStoreInfo = () =>
  useQuery<StoreInformation | null>({
    queryKey: ["store-information"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/storeinformation/store-information");
        return data.data.stores?.[0] || null;
      } catch {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

export const taka = (n?: number | null) =>
  `৳${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const belowHundred = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`);
const belowThousand = (n: number) =>
  [n >= 100 ? `${ONES[Math.floor(n / 100)]} hundred` : "", belowHundred(n % 100)].filter(Boolean).join(" ");

// Taka in words on the Bangladeshi scale (lakh, crore), as written on a voucher
export function takaInWords(amount: number): string {
  const value = Math.abs(Math.round((amount || 0) * 100));
  let whole = Math.floor(value / 100);
  const paisa = value % 100;
  const parts: string[] = [];
  const crore = Math.floor(whole / 10000000);
  whole %= 10000000;
  if (crore) parts.push(`${crore >= 100 ? takaInWords(crore).replace(/ taka only$/, "") : belowHundred(crore)} crore`);
  const lakh = Math.floor(whole / 100000);
  whole %= 100000;
  if (lakh) parts.push(`${belowHundred(lakh)} lakh`);
  const thousand = Math.floor(whole / 1000);
  whole %= 1000;
  if (thousand) parts.push(`${belowHundred(thousand)} thousand`);
  if (whole) parts.push(belowThousand(whole));
  const words = parts.join(" ") || "zero";
  const text = `${words} taka${paisa ? ` and ${belowHundred(paisa)} paisa` : ""} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
