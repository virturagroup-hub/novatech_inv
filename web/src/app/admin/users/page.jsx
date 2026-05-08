import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, User, Users, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import useUser from "@/utils/useUser";
import { format } from "date-fns";

export default function UserManagementPage() {
  const { data: currentUser, loading: currentUserLoading } = useUser();
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [showResetModal, setShowResetModal] = useState(null);
  const queryClient = useQueryClient();

  // Fetch current user's full profile to get role
  useEffect(() => {
    const fetchProfile = async () => {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setCurrentUserRole(data.user?.role);
      }
    };
    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser]);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await res.json();
      return data.users;
    },
    enabled:
      !!currentUser &&
      (currentUserRole === "admin" || currentUserRole === "elevated"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User role updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, tempPassword }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset password");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowResetModal(null);
      toast.success("Password reset successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reset password");
    },
  });

  if (currentUserLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (
    !currentUserRole ||
    (currentUserRole !== "admin" && currentUserRole !== "elevated")
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page.
          </p>
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <header className="p-8 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
              User Management
            </h2>
            <p className="text-gray-500 mt-1">
              Manage user roles and permissions.
            </p>
          </div>
          <a
            href="/account/create-user"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Create New User
          </a>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto">
        {/* Role Explanation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <RoleCard
            icon={<User size={20} />}
            title="Technician"
            description="Can view dashboard and inventory, scan QR codes to add/remove parts"
            color="text-gray-600 bg-gray-50"
          />
          <RoleCard
            icon={<Users size={20} />}
            title="Elevated User"
            description="Technician + create/edit bins and models, run reports"
            color="text-blue-600 bg-blue-50"
          />
          <RoleCard
            icon={<Shield size={20} />}
            title="Admin"
            description="Full access: all features + user management"
            color="text-purple-600 bg-purple-50"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Users</h3>
            <p className="text-sm text-gray-500 mt-1">
              {users.length} total users
            </p>
          </div>

          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                  Current Role
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                  Joined
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">
                  Change Role
                </th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-gray-900">
                      {user.name || "No name"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{user.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getRoleBadgeStyle(user.role)}`}
                    >
                      {user.role || "technician"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500">
                      {user.created_at
                        ? format(new Date(user.created_at), "MMM d, yyyy")
                        : "Unknown"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {currentUserRole === "admin" ? (
                      <>
                        <select
                          value={user.role || "technician"}
                          onChange={(e) =>
                            updateRoleMutation.mutate({
                              userId: user.id,
                              role: e.target.value,
                            })
                          }
                          disabled={user.id === currentUser?.id}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="technician">Technician</option>
                          <option value="elevated">Elevated User</option>
                          <option value="admin">Admin</option>
                        </select>
                        {user.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-gray-400">
                            (You)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">View only</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setShowResetModal(user)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Reset Password"
                      >
                        <KeyRound size={16} />
                      </button>
                      {currentUserRole === "admin" &&
                        user.id !== currentUser?.id && (
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete user ${user.email}? This cannot be undone.`,
                                )
                              ) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">
              No users found.
            </div>
          )}
        </div>
      </div>

      {showResetModal && (
        <PasswordResetModal
          user={showResetModal}
          onClose={() => setShowResetModal(null)}
          onReset={(tempPassword) =>
            resetPasswordMutation.mutate({
              userId: showResetModal.id,
              tempPassword,
            })
          }
        />
      )}
    </div>
  );
}

function RoleCard({ icon, title, description, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div
        className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${color} mb-4`}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function getRoleBadgeStyle(role) {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-700";
    case "elevated":
      return "bg-blue-100 text-blue-700";
    case "technician":
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function PasswordResetModal({ user, onClose, onReset }) {
  const [tempPassword, setTempPassword] = useState("");

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            Reset Password
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Reset password for {user.email}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temporary Password
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Enter temporary password"
              />
              <button
                onClick={generatePassword}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Generate
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              User will be required to change this password on next login.
            </p>
          </div>

          {tempPassword && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-900 mb-1">
                Remember to share this password securely with the user:
              </p>
              <code className="text-sm font-mono text-blue-700 bg-white px-2 py-1 rounded border border-blue-200">
                {tempPassword}
              </code>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-2.5 border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!tempPassword) {
                toast.error("Please enter a temporary password");
                return;
              }
              onReset(tempPassword);
            }}
            disabled={!tempPassword}
            className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}
