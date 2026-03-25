"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";

interface ProfileDropdownProps {
  userEmail: string | null;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function ProfileDropdown({ userEmail, isAdmin, onLogout }: ProfileDropdownProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminSubmenuOpen, setIsAdminSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsAdminSubmenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-text-primary/5 transition-colors text-text-primary"
      >
        <span className="text-sm">{userEmail || "Пользователь"}</span>
        <svg
          className={`w-4 h-4 transition-transform ${
            isMenuOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] rounded-lg border-2 border-[var(--border)] shadow-xl z-50">
          <div className="p-4 border-b-2 border-[var(--border-light)]">
            <p className="text-sm text-text-secondary">
              Email
            </p>
            <p className="font-medium text-text-primary break-all">
              {userEmail}
            </p>
          </div>
          {isAdmin && (
            <div className="border-b-2 border-[var(--border-light)]">
              <button
                onClick={() => setIsAdminSubmenuOpen(!isAdminSubmenuOpen)}
                className="w-full text-left px-4 py-3 text-accent hover:bg-accent/10 transition-colors font-medium flex items-center justify-between"
              >
                <span>Админ-панель</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isAdminSubmenuOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isAdminSubmenuOpen && (
                <div className="bg-[var(--surface-secondary)] border-t-2 border-[var(--border-light)]">
                  <button
                    onClick={() => {
                      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
                      window.open(`${backendUrl}/sqladmin`, "_blank");
                      setIsAdminSubmenuOpen(false);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-8 py-2 text-text-primary hover:bg-text-primary/5 transition-colors text-sm"
                  >
                    SQLAdmin
                  </button>
                  <button
                    onClick={() => {
                      router.push("/admin/business-plans");
                      setIsAdminSubmenuOpen(false);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-8 py-2 text-text-primary hover:bg-text-primary/5 transition-colors text-sm"
                  >
                    Бизнес-планы
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full text-left px-4 py-3 text-[var(--error-text)] hover:bg-[var(--error-background)] transition-colors font-medium"
          >
            Выход
          </button>
        </div>
      )}
    </div>
  );
}

