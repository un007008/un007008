import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ----- Admin user -----
  const passwordHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@bpp.local" },
    update: {},
    create: {
      email: "admin@bpp.local",
      password: passwordHash,
      name: "ผู้ดูแลระบบ BPP",
      role: "ADMIN",
    },
  });

  // ----- 5 sample properties -----
  const properties = [
    {
      refCode: "PS-00001",
      slug: "life-asoke-1br-sale",
      status: "AVAILABLE",
      listingType: "SALE",
      propertyType: "CONDO",
      title: {
        th: "คอนโด Life Asoke 1 ห้องนอน ใกล้ MRT เพชรบุรี",
        en: "Life Asoke Condo 1 Bedroom near MRT Phetchaburi",
        zh: "Life Asoke公寓 一居室 近地铁碧武里站",
      },
      description: {
        th: "ห้องสวย ชั้นสูง วิวเมือง เฟอร์นิเจอร์ครบ พร้อมเข้าอยู่",
        en: "Beautiful high-floor unit with city view, fully furnished, ready to move in.",
        zh: "高层美房，城市景观，家具齐全，拎包入住。",
      },
      priceSale: 3590000,
      bedrooms: 1,
      bathrooms: 1,
      areaSqm: 30.5,
      floor: 22,
      projectName: "Life Asoke",
      district: "ห้วยขวาง",
      btsMrt: "MRT เพชรบุรี",
      lat: 13.7508,
      lng: 100.5628,
      featured: true,
    },
    {
      refCode: "PS-00002",
      slug: "noble-ploenchit-2br-rent",
      status: "AVAILABLE",
      listingType: "RENT",
      propertyType: "CONDO",
      title: {
        th: "เช่าคอนโด Noble Ploenchit 2 ห้องนอน ติด BTS เพลินจิต",
        en: "Noble Ploenchit 2 Bedroom for Rent, next to BTS Ploenchit",
        zh: "Noble Ploenchit两居室出租 紧邻BTS奔集站",
      },
      description: {
        th: "ห้องมุม วิวสวน เครื่องใช้ไฟฟ้าครบ สัญญาขั้นต่ำ 1 ปี",
        en: "Corner unit with garden view, full appliances, minimum 1-year contract.",
        zh: "转角房，花园景观，电器齐全，最短租期一年。",
      },
      priceRent: 65000,
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 78,
      floor: 15,
      projectName: "Noble Ploenchit",
      district: "ปทุมวัน",
      btsMrt: "BTS เพลินจิต",
      lat: 13.7433,
      lng: 100.5488,
      featured: true,
    },
    {
      refCode: "PS-00003",
      slug: "baan-klang-muang-townhouse-sale",
      status: "AVAILABLE",
      listingType: "SALE",
      propertyType: "TOWNHOUSE",
      title: {
        th: "ทาวน์เฮาส์ บ้านกลางเมือง ลาดพร้าว 3 ชั้น",
        en: "Baan Klang Muang Ladprao 3-Storey Townhouse",
        zh: "Baan Klang Muang叻抛三层联排别墅",
      },
      description: {
        th: "3 ห้องนอน 3 ห้องน้ำ จอดรถ 2 คัน หมู่บ้านมีรปภ. 24 ชม.",
        en: "3 bed 3 bath, 2 parking spots, 24-hour security village.",
        zh: "三室三卫，两个车位，24小时保安社区。",
      },
      priceSale: 7900000,
      bedrooms: 3,
      bathrooms: 3,
      areaSqm: 160,
      projectName: "บ้านกลางเมือง ลาดพร้าว",
      district: "ลาดพร้าว",
      btsMrt: "MRT ลาดพร้าว",
      lat: 13.8063,
      lng: 100.5738,
      featured: false,
    },
    {
      refCode: "PS-00004",
      slug: "sathorn-house-sale-rent",
      status: "AVAILABLE",
      listingType: "SALE_AND_RENT",
      propertyType: "HOUSE",
      title: {
        th: "บ้านเดี่ยว 2 ชั้น ย่านสาทร ขาย/เช่า",
        en: "2-Storey Detached House in Sathorn for Sale/Rent",
        zh: "沙吞区两层独栋别墅 出售/出租",
      },
      description: {
        th: "บ้านเดี่ยวพร้อมสวน 4 ห้องนอน เหมาะทั้งอยู่อาศัยและทำโฮมออฟฟิศ",
        en: "Detached house with garden, 4 bedrooms, ideal for living or home office.",
        zh: "带花园独栋别墅，四间卧室，适合居住或家庭办公。",
      },
      priceSale: 25000000,
      priceRent: 120000,
      bedrooms: 4,
      bathrooms: 4,
      areaSqm: 320,
      district: "สาทร",
      btsMrt: "BTS ช่องนนทรี",
      lat: 13.7215,
      lng: 100.5297,
      featured: false,
    },
    {
      refCode: "PS-00005",
      slug: "bangna-land-sale",
      status: "AVAILABLE",
      listingType: "SALE",
      propertyType: "LAND",
      title: {
        th: "ที่ดินเปล่า 200 ตร.วา บางนา ใกล้เมกาบางนา",
        en: "200 sq.wah Vacant Land in Bangna near Mega Bangna",
        zh: "邦纳200平方哇空地 近Mega Bangna商场",
      },
      description: {
        th: "ที่ดินถมแล้ว ติดถนนซอยกว้าง เหมาะสร้างบ้านหรือลงทุน",
        en: "Filled land on a wide soi, suitable for building a house or investment.",
        zh: "已填土，临宽巷道，适合建房或投资。",
      },
      priceSale: 14000000,
      areaSqm: 800,
      district: "บางนา",
      lat: 13.6455,
      lng: 100.6802,
      featured: false,
    },
  ] as const;

  for (const p of properties) {
    await prisma.property.upsert({
      where: { refCode: p.refCode },
      update: {},
      create: p as never,
    });
  }

  // ----- 10 knowledge base entries -----
  const knowledge = [
    {
      question: "บริษัทเปิดทำการกี่โมง",
      answer: "เราเปิดทำการทุกวันจันทร์-เสาร์ เวลา 9:00-18:00 น. ค่ะ วันอาทิตย์สามารถนัดหมายล่วงหน้าได้ค่ะ",
      category: "general",
    },
    {
      question: "มีค่าบริการนายหน้าเท่าไหร่",
      answer: "กรณีขาย ค่านายหน้า 3% ของราคาขาย กรณีเช่า ค่านายหน้าเท่ากับค่าเช่า 1 เดือน (สัญญา 1 ปี) ค่ะ",
      category: "fees",
    },
    {
      question: "นัดชมทรัพย์ต้องทำอย่างไร",
      answer: "แจ้งรหัสทรัพย์หรือชื่อโครงการที่สนใจ พร้อมวันเวลาที่สะดวก ทีมงานจะยืนยันนัดภายใน 1 ชั่วโมงทำการค่ะ",
      category: "viewing",
    },
    {
      question: "ชาวต่างชาติซื้อคอนโดได้ไหม",
      answer: "ได้ค่ะ ชาวต่างชาติถือครองกรรมสิทธิ์คอนโดได้ไม่เกิน 49% ของพื้นที่โครงการ โดยต้องโอนเงินจากต่างประเทศพร้อมเอกสาร FET ค่ะ",
      category: "legal",
    },
    {
      question: "เช่าขั้นต่ำกี่เดือน",
      answer: "โดยทั่วไปสัญญาเช่าขั้นต่ำ 1 ปี บางห้องอาจรับสัญญา 6 เดือนได้ สอบถามรายห้องได้เลยค่ะ",
      category: "rent",
    },
    {
      question: "ต้องวางเงินมัดจำเท่าไหร่",
      answer: "การเช่า: มัดจำ 2 เดือน + ค่าเช่าล่วงหน้า 1 เดือน การซื้อ: เงินจอง/มัดจำตามตกลง โดยทั่วไป 1-5% ของราคาขายค่ะ",
      category: "fees",
    },
    {
      question: "มีบริการช่วยขอสินเชื่อไหม",
      answer: "มีค่ะ เราช่วยประสานงานกับธนาคารพันธมิตรหลายแห่ง ประเมินวงเงินเบื้องต้นฟรี ส่งเอกสารให้ทีมงานได้เลยค่ะ",
      category: "finance",
    },
    {
      question: "ค่าโอนกรรมสิทธิ์ใครจ่าย",
      answer: "โดยทั่วไปค่าธรรมเนียมโอน 2% แบ่งจ่ายคนละครึ่งระหว่างผู้ซื้อผู้ขาย ส่วนภาษีธุรกิจเฉพาะ/อากรและภาษีเงินได้เป็นของผู้ขาย ทั้งนี้ขึ้นกับการตกลงค่ะ",
      category: "legal",
    },
    {
      question: "ฝากขาย/ฝากเช่าทรัพย์ต้องทำอย่างไร",
      answer: "ส่งรายละเอียดทรัพย์ รูปถ่าย และเอกสารสิทธิ์ (โฉนด) มาให้ทีมงาน เราจะประเมินราคาและลงประกาศให้ฟรี ไม่มีค่าใช้จ่ายจนกว่าจะปิดการขาย/เช่าได้ค่ะ",
      category: "listing",
    },
    {
      question: "เลี้ยงสัตว์ได้ไหม",
      answer: "ขึ้นอยู่กับกฎของแต่ละโครงการค่ะ แจ้งชนิดสัตว์เลี้ยงและโครงการที่สนใจ ทีมงานจะเช็กให้ทันทีค่ะ",
      category: "rent",
    },
  ];

  // Idempotent: only seed KB when empty (KnowledgeEntry has no unique key to upsert on)
  const kbCount = await prisma.knowledgeEntry.count();
  if (kbCount === 0) {
    await prisma.knowledgeEntry.createMany({ data: knowledge });
  }

  console.log("Seed completed: 1 admin user, 5 properties, 10 knowledge entries");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
