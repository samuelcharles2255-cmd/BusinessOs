"use client";

import React, { useState } from "react";
import { formatMoney } from "@/lib/utils";

interface TrendChartProps {
  labels: string[];
  revenue: number[];
  units: number[];
}

export function TrendChart({ labels, revenue, units }: TrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!labels || labels.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500 font-mono text-xs">
        // NO TELEMETRY RECORDED IN CURRENT TIMELINE
      </div>
    );
  }

  const maxRevenue = Math.max(...revenue, 1);
  const width = 800;
  const height = 240;
  const paddingX = 40;
  const paddingY = 25;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = labels.map((label, i) => {
    const x =
      labels.length === 1
        ? width / 2
        : paddingX + (i / (labels.length - 1)) * chartWidth;
    const rev = revenue[i] || 0;
    const y = height - paddingY - (rev / maxRevenue) * chartHeight;
    return { x, y, label, revenue: rev, units: units[i] || 0 };
  });

  // Smooth cubic bezier path
  let pathD = "";
  if (points.length === 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
  } else if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${
    height - paddingY
  } L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-64 overflow-visible"
      >
        <defs>
          {/* Laser stroke gradient */}
          <linearGradient id="laserGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* Deep-space nebula aurora area fill */}
          <linearGradient id="auroraArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#03060f" stopOpacity="0.0" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Spacecraft grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction, idx) => {
          const y = height - paddingY - fraction * chartHeight;
          return (
            <g key={idx}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="currentColor"
                className="text-slate-200/60 dark:text-white/[0.05]"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
              <text
                x={paddingX - 10}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
              >
                {Math.round(maxRevenue * fraction).toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Nebula Area */}
        <path d={areaD} fill="url(#auroraArea)" />

        {/* Laser Glow Underlay */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#laserGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.3"
          filter="url(#laserGlow)"
        />

        {/* Sharp Laser Line */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#laserGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data Points and Orbital Focus Rings */}
        {points.map((p, idx) => (
          <g key={idx}>
            {hoveredIdx === idx && (
              <circle
                cx={p.x}
                cy={p.y}
                r="10"
                className="fill-cyan-400/20 stroke-cyan-400 animate-ping opacity-60"
                strokeWidth="1"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === idx ? 5.5 : 3.5}
              className={`transition-all duration-200 ${
                hoveredIdx === idx
                  ? "fill-white stroke-cyan-400 stroke-[3]"
                  : "fill-cyan-400 stroke-[#03060f] dark:stroke-[#03060f] stroke-2"
              }`}
            />
            {/* Target hover area */}
            <circle
              cx={p.x}
              cy={p.y}
              r="24"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
            {/* X-axis time label */}
            {(points.length <= 10 || idx % Math.ceil(points.length / 8) === 0) && (
              <text
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tracking-tight"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Holographic Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full bg-white/95 dark:bg-[#070d1e]/95 backdrop-blur-xl border border-slate-200/80 dark:border-cyan-500/30 rounded-xl p-3 shadow-xl dark:shadow-[0_0_24px_-4px_rgba(6,182,212,0.3)] text-xs space-y-1"
          style={{
            left: `${(points[hoveredIdx].x / width) * 100}%`,
            top: `${(points[hoveredIdx].y / height) * 100}%`,
          }}
        >
          <div className="font-mono text-[10px] text-slate-400 dark:text-cyan-400/80 uppercase tracking-wider">
            {points[hoveredIdx].label}
          </div>
          <div className="text-emerald-600 dark:text-cyan-300 font-bold font-mono text-sm">
            {formatMoney(points[hoveredIdx].revenue)}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>{points[hoveredIdx].units} units sold</span>
          </div>
        </div>
      )}
    </div>
  );
}
