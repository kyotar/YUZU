import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5D84A", borderRadius: 7 }}>
        <svg viewBox="0 0 62 50" width="22" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30.5 17L43 0H61L38.8 28.4V47.7H23.3V28.6L0.1 0H18.1L30.5 17Z" fill="#1A1A30"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
