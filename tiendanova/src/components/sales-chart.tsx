"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const number = new Intl.NumberFormat("es-CL");
export function SalesChart({
  data,
}: {
  data: { day: string; sales: number }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Ventas de los últimos 7 días. ${data.map(({ day, sales }) => `${day}: ${number.format(sales)} pesos`).join("; ")}`}
    >
      <ResponsiveContainer
        width="100%"
        height={220}
        minWidth={0}
        initialDimension={{ width: 420, height: 220 }}
      >
        <BarChart
          data={data}
          margin={{ top: 12, right: 9, left: 4, bottom: 4 }}
          accessibilityLayer={false}
        >
          <CartesianGrid stroke="#e5e8db" vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            tickFormatter={(value) => number.format(value)}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={75}
          />
          <Tooltip
            formatter={(value) => [
              `$${number.format(Number(value))}`,
              "Ventas",
            ]}
          />
          <Bar
            dataKey="sales"
            fill="#506c35"
            radius={[6, 6, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
