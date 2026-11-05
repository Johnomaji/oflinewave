import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDateTime } from "@/lib/dates";
import { tokens } from "@/lib/tokens";
import { qrDataUrl } from "./qr";

const c = tokens.colors;

const styles = StyleSheet.create({
  page: { backgroundColor: c.black, color: c.white, padding: 36, fontFamily: "Helvetica" },
  brand: { height: 34, width: 115, marginBottom: 24 },
  card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  band: { backgroundColor: c.orange, paddingVertical: 18, paddingHorizontal: 24 },
  bandLabel: { fontSize: 9, color: c.black, letterSpacing: 2 },
  title: { fontSize: 26, fontFamily: "Helvetica-Bold", color: c.black, marginTop: 4 },
  body: { padding: 24, flexDirection: "row", gap: 24 },
  details: { flex: 1, gap: 14 },
  label: { fontSize: 8, color: c.muted, letterSpacing: 1.5, marginBottom: 3 },
  value: { fontSize: 12 },
  qrWrap: { backgroundColor: c.white, padding: 10, borderRadius: 12, alignItems: "center" },
  qr: { width: 180, height: 180 },
  code: { fontSize: 11, color: c.black, fontFamily: "Courier-Bold", marginTop: 6, letterSpacing: 2 },
  footer: { marginTop: 24, fontSize: 9, color: c.muted, lineHeight: 1.5 },
});

export type PdfTicket = {
  code: string;
  qrToken: string;
  holderName: string;
  tierName: string;
  admits: number;
  eventTitle: string;
  startsAt: Date;
  venueName: string;
  venueAddress: string;
  orderReference: string;
  /** e.g. "2 × Parking"; shown once per order */
  addOns?: string[];
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export async function renderTicketsPdf(tickets: PdfTicket[]) {
  const [qrs, logo] = await Promise.all([
    Promise.all(tickets.map((t) => qrDataUrl(t.qrToken))),
    readFile(path.join(process.cwd(), "public", "brand", "logo.png")),
  ]);
  return renderToBuffer(
    <Document title="Oflinewave tickets" author="Oflinewave">
      {tickets.map((t, i) => (
        <Page key={t.code} size="A5" style={styles.page}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image style={styles.brand} src={{ data: logo, format: "png" }} />
          <View style={styles.card}>
            <View style={styles.band}>
              <Text style={styles.bandLabel}>
                {t.tierName.toUpperCase()}
                {t.admits > 1 ? ` · ADMITS ${t.admits}` : ""}
              </Text>
              <Text style={styles.title}>{t.eventTitle}</Text>
            </View>
            <View style={styles.body}>
              <View style={styles.details}>
                <Field label="Name" value={t.holderName} />
                <Field label="When" value={formatDateTime(t.startsAt)} />
                <Field label="Where" value={`${t.venueName}\n${t.venueAddress}`} />
                <Field label="Order" value={t.orderReference} />
                {i === 0 && t.addOns && t.addOns.length > 0 && <Field label="Add-ons" value={t.addOns.join("\n")} />}
              </View>
              <View style={styles.qrWrap}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                <Image style={styles.qr} src={qrs[i]} />
                <Text style={styles.code}>{t.code}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.footer}>
            One scan per ticket. Don&apos;t share screenshots, the first scan wins.{"\n"}
            Ticket {i + 1} of {tickets.length}.
          </Text>
        </Page>
      ))}
    </Document>,
  );
}
