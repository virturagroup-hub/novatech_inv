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
            "linear-gradient(135deg, rgba(4,120,87,1) 0%, rgba(8,145,178,1) 56%, rgba(15,23,42,1) 100%)",
          color: "#ffffff",
          fontSize: 86,
          fontWeight: 800,
          borderRadius: 32,
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.12)",
        }}
      >
        N
      </div>
    ),
    size,
  );
}
