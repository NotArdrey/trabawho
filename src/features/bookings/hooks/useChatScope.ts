type Scope = "incoming" | "purchases";
interface Options {
  isWorker: boolean;
  isChat: boolean;
  isProviderRoute: boolean;
  requestedScope: string | null;
  selectedId: string | null;
  userId: string;
}
export function useChatScope({ isWorker }: Options) {
  const activeScope: Scope = isWorker ? 'incoming' : 'purchases';
  return { activeScope, isResolvingChatScope: false };
}
