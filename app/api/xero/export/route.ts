import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTokenRefresh } from "@/lib/xero/oauth";
import { createManualJournal, getTrackingCategories } from "@/lib/xero/client";
import { buildXeroManualJournal } from "@/lib/xero/mapper";

interface ExportBody {
  tenantId: string;
  propertyId: string;
  fyStart: string;
  fyEnd: string;
  financialYear: string;
  force?: boolean;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ExportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { tenantId, propertyId, fyStart, fyEnd, financialYear, force } = body;
  if (!tenantId || !propertyId || !fyStart || !fyEnd || !financialYear) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check for duplicate export
  if (!force) {
    const { data: existingLog } = await supabase
      .from("xero_sync_logs")
      .select("id, completed_at")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("property_id", propertyId)
      .eq("financial_year", financialYear)
      .eq("status", "completed")
      .maybeSingle();

    if (existingLog) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: `This property has already been exported for FY ${financialYear}. Pass force:true to export again.`,
          completedAt: existingLog.completed_at,
        },
        { status: 409 },
      );
    }
  }

  // Fetch account mappings
  const { data: mappings } = await supabase
    .from("xero_account_mappings")
    .select("home_base_category, xero_account_code, xero_tracking_category_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId);

  if (!mappings || mappings.length === 0) {
    return NextResponse.json(
      {
        error: "no_mappings",
        message: "No account mappings configured. Please set up account mappings in Settings > Integrations.",
      },
      { status: 400 },
    );
  }

  // Fetch all property data in parallel
  const [
    { data: property },
    { data: rentalPeriods },
    { data: rentalExpenses },
    { data: renovations },
    { data: propertyLoan },
    { data: loanInterestRates },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("address, suburb, state")
      .eq("id", propertyId)
      .single(),
    supabase
      .from("rental_periods")
      .select("start_date, end_date, weekly_rent, management_fee_pct")
      .eq("property_id", propertyId),
    supabase
      .from("rental_operating_expenses")
      .select("category, amount, gst_amount, expense_date, description, supplier")
      .eq("property_id", propertyId)
      .gte("expense_date", fyStart)
      .lte("expense_date", fyEnd),
    supabase
      .from("renovations")
      .select(
        "name, classification, expenses(expense_date, amount, gst_amount, description, supplier, manual_classification)",
      )
      .eq("property_id", propertyId)
      .eq("claimable", true)
      .neq("status", "planned"),
    supabase
      .from("property_loans")
      .select("loan_amount")
      .eq("property_id", propertyId)
      .maybeSingle(),
    supabase
      .from("loan_interest_rates")
      .select("rate, effective_date")
      .eq("property_id", propertyId)
      .order("effective_date", { ascending: true }),
  ]);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Get tracking category name if mapped
  let trackingCategoryName: string | undefined;
  const trackingCatId = mappings.find((m) => m.xero_tracking_category_id)
    ?.xero_tracking_category_id;
  if (trackingCatId) {
    try {
      const categories = await withTokenRefresh(user.id, tenantId, (token) =>
        getTrackingCategories(tenantId, token),
      );
      trackingCategoryName = categories.find(
        (c) => c.TrackingCategoryID === trackingCatId,
      )?.Name;
    } catch {
      // Non-fatal: proceed without tracking
    }
  }

  const propertyAddress = [property.address, property.suburb, property.state]
    .filter(Boolean)
    .join(", ");

  const { journal, recordCount, missingCategories } = buildXeroManualJournal({
    propertyAddress,
    financialYear,
    fyStart: new Date(fyStart),
    fyEnd: new Date(fyEnd),
    rentalPeriods: rentalPeriods ?? [],
    rentalOperatingExpenses: rentalExpenses ?? [],
    renovations: (renovations ?? []).map((r) => ({
      name: r.name,
      classification: r.classification,
      expenses: (r.expenses ?? []) as {
        expense_date: string;
        amount: number | string;
        gst_amount: number | string | null;
        description: string | null;
        supplier: string | null;
        manual_classification: string | null;
      }[],
    })),
    propertyLoan: propertyLoan ?? null,
    loanInterestRates: loanInterestRates ?? [],
    accountMappings: mappings,
    trackingCategoryName,
  });

  if (missingCategories.length > 0) {
    return NextResponse.json(
      {
        error: "missing_mappings",
        message: `The following categories are missing account mappings: ${missingCategories.join(", ")}`,
        missingCategories,
      },
      { status: 400 },
    );
  }

  if (journal.JournalLines.length === 0) {
    return NextResponse.json(
      {
        error: "no_data",
        message: "No financial data found for this property in the selected financial year.",
      },
      { status: 400 },
    );
  }

  // Create sync log
  const { data: syncLog } = await supabase
    .from("xero_sync_logs")
    .insert({
      user_id: user.id,
      tenant_id: tenantId,
      property_id: propertyId,
      financial_year: financialYear,
      fy_start: fyStart,
      fy_end: fyEnd,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const logId = syncLog?.id;

  // Post to Xero
  let journalId: string;
  try {
    journalId = await withTokenRefresh(user.id, tenantId, (token) =>
      createManualJournal(tenantId, token, journal),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown Xero error";
    if (logId) {
      await supabase
        .from("xero_sync_logs")
        .update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() })
        .eq("id", logId);
    }
    return NextResponse.json(
      { error: "xero_api_error", message: msg },
      { status: 502 },
    );
  }

  // Update sync log to completed
  if (logId) {
    await supabase
      .from("xero_sync_logs")
      .update({
        status: "completed",
        xero_journal_ids: [journalId],
        records_pushed: recordCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", logId);
  }

  return NextResponse.json({
    ok: true,
    journalId,
    recordCount,
  });
}
