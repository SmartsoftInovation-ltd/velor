import React from "react";

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-10 w-full h-full">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-brand-100 dark:border-brand-900 rounded-full border-t-brand-500 animate-spin"></div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
};

export default Loader;
