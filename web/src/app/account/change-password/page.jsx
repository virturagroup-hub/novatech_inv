import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const { data: user, loading: userLoading } = useUser();
  const [mustChange, setMustChange] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validations, setValidations] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setMustChange(data.user?.must_change_password || false);
      }
    };
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    setValidations({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    });
  }, [newPassword]);

  const isPasswordValid = () => {
    return Object.values(validations).every((v) => v === true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!isPasswordValid()) {
      toast.error("Password does not meet requirements");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to change password");
        setLoading(false);
        return;
      }

      toast.success("Password changed successfully");

      // Redirect to home
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
      setLoading(false);
    }
  };

  if (userLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-8 shadow-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {mustChange ? "Change Your Password" : "Update Password"}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {mustChange
              ? "You must change your temporary password before continuing"
              : "Update your account password"}
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {mustChange ? "Temporary Password" : "Current Password"}
            </label>
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder={
                mustChange
                  ? "Enter temporary password"
                  : "Enter current password"
              }
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              New Password
            </label>
            <input
              required
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="Enter new password"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Confirm Password
            </label>
            <input
              required
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="Re-enter new password"
            />
          </div>

          {/* Password Requirements */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Password Requirements:
            </p>
            <ValidationItem
              valid={validations.length}
              text="At least 8 characters"
            />
            <ValidationItem
              valid={validations.uppercase}
              text="At least one uppercase letter (A-Z)"
            />
            <ValidationItem
              valid={validations.lowercase}
              text="At least one lowercase letter (a-z)"
            />
            <ValidationItem
              valid={validations.number}
              text="At least one number (0-9)"
            />
            <ValidationItem
              valid={validations.special}
              text="At least one special character (!@#$%^&*)"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid()}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Changing password..." : "Change Password"}
          </button>

          {!mustChange && (
            <a
              href="/"
              className="block text-center text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </a>
          )}
        </div>
      </form>
    </div>
  );
}

function ValidationItem({ valid, text }) {
  return (
    <div className="flex items-center gap-2">
      {valid ? (
        <svg
          className="w-4 h-4 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
        </svg>
      )}
      <span className={`text-xs ${valid ? "text-green-700" : "text-gray-600"}`}>
        {text}
      </span>
    </div>
  );
}
