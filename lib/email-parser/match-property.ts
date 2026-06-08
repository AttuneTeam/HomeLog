import { SupabaseClient } from "@supabase/supabase-js";

export type PropertyMatch =
  | { matched: true; propertyId: string; rentalPeriodId: string | null }
  | { matched: false; reason: string };

export async function matchPropertyBySender(
  supabase: SupabaseClient,
  userId: string,
  senderAddress: string,
  extractedAddress: string | null,
): Promise<PropertyMatch> {
  const normalizedSender = senderAddress.toLowerCase().trim();

  const { data: userProperties } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", userId);

  const propertyIds = (userProperties ?? []).map((p) => p.id);
  if (propertyIds.length === 0) {
    return { matched: false, reason: "No properties found for user" };
  }

  const { data: periods } = await supabase
    .from("rental_periods")
    .select("id, property_id, agent_email")
    .eq("agent_email", normalizedSender)
    .in("property_id", propertyIds);

  if (!periods || periods.length === 0) {
    return { matched: false, reason: `No rental periods found for sender ${senderAddress}` };
  }

  if (periods.length === 1) {
    return {
      matched: true,
      propertyId: periods[0].property_id,
      rentalPeriodId: periods[0].id,
    };
  }

  // Multiple properties managed by the same agent — try to narrow by extracted address
  if (extractedAddress) {
    const { data: properties } = await supabase
      .from("properties")
      .select("id, address, suburb")
      .in(
        "id",
        periods.map((p) => p.property_id),
      );

    const addressLower = extractedAddress.toLowerCase();
    const match = (properties ?? []).find(
      (p) =>
        addressLower.includes(p.address?.toLowerCase() ?? "") ||
        addressLower.includes(p.suburb?.toLowerCase() ?? ""),
    );

    if (match) {
      const period = periods.find((p) => p.property_id === match.id);
      return {
        matched: true,
        propertyId: match.id,
        rentalPeriodId: period?.id ?? null,
      };
    }
  }

  return {
    matched: false,
    reason: `Agent ${senderAddress} manages ${periods.length} properties — could not determine which from email content`,
  };
}
