import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router";
import axiosSecure from "./useAxiosSecure";

export const useStoreBranding = () => {
  // The Platform Console's operator may have no store session at all, so asking
  // there only produces a 401.
  const onPlatformConsole = useLocation().pathname.startsWith("/platform/");

  const { data } = useQuery({
    queryKey: ["store-branding"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/storeinformation/store-information-branding");
      return data.data as { storeName: string; logo: string };
    },
    staleTime: 30 * 60 * 1000,
    enabled: !onPlatformConsole,
  });

  return data;
};
