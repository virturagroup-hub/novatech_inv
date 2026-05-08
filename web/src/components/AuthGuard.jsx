import { useEffect } from "react";
import useUser from "@/utils/useUser";

export default function AuthGuard({ children }) {
  const { data: user, loading } = useUser();

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to signin if not authenticated
      window.location.href = "/account/signin";
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
