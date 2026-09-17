import { useFeature } from "../routes/FeatureGate";

// Uploads go to the store's own Cloudinary account; say so before a form fails
const IntegrationNotice = () => {
  const cloudinary = useFeature("cloudinary");
  if (cloudinary) return null;
  return (
    <div role="status" className="mx-3 mt-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-700 md:mx-4 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
      Image uploads are disabled: image storage (Cloudinary) is not configured for this store. Contact support.
    </div>
  );
};

export default IntegrationNotice;
