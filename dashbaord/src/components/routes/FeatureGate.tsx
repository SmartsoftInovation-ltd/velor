import type { ReactNode } from "react";
import { useAuth, type Features } from "../../context/AuthContext";

type FeaturePath = "sms" | "email" | "sslcommerz" | "cloudinary" | "couriers" | "couriers.pathao" | "couriers.steadfast";

// No feature list means an API without multi-tenant settings: nothing is gated
export const isFeatureEnabled = (features: Features | null | undefined, feature: FeaturePath): boolean => {
  if (!features) return true;
  if (feature === "couriers") return features.couriers.pathao || features.couriers.steadfast;
  return Boolean(feature.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown>)?.[key], features));
};

export const useFeature = (feature: FeaturePath): boolean => isFeatureEnabled(useAuth().features, feature);

interface FeatureGateProps {
  feature: FeaturePath;
  label: string;
  children: ReactNode;
}

// Pages that depend on an integration the platform has not configured for this store
const FeatureGate = ({ feature, label, children }: FeatureGateProps) => {
  if (useFeature(feature)) return <>{children}</>;

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
      <h2 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">{label} is not configured</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        This store does not have {label} set up yet. Contact support to connect your account.
      </p>
    </div>
  );
};

export default FeatureGate;
