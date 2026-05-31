const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

export interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: string;
  Status: string;
}

export interface XeroTrackingCategory {
  TrackingCategoryID: string;
  Name: string;
  Status: string;
  Options: { TrackingOptionID: string; Name: string; Status: string }[];
}

export interface XeroJournalLine {
  LineAmount: number;
  AccountCode: string;
  Description?: string;
  TaxType?: string;
  Tracking?: {
    Name: string;
    Option: string;
  }[];
}

export interface XeroManualJournal {
  Narration: string;
  Date?: string;
  ShowOnCashBasisReports?: boolean;
  LineAmountTypes?: "INCLUSIVE" | "EXCLUSIVE" | "NOTAX";
  JournalLines: XeroJournalLine[];
}

async function xeroFetch<T>(
  tenantId: string,
  accessToken: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero API ${path} failed ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getAccounts(
  tenantId: string,
  accessToken: string,
): Promise<XeroAccount[]> {
  const data = await xeroFetch<{ Accounts: XeroAccount[] }>(
    tenantId,
    accessToken,
    '/Accounts?where=Status=="ACTIVE"',
  );
  return data.Accounts ?? [];
}

export async function getTrackingCategories(
  tenantId: string,
  accessToken: string,
): Promise<XeroTrackingCategory[]> {
  const data = await xeroFetch<{ TrackingCategories: XeroTrackingCategory[] }>(
    tenantId,
    accessToken,
    '/TrackingCategories?where=Status=="ACTIVE"',
  );
  return data.TrackingCategories ?? [];
}

export async function createManualJournal(
  tenantId: string,
  accessToken: string,
  journal: XeroManualJournal,
): Promise<string> {
  const data = await xeroFetch<{
    ManualJournals: { ManualJournalID: string }[];
  }>(tenantId, accessToken, "/ManualJournals", {
    method: "POST",
    body: JSON.stringify({ ManualJournals: [journal] }),
  });

  const id = data.ManualJournals?.[0]?.ManualJournalID;
  if (!id) throw new Error("Xero did not return a ManualJournalID");
  return id;
}
