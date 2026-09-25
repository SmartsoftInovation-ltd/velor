import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { useTheme } from "../../../context/ThemeContext";
import { TopProduct, formatCompact } from "./useDashboard";

export default function TopProductsChart({ data }: { data: TopProduct[] }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const labels = data.map((d) =>
    d.name.length > 26 ? `${d.name.slice(0, 24)}…` : d.name,
  );
  const values = data.map((d) => d.quantity);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      toolbar: { show: false },
      background: "transparent",
    },
    theme: { mode: dark ? "dark" : "light" },
    colors: ["#465fff"],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        borderRadiusApplication: "end",
        barHeight: "60%",
        distributed: false,
      },
    },
    dataLabels: {
      enabled: true,
      style: { fontSize: "11px", colors: [dark ? "#e5e7eb" : "#344054"] },
      offsetX: 24,
    },
    grid: {
      borderColor: dark ? "rgba(255,255,255,0.08)" : "#f1f1f4",
      strokeDashArray: 4,
    },
    xaxis: {
      categories: labels,
      labels: {
        style: { colors: dark ? "#98a2b3" : "#667085", fontSize: "11px" },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: dark ? "#d0d5dd" : "#344054", fontSize: "11px" },
      },
    },
    tooltip: {
      theme: dark ? "dark" : "light",
      // Labels are cut to fit; the tooltip names the full product · variant.
      x: {
        formatter: (_val: number, opts) =>
          data[opts?.dataPointIndex ?? 0]?.name ?? "",
      },
      y: {
        formatter: (val: number, opts) => {
          const rev = data[opts?.dataPointIndex ?? 0]?.revenue ?? 0;
          return `${val} pcs · ${formatCompact(rev)}`;
        },
      },
    },
  };

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No products sold yet.
      </div>
    );
  }

  return (
    <Chart
      options={options}
      series={[{ name: "Qty Sold", data: values }]}
      type="bar"
      height={Math.max(240, data.length * 44)}
    />
  );
}
