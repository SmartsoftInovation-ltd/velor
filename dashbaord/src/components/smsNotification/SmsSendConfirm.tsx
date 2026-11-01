import { FaPaperPlane, FaTimes } from "react-icons/fa";
import { Modal } from "../ui/modal";
import SmsPreview from "./SmsPreview";

// A last look before a send that reaches many people: the exact message, who
// gets it and how many SMS that is. Nothing is sent until "Send" is pressed.
const SmsSendConfirm = ({
  isOpen,
  onClose,
  onConfirm,
  sending,
  message,
  recipientLabel,
  recipientCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sending: boolean;
  message: string;
  recipientLabel: string;
  recipientCount: number;
}) => (
  <Modal isOpen={isOpen} onClose={sending ? () => {} : onClose} className="w-full max-w-md" showCloseButton={false}>
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Send this message?</h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {recipientCount.toLocaleString()} {recipientCount === 1 ? "person" : "people"} · {recipientLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          aria-label="Close"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300"
        >
          <FaTimes className="size-3" />
        </button>
      </div>

      <SmsPreview message={message} recipientLabel={recipientLabel} recipientCount={recipientCount} compact />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
        >
          Back to edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={sending}
          className="shine flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-70"
        >
          {sending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Sending…
            </>
          ) : (
            <>
              <FaPaperPlane className="size-3.5" />
              Send to {recipientCount.toLocaleString()}
            </>
          )}
        </button>
      </div>
    </div>
  </Modal>
);

export default SmsSendConfirm;
