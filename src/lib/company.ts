import { prisma } from "@/lib/db";

/** Company (document issuer) profile — stored in SiteConfig("company").data */
export type CompanyProfile = {
  name: string;
  taxId: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
};

export const EMPTY_COMPANY: CompanyProfile = {
  name: "",
  taxId: "",
  branch: "",
  address: "",
  phone: "",
  email: "",
};

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const config = await prisma.siteConfig.findUnique({ where: { id: "company" } });
  const data = (config?.data ?? {}) as Partial<CompanyProfile>;
  return {
    name: typeof data.name === "string" ? data.name : "",
    taxId: typeof data.taxId === "string" ? data.taxId : "",
    branch: typeof data.branch === "string" ? data.branch : "",
    address: typeof data.address === "string" ? data.address : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    email: typeof data.email === "string" ? data.email : "",
  };
}
