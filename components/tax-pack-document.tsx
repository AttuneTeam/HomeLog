"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  statusLabel,
  type QuestionnaireSection,
} from "@/lib/tax/questionnaire";
import type { Div43ItemClaim } from "@/lib/tax/div43";
import type { ScheduleLine } from "@/lib/tax/rental-schedule";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PackProperty {
  id: string;
  address: string;
  excludedReason: string | null;
  grossRent: number;
  incomeSource: "actual" | "accrued" | null;
  incomeCrossCheck: { actual: number | null; accrued: number | null } | null;
  materialDivergence: boolean;
  deductions: ScheduleLine[];
  totalDeductions: number;
  netResult: number;
  isLoss: boolean;
  apportionment: {
    ownershipPct: number;
    deductibleDayPct: number;
    assumedSoleOwnership: boolean;
    assumedFullYear: boolean;
  };
  div43Items: Div43ItemClaim[];
  div43Total: number;
  div40Annual: number | null;
  depreciationMethod: string | null;
  qsFirm: string | null;
  costBase: {
    purchasePrice: number;
    stampDuty: number;
    stampDutySource: string | null;
    initialRepairs: number;
    capitalImprovements: number;
    total: number;
  };
}

export interface PackData {
  taxpayerName: string;
  financialYearLabel: string;
  fyStartDate: string;
  fyEndDate: string;
  generatedAt: string;
  properties: PackProperty[];
  portfolio: {
    totalGrossRent: number;
    deductionTotals: ScheduleLine[];
    totalDeductions: number;
    netResult: number;
    isLoss: boolean;
    propertiesAtLoss: number;
    totalCostBase: number;
  };
  excluded: Array<{ address: string; reason: string }>;
  questionnaire: QuestionnaireSection[];
  /** Anything that could not be included, surfaced rather than dropped. */
  omissions: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
  },
  coverTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  coverSub: { fontSize: 13, color: "#555555", marginBottom: 28 },
  coverMeta: { fontSize: 10, color: "#333333", marginBottom: 3 },
  h1: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
  },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d4",
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  label: { color: "#444444", flex: 1 },
  value: { fontFamily: "Helvetica-Bold", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  note: { fontSize: 7.5, color: "#666666", marginTop: 3, lineHeight: 1.4 },
  th: { flexDirection: "row", backgroundColor: "#f0f0f0", paddingVertical: 3, paddingHorizontal: 3 },
  tr: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 3, borderBottomWidth: 1, borderBottomColor: "#eeeeee" },
  thTxt: { fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  tdTxt: { fontSize: 7.5 },
  warn: {
    padding: 7,
    marginTop: 6,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  warnTxt: { fontSize: 7.5, color: "#92400e", lineHeight: 1.4 },
  qItem: { marginBottom: 7 },
  qQuestion: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  qAnswer: { fontSize: 8, color: "#333333", marginTop: 1.5, lineHeight: 1.4 },
  qStatus: { fontSize: 7, color: "#777777", marginTop: 1.5 },
  disclaimer: {
    marginTop: 18,
    padding: 9,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  disclaimerTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 3, color: "#92400e" },
  disclaimerTxt: { fontSize: 7.5, color: "#92400e", lineHeight: 1.5 },
  pageNo: { position: "absolute", bottom: 22, right: 44, fontSize: 7.5, color: "#999999" },
});

function Footer() {
  return (
    <Text
      style={S.pageNo}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      fixed
    />
  );
}

// ─── Document ────────────────────────────────────────────────────────────────

