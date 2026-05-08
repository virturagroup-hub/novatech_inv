import useAuth from "@/utils/useAuth";

export default function LogoutPage() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut({
      callbackUrl: "/account/signin",
      redirect: true,
    });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-8 shadow-sm text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Sign Out</h1>
        <p className="text-sm text-gray-600 mb-8">
          Are you sure you want to sign out?
        </p>

        <button
          onClick={handleSignOut}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Sign Out
        </button>

        <a
          href="/"
          className="block mt-4 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </a>
      </div>
    </div>
  );
}
