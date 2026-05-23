import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTavilyClient } from "@/lib/ai/tavily-client";
import { openai } from "@/lib/ai/openai-client";

interface RouteParams {
  params: Promise<{ propertyId: string }>;
}

const enrichmentSchema = z.object({
  year_built: z
    .number()
    .nullable()
    .describe("Year the property was built, null if not found"),
  architectural_style: z
    .string()
    .nullable()
    .describe(
      "Architectural style or era with specific details, e.g. 'Victorian terrace c.1890 with ornate cast-iron lacework', 'Edwardian bungalow', 'Inter-war Californian bungalow'",
    ),
  heritage_listing: z
    .string()
    .nullable()
    .describe(
      "Name or category of any heritage listing, e.g. 'Victorian Heritage Register' or 'Local Heritage Overlay HO123'",
    ),
  heritage_description: z
    .string()
    .nullable()
    .describe("Description of heritage significance if listed"),
  historical_context: z
    .string()
    .nullable()
    .describe("2-4 sentence narrative about the property's own history"),
  notable_features: z
    .array(z.string())
    .describe(
      "List of notable architectural or historical features of the property itself. Each item is a complete sentence or clear description. Empty array if none found.",
    ),
  sale_history: z
    .array(
      z.object({
        year: z.string().nullable(),
        price: z.string().nullable(),
        type: z.string().nullable().describe("e.g. 'sold', 'auction', 'passed in', 'rental listing'"),
        notes: z.string().nullable(),
      }),
    )
    .describe("Known sale or rental transactions from public records, newest first"),
  suburb_profile: z
    .object({
      overview: z
        .string()
        .nullable()
        .describe("2-3 sentences on the suburb's character, appeal and who lives there"),
      distance_to_cbd: z
        .string()
        .nullable()
        .describe("Distance and approximate travel time to CBD, e.g. '8km, 20 min by train'"),
      transport: z
        .array(z.string())
        .describe("Public transport options — train lines, tram routes, bus routes"),
      schools: z
        .array(z.string())
        .describe("Notable primary and secondary schools in or very near the suburb"),
      parks: z
        .array(z.string())
        .describe("Parks, reserves, sports grounds and recreational areas"),
      dining_shopping: z
        .string()
        .nullable()
        .describe("Notable café strips, restaurants, markets and shopping precincts"),
      lifestyle: z
        .string()
        .nullable()
        .describe("Lifestyle characteristics — walkability, community events, cultural scene"),
      median_house_price: z
        .string()
        .nullable()
        .describe("Approximate median house price if found in sources"),
    })
    .nullable()
    .describe("Profile of the suburb based on search results"),
  street_and_council_history: z
    .string()
    .nullable()
    .describe(
      "Interesting history about the street name origin, notable past events on the street, or local council/area history that most residents wouldn't know",
    ),
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      }),
    )
    .describe("Sources where this information was found"),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { propertyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, address, suburb, state, postcode, user_id")
    .eq("id", propertyId)
    .single();

  if (!property || property.user_id !== user.id) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const fullAddress = [
    property.address,
    property.suburb,
    property.state,
    property.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const tavily = getTavilyClient();

  // Four targeted searches in parallel
  const [historySearch, heritageSearch, salesSearch, suburbSearch] =
    await Promise.all([
      tavily.search(`${fullAddress} year built architectural style history`, {
        searchDepth: "advanced",
        maxResults: 5,
        includeAnswer: true,
        includeImages: true,
      }),
      tavily.search(
        `${property.address} ${property.suburb} ${property.state} heritage listing register significance features`,
        {
          searchDepth: "advanced",
          maxResults: 5,
          includeAnswer: true,
          includeImages: false,
        },
      ),
      tavily.search(
        `"${property.address}" ${property.suburb} ${property.state} sold price auction history realestate`,
        {
          searchDepth: "advanced",
          maxResults: 5,
          includeAnswer: true,
          includeImages: false,
        },
      ),
      tavily.search(
        `${property.suburb} ${property.state} suburb profile schools parks transport lifestyle amenities`,
        {
          searchDepth: "basic",
          maxResults: 5,
          includeAnswer: true,
          includeImages: false,
        },
      ),
    ]);

  // Combine and dedup results by URL
  const seenUrls = new Set<string>();
  const combinedResults = [
    ...historySearch.results,
    ...heritageSearch.results,
    ...salesSearch.results,
    ...suburbSearch.results,
  ].filter((r) => {
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  // Collect image URLs
  const imageUrls: string[] = (historySearch.images ?? [])
    .map((img: string | { url: string }) =>
      typeof img === "string" ? img : img.url,
    )
    .filter(
      (url: string) =>
        url &&
        (url.endsWith(".jpg") ||
          url.endsWith(".jpeg") ||
          url.endsWith(".png") ||
          url.endsWith(".webp")),
    )
    .slice(0, 6);

  // Build context sections
  const searchContext = combinedResults
    .map((r) => `[${r.title}]\nURL: ${r.url}\n${r.content.slice(0, 500)}`)
    .join("\n\n---\n\n");

  const answers = [
    historySearch.answer && `PROPERTY HISTORY:\n${historySearch.answer}`,
    heritageSearch.answer && `HERITAGE:\n${heritageSearch.answer}`,
    salesSearch.answer && `SALES HISTORY:\n${salesSearch.answer}`,
    suburbSearch.answer && `SUBURB PROFILE:\n${suburbSearch.answer}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { object: enrichment } = await generateObject({
    model: openai("gpt-5.5"),
    schema: enrichmentSchema,
    prompt: `You are extracting public property and suburb information for an Australian property.

Property address: ${fullAddress}
Suburb: ${property.suburb ?? "unknown"}, ${property.state ?? ""}

Extract structured information from the search results below. Only include information clearly supported by the sources — do not fabricate. Return null for fields not found.

SEARCH SUMMARIES:
${answers}

FULL SEARCH RESULTS:
${searchContext}

Important:
- For sale_history: extract any sale dates/prices found. Format prices as "$X,XXX,XXX". Order newest first.
- For suburb_profile: build a complete picture from the suburb search. Be specific about transport routes, school names, park names.
- For street_and_council_history: find something genuinely interesting that most people wouldn't know — street name origin, historical events, famous past residents or buildings on the street.
- For architectural_style: be specific about the era and style features visible from descriptions.`,
  });

  const raw = {
    history: {
      answer: historySearch.answer,
      results: historySearch.results.map((r) => ({ title: r.title, url: r.url })),
    },
    heritage: {
      answer: heritageSearch.answer,
      results: heritageSearch.results.map((r) => ({ title: r.title, url: r.url })),
    },
    sales: {
      answer: salesSearch.answer,
      results: salesSearch.results.map((r) => ({ title: r.title, url: r.url })),
    },
    suburb: {
      answer: suburbSearch.answer,
      results: suburbSearch.results.map((r) => ({ title: r.title, url: r.url })),
    },
  };

  const { error } = await supabase.from("property_enrichment").upsert(
    {
      property_id: propertyId,
      year_built: enrichment.year_built,
      architectural_style: enrichment.architectural_style,
      heritage_listing: enrichment.heritage_listing,
      heritage_description: enrichment.heritage_description,
      historical_context: enrichment.historical_context,
      notable_features: enrichment.notable_features,
      image_urls: imageUrls,
      sale_history: enrichment.sale_history,
      suburb_profile: enrichment.suburb_profile,
      street_and_council_history: enrichment.street_and_council_history,
      sources: enrichment.sources,
      raw_search_results: raw,
      enriched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );

  if (error) {
    return NextResponse.json(
      { error: `Failed to save enrichment: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ enrichment, image_urls: imageUrls });
}
