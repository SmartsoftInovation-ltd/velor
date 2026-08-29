import useIsMobile from "../../hooks/useIsMobile";

interface MobileActionBarProps {
  children: React.ReactNode;
  className?: string;
}

// Sticky footer for long forms on mobile so submit/cancel stay reachable.
// Renders children inline unchanged at md and above.
const MobileActionBar: React.FC<MobileActionBarProps> = ({
  children,
  className = "",
}) => {
  const isMobile = useIsMobile();

  if (!isMobile) return <>{children}</>;

  return (
    <>
      <div className="h-20" aria-hidden="true" />
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 border-t border-gray-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-gray-900 [&>*]:flex-1 [&_button]:min-h-11 [&_button]:w-full ${className}`}
      >
        {children}
      </div>
    </>
  );
};

export default MobileActionBar;
