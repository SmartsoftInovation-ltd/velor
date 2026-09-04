import { useCallback, useEffect, useRef, useState } from "react";
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

const LAUNCHER_SIZE = 56; // h-14 / w-14
const EDGE_GAP = 24; // matches the original bottom-6 / right-6 resting spot
const POSITION_KEY = "chatbox-position";
// Below this many pixels of movement a pointer press counts as a click, not a
// drag — otherwise the tiny shift in a normal tap would swallow the toggle.
const DRAG_THRESHOLD = 4;

interface Position {
  x: number;
  y: number;
}

const clampToViewport = ({ x, y }: Position): Position => ({
  x: Math.min(Math.max(x, EDGE_GAP), window.innerWidth - LAUNCHER_SIZE - EDGE_GAP),
  y: Math.min(Math.max(y, EDGE_GAP), window.innerHeight - LAUNCHER_SIZE - EDGE_GAP),
});

const defaultPosition = (): Position => ({
  x: window.innerWidth - LAUNCHER_SIZE - EDGE_GAP,
  y: window.innerHeight - LAUNCHER_SIZE - EDGE_GAP,
});

const ChatBox: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // null until the first client-side measure, so we never read window during
  // the initial render.
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Offset from the launcher's top-left to the pointer, so the button doesn't
  // jump under the cursor when the drag starts.
  const grabOffset = useRef<Position>({ x: 0, y: 0 });
  const dragStart = useRef<Position>({ x: 0, y: 0 });
  // Set once the pointer travels past DRAG_THRESHOLD; read on click to decide
  // whether the release was a drag (ignore) or a tap (toggle).
  const didDrag = useRef(false);

  // Restore the last spot the user parked the launcher, re-clamped in case the
  // window is smaller than it was when they left.
  useEffect(() => {
    const stored = localStorage.getItem(POSITION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Position;
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setPosition(clampToViewport(parsed));
          return;
        }
      } catch {
        // Corrupt entry — fall through to the default corner.
      }
    }
    setPosition(defaultPosition());
  }, []);

  // Keep the launcher on screen when the window shrinks.
  useEffect(() => {
    const onResize = () =>
      setPosition((prev) => (prev ? clampToViewport(prev) : prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      grabOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      dragStart.current = { x: e.clientX, y: e.clientY };
      didDrag.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!isDragging) return;
      if (
        Math.abs(e.clientX - dragStart.current.x) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - dragStart.current.y) > DRAG_THRESHOLD
      ) {
        didDrag.current = true;
      }
      setPosition(
        clampToViewport({
          x: e.clientX - grabOffset.current.x,
          y: e.clientY - grabOffset.current.y,
        }),
      );
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!isDragging) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      setPosition((prev) => {
        if (prev) localStorage.setItem(POSITION_KEY, JSON.stringify(prev));
        return prev;
      });
    },
    [isDragging],
  );

  const handleLauncherClick = useCallback(() => {
    // A release that moved counts as parking the button, not opening it.
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setIsOpen((prev) => !prev);
  }, []);

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

  // Wait for the first measure so the launcher never flashes in the wrong spot.
  if (!position) return null;

  // The panel hangs off whichever side of the launcher has room, so dragging
  // the button to a corner doesn't push the chat window off screen.
  const openUpward = position.y > window.innerHeight / 2;
  const openLeftAligned = position.x < window.innerWidth / 2;

  return (
    <div
      className={`no-print fixed z-99999 flex ${
        openUpward ? "flex-col" : "flex-col-reverse"
      } ${openLeftAligned ? "items-start" : "items-end"}`}
      style={{
        left: position.x,
        top: position.y,
        // Anchor the stack on the launcher itself: when the panel opens
        // upward it grows out of the flow above the button, so the button
        // stays exactly where it was dropped.
        transform: openUpward
          ? "translateY(-100%) translateY(56px)"
          : undefined,
      }}
    >
      {isOpen && (
        <div
          className={`${
            openUpward ? "mb-4" : "mt-4"
          } flex h-[480px] w-[340px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 sm:w-[380px]`}
        >
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
        onClick={handleLauncherClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className={`flex h-14 w-14 touch-none items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-lg hover:bg-brand-600 ${
          isDragging ? "cursor-grabbing" : "cursor-grab transition"
        }`}
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
