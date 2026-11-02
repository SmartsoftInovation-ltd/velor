import { useCallback, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { useTheme } from "../../../context/ThemeContext";
import { DailyPoint, formatCompact, formatCurrency } from "./useDashboard";

const REVENUE_COLOR = "#0F9D63";
const ORDERS_COLOR = "#12b76a";

const longDate = (raw?: string) => {
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// What ApexCharts exposes about where it drew each point (pixels in the plot)
type ChartContext = {
  w: { globals: { seriesXvalues?: number[][]; seriesYvalues?: number[][]; translateX: number; translateY: number; gridWidth: number } };
};

export default function RevenueTrendChart({
  series,
}: {
  series: DailyPoint[];
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  // Today's tooltip shows without hovering; hovering anywhere hides it so it
  // never sits on top of the chart's own tooltip
  const [dayPos, setDayPos] = useState<{ x: number; y: number; width: number } | null>(null);
  const [hovering, setHovering] = useState(false);

  const categories = useMemo(() => series.map((d) => d.date), [series]);
  const revenue = useMemo(() => series.map((d) => d.revenue), [series]);
  const orders = useMemo(() => series.map((d) => d.orders), [series]);

  // Today's point (the series is filled up to today); the last day if it is missing
  const todayKey = new Date().toISOString().slice(0, 10);
  const foundToday = categories.indexOf(todayKey);
  const dayIndex = foundToday >= 0 ? foundToday : series.length - 1;
  const day = series[dayIndex];
  const isToday = foundToday >= 0;
  const hasDay = !!day;

  // Where the chart drew today, so the box can sit on it
  const placeDay = useCallback(
    (ctx: ChartContext) => {
      const g = ctx?.w?.globals;
      const x = g?.seriesXvalues?.[0]?.[dayIndex];
      const y = g?.seriesYvalues?.[0]?.[dayIndex];
      if (!hasDay || x == null || y == null) {
        setDayPos(null);
        return;
      }
      const next = { x: x + g.translateX, y: y + g.translateY, width: g.gridWidth + g.translateX };
      // Only a real move re-renders, so the chart's update event can't loop
      setDayPos((prev) =>
        prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5 && prev.width === next.width ? prev : next,
      );
    },
    [dayIndex, hasDay],
  );

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        fontFamily: "Outfit, sans-serif",
        type: "area",
        height: 320,
        toolbar: { show: false },
        zoom: { enabled: false },
        background: "transparent",
        events: {
          mounted: (ctx: ChartContext) => placeDay(ctx),
          updated: (ctx: ChartContext) => placeDay(ctx),
          mouseMove: () => setHovering(true),
          mouseLeave: () => setHovering(false),
        },
      },
      theme: { mode: dark ? "dark" : "light" },
      colors: [REVENUE_COLOR, ORDERS_COLOR],
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
          // Headroom above the highest day so the box fits inside the chart
          max: (max: number) => (max > 0 ? max * 1.15 : max),
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
          formatter: (_v, opts) => longDate(categories[opts?.dataPointIndex ?? 0]),
        },
        y: {
          formatter: (val: number, opts) =>
            opts?.seriesIndex === 0 ? formatCurrency(val) : `${val} orders`,
        },
      },
    }),
    [categories, dark, placeDay],
  );

  const chartSeries = useMemo(
    () => [
      { name: "Revenue", type: "area", data: revenue },
      { name: "Orders", type: "line", data: orders },
    ],
    [revenue, orders],
  );

  if (series.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No sales in this period.
      </div>
    );
  }

  // The box opens to the right of the point, or to the left near the right edge
  const flip = dayPos ? dayPos.x > dayPos.width * 0.6 : false;
  const showDay = hasDay && dayPos && !hovering;

  return (
    <div className="relative">
      <Chart options={options} series={chartSeries} type="area" height={320} />

      {showDay && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* The same guide line and point the chart draws on hover */}
          <div
            className="absolute bottom-[38px] border-l border-dashed border-gray-300 dark:border-gray-600"
            style={{ left: dayPos.x, top: dayPos.y }}
          />
          <span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow dark:border-gray-900"
            style={{ left: dayPos.x, top: dayPos.y, background: REVENUE_COLOR }}
          />

          {/* The chart's tooltip for this day, shown without hovering */}
          <div
            className="absolute min-w-[170px] rounded-lg border border-gray-200 bg-white/95 text-[12px] shadow-lg dark:border-gray-700 dark:bg-gray-900/95"
            style={{
              left: dayPos.x,
              top: Math.max(4, dayPos.y - 20),
              transform: flip ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-gray-800 dark:bg-white/[0.04]">
              <span className="text-gray-600 dark:text-gray-300">{longDate(day.date)}</span>
              <span className="rounded bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
                {isToday ? "Today" : "Latest day"}
              </span>
            </div>
            <div className="space-y-1 px-3 py-2">
              <p className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <span className="size-2.5 rounded-full" style={{ background: REVENUE_COLOR }} />
                Revenue: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(day.revenue)}</span>
              </p>
              <p className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <span className="size-2.5 rounded-full" style={{ background: ORDERS_COLOR }} />
                Orders: <span className="font-semibold text-gray-900 dark:text-white">{day.orders} {day.orders === 1 ? "order" : "orders"}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
