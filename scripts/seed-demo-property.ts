/**
 * Seed script: create a dedicated demo user and populate one fully-featured
 * demo property (renovations, expenses, a rental period, and hardcoded AI
 * value summaries) for product demos.
 *
 * Idempotent — safe to re-run. Reuses the demo user and replaces its data.
 *
 * Run with: npm run seed:demo
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (service role bypasses RLS so we can insert on the demo user's behalf).
 */
import { createClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/database.types";

// Load env from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

const DEMO_EMAIL = "demo@homebase.app";
const DEMO_PASSWORD = "DemoProperty2026!";

// Service-role client for data inserts (bypasses RLS).
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Anon client for public auth (signUp / signInWithPassword). The auth admin
// API is not used: local Supabase instances with asymmetric JWT signing reject
// the secret key on /auth/v1/admin, whereas the public auth endpoints work.
const authClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function fail(label: string, error: { message: string } | null): void {
  if (error) {
    console.error(`${label} failed:`, error.message);
    process.exit(1);
  }
}

async function main() {
  console.log("Seeding demo property...\n");

  // ----------------------------------------------------------------
  // 1. Demo user (create or reuse) via public auth endpoints
  // ----------------------------------------------------------------
  let userId: string | undefined;

  const { data: signUp, error: signUpError } = await authClient.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (signUp?.user) {
    userId = signUp.user.id;
    console.log(`Created demo user (${DEMO_EMAIL})`);
  } else {
    // Already registered (or sign-up returned no user) — sign in to get the id.
    const { data: signIn, error: signInError } =
      await authClient.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
    if (!signIn?.user) {
      console.error(
        "Could not create or sign in demo user:",
        (signInError ?? signUpError)?.message,
      );
      process.exit(1);
    }
    userId = signIn.user.id;
    console.log(`Reusing existing demo user (${DEMO_EMAIL})`);
  }

  if (!userId) {
    console.error("Could not resolve demo user id");
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // 2. Profile (upsert — avoids conflicting with new-user trigger)
  // ----------------------------------------------------------------
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: "Demo User" });
  fail("Upsert profile", profileError);

  // ----------------------------------------------------------------
  // 3. Reset prior demo data (cascade clears renovations/expenses/etc.)
  // ----------------------------------------------------------------
  const { error: resetError } = await supabase
    .from("properties")
    .delete()
    .eq("user_id", userId);
  fail("Reset demo properties", resetError);

  // ----------------------------------------------------------------
  // 4. Property
  // ----------------------------------------------------------------
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .insert({
      user_id: userId,
      address: "14 Marriott Street",
      suburb: "Redfern",
      state: "NSW",
      postcode: "2016",
      purchase_date: "2023-03-15",
      purchase_price: 1185000,
      stamp_duty: 53600,
      notes: "Two-bedroom Victorian terrace held as a long-term rental investment.",
    })
    .select()
    .single();
  fail("Insert property", propertyError);
  const propertyId = property!.id;

  // ----------------------------------------------------------------
  // 5. Renovations
  // ----------------------------------------------------------------
  const { data: kitchenReno, error: kitchenError } = await supabase
    .from("renovations")
    .insert({
      property_id: propertyId,
      name: "Kitchen renovation",
      description:
        "Full kitchen upgrade — new cabinetry, stone benchtops, and appliances to lift rental appeal.",
      start_date: "2023-05-01",
      end_date: "2023-06-20",
      status: "completed",
      classification: "capital_improvement",
      claimable: true,
    })
    .select()
    .single();
  fail("Insert kitchen renovation", kitchenError);
  const kitchenId = kitchenReno!.id;

  const { data: bathroomReno, error: bathroomError } = await supabase
    .from("renovations")
    .insert({
      property_id: propertyId,
      name: "Bathroom repairs",
      description:
        "Repairs to the main bathroom — re-grouting, leaking tap, and a replaced exhaust fan.",
      start_date: "2026-04-10",
      end_date: null,
      status: "in_progress",
      classification: "repair",
      claimable: true,
    })
    .select()
    .single();
  fail("Insert bathroom renovation", bathroomError);
  const bathroomId = bathroomReno!.id;

  // ----------------------------------------------------------------
  // 6. Expenses
  // ----------------------------------------------------------------
  const expenseRows: Database["public"]["Tables"]["expenses"]["Insert"][] = [
    {
      renovation_id: kitchenId,
      amount: 12400,
      category: "materials",
      expense_date: "2023-05-08",
      description: "Custom cabinetry and stone benchtop",
      supplier: "Sydney Joinery Co",
      abn: "51 824 753 556",
      gst_amount: 1127.27,
      context_notes: null,
    },
    {
      renovation_id: kitchenId,
      amount: 6800,
      category: "labour",
      expense_date: "2023-05-22",
      description: "Cabinet installation and tiling labour",
      supplier: "Redfern Building Group",
      abn: "29 002 589 460",
      gst_amount: 618.18,
      context_notes: null,
    },
    {
      renovation_id: kitchenId,
      amount: 3950,
      category: "appliances",
      expense_date: "2023-06-02",
      description: "Oven, cooktop, and dishwasher",
      supplier: "The Good Guys Alexandria",
      abn: "89 008 600 025",
      gst_amount: 359.09,
      context_notes: null,
    },
    {
      renovation_id: kitchenId,
      amount: 1480,
      category: "fixtures",
      expense_date: "2023-06-09",
      description: "Tapware, sink, and lighting fixtures",
      supplier: "Reece Plumbing",
      abn: "84 004 097 090",
      gst_amount: 134.55,
      context_notes: null,
    },
    {
      renovation_id: kitchenId,
      amount: 620,
      category: "permits",
      expense_date: "2023-04-28",
      description: "Council renovation permit",
      supplier: "City of Sydney Council",
      abn: "22 636 550 790",
      gst_amount: 0,
      context_notes: null,
    },
    {
      renovation_id: bathroomId,
      amount: 540,
      category: "materials",
      expense_date: "2026-04-12",
      description: "Grout, sealant, and waterproofing supplies",
      supplier: "Bunnings Warehouse",
      abn: "26 008 672 179",
      gst_amount: 49.09,
      context_notes: null,
    },
    {
      renovation_id: bathroomId,
      amount: 880,
      category: "labour",
      expense_date: "2026-04-18",
      description: "Plumber call-out — leaking tap repair and re-grouting",
      supplier: "Inner West Plumbing",
      abn: "47 120 928 471",
      gst_amount: 80,
      context_notes: null,
    },
    {
      renovation_id: bathroomId,
      amount: 245,
      category: "fixtures",
      expense_date: "2026-04-19",
      description: "Replacement exhaust fan",
      supplier: "Reece Plumbing",
      abn: "84 004 097 090",
      gst_amount: 22.27,
      context_notes: null,
    },
  ];

  const { error: expensesError } = await supabase
    .from("expenses")
    .insert(expenseRows);
  fail("Insert expenses", expensesError);

  // ----------------------------------------------------------------
  // 7. Rental period
  // ----------------------------------------------------------------
  const { error: rentalError } = await supabase.from("rental_periods").insert({
    property_id: propertyId,
    start_date: "2023-07-15",
    end_date: null,
    weekly_rent: 920,
    management_company: "Ray White Surry Hills",
    agent_name: "Jordan Lee",
    management_fee_pct: 5.5,
    notes: "Current lease — long-term tenants since mid-2023.",
  });
  fail("Insert rental period", rentalError);

  // ----------------------------------------------------------------
  // 8. Hardcoded AI value summaries (no live AI calls)
  // ----------------------------------------------------------------
  const { error: renoSummaryError } = await supabase
    .from("renovation_summaries")
    .insert({
      renovation_id: kitchenId,
      summary_text:
        "The kitchen renovation modernised a dated, original kitchen with new cabinetry, stone benchtops, and energy-efficient appliances. As a capital improvement it materially lifts the property's rental appeal and long-term value, and the expenditure is treated as capital works (Division 43) and plant & equipment (Division 40) rather than an immediate deduction.",
      model_used: "demo-seed",
      is_edited: false,
    });
  fail("Insert renovation summary", renoSummaryError);

  // Grab a couple of expense ids to attach value summaries to.
  const { data: summaryTargets, error: targetsError } = await supabase
    .from("expenses")
    .select("id, description")
    .eq("renovation_id", kitchenId)
    .in("description", [
      "Custom cabinetry and stone benchtop",
      "Oven, cooktop, and dishwasher",
    ]);
  fail("Select expense summary targets", targetsError);

  const summaryTextByDescription: Record<string, string> = {
    "Custom cabinetry and stone benchtop":
      "New custom cabinetry and stone benchtops form the structural core of the kitchen upgrade. As fixed improvements they are capital works (Division 43), deductible at 2.5% per year, and add lasting value well beyond the renovation period.",
    "Oven, cooktop, and dishwasher":
      "The new appliances are depreciating plant & equipment (Division 40). As brand-new items in the renovation they qualify for decline-in-value deductions over their effective lives and improve the property's appeal to quality tenants.",
  };

  const valueSummaryRows = (summaryTargets ?? []).map((e) => ({
    expense_id: e.id,
    summary_text:
      summaryTextByDescription[e.description ?? ""] ??
      "This expense contributed to the property's value-add renovation.",
    model_used: "demo-seed",
    is_edited: false,
  }));

  if (valueSummaryRows.length > 0) {
    const { error: valueSummaryError } = await supabase
      .from("expense_value_summaries")
      .insert(valueSummaryRows);
    fail("Insert expense value summaries", valueSummaryError);
  }

  // ----------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------
  console.log("\n✓ Demo property seeded successfully.\n");
  console.log("  Property:           14 Marriott Street, Redfern NSW");
  console.log("  Renovations:        2 (Kitchen renovation, Bathroom repairs)");
  console.log(`  Expenses:           ${expenseRows.length}`);
  console.log("  Rental periods:     1");
  console.log("  Renovation summary: 1");
  console.log(`  Value summaries:    ${valueSummaryRows.length}`);
  console.log("\nLog in to the demo account with:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
