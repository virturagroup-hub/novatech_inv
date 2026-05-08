import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Plus, Minus, Save, RotateCcw } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function QuickAdjustScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [adjustments, setAdjustments] = useState({});

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const res = await fetch("/api/parts");
      return res.json();
    },
  });

  const batchUpdateMutation = useMutation({
    mutationFn: async (updates) => {
      const promises = updates.map(({ partId, newQuantity }) =>
        fetch(`/api/parts/${partId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: newQuantity }),
        }),
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      Alert.alert("Success", "All quantities updated");
      setAdjustments({});
    },
  });

  const adjustQuantity = (partId, currentQty, delta) => {
    setAdjustments((prev) => {
      const current = prev[partId] || 0;
      const newDelta = current + delta;
      const newTotal = currentQty + newDelta;

      if (newTotal < 0) return prev;

      if (newDelta === 0) {
        const updated = { ...prev };
        delete updated[partId];
        return updated;
      }

      return { ...prev, [partId]: newDelta };
    });
  };

  const handleSave = () => {
    const updates = Object.entries(adjustments).map(([partId, delta]) => {
      const part = parts.find((p) => p.id === parseInt(partId));
      return {
        partId: parseInt(partId),
        newQuantity: part.quantity + delta,
      };
    });

    if (updates.length === 0) {
      Alert.alert("No Changes", "Make some adjustments first");
      return;
    }

    batchUpdateMutation.mutate(updates);
  };

  const partsWithAdjustments = parts.filter((p) => adjustments[p.id]);
  const totalChanges = Object.keys(adjustments).length;

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: "#111827",
            marginBottom: 8,
          }}
        >
          Quick Adjust
        </Text>
        <Text style={{ fontSize: 14, color: "#6B7280" }}>
          Batch update part quantities
        </Text>
      </View>

      {/* Actions Bar */}
      {totalChanges > 0 && (
        <View
          style={{
            backgroundColor: "#EFF6FF",
            borderBottomWidth: 1,
            borderBottomColor: "#BFDBFE",
            paddingHorizontal: 20,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#1E40AF" }}>
              {totalChanges} part{totalChanges !== 1 ? "s" : ""} modified
            </Text>
            <Text style={{ fontSize: 12, color: "#60A5FA", marginTop: 2 }}>
              Ready to save
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setAdjustments({})}
              style={{
                backgroundColor: "#fff",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#BFDBFE",
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: "#2563EB" }}
              >
                Reset
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={batchUpdateMutation.isPending}
              style={{
                backgroundColor: "#2563EB",
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {batchUpdateMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Save size={16} color="#fff" />
                  <Text
                    style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}
                  >
                    Save All
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        {parts.map((part) => {
          const delta = adjustments[part.id] || 0;
          const newQty = part.quantity + delta;
          const hasChange = delta !== 0;

          return (
            <View
              key={part.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                borderWidth: 2,
                borderColor: hasChange ? "#2563EB" : "#E5E7EB",
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#111827",
                      marginBottom: 2,
                    }}
                  >
                    {part.part_number}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#6B7280" }}>
                    {part.part_name}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: "#9CA3AF",
                      marginBottom: 4,
                    }}
                  >
                    CURRENT
                  </Text>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {part.quantity}
                  </Text>
                </View>

                {hasChange && (
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "#9CA3AF",
                        marginBottom: 4,
                      }}
                    >
                      CHANGE
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "700",
                        color: delta > 0 ? "#10B981" : "#EF4444",
                      }}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </Text>
                  </View>
                )}

                {hasChange && (
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "#9CA3AF",
                        marginBottom: 4,
                      }}
                    >
                      NEW
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "700",
                        color: "#2563EB",
                      }}
                    >
                      {newQty}
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => adjustQuantity(part.id, part.quantity, -1)}
                  style={{
                    flex: 1,
                    backgroundColor: "#FEE2E2",
                    paddingVertical: 12,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Minus size={18} color="#DC2626" />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#DC2626",
                    }}
                  >
                    -1
                  </Text>
                </TouchableOpacity>

                {hasChange && (
                  <TouchableOpacity
                    onPress={() =>
                      setAdjustments((prev) => {
                        const updated = { ...prev };
                        delete updated[part.id];
                        return updated;
                      })
                    }
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <RotateCcw size={18} color="#6B7280" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => adjustQuantity(part.id, part.quantity, 1)}
                  style={{
                    flex: 1,
                    backgroundColor: "#D1FAE5",
                    paddingVertical: 12,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={18} color="#059669" />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#059669",
                    }}
                  >
                    +1
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {parts.length === 0 && !isLoading && (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#6B7280" }}>
              No parts available
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
