export type ConversationSummary = {
  id: string;
  channel: string;
  status: "AI_HANDLING" | "HUMAN_HANDLING" | "CLOSED";
  assignedTo: string | null;
  updatedAt: string;
  contact: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    note: string | null;
    tags: string[];
    lineUserId: string | null;
  };
  lastMessage: {
    content: string;
    sender: string;
    createdAt: string;
  } | null;
};

export type ChatMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  sender: "CUSTOMER" | "AI" | "STAFF";
  content: string;
  contentType: string;
  createdAt: string;
};

export type PropertyOption = {
  id: string;
  refCode: string;
  title: string;
  listingType: string;
  priceSale: string | null;
  priceRent: string | null;
  district: string | null;
  thumbUrl: string | null;
};

export type InboxFilter = "all" | "mine" | "unassigned" | "ai";
