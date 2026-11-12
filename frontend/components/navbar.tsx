
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (loading || !user || user.must_change_password) {
    return null;
  }

  const links = [
    { href: "/", label: "Chat" },
    { href: "/purchases/new", label: "New Purchase" },
    { href: "/purchases", label: "Purchase History" },
  ];

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }


    return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-gray-800 bg-[#0a0a0a] p-5">
        <h2 className="mb-10 text-lg font-semibold text-white">
        Purchasing Assistant
        </h2>

        <nav className="flex flex-col gap-2">
        {links.map((link) => (
            <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-4 py-3 transition-colors ${
                pathname === link.href
                ? "bg-gray-800 font-medium text-white"
                : "text-gray-400 hover:bg-gray-900 hover:text-white"
            }`}
            >
            {link.label}
            </Link>
        ))}
        </nav>

        <div className="mt-auto border-t border-gray-800 pt-5">
        <p className="mb-4 text-sm text-gray-400">
            {user.name}
        </p>

        <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg border border-gray-700 px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800"
        >
            Logout
        </button>
        </div>
    </aside>
    );

}