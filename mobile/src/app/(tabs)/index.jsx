import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  X,
  QrCode,
  AlertCircle,
  Edit2,
  Printer,
  Plus,
  Minus,
} from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [adjustmentMode, setAdjustmentMode] = useState(false);
  const [quantityDelta, setQuantityDelta] = useState(0);
  const [torchOn, setTorchOn] = useState(false);

  const { data: bins = [] } = useQuery({
    queryKey: ["bins"],
    queryFn: () => fetch("/api/bins").then((r) => r.json()),
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ partId, newQuantity }) => {
      const res = await fetch(`/api/parts/${partId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      Alert.alert("Success", "Quantity updated");
      setAdjustmentMode(false);
      setQuantityDelta(0);
    },
  });

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const qrData = JSON.parse(data);

      // Fetch the full part details from server
      const res = await fetch(`/api/parts?search=${qrData.partNumber}`);
      const parts = await res.json();
      const part = parts.find((p) => p.part_number === qrData.partNumber);

      if (part) {
        setSelectedPart(part);
      } else {
        Alert.alert("Not Found", "Part not found in inventory");
        setScanned(false);
      }
    } catch (error) {
      Alert.alert("Error", "Invalid QR code format");
      setScanned(false);
    }
  };

  const handleQuickAdjust = () => {
    if (quantityDelta === 0) {
      Alert.alert("No Change", "Adjust the quantity first");
      return;
    }
    const newQuantity = Math.max(0, selectedPart.quantity + quantityDelta);
    updateQuantityMutation.mutate({ partId: selectedPart.id, newQuantity });
  };

  const closePart = () => {
    setSelectedPart(null);
    setScanned(false);
    setAdjustmentMode(false);
    setQuantityDelta(0);
  };

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
        <StatusBar style="dark" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F9FAFB",
          paddingTop: insets.top,
          padding: 24,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusBar style="dark" />
        <QrCode size={64} color="#9CA3AF" />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: "#111827",
            marginTop: 16,
          }}
        >
          Camera Access Required
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "#6B7280",
            textAlign: "center",
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          We need camera permission to scan QR codes on part tags
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            backgroundColor: "#2563EB",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
            Grant Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />

      {!selectedPart ? (
        <>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            enableTorch={torchOn}
            autofocus="on"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          >
            <View style={{ flex: 1, backgroundColor: "transparent" }}>
              {/* Top Overlay */}
              <View
                style={{
                  paddingTop: insets.top,
                  padding: 24,
                  backgroundColor: "rgba(0,0,0,0.6)",
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: "#fff",
                    textAlign: "center",
                  }}
                >
                  Scan Part Tag
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#E5E7EB",
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  Position QR code within the frame
                </Text>
              </View>

              {/* Center Frame */}
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 250,
                    height: 250,
                    borderWidth: 4,
                    borderColor: "#10B981",
                    borderRadius: 24,
                    backgroundColor: "transparent",
                  }}
                />
              </View>

              {/* Bottom Controls */}
              <View
                style={{
                  height: 120,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <TouchableOpacity
                  onPress={() => setTorchOn(!torchOn)}
                  style={{
                    backgroundColor: torchOn
                      ? "#FCD34D"
                      : "rgba(255,255,255,0.2)",
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 24,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderWidth: 2,
                    borderColor: torchOn ? "#FCD34D" : "#fff",
                  }}
                >
                  <Text
                    style={{
                      color: torchOn ? "#000" : "#fff",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {torchOn ? "🔦 Flash On" : "💡 Flash Off"}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    color: "#9CA3AF",
                    fontSize: 12,
                    marginTop: 12,
                  }}
                >
                  Tap to toggle flash for better scanning
                </Text>
              </View>
            </View>
          </CameraView>
        </>
      ) : (
        <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
          {/* Header */}
          <View
            style={{
              backgroundColor: "#2563EB",
              paddingTop: insets.top,
              paddingHorizontal: 24,
              paddingBottom: 32,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#fff" }}>
                Part Details
              </Text>
              <TouchableOpacity onPress={closePart} style={{ padding: 8 }}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 28, fontWeight: "700", color: "#fff" }}>
                {selectedPart.part_number}
              </Text>
              {selectedPart.flagged && (
                <AlertCircle size={20} color="#FFA500" />
              )}
            </View>
            <Text style={{ fontSize: 16, color: "#BFDBFE" }}>
              {selectedPart.part_name}
            </Text>
          </View>

          <View style={{ padding: 24, gap: 20 }}>
            {/* Quick Adjust Section */}
            {!adjustmentMode ? (
              <TouchableOpacity
                onPress={() => setAdjustmentMode(true)}
                style={{
                  backgroundColor: "#EFF6FF",
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                  borderRadius: 16,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#1E40AF",
                    }}
                  >
                    Quick Adjust Quantity
                  </Text>
                  <Text
                    style={{ fontSize: 12, color: "#60A5FA", marginTop: 4 }}
                  >
                    Update stock on the go
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: "#2563EB",
                    borderRadius: 12,
                    padding: 8,
                  }}
                >
                  <Edit2 size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  backgroundColor: "#F3F4F6",
                  borderRadius: 16,
                  padding: 20,
                  gap: 16,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    Adjust Quantity
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setAdjustmentMode(false);
                      setQuantityDelta(0);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#6B7280",
                        fontWeight: "600",
                      }}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 24,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setQuantityDelta((prev) => prev - 1)}
                    style={{
                      backgroundColor: "#fff",
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: "#E5E7EB",
                    }}
                  >
                    <Minus size={28} color="#EF4444" />
                  </TouchableOpacity>

                  <View style={{ alignItems: "center", minWidth: 120 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#6B7280",
                        marginBottom: 4,
                      }}
                    >
                      Current: {selectedPart.quantity}
                    </Text>
                    <Text
                      style={{
                        fontSize: 36,
                        fontWeight: "700",
                        color:
                          quantityDelta === 0
                            ? "#6B7280"
                            : quantityDelta > 0
                              ? "#10B981"
                              : "#EF4444",
                      }}
                    >
                      {quantityDelta > 0 ? "+" : ""}
                      {quantityDelta}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}
                    >
                      New: {Math.max(0, selectedPart.quantity + quantityDelta)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setQuantityDelta((prev) => prev + 1)}
                    style={{
                      backgroundColor: "#fff",
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: "#E5E7EB",
                    }}
                  >
                    <Plus size={28} color="#10B981" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleQuickAdjust}
                  disabled={
                    quantityDelta === 0 || updateQuantityMutation.isPending
                  }
                  style={{
                    backgroundColor:
                      quantityDelta === 0 ? "#D1D5DB" : "#2563EB",
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  {updateQuantityMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}
                    >
                      Save Change
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Part Information */}
            <View
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 16,
                padding: 20,
                gap: 16,
              }}
            >
              <InfoRow label="Part Number" value={selectedPart.part_number} />
              <InfoRow label="Part Name" value={selectedPart.part_name} />
              <InfoRow
                label="Quantity"
                value={selectedPart.quantity.toString()}
              />
              <InfoRow
                label="Storage Bin"
                value={selectedPart.bin_name || "Unassigned"}
              />
              <InfoRow
                label="In Date"
                value={new Date(selectedPart.in_date).toLocaleDateString()}
              />

              {selectedPart.compatible_models?.length > 0 && (
                <View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: "#6B7280",
                      marginBottom: 8,
                    }}
                  >
                    Compatible Models
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {selectedPart.compatible_models.map((model, i) => (
                      <View
                        key={i}
                        style={{
                          backgroundColor: "#EFF6FF",
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#2563EB",
                            fontWeight: "600",
                          }}
                        >
                          {model}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {selectedPart.notes && (
                <View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: "#6B7280",
                      marginBottom: 4,
                    }}
                  >
                    Notes
                  </Text>
                  <Text style={{ fontSize: 14, color: "#111827" }}>
                    {selectedPart.notes}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 2,
                  borderColor: "#2563EB",
                  paddingVertical: 14,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Printer size={20} color="#2563EB" />
                <Text
                  style={{ color: "#2563EB", fontSize: 16, fontWeight: "600" }}
                >
                  Reprint Tag
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={closePart}
                style={{
                  backgroundColor: "#F3F4F6",
                  paddingVertical: 14,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    color: "#6B7280",
                    fontSize: 16,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  Close & Scan Next
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
        {value}
      </Text>
    </View>
  );
}
