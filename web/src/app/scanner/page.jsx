"use client";

import { useState, useRef, useEffect } from "react";
import {
  QrCode,
  Camera,
  Plus,
  Minus,
  Package,
  Search,
  X,
  StopCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useUser from "@/utils/useUser";

export default function QRScannerPage() {
  const { data: user, loading: userLoading } = useUser();
  const [scannedData, setScannedData] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef(null);
  const queryClient = useQueryClient();

  // Check for URL parameter on load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const partNumber = urlParams.get("part");
      if (partNumber) {
        console.log("📍 Auto-loading part from URL:", partNumber);
        setScannedData({ partNumber });
      }
    }
  }, []);

  // Search parts with partial matching
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["parts-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const res = await fetch(
        `/api/parts?search=${encodeURIComponent(searchQuery)}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      return data.parts || [];
    },
    enabled: showManualSearch && searchQuery.length >= 2,
  });

  // Fetch part by part_number when tag is scanned
  const {
    data: partData,
    isLoading: partLoading,
    error: partError,
  } = useQuery({
    queryKey: ["part-by-number", scannedData?.partNumber],
    queryFn: async () => {
      console.log("🔍 Searching for part number:", scannedData.partNumber);
      const res = await fetch(
        `/api/parts?search=${encodeURIComponent(scannedData.partNumber)}`,
      );
      if (!res.ok) throw new Error("Part not found");
      const data = await res.json();

      const exactMatch = data.parts?.find(
        (p) => p.part_number === scannedData.partNumber,
      );

      if (!exactMatch) {
        console.warn("⚠️ No exact match found for:", scannedData.partNumber);
        toast.error(`Part ${scannedData.partNumber} not found in database`);
        throw new Error(`No part found with number: ${scannedData.partNumber}`);
      }

      console.log("✅ Found part:", exactMatch);
      return exactMatch;
    },
    enabled: !!scannedData?.partNumber,
    retry: false,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ action }) => {
      if (!partData?.id) {
        throw new Error("Part ID not found");
      }

      const newQty =
        action === "add"
          ? (partData.quantity || 0) + quantity
          : (partData.quantity || 0) - quantity;

      const res = await fetch(`/api/parts/${partData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update quantity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["part-by-number", scannedData?.partNumber],
      });
      toast.success("Quantity updated");
      setQuantity(1);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update quantity");
    },
  });

  const startLiveScanner = async () => {
    try {
      setIsScanning(true);

      // Load html5-qrcode library if not already loaded
      if (!window.Html5Qrcode) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const html5QrCode = new window.Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          console.log("🎉 QR CODE SCANNED:", decodedText);

          // Check if it's a URL
          if (decodedText.includes("/scanner?part=")) {
            try {
              const url = new URL(decodedText);
              const partNumber = url.searchParams.get("part");
              if (partNumber) {
                setScannedData({ partNumber });
                toast.success(`Scanned: ${partNumber}`);
                stopScanner();
              }
            } catch (err) {
              // Fallback to direct part number
              setScannedData({ partNumber: decodedText.trim() });
              toast.success(`Scanned: ${decodedText.trim()}`);
              stopScanner();
            }
          } else {
            // Treat as direct part number
            setScannedData({ partNumber: decodedText.trim() });
            toast.success(`Scanned: ${decodedText.trim()}`);
            stopScanner();
          }
        },
        (errorMessage) => {
          // Silent - just keep scanning
        },
      );
    } catch (error) {
      console.error("Error starting scanner:", error);
      toast.error("Failed to start camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setIsScanning(false);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const handleManualSearch = () => {
    setShowManualSearch(true);
    setSearchQuery("");
  };

  const selectPart = (partId) => {
    fetch(`/api/parts/${partId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.part) {
          setScannedData({ partNumber: data.part.part_number });
        }
      })
      .catch((err) => {
        console.error("Error fetching part:", err);
        toast.error("Failed to load part");
      });
    setShowManualSearch(false);
    setSearchQuery("");
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const isAuthenticated = !!user;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">QR Scanner</h1>
          <a href="/" className="text-sm text-blue-600 font-semibold">
            Dashboard
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Scan QR codes to view part information
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Live Scanner Section */}
        {!scannedData && !isScanning && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="aspect-square bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <div className="text-center">
                <QrCode size={120} className="text-blue-300 mx-auto mb-4" />
                <p className="text-sm text-gray-600 font-medium">
                  Tap below to start live scanning
                </p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <button
                onClick={startLiveScanner}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Camera size={18} />
                Start Live Scanner
              </button>

              <button
                onClick={handleManualSearch}
                className="w-full bg-gray-100 text-gray-700 rounded-lg px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
              >
                <Search size={18} />
                Search Part Manually
              </button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900 font-semibold mb-1">
                  💡 Scanning Tips:
                </p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Grant camera permission when prompted</li>
                  <li>• Ensure good lighting on the QR code</li>
                  <li>• Hold steady and center the code</li>
                  <li>• Scanner will auto-detect QR codes</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Active Scanner View */}
        {isScanning && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div id="qr-reader" className="w-full"></div>

            <div className="p-4 space-y-3">
              <button
                onClick={stopScanner}
                className="w-full bg-red-600 text-white rounded-lg px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
              >
                <StopCircle size={18} />
                Stop Scanner
              </button>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-xs text-green-900 font-semibold">
                  📷 Scanner is active - point camera at QR code
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scanned Part Details */}
        {scannedData && partData && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {partData.part_name}
                </h2>
                <p className="text-sm text-gray-500">#{partData.part_number}</p>
              </div>
              <button
                onClick={() => {
                  setScannedData(null);
                  setQuantity(1);
                }}
                className="text-sm text-blue-600 font-semibold"
              >
                Scan New
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Current Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {partData.quantity || 0}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Bin Location</p>
                <p className="text-sm font-semibold text-gray-900">
                  {partData.bin_name || "No bin"}
                </p>
              </div>
            </div>

            {/* Compatible Models */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Package size={16} />
                <span className="font-semibold">Compatible Models:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {partData.compatible_models &&
                partData.compatible_models.length > 0 ? (
                  partData.compatible_models.map((model, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                    >
                      {model}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">
                    No models specified
                  </span>
                )}
              </div>
            </div>

            {/* Quantity Adjustment - Only for authenticated users */}
            {isAuthenticated ? (
              <>
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700">
                    Adjust Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <Minus size={18} />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      updateQuantityMutation.mutate({ action: "add" })
                    }
                    disabled={updateQuantityMutation.isPending}
                    className="bg-green-600 text-white rounded-lg px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Plus size={18} />
                    Add {quantity}
                  </button>
                  <button
                    onClick={() =>
                      updateQuantityMutation.mutate({ action: "remove" })
                    }
                    disabled={
                      updateQuantityMutation.isPending ||
                      (partData.quantity || 0) < quantity
                    }
                    className="bg-red-600 text-white rounded-lg px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Minus size={18} />
                    Remove {quantity}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-sm font-semibold text-yellow-900 mb-1">
                  Sign in to adjust quantities
                </p>
                <a
                  href="/account/signin"
                  className="text-sm text-yellow-700 underline"
                >
                  Sign in here
                </a>
              </div>
            )}
          </div>
        )}

        {scannedData && partLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-600">Loading part details...</p>
          </div>
        )}

        {scannedData && partError && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X size={32} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Part Not Found
              </h3>
              <p className="text-sm text-gray-600 mb-1">
                No part found with number:
              </p>
              <p className="text-sm font-mono bg-gray-100 px-3 py-2 rounded inline-block text-gray-900">
                {scannedData.partNumber}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setScannedData(null);
                  startLiveScanner();
                }}
                className="bg-blue-600 text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Scan Again
              </button>
              <button
                onClick={handleManualSearch}
                className="bg-gray-100 text-gray-700 rounded-lg px-4 py-3 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Search Manually
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Search Modal */}
      {showManualSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Search Parts</h2>
              <button
                onClick={() => {
                  setShowManualSearch(false);
                  setSearchQuery("");
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type part number or name..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {searchQuery.length < 2 ? (
                <p className="text-center text-gray-500 text-sm py-8">
                  Type at least 2 characters to search
                </p>
              ) : searchLoading ? (
                <p className="text-center text-gray-500 text-sm py-8">
                  Searching...
                </p>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((part) => (
                    <button
                      key={part.id}
                      onClick={() => selectPart(part.id)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-semibold text-gray-900">
                        {part.part_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        #{part.part_number}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Stock: {part.quantity || 0} • Bin:{" "}
                        {part.bin_name || "No bin"}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">
                  No parts found matching "{searchQuery}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
