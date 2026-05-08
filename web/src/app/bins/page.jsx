import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit2,
  Trash2,
  Inbox,
  Package,
  MapPin,
  X,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import useUser from "@/utils/useUser";

// Manufacturer color mapping
const MANUFACTURER_COLORS = {
  HP: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700",
    icon: "bg-blue-600",
  },
  Canon: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
    icon: "bg-red-600",
  },
  Epson: {
    bg: "bg-purple-50",
    border: "border-purple-300",
    text: "text-purple-700",
    icon: "bg-purple-600",
  },
  Brother: {
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-700",
    icon: "bg-green-600",
  },
  Lexmark: {
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-700",
    icon: "bg-yellow-600",
  },
  Xerox: {
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    text: "text-indigo-700",
    icon: "bg-indigo-600",
  },
  Samsung: {
    bg: "bg-teal-50",
    border: "border-teal-300",
    text: "text-teal-700",
    icon: "bg-teal-600",
  },
  Ricoh: {
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700",
    icon: "bg-orange-600",
  },
  Dell: {
    bg: "bg-cyan-50",
    border: "border-cyan-300",
    text: "text-cyan-700",
    icon: "bg-cyan-600",
  },
  Kyocera: {
    bg: "bg-pink-50",
    border: "border-pink-300",
    text: "text-pink-700",
    icon: "bg-pink-600",
  },
};

const DEFAULT_COLOR = {
  bg: "bg-gray-50",
  border: "border-gray-300",
  text: "text-gray-700",
  icon: "bg-gray-600",
};

function getManufacturerColor(manufacturer) {
  if (!manufacturer) return DEFAULT_COLOR;
  return MANUFACTURER_COLORS[manufacturer] || DEFAULT_COLOR;
}

