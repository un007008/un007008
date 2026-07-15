import { redirect } from "next/navigation";

import { KanbanClient, type KanbanLead } from "@/components/crm/kanban-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "CRM Pipeline — PropOS" };
export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/crm");

  const leads = await prisma.lead.findMany({
    where: session.user.role === "ADMIN" ? {} : { assignedTo: session.user.id },
    include: { contact: true },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const propertyIds = Array.from(
    new Set(leads.map((l) => l.propertyId).filter((v): v is string => Boolean(v)))
  );
  const properties = propertyIds.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, refCode: true },
      })
    : [];
  const propertyRef = new Map(properties.map((p) => [p.id, p.refCode]));

  const data: KanbanLead[] = leads.map((l) => ({
    id: l.id,
    stage: l.stage,
    interest: l.interest,
    source: l.source,
    budgetMax: l.budgetMax?.toString() ?? null,
    propertyRef: l.propertyId ? (propertyRef.get(l.propertyId) ?? null) : null,
    contactName: l.contact.name,
    contactPhone: l.contact.phone,
    assignedName: l.assignedTo ? (userName.get(l.assignedTo) ?? null) : null,
  }));

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">CRM Pipeline</h1>
      <KanbanClient initialLeads={data} />
    </div>
  );
}
