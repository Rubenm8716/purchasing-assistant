
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "employee";
  must_change_password: boolean;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const response = await fetch("http://localhost:8000/auth/me", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();
      setUser(data);
    } catch (error) {
      console.error("Failed to check authentication:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshUser();
  }, []);

    async function logout() {
    try {
        const response = await fetch("http://localhost:8000/auth/logout", {
        method: "POST",
        credentials: "include",
        });

        if (!response.ok) {
        throw new Error(`Logout failed: ${response.status}`);
        }

        // Clear the authenticated user from React state.
        setUser(null);
    } catch (error) {
        console.error("Failed to log out:", error);
        throw error;
    }
    }


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        logout,
        //logout: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
