"use client";

import { useEffect } from "react";
import useUser from "@/utils/useUser";

export default function CheckPasswordChangePage() {
  const { data: user, loading } = useUser();

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!user) return;

      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();

        // Check if password change is required (either forced or 90+ days old)
        const mustChange = data.user?.must_change_password;
        const passwordAge = data.user?.password_age_days;
        const needsChange = mustChange || (passwordAge && passwordAge >= 90);

        if (needsChange) {
          // Redirect to password change page
          window.location.href = "/account/change-password";
        } else {
          // Redirect to dashboard
          window.location.href = "/";
        }
      } else {
        // If profile fetch fails, just go to homepage
        window.location.href = "/";
      }
    };

    if (!loading && user) {
      checkAndRedirect();
    }
  }, [user, loading]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <p className="text-gray-600">Signing in...</p>
    </div>
  );
}
