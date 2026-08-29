import { useNavigate } from "react-router";

const Unauthorized = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-6">
      <div className="size-24 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
        <svg className="size-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Access Denied</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 text-center max-w-sm">
        You don't have permission to view this page. Contact your administrator to request access.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
        >
          Go Back
        </button>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all shadow-lg shadow-brand-500/20"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
