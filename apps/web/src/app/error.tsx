"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-void text-primary p-8">
      <h2 className="text-size-xl font-medium mb-4">Something went wrong</h2>
      <p className="text-secondary text-size-sm mb-6 text-center max-w-md">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