export function TaxPackDocument({ data }: { data: PackData }) {
  const rental = data.properties.filter((p) => !p.excludedReason);

  return (
    <Document>
      {/* Cover + portfolio summary */}
      <Page size="A4" style={S.page}>
        <Text style={S.coverTitle}>Investment Property Tax Pack</Text>
        <Text style={S.coverSub}>Financial year {data.financialYearLabel}</Text>
        <Text style={S.coverMeta}>Prepared for: {data.taxpayerName}</Text>
        <Text style={S.coverMeta}>
          Period: {fmtDate(data.fyStartDate)} to {fmtDate(data.fyEndDate)}
        </Text>
        <Text style={S.coverMeta}>Generated: {data.generatedAt}</Text>
        <Text style={[S.coverMeta, { marginTop: 14 }]}>
          {rental.length} rental{" "}
          {rental.length === 1 ? "property" : "properties"}
          {data.excluded.length > 0
            ? `, ${data.excluded.length} excluded`
            : ""}
        </Text>

        <View style={{ marginTop: 26 }}>
          <Text style={S.h1}>Portfolio summary</Text>
          <View style={S.row}>
            <Text style={S.label}>Gross rental income</Text>
            <Text style={S.value}>{fmt(data.portfolio.totalGrossRent)}</Text>
          </View>
          {data.portfolio.deductionTotals.map((line) => (
            <View style={S.row} key={line.key}>
              <Text style={S.label}>{line.label}</Text>
              <Text style={S.value}>({fmt(line.amount)})</Text>
            </View>
          ))}
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Total deductions</Text>
            <Text style={S.totalValue}>
              ({fmt(data.portfolio.totalDeductions)})
            </Text>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>
              Net rental {data.portfolio.isLoss ? "loss" : "income"}
            </Text>
            <Text style={S.totalValue}>
              {fmt(Math.abs(data.portfolio.netResult))}
            </Text>
          </View>
          {data.portfolio.propertiesAtLoss > 0 && (
            <Text style={S.note}>
              {data.portfolio.propertiesAtLoss} of {rental.length}{" "}
              {rental.length === 1 ? "property" : "properties"} ran at a loss
              individually. Per-property schedules follow.
            </Text>
          )}
          <Text style={S.note}>
            Totals are the sum of the per-property schedules in this pack. All
            figures are the taxpayer&apos;s apportioned share.
          </Text>
        </View>

        {data.excluded.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={S.h2}>Excluded from rental reporting</Text>
            {data.excluded.map((e) => (
              <View style={S.row} key={e.address}>
                <Text style={S.label}>{e.address}</Text>
                <Text style={[S.tdTxt, { color: "#666666" }]}>{e.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {data.omissions.length > 0 && (
          <View style={S.warn}>
            <Text style={[S.disclaimerTitle]}>Not included in this pack</Text>
            {data.omissions.map((o, i) => (
              <Text style={S.warnTxt} key={i}>
                • {o}
              </Text>
            ))}
          </View>
        )}
        <Footer />
      </Page>

      {/* One page per property */}
      {rental.map((property) => (
        <Page size="A4" style={S.page} key={property.id}>
          <Text style={S.h1}>{property.address}</Text>
          <Text style={[S.note, { marginTop: -4, marginBottom: 8 }]}>
            Rental schedule for {data.financialYearLabel}
          </Text>

          <View style={S.row}>
            <Text style={S.label}>
              Gross rental income
              {property.incomeSource === "accrued"
                ? " (estimated from tenancy terms)"
                : " (from recorded payments)"}
            </Text>
            <Text style={S.value}>{fmt(property.grossRent)}</Text>
          </View>

          {property.deductions.map((line) => (
            <View style={S.row} key={line.key}>
              <Text style={S.label}>{line.label}</Text>
              <Text style={S.value}>({fmt(line.amount)})</Text>
            </View>
          ))}

          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Total deductions</Text>
            <Text style={S.totalValue}>({fmt(property.totalDeductions)})</Text>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>
              Net rental {property.isLoss ? "loss" : "income"}
            </Text>
            <Text style={S.totalValue}>{fmt(Math.abs(property.netResult))}</Text>
          </View>

          {(property.apportionment.ownershipPct < 100 ||
            property.apportionment.deductibleDayPct < 100) && (
            <Text style={S.note}>
              Apportioned to your share: {property.apportionment.ownershipPct.toFixed(0)}%
              ownership
              {property.apportionment.assumedSoleOwnership ? " (assumed)" : ""}
              {property.apportionment.deductibleDayPct < 100
                ? `; deductions further apportioned to ${property.apportionment.deductibleDayPct.toFixed(0)}% of the year available for rent${property.apportionment.assumedFullYear ? " (assumed)" : ""}`
                : ""}
              . Income is apportioned by ownership only.
            </Text>
          )}

          {property.materialDivergence && property.incomeCrossCheck && (
            <View style={S.warn}>
              <Text style={S.warnTxt}>
                Recorded payments total{" "}
                {fmt(property.incomeCrossCheck.actual)}, but tenancy terms
                accrue {fmt(property.incomeCrossCheck.accrued)}. This usually
                means payment records are incomplete rather than that either
                figure is wrong. The income above uses the recorded payments.
              </Text>
            </View>
          )}

          {/* Division 43 register */}
          {property.div43Items.length > 0 && (
            <>
              <Text style={S.h2}>Capital works register (Division 43)</Text>
              <View style={S.th}>
                <Text style={[S.thTxt, { width: "34%" }]}>Item</Text>
                <Text style={[S.thTxt, { width: "16%" }]}>Completed</Text>
                <Text style={[S.thTxt, { width: "12%", textAlign: "right" }]}>Cost</Text>
                <Text style={[S.thTxt, { width: "8%", textAlign: "right" }]}>Rate</Text>
                <Text style={[S.thTxt, { width: "15%", textAlign: "right" }]}>This year</Text>
                <Text style={[S.thTxt, { width: "15%", textAlign: "right" }]}>Written down</Text>
              </View>
              {property.div43Items.map((item) => (
                <View style={S.tr} key={item.id}>
                  <Text style={[S.tdTxt, { width: "34%" }]}>
                    {item.description ?? "Capital works"}
                  </Text>
                  <Text style={[S.tdTxt, { width: "16%" }]}>
                    {item.startDate ?? "—"}
                  </Text>
                  <Text style={[S.tdTxt, { width: "12%", textAlign: "right" }]}>
                    {fmt(item.amount)}
                  </Text>
                  <Text style={[S.tdTxt, { width: "8%", textAlign: "right" }]}>
                    {item.ratePct}%
                  </Text>
                  <Text style={[S.tdTxt, { width: "15%", textAlign: "right" }]}>
                    {fmt(item.claimThisYear)}
                  </Text>
                  <Text style={[S.tdTxt, { width: "15%", textAlign: "right" }]}>
                    {fmt(item.writtenDownValue)}
                  </Text>
                </View>
              ))}
              <View style={S.totalRow}>
                <Text style={S.totalLabel}>
                  Capital works claimed this year
                </Text>
                <Text style={S.totalValue}>{fmt(property.div43Total)}</Text>
              </View>
              <Text style={S.note}>
                Each item writes off from its own completion date. Computed from
                the owner&apos;s recorded works only.
                {property.div40Annual != null
                  ? " Where a quantity surveyor's schedule is held, its figures take precedence and are shown below."
                  : ""}
              </Text>
            </>
          )}

          {/* Depreciation per QS */}
          <Text style={S.h2}>Depreciation schedule</Text>
          {property.div40Annual != null ? (
            <>
              <View style={S.row}>
                <Text style={S.label}>
                  Decline in value (Division 40)
                  {property.depreciationMethod
                    ? ` — ${property.depreciationMethod.replace("_", " ")}`
                    : ""}
                </Text>
                <Text style={S.value}>{fmt(property.div40Annual)}</Text>
              </View>
              {property.qsFirm && (
                <Text style={S.note}>
                  Per schedule prepared by {property.qsFirm}. Included in the
                  evidence bundle.
                </Text>
              )}
            </>
          ) : (
            <Text style={S.note}>
              No quantity surveyor schedule recorded. Plant and equipment
              (Division 40) is not tracked by Home Base — it depends on
              per-asset effective lives and the second-hand asset rules. Please
              request the schedule from the client.
            </Text>
          )}

          {/* CGT cost base */}
          <Text style={S.h2}>CGT cost base</Text>
          <View style={S.row}>
            <Text style={S.label}>Purchase price</Text>
            <Text style={S.value}>{fmt(property.costBase.purchasePrice)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>
              Stamp duty
              {property.costBase.stampDutySource === "roi_inputs"
                ? " (estimated, from ROI inputs)"
                : property.costBase.stampDutySource == null
                  ? " (not recorded)"
                  : ""}
            </Text>
            <Text style={S.value}>{fmt(property.costBase.stampDuty)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Initial repairs at purchase</Text>
            <Text style={S.value}>{fmt(property.costBase.initialRepairs)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Capital improvements</Text>
            <Text style={S.value}>
              {fmt(property.costBase.capitalImprovements)}
            </Text>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Total adjusted cost base</Text>
            <Text style={S.totalValue}>{fmt(property.costBase.total)}</Text>
          </View>
          <Text style={S.note}>
            Cost base is stated at 100% of the property, not apportioned to your
            share, because a disposal is calculated per owner at the time.
          </Text>
          <Footer />
        </Page>
      ))}

      {/* Questionnaire */}
      <Page size="A4" style={S.page}>
        <Text style={S.h1}>Rental property questionnaire</Text>
        <Text style={[S.note, { marginTop: -4, marginBottom: 10 }]}>
          Answered from the client&apos;s records. This pack covers the rental
          property section of the return only — the client supplies the
          remaining sections separately.
        </Text>
        {data.questionnaire.map((section) => (
          <View key={section.title} wrap={false}>
            <Text style={S.h2}>{section.title}</Text>
            {section.items.map((item, i) => (
              <View style={S.qItem} key={i}>
                <Text style={S.qQuestion}>{item.question}</Text>
                {item.answer && <Text style={S.qAnswer}>{item.answer}</Text>}
                <Text style={S.qStatus}>{statusLabel(item.status)}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={S.disclaimer}>
          <Text style={S.disclaimerTitle}>Important</Text>
          <Text style={S.disclaimerTxt}>
            This pack is generated from records the property owner entered and
            documents they supplied. It is decision support for a registered tax
            agent, not tax advice, and it is not a lodgement. Figures marked as
            estimated or assumed have not been verified against source
            documents. AI-assisted classification and extraction were used in
            preparing some figures; every one is reviewable and was subject to
            the owner&apos;s confirmation. Please verify against the supporting
            evidence bundled with this pack before relying on any amount.
          </Text>
        </View>
        <Footer />
      </Page>
    </Document>
  );
}
