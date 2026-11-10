import QRCode from "qrcode";
import type { Env } from "../config/env.js";

export async function buildOrderQr(orderId: string, env: Env) {
  const qrUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/o/${orderId}`;
  const qrPngBase64 = await QRCode.toDataURL(qrUrl, {
    type: "image/png",
    margin: 1,
    width: 280,
  }).then((dataUrl) => dataUrl.replace(/^data:image\/png;base64,/, ""));
  return { qrUrl, qrPngBase64 };
}
