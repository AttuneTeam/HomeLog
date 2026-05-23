"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InviteAcceptButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);

  function handleAccept() {
    setLoading(true);
    // Navigate directly to the accept route; the server will redirect on success
    window.location.href = `/api/invite/accept/${token}`;
  }

  return (
    <Button className="w-full" onClick={handleAccept} disabled={loading}>
      {loading ? "Accepting…" : "Accept invitation"}
    </Button>
  );
}
