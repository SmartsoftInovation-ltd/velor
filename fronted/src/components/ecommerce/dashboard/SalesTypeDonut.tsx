import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { useTheme } from "../../../context/ThemeContext";
import { SalesByType, formatCompact } from "./useDashboard";

const TYPE_LABELS: Record<string, string> = {
  retailsale: "Retail Sale",
  wholesale: "Wholesale",
  retailsaleorder: "Retail Order",
  wholesaleorder: "Wholesale Order",
  unknown: "Other",
};

export default function SalesTypeDonut({ data }: { data: SalesByType[] }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const labels = data.map((d) => TYPE_LABELS[d.type] || d.type);
  const values = data.map((d) => d.revenue);
  const colors = ["#465fff", "#12b76a", "#f79009", "#fb6514"];

  const options: ApexOptions = {
    chart: { fontFamily: "Outfit, sans-serif", type: "donut" },
    labels,
    colors,
    stroke: { colors: [dark ? "#1d2939" : "#ffffff"], width: 2 },
    dataLabels: { enabled: false },
    legend: {
      position: "bottom",
      fontFamily: "Outfit",
      labels: { colors: dark ? "#d0d5dd" : "#344054" },
      markers: { size: 6 },
      itemMargin: { horizontal: 8, vertical: 4 },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              fontSize: "12px",
              color: dark ? "#98a2b3" : "#667085",
              formatter: (w) =>
                formatCompact(
                  w.globals.seriesTotals.reduce(
                    (a: number, b: number) => a + b,
                    0,
                  ),
                ),
            },
            value: {
              fontSize: "18px",
              fontWeight: 700,
              color: dark ? "#f9fafb" : "#1d2939",
              formatter: (val: string) => formatCompact(Number(val)),
            },
          },
        },
      },
    },
    tooltip: {
      custom: ({ seriesIndex, w }) => {
        const color = colors[seriesIndex % colors.length];
        const label = w.globals.labels[seriesIndex];
        const value = formatCompact(w.globals.series[seriesIndex]);
        return (
          `<div style="background:${color};color:#fff;padding:6px 12px;` +
          `border-radius:8px;font-family:Outfit,sans-serif;font-size:12px;` +
          `font-weight:600;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.15);">` +
          `${label}: ${value}</div>`
        );
      },
    },
  };

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No sales data.
      </div>
    );
  }

  return (
    <div className="sales-type-donut">
      <Chart options={options} series={values} type="donut" height={300} />
    </div>
  );
}