export default function BinsPage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useUser();
  const [showModal, setShowModal] = useState(false);
  const [editingBin, setEditingBin] = useState(null);
  const [selectedBin, setSelectedBin] = useState(null);
  const [prefilledPosition, setPrefilledPosition] = useState(null);
  const [draggedBin, setDraggedBin] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);

  const { data: bins = [], isLoading } = useQuery({
    queryKey: ["bins"],
    queryFn: () => fetch("/api/bins").then((res) => res.json()),
  });

  const { data: partsData } = useQuery({
    queryKey: ["parts", selectedBin?.id],
    queryFn: () =>
      fetch(`/api/parts?binId=${selectedBin.id}`).then((res) => res.json()),
    enabled: !!selectedBin,
  });

  // Allow all logged-in users to edit bins
  const canEdit = true;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const url = editingBin ? `/api/bins/${editingBin.id}` : "/api/bins";
      const method = editingBin ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Bin save failed:", err);
        throw new Error(err.error || "Failed to save bin");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bins"] });
      setShowModal(false);
      setEditingBin(null);
      setPrefilledPosition(null);
      toast.success(editingBin ? "Bin updated" : "Bin created");
    },
    onError: (error) => {
      console.error("Bin mutation error:", error);
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/bins/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete bin");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bins"] });
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      setShowModal(false);
      setEditingBin(null);
      toast.success("Bin removed");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: async ({ binId, grid_row, grid_col }) => {
      const res = await fetch(`/api/bins/${binId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid_row, grid_col }),
      });
      if (!res.ok) throw new Error("Failed to update position");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bins"] });
      toast.success("Bin position updated");
    },
  });

  // Build dynamic grid based on positioned bins
  const positionedBins = bins.filter((b) => b.grid_row && b.grid_col);
  const unpositionedBins = bins.filter((b) => !b.grid_row || !b.grid_col);

  // Calculate grid dimensions
  const maxRow = positionedBins.reduce(
    (max, b) => Math.max(max, b.grid_row || 0),
    0,
  );
  const maxCol = positionedBins.reduce(
    (max, b) => Math.max(max, b.grid_col || 0),
    0,
  );

  // Default to at least 2x3 grid
  const numRows = Math.max(3, maxRow);
  const numCols = Math.max(2, maxCol);

  // Create grid map - now supports multiple bins per position
  const gridMap = {};
  positionedBins.forEach((bin) => {
    const key = `${bin.grid_row}-${bin.grid_col}`;
    if (!gridMap[key]) {
      gridMap[key] = [];
    }
    gridMap[key].push(bin);
  });

  const handleDragStart = (e, bin) => {
    setDraggedBin(bin);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, row, col) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPosition({ row, col });
  };

  const handleDragLeave = () => {
    setDragOverPosition(null);
  };

  const handleDrop = (e, row, col) => {
    e.preventDefault();
    if (draggedBin) {
      // Update bin position
      updatePositionMutation.mutate({
        binId: draggedBin.id,
        grid_row: row,
        grid_col: col,
      });
    }
    setDraggedBin(null);
    setDragOverPosition(null);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <header className="p-8 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
              Storage Bins
            </h2>
            <p className="text-gray-500 mt-1">
              Shelf layout ({numCols} columns × {numRows} rows) • Color-coded by
              manufacturer
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => {
                setEditingBin(null);
                setPrefilledPosition(null);
                setShowModal(true);
              }}
              className="bg-blue-600 text-white rounded-full px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              New Bin
            </button>
          )}
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Grid View */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Shelf Layout
            </h3>
            {canEdit && (
              <p className="text-sm text-gray-500">
                Click empty positions to add bins • Drag bins to move
              </p>
            )}
          </div>
          <div
            className={`grid gap-4`}
            style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)` }}
          >
            {Array.from({ length: numRows }).map((_, rowIdx) =>
              Array.from({ length: numCols }).map((_, colIdx) => {
                const row = rowIdx + 1;
                const col = colIdx + 1;
                const binsAtPosition = gridMap[`${row}-${col}`] || [];
                const hasBins = binsAtPosition.length > 0;
                const isDropTarget =
                  dragOverPosition?.row === row &&
                  dragOverPosition?.col === col;

                return (
                  <div
                    key={`${row}-${col}`}
                    className={`border-2 border-dashed rounded-xl p-4 min-h-[140px] transition-all ${
                      !hasBins && canEdit
                        ? "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                        : "border-gray-200 bg-gray-50"
                    } ${isDropTarget ? "border-blue-500 bg-blue-100" : ""}`}
                    onClick={() => {
                      if (!hasBins && canEdit) {
                        setEditingBin(null);
                        setPrefilledPosition({ row, col });
                        setShowModal(true);
                      }
                    }}
                    onDragOver={(e) => handleDragOver(e, row, col)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, row, col)}
                  >
                    {hasBins ? (
                      <div className="flex gap-2 h-full">
                        {binsAtPosition.map((bin) => {
                          const colors = getManufacturerColor(bin.manufacturer);
                          const isDragging = draggedBin?.id === bin.id;
                          return (
                            <div
                              key={bin.id}
                              draggable={canEdit}
                              onDragStart={(e) => handleDragStart(e, bin)}
                              onDragEnd={() => {
                                setDraggedBin(null);
                                setDragOverPosition(null);
                              }}
                              className={`flex-1 ${colors.border} ${colors.bg} rounded-lg p-3 hover:shadow-md cursor-pointer transition-all ${isDragging ? "opacity-50" : ""}`}
                              onClick={() => setSelectedBin(bin)}
                              style={{ minWidth: 0 }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-1">
                                  {canEdit && (
                                    <GripVertical
                                      size={12}
                                      className="text-gray-400 cursor-grab flex-shrink-0"
                                    />
                                  )}
                                  <div
                                    className={`p-1.5 ${colors.icon} rounded-lg text-white flex-shrink-0`}
                                  >
                                    <Inbox size={14} />
                                  </div>
                                </div>
                                {canEdit && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingBin(bin);
                                      setPrefilledPosition(null);
                                      setShowModal(true);
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600 flex-shrink-0"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                              </div>
                              <h4 className="font-semibold text-gray-900 text-xs truncate">
                                {bin.name}
                              </h4>
                              {bin.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                  {bin.description}
                                </p>
                              )}
                              <div
                                className={`mt-2 pt-2 border-t ${colors.border} flex items-center justify-between`}
                              >
                                <div className="flex items-center gap-1 text-xs font-medium truncate">
                                  {bin.manufacturer ? (
                                    <span className={`${colors.text} truncate`}>
                                      {bin.manufacturer}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                                <div
                                  className={`flex items-center gap-1 text-xs ${colors.text} font-medium flex-shrink-0`}
                                >
                                  <Package size={10} />
                                  {bin.partsCount || 0}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                        <span className="text-xs font-mono text-gray-300 mb-2">
                          {row},{col}
                        </span>
                        {canEdit ? (
                          <span className="text-xs text-blue-500">
                            + Add Bin
                          </span>
                        ) : (
                          <span>Empty</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* Unpositioned Bins */}
        {unpositionedBins.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Unassigned Bins
              {canEdit && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (Click to edit and assign position)
                </span>
              )}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unpositionedBins.map((bin) => {
                const colors = getManufacturerColor(bin.manufacturer);
                return (
                  <div
                    key={bin.id}
                    onClick={() => {
                      if (canEdit) {
                        setEditingBin(bin);
                        setPrefilledPosition(null);
                        setShowModal(true);
                      } else {
                        setSelectedBin(bin);
                      }
                    }}
                    className={`${colors.bg} border ${colors.border} rounded-xl p-4 hover:shadow-md transition-all cursor-pointer`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 ${colors.icon} rounded-lg text-white`}
                        >
                          <Inbox size={14} />
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBin(bin);
                              setPrefilledPosition(null);
                              setShowModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Delete bin?"))
                                deleteMutation.mutate(bin.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {bin.name}
                    </h4>
                    {bin.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {bin.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span
                        className={
                          bin.manufacturer ? colors.text : "text-gray-400"
                        }
                      >
                        {bin.manufacturer || "No mfr"}
                      </span>
                      <span className={`${colors.text} font-medium`}>
                        {bin.partsCount || 0} parts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <BinModal
          onClose={() => {
            setShowModal(false);
            setEditingBin(null);
            setPrefilledPosition(null);
          }}
          onSave={(data) => saveMutation.mutate(data)}
          onDelete={(id) => deleteMutation.mutate(id)}
          initialData={editingBin}
          prefilledPosition={prefilledPosition}
          isDeleting={deleteMutation.isPending}
        />
      )}

      {selectedBin && (
        <BinPartsModal
          bin={selectedBin}
          parts={partsData?.parts || []}
          onClose={() => setSelectedBin(null)}
        />
      )}
    </div>
  );
}

function BinModal({
  onClose,
  onSave,
  onDelete,
  initialData,
  prefilledPosition,
  isDeleting,
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [manufacturer, setManufacturer] = useState(
    initialData?.manufacturer || "",
  );
  const [gridRow, setGridRow] = useState(
    prefilledPosition
      ? String(prefilledPosition.row)
      : initialData?.grid_row
        ? String(initialData.grid_row)
        : "",
  );
  const [gridCol, setGridCol] = useState(
    prefilledPosition
      ? String(prefilledPosition.col)
      : initialData?.grid_col
        ? String(initialData.grid_col)
        : "",
  );

  const manufacturers = Object.keys(MANUFACTURER_COLORS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {initialData ? "Edit Bin" : "Create Bin"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Bin Name / Code
            </label>
            <input
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. A-101 or North Shelf"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Description (Optional)
            </label>
            <textarea
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white h-24 resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specific location details..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Manufacturer (for color coding)
            </label>
            <select
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
            >
              <option value="">None</option>
              {manufacturers.map((mfr) => (
                <option key={mfr} value={mfr}>
                  {mfr}
                </option>
              ))}
            </select>
            {manufacturer && (
              <div className="flex items-center gap-2 mt-2">
                <div
                  className={`w-4 h-4 rounded ${getManufacturerColor(manufacturer).icon}`}
                ></div>
                <span className="text-xs text-gray-500">
                  Bin will be {manufacturer} color
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Shelf Position {prefilledPosition && "(Pre-selected)"}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Row</label>
                <select
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  value={gridRow}
                  onChange={(e) => setGridRow(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  <option value="1">Row 1</option>
                  <option value="2">Row 2</option>
                  <option value="3">Row 3</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Column
                </label>
                <select
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  value={gridCol}
                  onChange={(e) => setGridCol(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  <option value="1">Column 1</option>
                  <option value="2">Column 2</option>
                </select>
              </div>
            </div>
            {gridRow && gridCol && (
              <p className="text-xs text-gray-500 mt-1">
                Will be placed at Row {gridRow}, Column {gridCol}
              </p>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div>
            {initialData && onDelete && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Delete "${initialData.name}"? This cannot be undone.`,
                    )
                  ) {
                    onDelete(initialData.id);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Bin"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!name) return toast.error("Name is required");
                onSave({
                  name,
                  description,
                  manufacturer,
                  grid_row: gridRow ? parseInt(gridRow) : null,
                  grid_col: gridCol ? parseInt(gridCol) : null,
                });
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700"
            >
              {initialData ? "Save Changes" : "Create Bin"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BinPartsModal({ bin, parts, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{bin.name}</h3>
            {bin.description && (
              <p className="text-sm text-gray-500 mt-1">{bin.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {parts.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Inbox size={48} className="mx-auto mb-3 text-gray-300" />
              <p>No parts stored in this bin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {parts.map((part) => (
                <div
                  key={part.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {part.part_number}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">
                          Qty: {part.quantity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{part.part_name}</p>
                      {part.compatible_models?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {part.compatible_models
                            .slice(0, 3)
                            .map((model, i) => (
                              <span
                                key={i}
                                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                              >
                                {model}
                              </span>
                            ))}
                          {part.compatible_models.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{part.compatible_models.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <a
                      href={`/inventory?search=${encodeURIComponent(part.part_number)}`}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      onClick={onClose}
                    >
                      View →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {parts.length} part{parts.length !== 1 ? "s" : ""} in this bin
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full font-semibold hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
