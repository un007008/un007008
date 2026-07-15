/** Homepage section builder — config stored in SiteConfig("homepage").data */

export const SECTION_TYPES = [
  "hero",
  "propertyTypes",
  "popularLocations",
  "featuredProperties",
  "forSale",
  "forRent",
  "promotionBanner",
  "featuredArticles",
  "cta",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export type LangText = { th: string; en: string; zh: string };

export type SectionConfig = {
  id: string; // stable key for reordering
  type: SectionType;
  visible: boolean;
  /** per-language manual-edit flags: when true, auto-translate must not overwrite */
  editedEn?: boolean;
  editedZh?: boolean;
  title: LangText;
  subtitle: LangText;
  /** promotionBanner/cta: button label + link */
  buttonLabel?: LangText;
  buttonUrl?: string;
};

export type HomepageConfig = { sections: SectionConfig[] };

export const SECTION_LABEL: Record<SectionType, string> = {
  hero: "Hero (แบนเนอร์ใหญ่ + ช่องค้นหา)",
  propertyTypes: "ประเภททรัพย์",
  popularLocations: "ทำเลยอดนิยม",
  featuredProperties: "ทรัพย์แนะนำ",
  forSale: "ประกาศขายล่าสุด",
  forRent: "ประกาศเช่าล่าสุด",
  promotionBanner: "แบนเนอร์โปรโมชัน",
  featuredArticles: "บทความล่าสุด",
  cta: "ชวนติดต่อ (CTA)",
};

const L = (th: string, en: string, zh: string): LangText => ({ th, en, zh });

export const DEFAULT_HOMEPAGE: HomepageConfig = {
  sections: [
    {
      id: "hero",
      type: "hero",
      visible: true,
      title: L(
        "พบบ้านที่ใช่ ในทำเลที่ชอบ",
        "Find the right home in the right location",
        "在心仪的地段找到理想的家"
      ),
      subtitle: L(
        "คอนโด บ้าน ทาวน์เฮาส์ และที่ดินคุณภาพในกรุงเทพฯ",
        "Quality condos, houses, townhouses and land in Bangkok",
        "曼谷优质公寓、别墅、联排别墅及土地"
      ),
    },
    {
      id: "propertyTypes",
      type: "propertyTypes",
      visible: true,
      title: L("เลือกตามประเภททรัพย์", "Browse by property type", "按房源类型浏览"),
      subtitle: L("", "", ""),
    },
    {
      id: "popularLocations",
      type: "popularLocations",
      visible: true,
      title: L("ทำเลยอดนิยม", "Popular locations", "热门区域"),
      subtitle: L("", "", ""),
    },
    {
      id: "featuredProperties",
      type: "featuredProperties",
      visible: true,
      title: L("ทรัพย์แนะนำ", "Featured properties", "精选房源"),
      subtitle: L("", "", ""),
    },
    {
      id: "forSale",
      type: "forSale",
      visible: true,
      title: L("ประกาศขายล่าสุด", "Latest for sale", "最新出售房源"),
      subtitle: L("", "", ""),
    },
    {
      id: "forRent",
      type: "forRent",
      visible: true,
      title: L("ประกาศเช่าล่าสุด", "Latest for rent", "最新出租房源"),
      subtitle: L("", "", ""),
    },
    {
      id: "promotionBanner",
      type: "promotionBanner",
      visible: false,
      title: L("โปรโมชันพิเศษเดือนนี้", "Special promotion this month", "本月特别优惠"),
      subtitle: L("ฝากขายฟรี ไม่มีค่าใช้จ่ายจนกว่าจะขายได้", "List with us for free", "免费挂牌出售"),
      buttonLabel: L("ดูรายละเอียด", "Learn more", "了解详情"),
      buttonUrl: "",
    },
    {
      id: "featuredArticles",
      type: "featuredArticles",
      visible: true,
      title: L("บทความและความรู้", "Articles & guides", "文章与指南"),
      subtitle: L("", "", ""),
    },
    {
      id: "cta",
      type: "cta",
      visible: true,
      title: L("ให้เราช่วยหาบ้านในฝันของคุณ", "Let us find your dream home", "让我们帮您找到理想的家"),
      subtitle: L(
        "ทักแชทหาทีมงานได้เลย ตอบไวทุกวัน",
        "Chat with our team — quick replies every day",
        "随时联系我们的团队，每天快速回复"
      ),
      buttonLabel: L("แชท LINE", "Chat on LINE", "LINE 咨询"),
      buttonUrl: "",
    },
  ],
};

/** Merge stored config with defaults so new section types appear automatically. */
export function normalizeHomepage(data: unknown): HomepageConfig {
  const stored = (data as HomepageConfig | null)?.sections;
  if (!Array.isArray(stored) || stored.length === 0) return DEFAULT_HOMEPAGE;
  const byType = new Map(stored.map((s) => [s.type, s]));
  const missing = DEFAULT_HOMEPAGE.sections.filter((d) => !byType.has(d.type));
  return { sections: [...stored, ...missing.map((m) => ({ ...m, visible: false }))] };
}
