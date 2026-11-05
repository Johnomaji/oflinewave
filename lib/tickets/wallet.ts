import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { ImageResponse } from "next/og";
import { createElement } from "react";
import { formatDateTime } from "@/lib/dates";
import { tokens } from "@/lib/tokens";
import { appUrl } from "@/lib/utils";
import { qrFingerprint } from "./token";

/**
 * Add-to-wallet. Both providers are off unless their credentials are set:
 *  - Google Wallet: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL, GOOGLE_WALLET_PRIVATE_KEY
 *  - Apple Wallet:  APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT, APPLE_PASS_KEY, APPLE_WWDR_CERT
 *    (PEM contents; base64-encoding the PEM is accepted too), optional APPLE_PASS_KEY_PASSPHRASE
 */

export type WalletTicket = {
  id: string;
  code: string;
  qrToken: string;
  holderName: string;
  tierName: string;
  admits: number;
  event: { id: string; slug: string; title: string; startsAt: Date; endsAt: Date | null; venue: { name: string; address: string } };
  orderReference: string;
};

const c = tokens.colors;

function pem(value: string | undefined) {
  if (!value) return undefined;
  const v = value.trim();
  return v.startsWith("-----") ? v.replace(/\\n/g, "\n") : Buffer.from(v, "base64").toString("utf8");
}

export const walletConfig = {
  google: () =>
    Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_WALLET_PRIVATE_KEY),
  apple: () =>
    Boolean(
      process.env.APPLE_PASS_TYPE_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_PASS_CERT &&
        process.env.APPLE_PASS_KEY &&
        process.env.APPLE_WWDR_CERT,
    ),
};

// ─── Google Wallet ──────────────────────────────────────────────────────────

/** "Save to Google Wallet" URL. Class + object travel inside the signed JWT, no API calls needed. */
export async function googleWalletUrl(t: WalletTicket) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const key = await importPKCS8(pem(process.env.GOOGLE_WALLET_PRIVATE_KEY)!, "RS256");
  const classId = `${issuer}.oflinewave-${t.event.id}`;
  // The fingerprint makes a re-issued (transferred) ticket a new wallet object.
  const objectId = `${issuer}.${t.id}-${qrFingerprint(t.qrToken).replace(/[^A-Za-z0-9_-]/g, "")}`;
  const text = (value: string) => ({ defaultValue: { language: "en-GB", value } });

  const payload = {
    eventTicketClasses: [
      {
        id: classId,
        issuerName: "Oflinewave",
        reviewStatus: "UNDER_REVIEW",
        eventName: text(t.event.title),
        venue: { name: text(t.event.venue.name), address: text(t.event.venue.address) },
        dateTime: { start: t.event.startsAt.toISOString(), end: t.event.endsAt?.toISOString() },
        hexBackgroundColor: c.black,
        logo: { sourceUri: { uri: appUrl("/icon-512.png") } },
      },
    ],
    eventTicketObjects: [
      {
        id: objectId,
        classId,
        state: "ACTIVE",
        ticketHolderName: t.holderName,
        ticketNumber: t.code,
        ticketType: text(t.admits > 1 ? `${t.tierName} · admits ${t.admits}` : t.tierName),
        barcode: { type: "QR_CODE", value: t.qrToken, alternateText: t.code },
        hexBackgroundColor: c.black,
      },
    ],
  };

  const jwt = await new SignJWT({ origins: [appUrl()], typ: "savetowallet", payload })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!)
    .setAudience("google")
    .setIssuedAt()
    .sign(key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

// ─── Apple Wallet ───────────────────────────────────────────────────────────

async function png(size: number, element: React.ReactElement) {
  const res = new ImageResponse(element, { width: size, height: size });
  return Buffer.from(await res.arrayBuffer());
}

function iconElement(size: number) {
  return createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: c.orange,
        color: c.black,
        fontSize: size * 0.62,
        fontWeight: 800,
        borderRadius: size * 0.22,
      },
    },
    "o",
  );
}

/** Builds a signed .pkpass for one ticket. */
export async function applePass(t: WalletTicket): Promise<Buffer> {
  const { PKPass } = await import("passkit-generator");

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    organizationName: "Oflinewave",
    description: `Ticket for ${t.event.title}`,
    serialNumber: `${t.id}-${qrFingerprint(t.qrToken)}`,
    logoText: "oflinewave",
    backgroundColor: "rgb(10,10,10)",
    foregroundColor: "rgb(255,255,255)",
    labelColor: "rgb(255,90,31)",
    relevantDate: t.event.startsAt.toISOString(),
    eventTicket: {},
  };

  const [icon, icon2x, logo, logo2x] = await Promise.all([png(29, iconElement(29)), png(58, iconElement(58)), png(50, iconElement(50)), png(100, iconElement(100))]);

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": icon,
      "icon@2x.png": icon2x,
      "logo.png": logo,
      "logo@2x.png": logo2x,
    },
    {
      wwdr: pem(process.env.APPLE_WWDR_CERT)!,
      signerCert: pem(process.env.APPLE_PASS_CERT)!,
      signerKey: pem(process.env.APPLE_PASS_KEY)!,
      signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    },
  );

  pass.primaryFields.push({ key: "event", label: "EVENT", value: t.event.title });
  pass.secondaryFields.push(
    { key: "name", label: "NAME", value: t.holderName },
    { key: "tier", label: "TICKET", value: t.admits > 1 ? `${t.tierName} ×${t.admits}` : t.tierName },
  );
  pass.auxiliaryFields.push(
    { key: "date", label: "WHEN", value: formatDateTime(t.event.startsAt) },
    { key: "venue", label: "WHERE", value: t.event.venue.name },
  );
  pass.backFields.push(
    { key: "address", label: "Address", value: t.event.venue.address },
    { key: "code", label: "Ticket code", value: t.code },
    { key: "order", label: "Order", value: t.orderReference },
    { key: "info", label: "Good to know", value: "One scan per ticket. The first scan wins." },
  );
  pass.setBarcodes({ format: "PKBarcodeFormatQR", message: t.qrToken, messageEncoding: "iso-8859-1", altText: t.code });

  return pass.getAsBuffer();
}
