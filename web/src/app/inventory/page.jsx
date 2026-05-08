import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Camera,
  MoreHorizontal,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Printer,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterBin, setFilterBin] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [filterFlagged, setFilterFlagged] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [printingPart, setPrintingPart] = useState(null);

  // Bulk selection state
  const [selectedParts, setSelectedParts] = useState([]);

  // Queries
  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: [
      "parts",
      search,
      filterBin,
      filterModel,
      filterManufacturer,
      filterFlagged,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        binId: filterBin,
        model: filterModel,
        manufacturer: filterManufacturer,
        flagged: filterFlagged.toString(),
      });
      const res = await fetch(`/api/parts?${params}`);
      const data = await res.json();
      return data.parts; // Extract parts array from response object
    },
  });

  const { data: bins = [] } = useQuery({
    queryKey: ["bins"],
    queryFn: () => fetch("/api/bins").then((r) => r.json()),
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: () => fetch("/api/models").then((r) => r.json()),
  });

  // Get unique manufacturers from models
  const manufacturers = ["Canon", "HP", "Riso", "Sharp", "Konica Minolta"];

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/parts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("Part removed");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const url = editingPart ? `/api/parts/${editingPart.id}` : "/api/parts";
      const method = editingPart ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw result;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      setShowModal(false);
      setEditingPart(null);
      toast.success(editingPart ? "Part updated" : "Part added");
    },
    onError: (error) => {
      if (error.error === "duplicate") {
        // Show duplicate warning with option to update existing
        if (
          confirm(
            `${error.message}\n\nWould you like to edit the existing part instead?`,
          )
        ) {
          setEditingPart(error.existing);
          setShowModal(true);
        }
      } else {
        toast.error(error.message || "Failed to save part");
      }
    },
  });

  // Handle Action from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "add") setShowModal(true);
    if (params.get("flagged") === "true") setFilterFlagged(true);
    if (params.get("edit")) {
      // Logic to trigger edit on load if needed
    }
  }, []);

  // Toggle selection
  const toggleSelect = (partId) => {
    setSelectedParts((prev) =>
      prev.includes(partId)
        ? prev.filter((id) => id !== partId)
        : [...prev, partId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedParts.length === parts.length) {
      setSelectedParts([]);
    } else {
      setSelectedParts(parts.map((p) => p.id));
    }
  };

  const getSelectedPartsData = () => {
    return parts.filter((p) => selectedParts.includes(p.id));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="p-4 md:p-8 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Inventory
            </h2>
            <p className="text-gray-500 mt-1 text-sm md:text-base">
              Manage and track printer parts.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingPart(null);
              setShowModal(true);
            }}
            className="bg-blue-600 text-white rounded-full px-6 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add New Part
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="p-4 md:p-6 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search parts..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 md:px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showFilters ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
            >
              <Filter size={18} />
              <span className="hidden sm:inline">Filters</span>
              {showFilters ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
          </div>

          {/* Bulk Actions Bar */}
          {selectedParts.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <Printer size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {selectedParts.length} part
                    {selectedParts.length !== 1 ? "s" : ""} selected
                  </p>
                  <p className="text-xs text-blue-700">Ready to print tags</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedParts([])}
                  className="px-4 py-2 border border-blue-200 bg-white text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setPrintingPart(getSelectedPartsData())}
                  className="flex-1 sm:flex-initial px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer size={16} />
                  Print Selected
                </button>
              </div>
            </div>
          )}

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 p-3 md:p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase">
                  Storage Bin
                </label>
                <select
                  className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                  value={filterBin}
                  onChange={(e) => setFilterBin(e.target.value)}
                >
                  <option value="">All Bins</option>
                  {bins.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase">
                  Compatible Model
                </label>
                <select
                  className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                >
                  <option value="">All Models</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.manufacturer ? `${m.manufacturer} - ` : ""}
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase">
                  Manufacturer
                </label>
                <select
                  className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                  value={filterManufacturer}
                  onChange={(e) => setFilterManufacturer(e.target.value)}
                >
                  <option value="">All Manufacturers</option>
                  {manufacturers.map((mfr) => (
                    <option key={mfr} value={mfr}>
                      {mfr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end h-full pb-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative ${filterFlagged ? "bg-orange-500" : "bg-gray-200"}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${filterFlagged ? "translate-x-4" : ""}`}
                    ></div>
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={filterFlagged}
                    onChange={() => setFilterFlagged(!filterFlagged)}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Needs Attention
                  </span>
                </label>
              </div>
              <div className="flex items-end justify-end h-full">
                <button
                  onClick={() => {
                    setFilterBin("");
                    setFilterModel("");
                    setFilterManufacturer("");
                    setFilterFlagged(false);
                    setSearch("");
                  }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-900"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block flex-1 overflow-auto bg-white">
        <div className="max-w-7xl mx-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={
                      selectedParts.length === parts.length && parts.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-600"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Part Number
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Part Name
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Storage Bin
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Compatibility
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  In Date
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parts.length > 0 ? (
                parts.map((part) => (
                  <tr
                    key={part.id}
                    className="group hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedParts.includes(part.id)}
                        onChange={() => toggleSelect(part.id)}
                        className="rounded text-blue-600 focus:ring-blue-600"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {part.part_number}
                        </span>
                        {part.flagged && (
                          <div
                            className="text-orange-500"
                            title="Needs Attention"
                          >
                            <AlertCircle size={14} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {part.part_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {part.bin_name ? (
                        <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center gap-1.5">
                          {part.bin_name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {part.compatible_models?.length > 0 ? (
                          part.compatible_models.slice(0, 2).map((m, i) => (
                            <span
                              key={i}
                              className="bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            >
                              {m}
                            </span>
                          ))
                        ) : part.is_universal ? (
                          <span className="text-[10px] text-gray-500 font-medium">
                            Universal Part
                          </span>
                        ) : (
                          <span className="text-[10px] text-orange-600 font-medium">
                            Missing Models
                          </span>
                        )}
                        {part.compatible_models?.length > 2 && (
                          <span className="text-[10px] text-gray-400">
                            +{part.compatible_models.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                      {format(new Date(part.in_date), "yyyy-MM-dd")}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-900">
                        {part.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setPrintingPart([part])}
                          className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                          title="Print Tag"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPart(part);
                            setShowModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this part?"))
                              deleteMutation.mutate(part.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No parts found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex-1 overflow-auto bg-gray-50">
        <div className="p-4 space-y-3">
          {parts.length > 0 ? (
            parts.map((part) => (
              <div
                key={part.id}
                className={`bg-white rounded-xl border-2 transition-all ${
                  selectedParts.includes(part.id)
                    ? "border-blue-500 shadow-lg"
                    : "border-gray-200"
                }`}
              >
                {/* Card Header with Checkbox */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedParts.includes(part.id)}
                        onChange={() => toggleSelect(part.id)}
                        className="mt-1 rounded text-blue-600 focus:ring-blue-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-bold text-gray-900">
                            {part.part_number}
                          </span>
                          {part.flagged && (
                            <AlertCircle
                              size={16}
                              className="text-orange-500"
                            />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {part.part_name}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Bin
                      </div>
                      {part.bin_name ? (
                        <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center">
                          {part.bin_name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          Unassigned
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Quantity
                      </div>
                      <span className="text-base font-bold text-gray-900">
                        {part.quantity}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Compatible Models
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {part.compatible_models?.length > 0 ? (
                        part.compatible_models.map((m, i) => (
                          <span
                            key={i}
                            className="bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          >
                            {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-orange-600 font-medium">
                          Missing Models
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    <span className="font-semibold">In Date:</span>{" "}
                    {format(new Date(part.in_date), "yyyy-MM-dd")}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-3 border-t border-gray-100 flex items-center gap-2">
                  <button
                    onClick={() => setPrintingPart([part])}
                    className="flex-1 px-4 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-semibold hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    onClick={() => {
                      setEditingPart(part);
                      setShowModal(true);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this part?"))
                        deleteMutation.mutate(part.id);
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              No parts found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Part Modal */}
      {showModal && (
        <PartModal
          onClose={() => setShowModal(false)}
          onSave={(data) => saveMutation.mutate(data)}
          bins={bins}
          models={models}
          initialData={editingPart}
        />
      )}

      {/* Print Tag Modal - now supports array of parts */}
      {printingPart && (
        <PrintTagModal
          parts={Array.isArray(printingPart) ? printingPart : [printingPart]}
          onClose={() => setPrintingPart(null)}
        />
      )}
    </div>
  );
}

function PartModal({ onClose, onSave, bins, models, initialData }) {
  const [formData, setFormData] = useState(
    initialData || {
      part_number: "",
      part_name: "",
      compatible_models: [],
      in_date: format(new Date(), "yyyy-MM-dd"),
      bin_id: "",
      quantity: 0,
      notes: "",
      is_universal: false,
    },
  );
  const [modelManufacturerFilter, setModelManufacturerFilter] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Check for duplicate part numbers
  useEffect(() => {
    if (formData.part_number && formData.part_number.length >= 3) {
      const checkDuplicate = async () => {
        try {
          const res = await fetch(
            `/api/parts?search=${encodeURIComponent(formData.part_number)}`,
          );
          const data = await res.json();
          const duplicate = data.parts?.find(
            (p) =>
              p.part_number.toLowerCase() ===
                formData.part_number.toLowerCase() &&
              (!initialData || p.id !== initialData.id),
          );
          if (duplicate) {
            setDuplicateWarning(duplicate);
          } else {
            setDuplicateWarning(null);
          }
        } catch (err) {
          console.error("Error checking duplicate:", err);
        }
      };
      const timer = setTimeout(checkDuplicate, 500);
      return () => clearTimeout(timer);
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.part_number, initialData]);

  // Filter and sort models by manufacturer
  const manufacturers = ["Canon", "HP", "Riso", "Sharp", "Konica Minolta"];
  const filteredModels = modelManufacturerFilter
    ? models.filter((m) => m.manufacturer === modelManufacturerFilter)
    : models;

  const sortedModels = [...filteredModels].sort((a, b) => {
    const mfrA = a.manufacturer || "ZZZZ";
    const mfrB = b.manufacturer || "ZZZZ";
    if (mfrA !== mfrB) return mfrA.localeCompare(mfrB);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] my-auto">
        <div className="p-4 md:p-6 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-gray-900">
              {initialData ? "Edit Part" : "Add New Part"}
            </h3>
            <p className="text-xs md:text-sm text-gray-500">
              Fill in the details below.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <FormField label="Part Number" required>
              <input
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                value={formData.part_number}
                onChange={(e) =>
                  setFormData({ ...formData, part_number: e.target.value })
                }
                placeholder="e.g. FM1-D581"
              />
              {duplicateWarning && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs font-semibold text-orange-900 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Part already exists with quantity{" "}
                    {duplicateWarning.quantity}
                  </p>
                  <p className="text-[10px] text-orange-700 mt-0.5">
                    Consider editing the existing part instead of creating a
                    duplicate.
                  </p>
                </div>
              )}
            </FormField>
            <FormField label="Part Name" required>
              <input
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                value={formData.part_name}
                onChange={(e) =>
                  setFormData({ ...formData, part_name: e.target.value })
                }
                placeholder="e.g. Fixing Assembly"
              />
            </FormField>
            <FormField label="In Date">
              <input
                type="date"
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                value={formData.in_date}
                onChange={(e) =>
                  setFormData({ ...formData, in_date: e.target.value })
                }
              />
            </FormField>
            <FormField label="Quantity">
              <input
                type="number"
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity: parseInt(e.target.value) || 0,
                  })
                }
              />
            </FormField>
            <FormField label="Storage Bin">
              <select
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                value={formData.bin_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, bin_id: e.target.value })
                }
              >
                <option value="">Unassigned</option>
                {bins.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Universal / Accessory Part">
            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                className="rounded text-blue-600 focus:ring-blue-600"
                checked={formData.is_universal}
                onChange={(e) =>
                  setFormData({ ...formData, is_universal: e.target.checked })
                }
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  This part is compatible with multiple devices (finishers,
                  accessories, etc.)
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Check this to skip the "needs attention" flag when no specific
                  models are selected
                </p>
              </div>
            </label>
          </FormField>

          <FormField label="Compatible Models (Multi-select)">
            <div className="mb-3">
              <select
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                value={modelManufacturerFilter}
                onChange={(e) => setModelManufacturerFilter(e.target.value)}
              >
                <option value="">All Manufacturers</option>
                {manufacturers.map((mfr) => (
                  <option key={mfr} value={mfr}>
                    {mfr}
                  </option>
                ))}
              </select>
            </div>
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sortedModels.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 cursor-pointer hover:border-blue-200 transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-600"
                      checked={formData.compatible_models.includes(m.name)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...formData.compatible_models, m.name]
                          : formData.compatible_models.filter(
                              (name) => name !== m.name,
                            );
                        setFormData({ ...formData, compatible_models: next });
                      }}
                    />
                    <span className="text-xs font-medium text-gray-700">
                      {m.manufacturer && (
                        <span className="text-gray-500">
                          {m.manufacturer} -{" "}
                        </span>
                      )}
                      {m.name}
                    </span>
                  </label>
                ))}
                {sortedModels.length === 0 && (
                  <p className="text-xs text-gray-400 italic">
                    {modelManufacturerFilter
                      ? "No models for this manufacturer."
                      : "No models available. Add them in Master Models list."}
                  </p>
                )}
              </div>
            </div>
            {formData.compatible_models.length === 0 &&
              !formData.is_universal && (
                <p className="text-[10px] text-orange-600 font-medium mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> Part will be flagged as "Needs
                  Attention" without compatibility info.
                </p>
              )}
          </FormField>

          <FormField label="Notes">
            <textarea
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white h-24 resize-none"
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Internal notes, shelf life, or special instructions..."
            />
          </FormField>
        </div>

        <div className="p-4 md:p-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-end gap-3 bg-white shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!formData.part_number || !formData.part_name) {
                toast.error("Part Number and Name are required");
                return;
              }
              onSave(formData);
            }}
            className="w-full sm:w-auto px-8 py-2.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            {initialData ? "Save Changes" : "Add Part"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function PrintTagModal({ parts, onClose }) {
  const [printQuantities, setPrintQuantities] = useState(
    parts.reduce((acc, part) => {
      acc[part.id] = { copies: 1, useQuantity: false };
      return acc;
    }, {}),
  );

  const handlePrint = () => {
    window.print();
  };

  const handleQuantityChange = (partId, field, value) => {
    setPrintQuantities((prev) => ({
      ...prev,
      [partId]: { ...prev[partId], [field]: value },
    }));
  };

  // Generate all tags to print based on configuration
  const tagsToPrint = [];
  parts.forEach((part) => {
    const config = printQuantities[part.id];
    const numCopies = config.useQuantity ? part.quantity : config.copies;
    for (let i = 0; i < numCopies; i++) {
      tagsToPrint.push({
        ...part,
        copyNum: i + 1,
        totalCopies: numCopies,
      });
    }
  });

  // Render individual tag content (shared between preview and print)
  const renderTag = (part, idx) => {
    const siteUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://parts-inventory-tracking-sy-481.created.app";
    const qrUrl = `${siteUrl}/scanner?part=${encodeURIComponent(part.part_number)}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;

    return (
      <div key={idx} className="single-tag">
        <div className="flex h-full gap-2">
          {/* QR Code */}
          <div className="flex items-center justify-center">
            <img
              src={qrCodeUrl}
              alt="QR Code"
              className="w-20 h-20 border border-gray-200"
            />
          </div>

          {/* Part Info */}
          <div className="flex-1 flex flex-col justify-between py-1">
            <div>
              <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                Part Number
              </div>
              <div className="text-lg font-bold text-gray-900 leading-tight mb-2">
                {part.part_number}
              </div>
              <div className="text-[10px] font-medium text-gray-700 leading-snug line-clamp-2">
                {part.part_name}
              </div>
            </div>

            <div className="flex gap-2 text-[8px] text-gray-500 mt-1">
              {part.bin_name && (
                <div>
                  <span className="font-semibold">Bin:</span> {part.bin_name}
                </div>
              )}
              {part.quantity > 0 && (
                <div>
                  <span className="font-semibold">Qty:</span> {part.quantity}
                </div>
              )}
              {part.totalCopies > 1 && (
                <div>
                  <span className="font-semibold">Copy:</span> {part.copyNum}/
                  {part.totalCopies}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          .print-only-root,
          .print-only-root * {
            visibility: visible !important;
          }
          .print-only-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .printable-tag-container {
            display: grid !important;
            grid-template-columns: repeat(2, 3.5in) !important;
            grid-auto-rows: 2in !important;
            gap: 0.25in !important;
            justify-content: start !important;
            align-content: start !important;
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .single-tag {
            width: 3.5in !important;
            height: 2in !important;
            min-height: 2in !important;
            max-height: 2in !important;
            box-sizing: border-box !important;
            border: 1px solid #000 !important;
            padding: 0.15in !important;
            background: white !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }
          .single-tag:nth-child(8n) {
            break-after: page !important;
            page-break-after: always !important;
          }
          .single-tag:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
          .print-modal-container,
          .modal-header,
          .modal-config,
          .modal-footer,
          .preview-text,
          .preview-tag-container {
            display: none !important;
          }
        }
      `}</style>

      {/* Preview Modal - screen only */}
      <div className="print-modal-container fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto print:hidden">
        <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-4xl my-8">
          <div className="modal-header p-4 md:p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">
                Print Part Tags
              </h3>
              <p className="text-xs md:text-sm text-gray-500">
                {parts.length} part{parts.length !== 1 ? "s" : ""} selected ·
                Total tags: {tagsToPrint.length} · Pages:{" "}
                {Math.ceil(tagsToPrint.length / 8)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Print Configuration */}
          <div className="modal-config p-4 md:p-6 border-b border-gray-200 bg-gray-50 max-h-64 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Print Quantity for Each Part
            </div>
            <div className="space-y-3">
              {parts.map((part) => (
                <div
                  key={part.id}
                  className="bg-white rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">
                        {part.part_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {part.part_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printQuantities[part.id].useQuantity}
                          onChange={(e) =>
                            handleQuantityChange(
                              part.id,
                              "useQuantity",
                              e.target.checked,
                            )
                          }
                          className="rounded text-blue-600 focus:ring-blue-600"
                        />
                        <span className="text-xs text-gray-700">
                          Print {part.quantity} (stock qty)
                        </span>
                      </label>
                      {!printQuantities[part.id].useQuantity && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">
                            Copies:
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={printQuantities[part.id].copies}
                            onChange={(e) =>
                              handleQuantityChange(
                                part.id,
                                "copies",
                                parseInt(e.target.value) || 1,
                              )
                            }
                            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 md:p-8 max-h-96 overflow-y-auto">
            <div className="preview-text mb-4 text-center text-xs md:text-sm text-gray-500">
              Tag Layout: 2 columns × 4 rows (8 tags per page) · Tag Size: 3.5"
              × 2"
            </div>

            <div className="preview-tag-container grid grid-cols-2 gap-4">
              {tagsToPrint.map((part, idx) => {
                const siteUrl =
                  typeof window !== "undefined"
                    ? window.location.origin
                    : "https://parts-inventory-tracking-sy-481.created.app";
                const qrUrl = `${siteUrl}/scanner?part=${encodeURIComponent(part.part_number)}`;
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;

                return (
                  <div
                    key={idx}
                    className="single-tag border-2 border-dashed border-gray-300 bg-white p-3"
                    style={{ width: "100%", minHeight: "2in" }}
                  >
                    <div className="flex h-full gap-2">
                      {/* QR Code */}
                      <div className="flex items-center justify-center">
                        <img
                          src={qrCodeUrl}
                          alt="QR Code"
                          className="w-20 h-20 border border-gray-200"
                        />
                      </div>

                      {/* Part Info */}
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                            Part Number
                          </div>
                          <div className="text-lg font-bold text-gray-900 leading-tight mb-2">
                            {part.part_number}
                          </div>
                          <div className="text-[10px] font-medium text-gray-700 leading-snug line-clamp-2">
                            {part.part_name}
                          </div>
                        </div>

                        <div className="flex gap-2 text-[8px] text-gray-500 mt-1">
                          {part.bin_name && (
                            <div>
                              <span className="font-semibold">Bin:</span>{" "}
                              {part.bin_name}
                            </div>
                          )}
                          {part.quantity > 0 && (
                            <div>
                              <span className="font-semibold">Qty:</span>{" "}
                              {part.quantity}
                            </div>
                          )}
                          {part.totalCopies > 1 && (
                            <div>
                              <span className="font-semibold">Copy:</span>{" "}
                              {part.copyNum}/{part.totalCopies}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="modal-footer p-4 md:p-6 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-3 bg-gray-50">
            <p className="text-xs text-gray-500 text-center md:text-left">
              QR codes link directly to part details page · 8 tags per sheet
            </p>
            <div className="flex gap-3 w-full md:w-auto">
              <button
                onClick={onClose}
                className="flex-1 md:flex-initial px-6 py-2.5 border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 md:flex-initial px-8 py-2.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={18} />
                Print {tagsToPrint.length} Tag
                {tagsToPrint.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only container - outside modal */}
      <div className="print-only-root hidden print:block">
        <div className="printable-tag-container">
          {tagsToPrint.map((part, idx) => renderTag(part, idx))}
        </div>
      </div>
    </>
  );
}
