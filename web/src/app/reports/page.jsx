import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Download,
  History,
  FileText,
  Package,
  AlertTriangle,
  Layers,
  Inbox,
} from "lucide-react";
import { format, startOfDay, subDays, subWeeks, subMonths } from "date-fns";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("activity");
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("");
  const [dateRange, setDateRange] = useState("all");

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["logs", search, actionType, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ search, actionType });
      if (dateRange === "today")
        params.append("startDate", startOfDay(new Date()).toISOString());
      if (dateRange === "week")
        params.append("startDate", subWeeks(new Date(), 1).toISOString());
      if (dateRange === "month")
        params.append("startDate", subMonths(new Date(), 1).toISOString());

      const res = await fetch(`/api/logs?${params}`);
      return res.json();
    },
  });

  const { data: partsData, isLoading: partsLoading } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const res = await fetch("/api/parts");
      if (!res.ok) throw new Error("Failed to fetch parts");
      return res.json();
    },
  });

  const parts = partsData?.parts || [];

  const { data: binsData } = useQuery({
    queryKey: ["bins"],
    queryFn: async () => {
      const res = await fetch("/api/bins");
      if (!res.ok) throw new Error("Failed to fetch bins");
      return res.json();
    },
  });

  const bins = binsData?.bins || [];

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await fetch("/api/models");
      if (!res.ok) throw new Error("Failed to fetch models");
      return res.json();
    },
  });

  const models = modelsData?.models || [];

  const exportActivityLogs = () => {
    const csv = [
      ["Timestamp", "Action", "Entity", "Item", "Details"].join(","),
      ...logs.map((log) =>
        [
          format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss"),
          log.action_type,
          log.entity_type,
          `"${log.display_name.replace(/"/g, '""')}"`,
          `"${(log.details || "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n");

    downloadCSV(csv, `activity_log_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const exportAllParts = () => {
    const csv = [
      [
        "Part Number",
        "Part Name",
        "Quantity",
        "Storage Bin",
        "Compatible Models",
        "Manufacturers",
        "In Date",
        "Flagged",
        "Notes",
      ].join(","),
      ...parts.map((p) => {
        // Extract manufacturers from compatible models
        const partManufacturers = [
          ...new Set(
            (p.compatible_models || [])
              .map((modelName) => {
                const model = models.find((m) => m.name === modelName);
                return model?.manufacturer;
              })
              .filter(Boolean),
          ),
        ].join("; ");

        return [
          `"${p.part_number}"`,
          `"${p.part_name}"`,
          p.quantity,
          `"${p.bin_name || "Unassigned"}"`,
          `"${(p.compatible_models || []).join("; ")}"`,
          `"${partManufacturers || "N/A"}"`,
          format(new Date(p.in_date), "yyyy-MM-dd"),
          p.flagged ? "Yes" : "No",
          `"${(p.notes || "").replace(/"/g, '""')}"`,
        ].join(",");
      }),
    ].join("\n");

    downloadCSV(csv, `parts_inventory_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const exportLowStock = () => {
    const lowStock = parts.filter((p) => p.quantity <= 5);
    const csv = [
      ["Part Number", "Part Name", "Current Qty", "Storage Bin"].join(","),
      ...lowStock.map((p) =>
        [
          `"${p.part_number}"`,
          `"${p.part_name}"`,
          p.quantity,
          `"${p.bin_name || "Unassigned"}"`,
        ].join(","),
      ),
    ].join("\n");

    downloadCSV(csv, `low_stock_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const exportPartsByBin = () => {
    const csv = [
      ["Bin Name", "Part Number", "Part Name", "Quantity"].join(","),
      ...parts
        .sort((a, b) => (a.bin_name || "").localeCompare(b.bin_name || ""))
        .map((p) =>
          [
            `"${p.bin_name || "Unassigned"}"`,
            `"${p.part_number}"`,
            `"${p.part_name}"`,
            p.quantity,
          ].join(","),
        ),
    ].join("\n");

    downloadCSV(csv, `parts_by_bin_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const exportCompatibilityMatrix = () => {
    // Group models by manufacturer
    const modelsByMfr = {};
    models.forEach((m) => {
      const mfr = m.manufacturer || "Unknown";
      if (!modelsByMfr[mfr]) modelsByMfr[mfr] = [];
      modelsByMfr[mfr].push(m.name);
    });

    const modelNames = models.map(
      (m) => `${m.manufacturer || "Unknown"} ${m.name}`,
    );
    const csv = [
      ["Part Number", "Part Name", ...modelNames].join(","),
      ...parts.map((p) => {
        const compatRow = models.map((m) =>
          (p.compatible_models || []).includes(m.name) ? "✓" : "",
        );
        return [`"${p.part_number}"`, `"${p.part_name}"`, ...compatRow].join(
          ",",
        );
      }),
    ].join("\n");

    downloadCSV(
      csv,
      `compatibility_matrix_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  };

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  // Summary counts
  const summary = logs.reduce((acc, log) => {
    acc[log.action_type] = (acc[log.action_type] || 0) + 1;
    return acc;
  }, {});

  const lowStockParts = parts.filter((p) => p.quantity <= 5);
  const flaggedParts = parts.filter((p) => p.flagged);
  const totalParts = parts.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="p-8 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            Reports & Analytics
          </h2>
          <p className="text-gray-500 mt-1">
            Export data and view inventory insights.
          </p>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <ReportTab
            active={activeTab === "activity"}
            onClick={() => setActiveTab("activity")}
            icon={<History size={18} />}
          >
            Activity Timeline
          </ReportTab>
          <ReportTab
            active={activeTab === "parts"}
            onClick={() => setActiveTab("parts")}
            icon={<Package size={18} />}
          >
            Parts Export
          </ReportTab>
          <ReportTab
            active={activeTab === "lowstock"}
            onClick={() => setActiveTab("lowstock")}
            icon={<AlertTriangle size={18} />}
          >
            Low Stock
          </ReportTab>
          <ReportTab
            active={activeTab === "bins"}
            onClick={() => setActiveTab("bins")}
            icon={<Inbox size={18} />}
          >
            By Bin
          </ReportTab>
          <ReportTab
            active={activeTab === "compatibility"}
            onClick={() => setActiveTab("compatibility")}
            icon={<Layers size={18} />}
          >
            Compatibility
          </ReportTab>
        </div>

        {/* Activity Timeline Tab */}
        {activeTab === "activity" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <StatCard
                label="Added"
                count={summary.added || 0}
                color="text-green-600"
              />
              <StatCard
                label="Edited"
                count={summary.edited || 0}
                color="text-blue-600"
              />
              <StatCard
                label="Removed"
                count={summary.removed || 0}
                color="text-red-600"
              />
              <StatCard
                label="Total Events"
                count={logs.length}
                color="text-gray-900"
              />
            </div>

            {/* Filters */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Search
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Find event..."
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action Type
                  </label>
                  <select
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                  >
                    <option value="">All Actions</option>
                    <option value="added">Added</option>
                    <option value="edited">Edited</option>
                    <option value="removed">Removed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timeframe
                  </label>
                  <div className="flex gap-2">
                    <FilterButton
                      active={dateRange === "all"}
                      onClick={() => setDateRange("all")}
                    >
                      All
                    </FilterButton>
                    <FilterButton
                      active={dateRange === "today"}
                      onClick={() => setDateRange("today")}
                    >
                      Today
                    </FilterButton>
                    <FilterButton
                      active={dateRange === "week"}
                      onClick={() => setDateRange("week")}
                    >
                      7D
                    </FilterButton>
                    <FilterButton
                      active={dateRange === "month"}
                      onClick={() => setDateRange("month")}
                    >
                      30D
                    </FilterButton>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={exportActivityLogs}
                    className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>
              </div>
            </section>

            {/* Logs Table */}
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Affected Item
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                        {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${getActionStyle(log.action_type)}`}
                        >
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {log.entity_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900">
                          {log.display_name}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        No activity logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}

        {/* Parts Export Tab */}
        {activeTab === "parts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                label="Total Parts"
                count={parts.length}
                color="text-blue-600"
              />
              <StatCard
                label="Total Quantity"
                count={totalParts}
                color="text-green-600"
              />
              <StatCard
                label="Flagged"
                count={flaggedParts.length}
                color="text-orange-600"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <FileText size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Full Inventory Export
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Export all parts with complete details (quantity, bin,
                    models, notes)
                  </p>
                </div>
              </div>
              <button
                onClick={exportAllParts}
                className="w-full md:w-auto bg-blue-600 text-white rounded-lg px-6 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Complete Inventory CSV
              </button>
            </div>
          </div>
        )}

        {/* Low Stock Tab */}
        {activeTab === "lowstock" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard
                label="Low Stock Parts"
                count={lowStockParts.length}
                color="text-orange-600"
              />
              <StatCard label="Threshold" count="≤ 5" color="text-gray-600" />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Parts Running Low
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Parts with quantity ≤ 5 units
                  </p>
                </div>
                <button
                  onClick={exportLowStock}
                  className="bg-orange-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-orange-700 transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  Export
                </button>
              </div>

              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                      Part Number
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                      Part Name
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                      Storage Bin
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lowStockParts.map((part) => (
                    <tr
                      key={part.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {part.part_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {part.part_name}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            part.quantity === 0
                              ? "bg-red-100 text-red-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {part.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {part.bin_name || "Unassigned"}
                      </td>
                    </tr>
                  ))}
                  {lowStockParts.length === 0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        No low stock parts. Great job!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Parts by Bin Tab */}
        {activeTab === "bins" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                label="Total Bins"
                count={bins.length}
                color="text-purple-600"
              />
              <StatCard
                label="Assigned Parts"
                count={parts.filter((p) => p.bin_id).length}
                color="text-blue-600"
              />
              <StatCard
                label="Unassigned"
                count={parts.filter((p) => !p.bin_id).length}
                color="text-gray-600"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-50 rounded-xl">
                  <Inbox size={24} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Parts Organized by Storage Bin
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Export inventory grouped by bin location
                  </p>
                </div>
              </div>
              <button
                onClick={exportPartsByBin}
                className="w-full md:w-auto bg-purple-600 text-white rounded-lg px-6 py-3 text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Parts by Bin CSV
              </button>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700">
                  Preview: Bin Distribution
                </h4>
              </div>
              <div className="p-6 space-y-4">
                {bins.map((bin) => {
                  const binParts = parts.filter((p) => p.bin_id === bin.id);
                  return (
                    <div
                      key={bin.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Inbox size={18} className="text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {bin.name}
                          </p>
                          {bin.description && (
                            <p className="text-xs text-gray-500">
                              {bin.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-600">
                        {binParts.length} part{binParts.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })}
                {parts.filter((p) => !p.bin_id).length > 0 && (
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={18} className="text-orange-500" />
                      <p className="font-semibold text-gray-900">Unassigned</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-600">
                      {parts.filter((p) => !p.bin_id).length} part
                      {parts.filter((p) => !p.bin_id).length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compatibility Matrix Tab */}
        {activeTab === "compatibility" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard
                label="Models"
                count={models.length}
                color="text-indigo-600"
              />
              <StatCard
                label="Parts"
                count={parts.length}
                color="text-blue-600"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-50 rounded-xl">
                  <Layers size={24} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Part-Model Compatibility Matrix
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Export a cross-reference table showing which parts work with
                    which models
                  </p>
                </div>
              </div>
              <button
                onClick={exportCompatibilityMatrix}
                className="w-full md:w-auto bg-indigo-600 text-white rounded-lg px-6 py-3 text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Compatibility Matrix CSV
              </button>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700">
                  Preview: Sample Compatibility
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">
                        Part
                      </th>
                      {models.slice(0, 5).map((model) => (
                        <th
                          key={model.id}
                          className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center"
                        >
                          {model.name}
                        </th>
                      ))}
                      {models.length > 5 && (
                        <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-center">
                          +{models.length - 5} more
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parts.slice(0, 10).map((part) => (
                      <tr key={part.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900 sticky left-0 bg-white">
                          {part.part_number}
                        </td>
                        {models.slice(0, 5).map((model) => (
                          <td key={model.id} className="px-4 py-3 text-center">
                            {(part.compatible_models || []).includes(
                              model.name,
                            ) ? (
                              <span className="text-green-600 font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                        {models.length > 5 && (
                          <td className="px-4 py-3 text-center text-gray-400">
                            ...
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parts.length > 10 && (
                <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
                  Showing 10 of {parts.length} parts. Export CSV for full
                  matrix.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportTab({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      <span className="hidden md:inline">{children}</span>
    </button>
  );
}

function StatCard({ label, count, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{count}</p>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
    >
      {children}
    </button>
  );
}

function getActionStyle(action) {
  switch (action) {
    case "added":
      return "bg-green-50 text-green-700 border-green-200";
    case "edited":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "removed":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}
