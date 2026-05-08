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
            "radial-gradient(circle at 30% 30%, rgba(250,204,21,0.95), rgba(15,23,42,1) 70%)",
          color: "#020617",
          fontSize: 80,
          fontWeight: 800,
          borderRadius: 42,
        }}
      >
        N
      </div>
    ),
    size,
  );
}
