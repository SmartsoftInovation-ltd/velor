import { useEffect, useState } from "react";
import { BoxIconLine } from "../../../icons";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { showApiError } from "../../../utils/apiError";

interface StatBoxProps {
  title: string;
  count: number | string;
  amount?: number;
  color?: string;
  bgColor?: string;
}

const StatBox = ({
  title,
  count,
  amount,
  color = "bg-gray-200",
  bgColor = "bg-gray-50",
}: StatBoxProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-2 rounded-lg border border-gray-200 ${bgColor} shadow-sm w-32 h-28 hover:shadow-md transition`}
    >
      <div
        className={`flex items-center justify-center w-8 h-8 ${color} rounded-lg`}
      >
        <BoxIconLine className="text-gray-800 size-4 dark:text-white/90" />
      </div>
      <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {title}
      </span>
      <h4 className="mt-1 font-semibold text-gray-800 text-sm dark:text-white/90">
        {count}
      </h4>
      {amount !== undefined && (
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          ৳ {amount}
        </span>
      )}
    </div>
  );
};

const statusColors: Record<string, { color: string; bgColor: string }> = {
  Pending: { color: "bg-yellow-200", bgColor: "bg-yellow-50" },
  Hold: { color: "bg-red-200", bgColor: "bg-red-50" },
  Shipped: { color: "bg-green-200", bgColor: "bg-green-50" },
  Completed: { color: "bg-indigo-200", bgColor: "bg-indigo-50" },
  CourierPending: { color: "bg-orange-200", bgColor: "bg-orange-50" },
  Packaging: { color: "bg-pink-200", bgColor: "bg-pink-50" },
  Confirmed: { color: "bg-teal-200", bgColor: "bg-teal-50" },
  Default: { color: "bg-gray-200", bgColor: "bg-gray-50" },
};

const OrderHistory = () => {
  const [stats, setStats] = useState<
    { _id: string; count: number; amount: number }[]
  >([]);
  const [totalOrder, setTotalOrder] = useState<number>(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axiosSecure.get("/order/getordercountandamount");
        setStats(res.data.data.orderCountAndAmount);
        setTotalOrder(res.data.data.totalOrder);
      } catch (error) {
        showApiError(error, "Failed to fetch order stats!");
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="flex justify-around flex-wrap gap-2">
      <StatBox
        title="Orders"
        count={totalOrder}
        color="bg-blue-300"
        bgColor="bg-blue-50"
      />

      {stats.map((item) => {
        const colors = statusColors[item._id] || statusColors.Default;
        return (
          <StatBox
            key={item._id}
            title={item._id}
            count={item.count}
            amount={item.amount}
            color={colors.color}
            bgColor={colors.bgColor}
          />
        );
      })}
    </div>
  );
};

export default OrderHistory;
