"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { authAPI, businessPlanAPI, companyAPI, BusinessPlan, Company, BusinessPlanConfig } from "@/lib/api";
import MultiSelectSearchInput from "@/components/MultiSelectSearchInput";
import ProfileDropdown from "@/components/ProfileDropdown";

export default function Dashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessPlans, setBusinessPlans] = useState<BusinessPlan[]>([]);
  const [userCompany, setUserCompany] = useState<Company | null>(null);
  const [config, setConfig] = useState<BusinessPlanConfig | null>(null);
  
  // Company modal state
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<"ИП" | "ТОО">("ТОО");
  const [companyBin, setCompanyBin] = useState("");
  const [companyOkedCodes, setCompanyOkedCodes] = useState<string[]>([]);
  const [isCompanyLoading, setIsCompanyLoading] = useState(false);
  
  // Business plan creation state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planPriorityActivities, setPlanPriorityActivities] = useState<string[]>([]);
  const [planParticipationPeriodYears, setPlanParticipationPeriodYears] = useState<string>("1");
  const [planPlannedSubmissionYear, setPlanPlannedSubmissionYear] = useState<string>(new Date().getFullYear().toString());
  const [isCreatingPlanLoading, setIsCreatingPlanLoading] = useState(false);
  
  // Business plan edit state
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanName, setEditPlanName] = useState("");
  const [editPlanPriorityActivities, setEditPlanPriorityActivities] = useState<string[]>([]);
  const [editPlanParticipationPeriodYears, setEditPlanParticipationPeriodYears] = useState<string>("1");
  const [editPlanPlannedSubmissionYear, setEditPlanPlannedSubmissionYear] = useState<string>(new Date().getFullYear().toString());
  const [isUpdatingPlanLoading, setIsUpdatingPlanLoading] = useState(false);

  // Flatten OKED structure for MultiSelectSearchInput
  const flattenedOked = useMemo(() => {
    if (!config) return [];
    
    interface OkedItem {
      code: string;
      name: string;
      items?: OkedItem[];
    }
    
    function flatten(
      items: OkedItem[],
      parentPath: string = "",
      result: Array<{ code: string; name: string; fullPath: string }> = []
    ): Array<{ code: string; name: string; fullPath: string }> {
      for (const item of items) {
        // Skip section headers
        if (item.code.startsWith("Раздел")) {
          if (item.items) {
            flatten(item.items, "", result);
          }
          continue;
        }
        
        const fullPath = parentPath ? `${parentPath} > ${item.name}` : item.name;
        result.push({
          code: item.code,
          name: item.name,
          fullPath: `${item.code} - ${item.name}`,
        });
        
        if (item.items) {
          flatten(item.items, fullPath, result);
        }
      }
      return result;
    }
    
    return flatten(config.oked_classifier);
  }, [config]);

  useEffect(() => {
    fetchUserInfo();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (userEmail) {
      loadBusinessPlans();
      fetchUserCompany();
    }
  }, [userEmail]);

  const fetchUserInfo = async () => {
    try {
      const response = await authAPI.me();
      setUserEmail(response.email);
      setIsAdmin(response.is_admin);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch user info:", error);
      router.push("/");
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await businessPlanAPI.getConfig();
      setConfig(response);
    } catch (error) {
      console.error("Failed to fetch config:", error);
    }
  };

  const fetchUserCompany = async () => {
    try {
      const company = await companyAPI.getCompany();
      setUserCompany(company);
    } catch (error: any) {
      // 404 means no company exists yet, which is fine
      if (error.message?.includes("404") || error.message?.includes("not found")) {
        setUserCompany(null);
      } else {
        console.error("Failed to fetch company:", error);
      }
    }
  };

  const loadBusinessPlans = async () => {
    try {
      const response = await businessPlanAPI.listBusinessPlans();
      setBusinessPlans(response.business_plans);
    } catch (error) {
      console.error("Failed to load business plans:", error);
    }
  };

  const handleCreateBusinessPlan = () => {
    if (!userCompany) {
      // Show company creation form first
      setIsEditingCompany(false);
      setIsCompanyModalOpen(true);
    } else {
      // Show business plan creation form
      setIsPlanModalOpen(true);
      setPlanName("");
      setPlanPriorityActivities([]);
    }
  };

  const handleEditCompany = () => {
    if (!userCompany) return;
    setIsEditingCompany(true);
    setCompanyName(userCompany.name);
    setCompanyType(userCompany.type as "ИП" | "ТОО");
    setCompanyBin(userCompany.bin);
    setCompanyOkedCodes(userCompany.oked_codes);
    setIsCompanyModalOpen(true);
  };

  const handleSubmitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !companyBin || companyOkedCodes.length === 0 || isCompanyLoading) return;
    
    // Validate БИН: 12 digits
    if (!/^\d{12}$/.test(companyBin)) {
      alert("БИН должен содержать ровно 12 цифр");
      return;
    }
    
    setIsCompanyLoading(true);
    try {
      if (isEditingCompany) {
        const updatedCompany = await companyAPI.updateCompany(
          companyName.trim(),
          companyType,
          companyBin,
          companyOkedCodes
        );
        setUserCompany(updatedCompany);
      } else {
        const newCompany = await companyAPI.createCompany(
          companyName.trim(),
          companyType,
          companyBin,
          companyOkedCodes
        );
        setUserCompany(newCompany);
      }
      setIsCompanyModalOpen(false);
      setCompanyName("");
      setCompanyType("ТОО");
      setCompanyBin("");
      setCompanyOkedCodes([]);
      setIsEditingCompany(false);
      
      // If creating new company, automatically show business plan form
      if (!isEditingCompany) {
        setIsPlanModalOpen(true);
        setPlanName("");
        setPlanPriorityActivities([]);
      }
    } catch (error: any) {
      console.error("Failed to save company:", error);
      alert(error.message || "Не удалось сохранить компанию");
    } finally {
      setIsCompanyLoading(false);
    }
  };

  const handleEditBusinessPlan = (plan: BusinessPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlanId(plan.id);
    setEditPlanName(plan.title);
    setEditPlanPriorityActivities(plan.priority_activities);
    setEditPlanParticipationPeriodYears(plan.participation_period_years.toString());
    setEditPlanPlannedSubmissionYear(plan.planned_submission_year.toString());
    setIsEditingPlan(true);
  };

  const handleSubmitEditPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const participationPeriod = parseInt(editPlanParticipationPeriodYears) || 1;
    const submissionYear = parseInt(editPlanPlannedSubmissionYear) || new Date().getFullYear();
    
    if (!editingPlanId || !editPlanName.trim() || editPlanPriorityActivities.length === 0 || isUpdatingPlanLoading) return;
    
    setIsUpdatingPlanLoading(true);
    try {
      await businessPlanAPI.updateBusinessPlan(
        editingPlanId,
        editPlanName.trim(),
        editPlanPriorityActivities,
        participationPeriod,
        submissionYear
      );
      setIsEditingPlan(false);
      setEditingPlanId(null);
      setEditPlanName("");
      setEditPlanPriorityActivities([]);
      setEditPlanParticipationPeriodYears("1");
      setEditPlanPlannedSubmissionYear(new Date().getFullYear().toString());
      await loadBusinessPlans();
    } catch (error: any) {
      console.error("Failed to update business plan:", error);
      alert(error.message || "Не удалось обновить бизнес-план");
      setIsUpdatingPlanLoading(false);
    }
  };

  const handleSubmitCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const participationPeriod = parseInt(planParticipationPeriodYears) || 1;
    const submissionYear = parseInt(planPlannedSubmissionYear) || new Date().getFullYear();
    
    if (!planName.trim() || planPriorityActivities.length === 0 || !userCompany || isCreatingPlanLoading) return;
    
    setIsCreatingPlanLoading(true);
    try {
      const newPlan = await businessPlanAPI.createBusinessPlan(
        planName.trim(),
        userCompany.id,
        planPriorityActivities,
        participationPeriod,
        submissionYear
      );
      setIsPlanModalOpen(false);
      setPlanName("");
      setPlanPriorityActivities([]);
      setPlanParticipationPeriodYears("1");
      setPlanPlannedSubmissionYear(new Date().getFullYear().toString());
      await loadBusinessPlans();
      router.push(`/business-plans/${newPlan.id}`);
    } catch (error: any) {
      console.error("Failed to create business plan:", error);
      alert(error.message || "Не удалось создать бизнес-план");
      setIsCreatingPlanLoading(false);
    }
  };

  const handleDeleteBusinessPlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Вы уверены, что хотите удалить этот бизнес-план?")) return;
    
    try {
      await businessPlanAPI.deleteBusinessPlan(planId);
      setBusinessPlans(businessPlans.filter((plan) => plan.id !== planId));
    } catch (error) {
      console.error("Failed to delete business plan:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-secondary)]">
        <div className="text-text-primary">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-secondary)]">
      {/* Header */}
      <header className="border-b-2 border-[var(--border)] bg-[var(--surface-header)] flex-shrink-0 shadow-sm">
        <div className="w-full px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-text-primary">
            AI Конструктор Бизнес-планов
          </h1>

          {/* User Menu */}
          <ProfileDropdown
            userEmail={userEmail}
            isAdmin={isAdmin}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-y-auto bg-[var(--surface-secondary)]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Company Section */}
          {userCompany ? (
            <div className="mb-8 p-6 bg-[var(--surface)] rounded-lg border-2 border-[var(--border-light)] shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-text-primary mb-2">
                    Моя компания
                  </h2>
                  <div className="space-y-1">
                    <p className="text-lg font-medium text-text-primary">
                      {userCompany.name}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {userCompany.type}, БИН: {userCompany.bin}
                    </p>
                    <p className="text-sm text-text-secondary">
                      ОКЭД: {userCompany.oked_codes.join(", ")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleEditCompany}
                  className="px-4 py-2 border-2 border-[var(--border-input)] rounded-lg text-text-primary hover:bg-text-primary/5 transition-colors text-sm font-medium"
                >
                  Редактировать
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-8 p-6 bg-[var(--surface)] rounded-lg border-2 border-[var(--border-light)] shadow-sm border-dashed">
              <div className="text-center">
                <p className="text-text-secondary mb-4">
                  У вас еще нет компании. Создайте компанию, чтобы начать работу с бизнес-планами.
                </p>
                <button
                  onClick={() => {
                    setIsEditingCompany(false);
                    setIsCompanyModalOpen(true);
                  }}
                  className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-all"
                >
                  Создать компанию
                </button>
              </div>
            </div>
          )}

          {/* Business Plans Section */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary">
              Бизнес-планы
            </h2>
            <button
              onClick={handleCreateBusinessPlan}
              disabled={!userCompany}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Новый бизнес-план
            </button>
          </div>

          {businessPlans.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[var(--text-tertiary)] mb-4">
                Пока нет бизнес-планов. Создайте первый!
              </p>
              <button
                onClick={handleCreateBusinessPlan}
                disabled={!userCompany}
                className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Создать бизнес-план
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {businessPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-6 bg-[var(--surface)] rounded-lg border-2 border-[var(--border-light)] hover:border-[var(--border)] transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 
                      onClick={() => router.push(`/business-plans/${plan.id}`)}
                      className="text-lg font-semibold text-text-primary flex-1 cursor-pointer hover:underline"
                    >
                      {plan.title}
                    </h3>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={(e) => handleEditBusinessPlan(plan, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent/10 rounded transition-opacity"
                        title="Редактировать бизнес-план"
                      >
                        <svg
                          className="w-4 h-4 text-accent"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDeleteBusinessPlan(plan.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--error-background)] rounded transition-opacity"
                        title="Удалить бизнес-план"
                      >
                        <svg
                          className="w-4 h-4 text-[var(--error-text)]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Обновлено {new Date(plan.updated_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Company Modal (Create/Edit) */}
      {isCompanyModalOpen && config && (
        <div className="fixed inset-0 bg-[var(--modal-backdrop)] flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--modal-background)] rounded-lg max-w-2xl w-full shadow-2xl border-2 border-[var(--modal-border)] max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-text-primary">
                  {isEditingCompany ? "Редактировать компанию" : "Создать компанию"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsCompanyModalOpen(false);
                    setCompanyName("");
                    setCompanyType("ТОО");
                    setCompanyBin("");
                    setCompanyOkedCodes([]);
                    setIsEditingCompany(false);
                  }}
                  className="p-1 hover:bg-text-primary/5 rounded transition-colors"
                  title="Закрыть"
                >
                  <svg
                    className="w-6 h-6 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmitCompany}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Название компании *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Введите название компании..."
                    autoFocus
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Тип компании *
                  </label>
                  <select
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value as "ИП" | "ТОО")}
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  >
                    <option value="ИП">ИП</option>
                    <option value="ТОО">ТОО</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    БИН *
                  </label>
                  <input
                    type="text"
                    value={companyBin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 12);
                      setCompanyBin(value);
                    }}
                    placeholder="12 цифр"
                    maxLength={12}
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  />
                  {companyBin.length > 0 && companyBin.length !== 12 && (
                    <p className="mt-1 text-xs text-[var(--error-text)]">
                      БИН должен содержать ровно 12 цифр
                    </p>
                  )}
                </div>
                <MultiSelectSearchInput
                  items={flattenedOked}
                  selectedItems={companyOkedCodes}
                  onChange={setCompanyOkedCodes}
                  label="ОКЭД коды"
                  placeholder="Начните вводить код или название..."
                  getItemKey={(item) => item.code!}
                  getItemDisplay={(item) => (
                    <>
                      <span className="font-mono font-medium">{item.code}</span> - {item.name}
                    </>
                  )}
                  filterItem={(item, searchTerm) =>
                    item.code!.toLowerCase().includes(searchTerm) ||
                    item.name.toLowerCase().includes(searchTerm) ||
                    item.fullPath!.toLowerCase().includes(searchTerm)
                  }
                  getSelectedItemDisplay={(key, item) => {
                    if (item) {
                      return `${item.code} - ${item.name}`;
                    }
                    return key;
                  }}
                />
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompanyModalOpen(false);
                      setCompanyName("");
                      setCompanyType("ТОО");
                      setCompanyBin("");
                      setCompanyOkedCodes([]);
                      setIsEditingCompany(false);
                    }}
                    className="px-4 py-2 border-2 border-[var(--border-input)] rounded-lg text-text-primary hover:bg-text-primary/5 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!companyName.trim() || companyBin.length !== 12 || companyOkedCodes.length === 0 || isCompanyLoading}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCompanyLoading ? (isEditingCompany ? "Сохранение..." : "Создание...") : (isEditingCompany ? "Сохранить" : "Создать компанию")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Business Plan Modal */}
      {isPlanModalOpen && userCompany && config && (
        <div className="fixed inset-0 bg-[var(--modal-backdrop)] flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--modal-background)] rounded-lg max-w-2xl w-full shadow-2xl border-2 border-[var(--modal-border)] max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-text-primary">
                  Создать бизнес-план
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlanModalOpen(false);
                    setPlanName("");
                    setPlanPriorityActivities([]);
                  }}
                  className="p-1 hover:bg-text-primary/5 rounded transition-colors"
                  title="Закрыть"
                >
                  <svg
                    className="w-6 h-6 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              
              {/* Company Info Display */}
              <div className="mb-6 p-4 bg-[var(--surface-secondary)] rounded-lg border-2 border-[var(--border-light)]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-medium text-text-secondary mb-2">
                      Компания
                    </h3>
                    <p className="text-text-primary font-medium">{userCompany.name}</p>
                    <p className="text-sm text-text-secondary">
                      {userCompany.type}, БИН: {userCompany.bin}
                    </p>
                    <p className="text-sm text-text-secondary mt-1">
                      ОКЭД: {userCompany.oked_codes.join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsPlanModalOpen(false);
                      handleEditCompany();
                    }}
                    className="text-xs text-accent hover:underline"
                  >
                    Изменить
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitCreatePlan}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Название бизнес-плана *
                  </label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="Введите название..."
                    autoFocus
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  />
                </div>
                <div className="mb-4">
                  <MultiSelectSearchInput
                    items={config.priority_activities.map((activity) => ({ name: activity }))}
                    selectedItems={planPriorityActivities}
                    onChange={setPlanPriorityActivities}
                    label="Приоритетные виды деятельности"
                    placeholder="Начните вводить для поиска..."
                    getItemKey={(item) => item.name}
                    getItemDisplay={(item) => item.name}
                    filterItem={(item, searchTerm) =>
                      item.name.toLowerCase().includes(searchTerm)
                    }
                  />
                  {planPriorityActivities.length > 2 && (
                    <div className="mt-2 p-3 bg-[var(--warning-background)] border-2 border-[var(--warning-border)] rounded-lg flex gap-2 text-sm text-[var(--warning-text)]">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p>
                        Не рекомендуется указывать больше двух видов деятельности (даже если есть намерения в дальнейшем развивать соответствующие направления), если проект до конца не продуман, так как за резидентом технопарка остается право расширения перечня видов деятельности. Для этого необходимо будет скорректировать с учетом нового направления развития компании бизнес-план и предоставить его на рассмотрение комиссии Astana Hub.
                      </p>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Срок участия в технопарке (лет) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={planParticipationPeriodYears}
                    onChange={(e) => setPlanParticipationPeriodYears(e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value || parseInt(e.target.value) < 1) {
                        setPlanParticipationPeriodYears("1");
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Год планируемой подачи бизнес-плана *
                  </label>
                  <input
                    type="number"
                    min={new Date().getFullYear()}
                    max={new Date().getFullYear() + 4}
                    value={planPlannedSubmissionYear}
                    onChange={(e) => setPlanPlannedSubmissionYear(e.target.value)}
                    onBlur={(e) => {
                      const currentYear = new Date().getFullYear();
                      const value = parseInt(e.target.value);
                      if (!e.target.value || isNaN(value) || value < currentYear) {
                        setPlanPlannedSubmissionYear(currentYear.toString());
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  />
                  {parseInt(planPlannedSubmissionYear) >= new Date().getFullYear() + 2 && (
                    <div className="mt-2 p-3 bg-[var(--warning-background)] border-2 border-[var(--warning-border)] rounded-lg flex gap-2 text-sm text-[var(--warning-text)]">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p>
                        ВНИМАНИЕ: Год планируемой подачи более чем на год в будущем. К моменту подачи правила и требования Astana Hub могут значительно измениться.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlanModalOpen(false);
                      setPlanName("");
                      setPlanPriorityActivities([]);
                      setPlanParticipationPeriodYears("1");
                      setPlanPlannedSubmissionYear(new Date().getFullYear().toString());
                    }}
                    className="px-4 py-2 border-2 border-[var(--border-input)] rounded-lg text-text-primary hover:bg-text-primary/5 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!planName.trim() || planPriorityActivities.length === 0 || isCreatingPlanLoading}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingPlanLoading ? "Создание..." : "Создать"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Business Plan Modal */}
      {isEditingPlan && editingPlanId && config && (
        <div className="fixed inset-0 bg-[var(--modal-backdrop)] flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--modal-background)] rounded-lg max-w-2xl w-full shadow-2xl border-2 border-[var(--modal-border)] max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-text-primary">
                  Редактировать бизнес-план
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPlan(false);
                    setEditingPlanId(null);
                    setEditPlanName("");
                    setEditPlanPriorityActivities([]);
                    setEditPlanParticipationPeriodYears("1");
                    setEditPlanPlannedSubmissionYear(new Date().getFullYear().toString());
                  }}
                  className="p-1 hover:bg-text-primary/5 rounded transition-colors"
                  title="Закрыть"
                >
                  <svg
                    className="w-6 h-6 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitEditPlan}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Название бизнес-плана *
                  </label>
                  <input
                    type="text"
                    value={editPlanName}
                    onChange={(e) => setEditPlanName(e.target.value)}
                    placeholder="Введите название..."
                    autoFocus
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  />
                </div>
                <div className="mb-4">
                  <MultiSelectSearchInput
                    items={config.priority_activities.map((activity) => ({ name: activity }))}
                    selectedItems={editPlanPriorityActivities}
                    onChange={setEditPlanPriorityActivities}
                    label="Приоритетные виды деятельности"
                    placeholder="Начните вводить для поиска..."
                    getItemKey={(item) => item.name}
                    getItemDisplay={(item) => item.name}
                    filterItem={(item, searchTerm) =>
                      item.name.toLowerCase().includes(searchTerm)
                    }
                  />
                  {editPlanPriorityActivities.length > 2 && (
                    <div className="mt-2 p-3 bg-[var(--warning-background)] border-2 border-[var(--warning-border)] rounded-lg flex gap-2 text-sm text-[var(--warning-text)]">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p>
                        Не рекомендуется указывать больше двух видов деятельности (даже если есть намерения в дальнейшем развивать соответствующие направления), если проект до конца не продуман, так как за резидентом технопарка остается право расширения перечня видов деятельности. Для этого необходимо будет скорректировать с учетом нового направления развития компании бизнес-план и предоставить его на рассмотрение комиссии Astana Hub.
                      </p>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Срок участия в технопарке (лет) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={editPlanParticipationPeriodYears}
                    onChange={(e) => setEditPlanParticipationPeriodYears(e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value || parseInt(e.target.value) < 1) {
                        setEditPlanParticipationPeriodYears("1");
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Год планируемой подачи бизнес-плана *
                  </label>
                  <input
                    type="number"
                    min={new Date().getFullYear()}
                    max={new Date().getFullYear() + 4}
                    value={editPlanPlannedSubmissionYear}
                    onChange={(e) => setEditPlanPlannedSubmissionYear(e.target.value)}
                    onBlur={(e) => {
                      const currentYear = new Date().getFullYear();
                      const value = parseInt(e.target.value);
                      if (!e.target.value || isNaN(value) || value < currentYear) {
                        setEditPlanPlannedSubmissionYear(currentYear.toString());
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-[var(--border-input)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors"
                  />
                  {parseInt(editPlanPlannedSubmissionYear) >= new Date().getFullYear() + 2 && (
                    <div className="mt-2 p-3 bg-[var(--warning-background)] border-2 border-[var(--warning-border)] rounded-lg flex gap-2 text-sm text-[var(--warning-text)]">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p>
                        ВНИМАНИЕ: Год планируемой подачи более чем на год в будущем. К моменту подачи правила и требования Astana Hub могут значительно измениться.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPlan(false);
                      setEditingPlanId(null);
                      setEditPlanName("");
                      setEditPlanPriorityActivities([]);
                      setEditPlanParticipationPeriodYears("1");
                      setEditPlanPlannedSubmissionYear(new Date().getFullYear().toString());
                    }}
                    className="px-4 py-2 border-2 border-[var(--border-input)] rounded-lg text-text-primary hover:bg-text-primary/5 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!editPlanName.trim() || editPlanPriorityActivities.length === 0 || isUpdatingPlanLoading}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingPlanLoading ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
