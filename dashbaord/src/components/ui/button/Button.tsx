import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode; // Button text or content
  size?: "sm" | "md"; // Button size
  variant?: "primary" | "secondary" | "outline"; // Button variant
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  onClick?: () => void; // Click handler
  disabled?: boolean; // Disabled state
  className?: string; // Additional classes
  title?: string; // Tooltip title
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  className = "",
  disabled = false,
  title,
}) => {
  // Size Classes
  const sizeClasses = {
    sm: "px-2 py-2 text-md",
    md: "px-4 py-3 text-sm",
  };

 // One button look across the whole app: #DCE8FF, dark blue label, no border.
  // All three variants resolve to it so existing `variant` props keep working.
  const baseVariant =
"bg-[#DCE8FF] text-[#1D4ED8] shadow-theme-xs hover:bg-[#C7DAFF] disabled:bg-[#EEF4FF] disabled:text-[#9DB2E8]";
  const variantClasses = {
    primary: baseVariant,
    secondary: baseVariant,
    outline: baseVariant,
  };

  return (
    <button
      // className last so a caller can still override the shared look.
      className={`shine [--shine-duration:0.45s] inline-flex items-center justify-center gap-2 rounded-md border-none transition ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {startIcon ? <span className="flex items-center">{startIcon}</span> : null}
      {/* Wrapped so React keeps a stable host node for the label. A bare string
          child sitting between two conditional siblings could keep its old text
          in the DOM when the label changed (e.g. "Creating..." staying put after
          a failed submit reset the loading flag).
          `key={disabled ? "busy" : "idle"}` forces a full unmount/remount of
          this span instead of a partial diff whenever a caller swaps its
          children's shape across a loading-state toggle (typically a fragment
          with a spinner + "Processing..." while busy, a bare string once
          idle). Diffing across shapes like that, at the same time `disabled`
          itself flips (which changes this element's own className above),
          intermittently threw "Failed to execute 'removeChild' on 'Node'" —
          React's commit and this button's own reconciliation landing on the
          same node from two different diff paths in the same pass. A stable
          key makes the swap an unambiguous replace instead of a diff. */}
      <span key={disabled ? "busy" : "idle"} className="contents">
        {children}
      </span>
      {endIcon ? <span className="flex items-center">{endIcon}</span> : null}
    </button>
  );
};

export default Button;
