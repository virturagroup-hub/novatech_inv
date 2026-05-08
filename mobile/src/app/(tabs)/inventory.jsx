import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Search, Package, AlertCircle, Filter } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: partsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["parts", search, filterManufacturer],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        manufacturer: filterManufacturer,
      });
      const res = await fetch(`/api/parts?${params}`);
      const data = await res.json();
      return data;
    },
  });

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: () => fetch("/api/models").then((r) => r.json()),
  });

  const parts = partsData?.parts || [];
  const manufacturers = ["Canon", "HP", "Riso", "Sharp", "Konica Minolta"];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#111827" }}>
            Inventory
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#EFF6FF",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
              }}
            >
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: "#2563EB" }}
              >
                {parts.length} parts
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              style={{
                backgroundColor: showFilters ? "#EFF6FF" : "#F3F4F6",
                padding: 8,
                borderRadius: 12,
              }}
            >
              <Filter size={20} color={showFilters ? "#2563EB" : "#6B7280"} />
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#F3F4F6",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          <Search size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search parts..."
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, fontSize: 14, color: "#111827" }}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {showFilters && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: "#6B7280",
                textTransform: "uppercase",
              }}
            >
              Manufacturer
            </Text>
            <View
              style={{
                backgroundColor: "#F3F4F6",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <TouchableOpacity
                onPress={() => setFilterManufacturer("")}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor:
                    filterManufacturer === "" ? "#EFF6FF" : "transparent",
                  borderBottomWidth: 1,
                  borderBottomColor: "#E5E7EB",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: filterManufacturer === "" ? "600" : "400",
                    color: filterManufacturer === "" ? "#2563EB" : "#374151",
                  }}
                >
                  All Manufacturers
                </Text>
              </TouchableOpacity>
              {manufacturers.map((mfr) => (
                <TouchableOpacity
                  key={mfr}
                  onPress={() => setFilterManufacturer(mfr)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor:
                      filterManufacturer === mfr ? "#EFF6FF" : "transparent",
                    borderBottomWidth: 1,
                    borderBottomColor: "#E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: filterManufacturer === mfr ? "600" : "400",
                      color: filterManufacturer === mfr ? "#2563EB" : "#374151",
                    }}
                  >
                    {mfr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Parts List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {parts.map((part) => (
          <View
            key={part.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              overflow: "hidden",
            }}
          >
            <View style={{ padding: 16, gap: 12 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: "#111827",
                      }}
                    >
                      {part.part_number}
                    </Text>
                    {part.flagged && <AlertCircle size={16} color="#F97316" />}
                  </View>
                  <Text style={{ fontSize: 14, color: "#6B7280" }}>
                    {part.part_name}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: "#F3F4F6",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    Qty: {part.quantity}
                  </Text>
                </View>
              </View>

              {/* Details */}
              <View style={{ gap: 8 }}>
                {part.bin_name && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Package size={14} color="#9CA3AF" />
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>
                      <Text style={{ fontWeight: "600" }}>Bin:</Text>{" "}
                      {part.bin_name}
                    </Text>
                  </View>
                )}

                {part.compatible_models?.length > 0 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "#9CA3AF",
                        marginBottom: 4,
                      }}
                    >
                      COMPATIBLE MODELS
                    </Text>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}
                    >
                      {part.compatible_models.map((model, i) => (
                        <View
                          key={i}
                          style={{
                            backgroundColor: "#EFF6FF",
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
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
              </View>
            </View>
          </View>
        ))}

        {parts.length === 0 && !isLoading && (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <Package size={48} color="#D1D5DB" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#6B7280",
                marginTop: 12,
              }}
            >
              No parts found
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 4 }}>
              Try a different search
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
