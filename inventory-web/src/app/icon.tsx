import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 192,
  height: 192,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, rgba(245,158,11,1) 0%, rgba(15,23,42,1) 58%, rgba(14,116,144,1) 100%)",
          color: "#020617",
          fontSize: 88,
          fontWeight: 800,
          borderRadius: 32,
        }}
      >
        N
      </div>
    ),
    size,
  );
}
