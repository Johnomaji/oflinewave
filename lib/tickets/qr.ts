import "server-only";
import QRCode from "qrcode";

const options = {
  errorCorrectionLevel: "M" as const,
  margin: 1,
  width: 480,
  color: { dark: "#0A0A0A", light: "#FFFFFF" },
};

export function qrPng(token: string) {
  return QRCode.toBuffer(token, options);
}

export function qrDataUrl(token: string) {
  return QRCode.toDataURL(token, options);
}

export function qrSvg(token: string) {
  return QRCode.toString(token, { ...options, type: "svg" });
}
