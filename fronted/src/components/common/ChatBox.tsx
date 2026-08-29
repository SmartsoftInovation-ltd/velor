import { useEffect, useRef, useState } from "react";
import { ChatIcon, CloseIcon, PaperPlaneIcon } from "../../icons";
import axiosSecure from "../../hooks/useAxiosSecure";

interface ChatSource {
  id: string;
  name: string;
  slug: string;
  price: number;
  thumbnail: string;
  score: number;
}

interface ChatMessage {
  id: number;
  from: "user" | "bot";
  text: string;
  sources?: ChatSource[];
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    from: "bot",
    text: "Hi! Ask me anything about our products — prices, stock, availability.",
  },
];

const ChatBox: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isSending]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "user", text: trimmed },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const res = await axiosSecure.post("/chat", { question: trimmed });
      const { answer, sources } = res.data.data as {
        answer: string;
        sources: ChatSource[];
      };
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, from: "bot", text: answer, sources },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          from: "bot",
          text: "Sorry, I couldn't get an answer right now. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="no-print fixed bottom-6 right-6 z-99999 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 flex h-[480px] w-[340px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-gray-200 bg-brand-500 px-4 py-3 dark:border-gray-800">
            <h4 className="text-sm font-semibold text-white">Chat Support</h4>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.from === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    message.from === "user"
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-800 dark:bg-white/[0.05] dark:text-white/90"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-black/10 pt-2 dark:border-white/10">
                      {message.sources.map((source) => (
                        <span
                          key={source.id}
                          className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-white/70"
                        >
                          {source.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400 dark:bg-white/[0.05] dark:text-white/50">
                  Typing…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-gray-200 px-3 py-3 dark:border-gray-800">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isSending}
              className="h-10 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
            <button
              onClick={handleSend}
              aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#DCE8FF] text-[#1D4ED8] hover:bg-[#C7DAFF] disabled:opacity-50"
              disabled={!input.trim() || isSending}
            >
              <PaperPlaneIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-lg transition hover:bg-brand-600"
      >
        {isOpen ? (
          <CloseIcon className="h-6 w-6" />
        ) : (
          <ChatIcon className="h-6 w-6" />
        )}
      </button>
    </div>
  );
};

export default ChatBox;
