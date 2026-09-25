import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { useTheme } from "../../../context/ThemeContext";
import { DailyPoint, formatCompact, formatCurrency } from "./useDashboard";

export default function RevenueTrendChart({
  series,
}: {
  series: DailyPoint[];
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const categories = series.map((d) => d.date);
  const revenue = series.map((d) => d.revenue);
  const orders = series.map((d) => d.orders);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "area",
      height: 320,
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
    },
    theme: { mode: dark ? "dark" : "light" },
    colors: ["#0F9D63", "#12b76a"],
    stroke: { curve: "smooth", width: [3, 2] },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: dark ? "rgba(255,255,255,0.08)" : "#f1f1f4",
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: "category",
      categories,
      tickAmount: Math.min(categories.length, 8),
      labels: {
        rotate: 0,
        hideOverlappingLabels: true,
        style: {
          colors: dark ? "#98a2b3" : "#667085",
          fontSize: "11px",
        },
        formatter: (val: string) => {
          if (!val) return "";
          const d = new Date(val);
          if (Number.isNaN(d.getTime())) return val;
          return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          });
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      {
        labels: {
          style: { colors: dark ? "#98a2b3" : "#667085", fontSize: "11px" },
          formatter: (val: number) => formatCompact(val),
        },
      },
      { show: false },
    ],
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontFamily: "Outfit",
      labels: { colors: dark ? "#d0d5dd" : "#344054" },
      markers: { size: 6 },
    },
    tooltip: {
      theme: dark ? "dark" : "light",
      x: {
        formatter: (_v, opts) => {
          const raw = categories[opts?.dataPointIndex ?? 0];
          if (!raw) return "";
          const d = new Date(raw);
          return Number.isNaN(d.getTime())
            ? raw
            : d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
        },
      },
      y: {
        formatter: (val: number, opts) =>
          opts?.seriesIndex === 0 ? formatCurrency(val) : `${val} orders`,
      },
    },
  };

  const chartSeries = [
    { name: "Revenue", type: "area", data: revenue },
    { name: "Orders", type: "line", data: orders },
  ];

  if (series.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No sales in this period.
      </div>
    );
  }

  return (
    <Chart options={options} series={chartSeries} type="area" height={320} />
  );
}
