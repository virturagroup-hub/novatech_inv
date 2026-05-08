import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { toast } from "sonner";

export default function CreateUserPage() {
  const { data: currentUser, loading: currentUserLoading } = useUser();
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("technician");
  const [tempPassword, setTempPassword] = useState("");

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

  const generatePassword = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // uppercase
    password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // lowercase
    password += "0123456789"[Math.floor(Math.random() * 10)]; // number
    password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // special
    for (let i = 0; i < 8; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  const handleGenerate = () => {
    const newPass = generatePassword();
    setTempPassword(newPass);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!name || !email || !tempPassword || !role) {
      toast.error("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, tempPassword, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create user");
        setLoading(false);
        return;
      }

      toast.success(
        `${role.charAt(0).toUpperCase() + role.slice(1)} user created successfully`,
      );
      setName("");
      setEmail("");
      setRole("technician");
      setTempPassword("");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

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
            Only admins and elevated users can create new users.
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
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-8 shadow-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New User</h1>
          <p className="text-sm text-gray-500 mt-2">
            New users will be required to change their password on first login
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Full Name
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Email
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tech@company.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              User Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            >
              <option value="technician">
                Technician - View & scan inventory
              </option>
              {currentUserRole === "admin" && (
                <>
                  <option value="elevated">
                    Elevated User - Technician + manage bins/models
                  </option>
                  <option value="admin">
                    Admin - Full access + user management
                  </option>
                </>
              )}
            </select>
            {currentUserRole === "elevated" && (
              <p className="text-xs text-gray-500">
                As an elevated user, you can only create technician accounts
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Temporary Password
            </label>
            <div className="flex gap-2">
              <input
                required
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="Click generate →"
              />
              <button
                type="button"
                onClick={handleGenerate}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                Generate
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Share this password with the new user. They'll change it on first
              login.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating user..." : "Create User"}
          </button>

          <a
            href="/"
            className="block text-center text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
