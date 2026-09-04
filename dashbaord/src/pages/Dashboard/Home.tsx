import PageMeta from "../../components/common/PageMeta";
import InteractiveDashboard from "../../components/ecommerce/dashboard/InteractiveDashboard";

export default function Home() {
  return (
    <>
      <PageMeta
        title="Dashboard - Baig Ecommerce Admin"
        description="Interactive business overview dashboard for Baig Digital"
      />
      <InteractiveDashboard />
    </>
  );
}
