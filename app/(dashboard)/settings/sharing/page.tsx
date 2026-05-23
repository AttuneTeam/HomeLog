import { redirect } from "next/navigation";

export default function SharingRedirectPage() {
  redirect("/settings/account");
}
