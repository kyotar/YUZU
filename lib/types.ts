export type Post = {
  id: string;
  text: string;
  createdAt: number;
  emoji: string;
  blob: [string, string, string];
  sessionId: string;
};
