/**
 * Seed script: embed and insert ATO rulings into ato_rulings_embeddings.
 * Run with: npm run seed:ato
 *
 * Requires env vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { chunkText } from "../lib/ai/chunk-text";

// Load env from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const embeddingModel = openai.embedding("text-embedding-3-small");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ============================================================
// ATO Rulings Corpus
// ============================================================
const ATO_RULINGS = [
  {
    ruling_ref: "TR 97/23",
    title: "Income tax: deductions for repairs",
    body: `Taxation Ruling TR 97/23 - Income tax: deductions for repairs.

A repair is work that restores an asset to its former condition without improving it beyond its original state. The key test is whether the work restores efficiency of function without changing the character of the asset.

Key tests for deductibility under s 25-10 ITAA 1997:
(1) Has the asset deteriorated since it came into use for income-producing purposes?
(2) Does the work restore the asset to its former state without improving it?
(3) Is the work necessitated by wear and tear, decay or damage occurring during the income-producing period?

If all three tests are met, the expenditure is deductible immediately as a repair.

Replacing an 'entirety' — such as an entire fence, entire roof, or entire hot water system — is generally capital expenditure, not a repair, even if the replacement uses modern materials. The 'entirety test' asks whether the component replaced is itself an entirety or merely a part of a larger asset.

Improvements are capital: If work goes beyond restoring the prior condition and improves the asset (e.g., upgrading to a higher standard, extending the useful life significantly, or changing the character of the asset), the expenditure is capital and not deductible as a repair.

Initial repairs: Expenditure on repairs to make good defects, damage, or deterioration that existed at the time the property was acquired is NOT deductible under s 25-10. Such expenditure is either capital (adding to the cost base for CGT purposes) or may qualify as capital works under Division 43 if construction work is involved. This applies even if the taxpayer was unaware of the defects at the time of purchase.

The critical distinction for initial repairs: if the property was in disrepair when acquired and work is done to fix that pre-existing disrepair, the expense is capital. If the asset was in good condition when acquired and subsequently deteriorated during the income-producing period, repair costs are deductible.`,
  },
  {
    ruling_ref: "TR 97/23",
    title: "Income tax: deductions for repairs — practical examples",
    body: `Taxation Ruling TR 97/23 — Practical application examples.

Examples of deductible repairs (Immediate Deduction under s 25-10):
- Repainting a rental property that has become weathered during the tenancy period
- Replacing a small section of damaged guttering (part, not entirety)
- Fixing a leaking tap or repairing a broken window
- Patching damaged plasterwork
- Repairing (not replacing) a portion of timber flooring

Examples of capital expenditure (NOT repairs):
- Replacing an entire roof with a new material (entirety replaced)
- Installing new flooring throughout the property (improvement and entirety)
- Adding a room or extending the building
- Replacing an entire hot water system (replacing an entirety)
- Replacing all windows with double-glazed windows (improvement)
- Replacing an entire fence

Mixed cases require apportionment: If work is partly repair and partly improvement, apportion the cost. Only the repair component is deductible.

Environmental protection: Separate from the repairs provisions, expenditure on environmental protection activities to prevent or remedy pollution may be deductible under s 40-755 ITAA 1997. This includes asbestos removal where asbestos is a form of environmental contamination. This deduction may apply even where the work would otherwise be classified as capital.`,
  },
  {
    ruling_ref: "TR 2021/5",
    title: "Capital works deductions — Division 43 ITAA 1997",
    body: `Taxation Ruling TR 2021/5 — Capital works deductions (Division 43).

Division 43 of ITAA 1997 allows deductions for capital works expenditure on buildings and structural improvements used for income-producing purposes.

Deduction rates:
- 2.5% per year for residential buildings where construction commenced after 15 September 1987
- 4% per year for commercial buildings, short-term accommodation, and some other structures
- The deduction period runs for 40 years (at 2.5%) or 25 years (at 4%) from the date construction is completed

Eligible capital works expenditure includes:
- Construction of a building or structural improvement
- Extensions, alterations, and improvements to buildings
- Earthworks (retaining walls, driveways) integral to a building
- Work on fixed structural components (staircases, built-in cupboards, bathroom tiles)

Capital works expenditure does NOT include:
- Plant and equipment items (covered by Division 40)
- Cost of acquiring land
- Expenditure incurred before 18 July 1985 (pre-CGT)

Key point for investment properties: Capital works that replace or improve structural components of a rental property are deductible at 2.5% per annum over 40 years — not immediately. The investor must have documentation (quantity surveyor report or builder invoices) to support the claim.

When a capital works asset is sold, the deductions claimed reduce the cost base, affecting capital gains tax calculation.`,
  },
  {
    ruling_ref: "TR 2020/1",
    title: "Plant and equipment — Division 40 ITAA 1997",
    body: `Taxation Ruling TR 2020/1 — Depreciation of plant and equipment (Division 40).

Division 40 of ITAA 1997 provides deductions for the decline in value of depreciating assets (plant and equipment) used in producing assessable income.

Key concepts:
- A depreciating asset is an asset with a limited effective life that can reasonably be expected to decline in value
- Division 40 applies to items that are not structural improvements (which fall under Division 43)
- The asset must be used or installed ready for use for a taxable purpose

Common Division 40 items in investment properties:
- Air conditioning systems (split systems, window units)
- Dishwashers, stoves, ovens, range hoods
- Carpet and floating floorboards (installed after 9 May 2017: new properties only)
- Hot water systems (electric, gas, solar)
- Blinds, curtains, light fittings
- Ceiling fans

Effective life: The ATO publishes effective life tables (TR 2023/1 on effective lives). Investors can use the ATO rate or self-assess a shorter effective life.

Depreciation methods:
- Diminishing value method: deduction = opening pool balance × (200% / effective life)
- Prime cost method: deduction = cost × (100% / effective life)

Post-7 May 2017 restriction: For residential investment properties, second-hand (previously used) plant and equipment items can no longer be claimed under Division 40 by new purchasers. Only brand new items qualify.

Instant asset write-off: Small business entities may be eligible to immediately deduct the cost of eligible depreciating assets under the instant asset write-off provisions.`,
  },
  {
    ruling_ref: "ATO PS LA 2003/8",
    title: "Initial repairs — pre-existing defects at acquisition",
    body: `ATO Practice Statement PS LA 2003/8 — Initial repairs at time of acquisition.

When a taxpayer acquires an income-producing property that is in a state of disrepair, expenditure on remedying that disrepair is NOT deductible as a repair under s 25-10 ITAA 1997.

The principle: Initial repairs that correct defects, damage, or deterioration that existed at the time of acquisition are capital in nature. The deduction denial applies regardless of whether the taxpayer was aware of the defects when they acquired the property.

Tax treatment of initial repair costs:
1. If the work constitutes capital works (construction, structural improvement): deductible over 40 years under Division 43 at 2.5%
2. If the work constitutes plant and equipment: depreciable under Division 40
3. If neither: the cost adds to the cost base of the property for CGT purposes under s 110-25

Indicators that expenditure may be initial repairs (non-deductible):
- Work was performed shortly after acquisition (within 12-18 months)
- The property was purchased at a below-market price reflecting its poor condition
- The work corrects pre-existing deterioration rather than deterioration during the income-producing period
- The vendor disclosed existing defects or the purchase contract referenced repairs

The ATO may scrutinise large repair claims in the first 1-2 years of property ownership. Taxpayers should retain evidence showing when deterioration occurred (e.g., depreciation schedules, building inspections, photos) to demonstrate that deterioration arose during the tenancy rather than at acquisition.`,
  },
  {
    ruling_ref: "IT 180",
    title: "Entirety principle — when replacement is capital",
    body: `ATO Interpretation of Taxation IT 180 — The Entirety Principle in repairs.

The 'entirety principle' distinguishes between deductible repairs (restoring a part) and non-deductible capital expenditure (replacing an entirety).

An 'entirety' is an asset or a component of an asset that is complete in itself — something that can stand alone as a functional unit. When an entirety is replaced rather than repaired, the expenditure is capital, not a deductible repair, even if the replacement restores the original function.

Examples of replacements of entireties (capital expenditure, not deductible):
- Replacing an entire roof (the roof is an entirety, even if damaged by storm)
- Replacing an entire fence around a property
- Replacing an entire hot water system
- Replacing an entire heating/cooling unit
- Replacing all windows in a property
- Replacing an entire kitchen

Examples of repairing a part (deductible):
- Replacing broken tiles on a section of the roof (a part, not the whole roof)
- Replacing one panel of a fence
- Replacing a faulty valve in a hot water system
- Replacing a single broken window pane
- Repairing worn floor joists (not replacing the entire floor)

The entirety test and the repair test work together: expenditure can only be a repair if it (a) restores something that has deteriorated and (b) does not replace an entirety. If either condition fails, the expenditure is capital.

Note: The fact that modern or superior materials are used in a replacement does not automatically make it an improvement — if the replacement restores the same function to the same standard (using modern equivalents), it may still be capital (as a replacement of an entirety) but would NOT be a repair.`,
  },
  {
    ruling_ref: "TR 2023/1",
    title: "Environmental protection activities and energy deductions",
    body: `ATO guidance on environmental protection activities and energy efficiency deductions.

Section 40-755 ITAA 1997 — Environmental protection activities:
Expenditure on carrying out environmental protection activities is deductible in the year incurred, regardless of whether the expenditure would otherwise be capital. This is a significant exception to the capital/revenue distinction.

Qualifying environmental protection activities include:
- Preventing, fighting, or remedying pollution of land, air, or water
- Treating, cleaning up, or storing waste
- Monitoring, preventing, and controlling environmental damage
- Asbestos removal and remediation (asbestos is classified as an environmental contaminant)
- Lead paint removal in properties (where carried out for environmental protection purposes)

Key condition: The activity must be carried out as a sole or dominant purpose for environmental protection. If asbestos removal is incidental to a renovation project, the deductibility under s 40-755 may be questioned.

Practical application for investment properties:
- Asbestos removal prior to renovation: may qualify under s 40-755 as an immediate deduction, even if the renovation itself is capital works
- Solar panel installation: capital works under Division 43 or plant and equipment under Division 40 depending on configuration
- Water-efficient fixtures (water tanks, low-flow fittings): potentially Division 43 (fixed structural) or Division 40 (removable)
- Insulation installation: Division 43 capital works at 2.5% over 40 years (structural improvement)

Environmental flag consideration: When any invoice description references asbestos, lead paint, contamination, hazardous materials, or pollution remediation, the environmental_flag should be set to true and s 40-755 considered.`,
  },
  {
    ruling_ref: "TD 2023/1",
    title: "Instant asset write-off thresholds — small business",
    body: `ATO Tax Determination TD 2023/1 — Instant asset write-off for small business entities.

The instant asset write-off allows eligible small business entities (SBE) to immediately deduct the full cost of eligible depreciating assets in the income year the asset is first used or installed ready for use.

Current threshold (2023-24 and 2024-25 income years): $20,000 per asset.

Eligibility requirements:
- The business must be a small business entity (aggregated annual turnover < $10 million)
- The asset must be used or installed ready for use in the income year the deduction is claimed
- The asset must be used for taxable purposes
- The cost of the asset must be less than the threshold

For investment property owners: Individual investors are generally not operating a business — they hold passive investments. The instant asset write-off is NOT available to passive individual investors. Instead, they must depreciate plant and equipment items over their effective life under Division 40.

Exception: Where a taxpayer operates their investment property activity as a business (e.g., commercial property, large-scale property investment portfolio treated as a business), SBE provisions may apply.

For most individual residential property investors: Apply the standard Division 40 depreciation rules (diminishing value or prime cost) over the asset's effective life. Do not apply the $20,000 instant write-off unless the taxpayer has confirmed SBE status.`,
  },
];

const ENHANCED_ATO_RULINGS = [
  {
    ruling_ref: "TR 2024/1",
    title: "Composite Items: The Functionality Test",
    body: `Determines whether a system of components is a single asset or multiple separate assets under Division 40
    
    The Functionality Test:
    - Separate Identifiable Function: If a component performs a discrete function (e.g., a battery storage unit vs. a solar panel), it is a separate depreciating asset.
    - Functional Integration: High degree of physical/functional integration (e.g., a desktop computer package) suggests the composite item is the depreciating asset.
    - Systems: Components purchased to function together as a connected system are usually one composite asset.`,
  },
  {
    ruling_ref: "TR 2025/D1 & PCG 2025/D7",
    title: "Holiday Homes and Leisure Facility Restrictions",
    body: `Replaces IT 2167. Implements stricter limits on holiday homes and mixed-use properties.
    
    Key Decision Triggers:
    - Leisure Facility Rule (s 26-50): If a property is "mainly" used for recreation, ownership costs (interest, rates) and repairs/maintenance may be denied.
    - Peak Period Test: Availability during school holidays and Christmas, and pricing at market rates, determine if the property is "mainly" income-producing.
    - Apportionment (PCG 2025/D6): Expenses for mixed-use properties must be divided on a "fair and reasonable" basis using time-based or floor-area methods.`,
  },
  {
    ruling_ref: "TR 2022/1 (Updated 2025)",
    title: "Effective Life of Depreciating Assets (Division 40)",
    body: `Provides tables for working out the decline in value for plant and equipment. Replaces TR 2021/5.
    
    2025-2026 Asset Markers:
    - Mini split A/C systems: 10 years.
    - Solar PV panels: 15 years.
    - CCTV Cameras: 4 years.
    - Removable Carpet (after 2019): 8 years.
    - Floating timber floors: 15 years.
    - Ceiling Fans: 5 years.`,
  },
  {
    ruling_ref: "s 40-755 ITAA 1997",
    title: "Environmental Protection: Asbestos and Pollution",
    body: `A major exception allowing immediate deductions for capital-natured outgoings if for the "sole or dominant purpose" of environmental protection.
    
    Key Logic:
    - Remediating Pollution: Asbestos removal is fully deductible even if it existed at the time of purchase.
    - Removal vs Replacement: The cost of removing the pollutant (asbestos roof/fence) is an immediate deduction. The cost of the replacement structure is usually a capital work (Division 43).
    - Pre-letting: s 40-755 overrides the "Initial Repair" rule for hazardous contaminants.`,
  },
  {
    ruling_ref: "ATO PS LA 2003/8",
    title: "Initial Repairs and Low-Cost Business Safe Harbors",
    body: `Governs work done to remedy defects existing at acquisition.
    
    The Initial Repair Rule: Work to fix pre-existing damage is capital, regardless of whether the owner knew of the defect. This cost adds to the CGT cost base.
    
    Indicators of Initial Repairs:
    - Work performed within 12-18 months of purchase.
    - Purchase price was below market value due to condition.
    - Vendor disclosed defects in the contract.
    
    Business Safe Harbor: For entities carrying on a business, outgoings under $100 for a single item may be immediately expensed for administrative convenience. Note: This is generally not available to passive residential investors.`,
  },
  {
    ruling_ref: "NAT 1729 (2025 Guide)",
    title: "Rental Properties Guide 2025: Master Asset Mapping",
    body: `Definitive classification of assets between Division 40 (Plant) and Division 43 (Capital Works).
    
    Division 40 (Plant): Ceiling fans, dishwashers, removable floor coverings, solar panels, security cameras, and intercom systems.
    Division 43 (Capital Works): Fixed structural items including walls, roofs, fences, bathroom vanities, and fixed tiling.
    
    Build-to-Rent Incentive: Eligible new residential developments (construction started after 9 May 2023) qualify for a 4% capital works rate instead of 2.5%.`,
  },
  {
    ruling_ref: "Recoupment Logic",
    title: "Insurance Payouts and Casualties",
    body: `Treatment of insurance proceeds for loss or repairs.
    - Cash Payouts: Must be declared as assessable income.
    - Offset Rule: Payouts received for repairs are offset by the repair deduction in the same year.
    - Direct Payments: If an insurer pays a contractor directly, the owner cannot claim a deduction.
    - Total Loss: Payouts for the total destruction of a Division 40 asset require a balancing adjustment.`,
  },
];

// ============================================================
// Main seed function
// ============================================================
async function main() {
  console.log("Seeding ATO rulings embeddings...");

  // Clear existing data
  const { error: deleteError } = await supabase
    .from("ato_rulings_embeddings")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all

  if (deleteError) {
    console.error("Failed to clear existing rulings:", deleteError.message);
    process.exit(1);
  }

  // Build chunks from all rulings
  const allRows: Array<{
    ruling_ref: string;
    title: string;
    chunk_index: number;
    chunk_text: string;
  }> = [];

  for (const ruling of ENHANCED_ATO_RULINGS) {
    const chunks = chunkText(ruling.body, 900, 100);
    chunks.forEach((chunk_text, i) => {
      allRows.push({
        ruling_ref: ruling.ruling_ref,
        title: ruling.title,
        chunk_index: i,
        chunk_text,
      });
    });
  }

  console.log(`Generating embeddings for ${allRows.length} chunks...`);

  // Embed all chunks in one batch
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: allRows.map((r) => r.chunk_text),
  });

  console.log(
    `Inserting ${allRows.length} rows into ato_rulings_embeddings...`,
  );

  const insertRows = allRows.map((row, i) => ({
    ...row,
    embedding: embeddings[i],
    metadata: { source: "seed" },
  }));

  const { error: insertError } = await supabase
    .from("ato_rulings_embeddings")
    .insert(insertRows);

  if (insertError) {
    console.error("Insert failed:", insertError.message);
    process.exit(1);
  }

  console.log(`✓ Seeded ${insertRows.length} ATO ruling chunks successfully.`);

  // Print summary
  const byRuling: Record<string, number> = {};
  allRows.forEach((r) => {
    byRuling[r.ruling_ref] = (byRuling[r.ruling_ref] ?? 0) + 1;
  });
  console.log("\nChunks per ruling:");
  Object.entries(byRuling).forEach(([ref, count]) => {
    console.log(`  ${ref}: ${count} chunk(s)`);
  });
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
