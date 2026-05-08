import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
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
            "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.95), rgba(3,7,18,1) 72%)",
          color: "#ffffff",
          fontSize: 76,
          fontWeight: 800,
          borderRadius: 42,
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.12)",
        }}
      >
        N
      </div>
    ),
    size,
  );
}
