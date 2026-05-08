import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  AlertCircle,
  Plus,
  History,
  TrendingUp,
  Package,
  Inbox,
  Layers,
} from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;

  const { stats, recentLogs, flaggedList } = data;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <header className="p-8 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            Inventory Overview
          </h2>
          <p className="text-gray-500 mt-1">
            Real-time status of parts and storage locations.
          </p>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Parts"
            value={stats.total_parts}
            icon={<Package size={20} />}
            color="text-blue-600"
          />
          <StatCard
            label="Unique Part #s"
            value={stats.unique_part_numbers}
            icon={<TrendingUp size={20} />}
            color="text-gray-900"
          />
          <StatCard
            label="Total Bins"
            value={stats.total_bins}
            icon={<Inbox size={20} />}
            color="text-gray-900"
          />
          <StatCard
            label="Needs Attention"
            value={stats.flagged_parts}
            icon={<AlertCircle size={20} />}
            color="text-orange-600"
            isUrgent={stats.flagged_parts > 0}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Actions & Flagged Parts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickActionButton
                  href="/inventory?action=add"
                  label="Add Part"
                  icon={<Plus size={18} />}
                />
                <QuickActionButton
                  href="/bins?action=add"
                  label="Add Bin"
                  icon={<Plus size={18} />}
                />
                <QuickActionButton
                  href="/reports"
                  label="View Logs"
                  icon={<History size={18} />}
                />
                <QuickActionButton
                  href="/models"
                  label="Manage Models"
                  icon={<Layers size={18} />}
                />
              </div>
            </section>

            {/* Needs Attention List */}
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Needs Attention
                  </h3>
                  <p className="text-sm text-gray-500">
                    Parts missing compatibility or location info.
                  </p>
                </div>
                <a
                  href="/inventory?flagged=true"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View all <ArrowRight size={14} />
                </a>
              </div>
              <div className="divide-y divide-gray-100">
                {flaggedList.length > 0 ? (
                  flaggedList.map((part) => (
                    <div
                      key={part.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                          {part.part_number}
                        </span>
                        <span className="text-xs text-gray-500">
                          {part.part_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                          Review Needed
                        </span>
                        <a
                          href={`/inventory?edit=${part.id}`}
                          className="p-2 text-gray-400 hover:text-blue-600"
                        >
                          <ArrowRight size={18} />
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    All clear! No parts need attention.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Recent Activity */}
          <section className="bg-white rounded-xl border border-gray-200 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Recent Activity
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {log.entity_type} {log.action_type}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {format(new Date(log.timestamp), "MMM d, HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {log.display_name}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200">
              <a
                href="/reports"
                className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Full activity log
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, isUrgent }) {
  return (
    <div
      className={`bg-white rounded-xl border ${isUrgent ? "border-orange-200 bg-orange-50/30" : "border-gray-200"} p-6`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>{icon}</div>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight text-gray-900">
          {value}
        </p>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}

function QuickActionButton({ href, label, icon }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all text-gray-700"
    >
      <div className="text-blue-600">{icon}</div>
      <span className="text-xs font-semibold">{label}</span>
    </a>
  );
}
