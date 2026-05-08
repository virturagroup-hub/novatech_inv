"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { User, Mail, Shield, Key, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { data: user, loading, refetch } = useUser();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!user,
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }) => {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      setShowChangePassword(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/account/signin";
    }
    return null;
  }

  const profile = profileData?.user || user;
  const passwordAge = profile?.password_age_days;
  const needsPasswordChange = passwordAge && passwordAge >= 90;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-2">
            Manage your account settings and security
          </p>
        </div>

        {/* Password Expiration Warning */}
        {needsPasswordChange && (
          <div className="mb-6 bg-orange-50 border-2 border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-orange-500 rounded-lg text-white">
              <Shield size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">
                Password Change Required
              </h3>
              <p className="text-sm text-orange-700 mt-1">
                Your password is {passwordAge} days old. For security, please
                change it below.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6">
          {/* Profile Information */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Profile Information
              </h2>
              <p className="text-sm text-gray-600 mt-1">Your account details</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-3 bg-blue-100 rounded-full">
                  <User size={24} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase">
                    Name
                  </div>
                  <div className="text-base font-medium text-gray-900 mt-1">
                    {profile.name || "Not set"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-3 bg-green-100 rounded-full">
                  <Mail size={24} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase">
                    Email (Username)
                  </div>
                  <div className="text-base font-medium text-gray-900 mt-1">
                    {profile.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Shield size={24} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase">
                    Permission Level
                  </div>
                  <div className="text-base font-medium text-gray-900 mt-1 capitalize">
                    {profile.role || "technician"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Security</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your password and security settings
              </p>
            </div>
            <div className="p-6">
              {!showChangePassword ? (
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-full group-hover:bg-orange-200 transition-colors">
                      <Key size={24} className="text-orange-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">
                        Change Password
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {passwordAge !== undefined && passwordAge !== null
                          ? `Last changed ${passwordAge} days ago`
                          : "Update your password"}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className="text-gray-400 group-hover:text-gray-600"
                    size={20}
                  />
                </button>
              ) : (
                <ChangePasswordForm
                  onSubmit={(data) => changePasswordMutation.mutate(data)}
                  onCancel={() => setShowChangePassword(false)}
                  loading={changePasswordMutation.isPending}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordForm({ onSubmit, onCancel, loading }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    // Validate password requirements
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error("Password must contain at least one number");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      toast.error("Password must contain at least one special character");
      return;
    }

    onSubmit({ currentPassword, newPassword });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="text-xs font-semibold text-blue-900 mb-2">
          Password Requirements:
        </div>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• At least 8 characters long</li>
          <li>• One uppercase letter (A-Z)</li>
          <li>• One lowercase letter (a-z)</li>
          <li>• One number (0-9)</li>
          <li>• One special character (!@#$%^&*...)</li>
        </ul>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Current Password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          required
          minLength={8}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Confirm New Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          required
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Changing..." : "Change Password"}
        </button>
      </div>
    </form>
  );
}
