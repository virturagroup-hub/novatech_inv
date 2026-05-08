import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit2,
  Trash2,
  Layers,
  X,
  Search,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function ModelsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState(null);

  const { data: models = [], isLoading } = useQuery({
    queryKey: ["models", search, manufacturerFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        manufacturer: manufacturerFilter,
      });
      const res = await fetch(`/api/models?${params}`);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const url = editingModel
        ? `/api/models/${editingModel.id}`
        : "/api/models";
      const method = editingModel ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error("Model save failed:", result);
        throw result;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["parts"] }); // Renaming/deleting affects parts
      setShowModal(false);
      setEditingModel(null);
      toast.success(editingModel ? "Model updated" : "Model added");
    },
    onError: (error) => {
      console.error("Model mutation error:", error);
      if (error.error === "duplicate") {
        toast.error(error.message);
      } else {
        toast.error(error.message || "Failed to save model");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/models/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("Model removed");
    },
  });

  // Get unique manufacturers for filter
  const manufacturers = [
    ...new Set(models.map((m) => m.manufacturer).filter(Boolean)),
  ].sort();

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="p-8 border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
              Master Models
            </h2>
            <p className="text-gray-500 mt-1">
              Global list of compatible device models.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingModel(null);
              setShowModal(true);
            }}
            className="bg-blue-600 text-white rounded-full px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add New Model
          </button>
        </div>
      </header>

      <div className="p-8 max-w-4xl mx-auto space-y-6">
        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Find a model..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={manufacturerFilter}
            onChange={(e) => setManufacturerFilter(e.target.value)}
          >
            <option value="">All Manufacturers</option>
            {manufacturers.map((mfr) => (
              <option key={mfr} value={mfr}>
                {mfr}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                  Manufacturer
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                  Model Name
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {models.map((model) => (
                <tr
                  key={model.id}
                  className="group hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    {model.manufacturer ? (
                      <span className="text-sm text-gray-600">
                        {model.manufacturer}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">
                        Unknown
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Layers size={16} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">
                        {model.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingModel(model);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Remove this model? It will be removed from compatibility lists on all existing parts.",
                            )
                          )
                            deleteMutation.mutate(model.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {models.length === 0 && (
                <tr>
                  <td
                    colSpan="3"
                    className="px-6 py-12 text-center text-gray-500 text-sm"
                  >
                    No models found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ModelModal
          onClose={() => setShowModal(false)}
          onSave={(data) => saveMutation.mutate(data)}
          initialData={editingModel}
          existingModels={models}
        />
      )}
    </div>
  );
}

function ModelModal({ onClose, onSave, initialData, existingModels }) {
  const [name, setName] = useState(initialData?.name || "");
  const [manufacturer, setManufacturer] = useState(
    initialData?.manufacturer || "",
  );
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Check for duplicates as user types
  const checkDuplicate = () => {
    if (!name || !manufacturer) return;

    const duplicate = existingModels.find(
      (m) =>
        m.name.toLowerCase() === name.toLowerCase() &&
        m.manufacturer?.toLowerCase() === manufacturer.toLowerCase() &&
        m.id !== initialData?.id,
    );

    setDuplicateWarning(duplicate);
  };

  React.useEffect(() => {
    checkDuplicate();
  }, [name, manufacturer]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {initialData ? "Edit Model" : "Add Model"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {duplicateWarning && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle
                size={18}
                className="text-orange-600 mt-0.5 shrink-0"
              />
              <div className="text-sm text-orange-900">
                <strong>Duplicate detected:</strong>{" "}
                {duplicateWarning.manufacturer} {duplicateWarning.name} already
                exists
              </div>
            </div>
          )}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-gray-500 uppercase text-left">
              Manufacturer
            </label>
            <input
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g. Canon, HP, Ricoh"
            />
          </div>
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-gray-500 uppercase text-left">
              Model Name
            </label>
            <input
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ImageRunner Adv C3945"
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name) return toast.error("Model name is required");
              onSave({ name, manufacturer });
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700"
            disabled={duplicateWarning}
          >
            {initialData ? "Save Changes" : "Add Model"}
          </button>
        </div>
      </div>
    </div>
  );
}
