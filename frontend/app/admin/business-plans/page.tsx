"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { authAPI, adminAPI, BusinessPlanAdmin } from "@/lib/api";
import ProfileDropdown from "@/components/ProfileDropdown";

export default function AdminBusinessPlansPage() {
  const router = useRouter();
  
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessPlans, setBusinessPlans] = useState<BusinessPlanAdmin[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<BusinessPlanAdmin | null>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [totalPlans, setTotalPlans] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [searchEmail, setSearchEmail] = useState("");

  useEffect(() => {
    fetchUserInfo();
  }, []);

  useEffect(() => {
    if (userEmail && isAdmin) {
      loadBusinessPlans();
    }
  }, [userEmail, isAdmin, offset, searchEmail]);

  const fetchUserInfo = async () => {
    try {
      const response = await authAPI.me();
      setUserEmail(response.email);
      setIsAdmin(response.is_admin);
      setLoading(false);
      
      if (!response.is_admin) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to fetch user info:", error);
      router.push("/");
    }
  };

  const loadBusinessPlans = async () => {
    try {
      setIsLoadingPlans(true);
      const response = await adminAPI.listAllBusinessPlans(
        searchEmail || undefined,
        limit,
        offset
      );
      setBusinessPlans(response.business_plans);
      setTotalPlans(response.total);
    } catch (error) {
      console.error("Failed to load business plans:", error);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      const plan = await adminAPI.getBusinessPlan(planId);
      setSelectedPlan(plan);
    } catch (error) {
      console.error("Failed to load business plan:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-black dark:text-white">Загрузка...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="border-b-2 border-black/20 dark:border-white/20 bg-white dark:bg-zinc-900 flex-shrink-0 shadow-sm">
        <div className="w-full px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              title="Назад к панели"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-black dark:text-white">
              Админ-панель: Бизнес-планы
            </h1>
          </div>

          {/* User Menu */}
          <ProfileDropdown
            userEmail={userEmail}
            isAdmin={isAdmin}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-hidden flex">
        {/* Left: Business Plans List */}
        <div className="w-80 border-r-2 border-black/20 dark:border-white/20 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden shadow-lg">
          <div className="border-b-2 border-black/15 dark:border-white/15 p-3 bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
            <h2 className="text-sm font-semibold text-black dark:text-white mb-2">
              Все бизнес-планы
            </h2>
            <input
              type="text"
              placeholder="Фильтр по email..."
              value={searchEmail}
              onChange={(e) => {
                setSearchEmail(e.target.value);
                setOffset(0);
              }}
              className="w-full px-3 py-1.5 text-sm border border-black/20 dark:border-white/20 rounded bg-white dark:bg-zinc-900 text-black dark:text-white"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {isLoadingPlans ? (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                Загрузка...
              </div>
            ) : businessPlans.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                Нет бизнес-планов
              </div>
            ) : (
              <div className="space-y-2">
                {businessPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      selectedPlan?.id === plan.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-black/15 dark:border-white/15 hover:border-black/25 dark:hover:border-white/25 bg-zinc-50 dark:bg-zinc-800"
                    }`}
                  >
                    <h3 className="text-sm font-medium text-black dark:text-white mb-1">
                      {plan.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      ID: {plan.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Обновлен: {new Date(plan.updated_at).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Business Plan View */}
        <div className="flex-1 overflow-y-auto p-8">
          {selectedPlan ? (
            <div className="max-w-4xl mx-auto">
              {/* Plan Info */}
              <div className="mb-6 p-4 bg-white dark:bg-zinc-900 rounded-lg border-2 border-black/15 dark:border-white/15">
                <h2 className="text-xl font-bold text-black dark:text-white mb-2">
                  {selectedPlan.title}
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">ID:</span>
                    <span className="ml-2 text-black dark:text-white">{selectedPlan.id}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Email пользователя:</span>
                    <span className="ml-2 text-black dark:text-white">{selectedPlan.user_email}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Название компании:</span>
                    <span className="ml-2 text-black dark:text-white">{selectedPlan.company_name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Создан:</span>
                    <span className="ml-2 text-black dark:text-white">
                      {new Date(selectedPlan.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Обновлен:</span>
                    <span className="ml-2 text-black dark:text-white">
                      {new Date(selectedPlan.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Plan Content */}
              <div className="bg-white dark:bg-zinc-900 shadow-2xl w-full min-h-[297mm] p-12 mb-8 border-2 border-zinc-300 dark:border-zinc-700">
                <div className="prose prose-sm max-w-none dark:prose-invert text-black dark:text-white [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 [&_li]:mb-1 [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-zinc-300 [&_th]:dark:border-zinc-700 [&_th]:px-4 [&_th]:py-2 [&_th]:bg-zinc-100 [&_th]:dark:bg-zinc-800 [&_th]:font-semibold [&_th]:text-left [&_td]:border [&_td]:border-zinc-300 [&_td]:dark:border-zinc-700 [&_td]:px-4 [&_td]:py-2">
                  {selectedPlan.user_content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedPlan.user_content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-zinc-500 dark:text-zinc-400">
                      Бизнес-план пуст
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-zinc-500 dark:text-zinc-400">
                <p className="text-lg mb-2">Выберите бизнес-план</p>
                <p className="text-sm">Выберите бизнес-план из списка слева для просмотра</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

