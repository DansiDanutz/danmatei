export type ChatThread = {
  id: string;
  title: string;
  updatedAt: string;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  createdAt: string;
};
