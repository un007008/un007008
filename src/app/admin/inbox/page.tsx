import { InboxClient } from "@/components/inbox/inbox-client";

export const metadata = { title: "กล่องข้อความ — PropOS" };

export default function InboxPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  return <InboxClient initialSelectedId={searchParams.c ?? null} />;
}
