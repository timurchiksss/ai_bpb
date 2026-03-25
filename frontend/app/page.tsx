"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [registerRequestData, setRegisterRequestData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    phone_number: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Redirect to dashboard if user is authenticated
    if (isAuthenticated === true) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const checkAuth = async () => {
    try {
      await authAPI.me();
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const handleOpenLogin = () => {
    setIsModalOpen(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authAPI.login(loginData.email, loginData.password);
      setIsAuthenticated(true);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (registerData.password !== registerData.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    try {
      await authAPI.register(registerData.email, registerData.password);
      setIsAuthenticated(true);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
      setLoading(false);
    }
  };

  const handleRegisterRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (registerRequestData.password !== registerRequestData.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (!registerRequestData.phone_number.trim()) {
      setError("Номер телефона обязателен");
      return;
    }

    setLoading(true);

    try {
      await authAPI.registerRequest(
        registerRequestData.email,
        registerRequestData.password,
        registerRequestData.phone_number
      );
      setError(null);
      setSuccess("Заявка на участие отправлена. Мы свяжемся с вами в ближайшее время.");
      setLoading(false);
      // Clear form but keep modal open
      setRegisterRequestData({
        email: "",
        password: "",
        confirmPassword: "",
        phone_number: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки заявки");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-blue-100/60 to-blue-200/40 font-sans dark:from-black dark:via-blue-950/30 dark:to-blue-900/20 overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent/15 rounded-bl-none blur-3xl"></div>
        <div className="absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-accent/12 rounded-tr-none blur-3xl"></div>
        <div className="absolute bottom-20 right-1/4 w-64 h-64 rounded-full bg-accent/10 blur-2xl"></div>
      </div>
      
      <main className="relative z-10 flex min-h-screen w-full max-w-4xl flex-col items-center justify-between py-20 px-8 bg-[var(--container-background)] backdrop-blur-sm sm:px-16 sm:py-32 rounded-2xl shadow-xl">
        <div className="w-full">
          <div className="mb-20">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-text-primary mb-6">
              AI Конструктор Бизнес-планов
            </h1>
            <div className="w-24 h-1 bg-text-primary mb-8"></div>
            <p className="text-xl sm:text-2xl text-text-secondary leading-relaxed max-w-2xl">
              Ваш интеллектуальный партнер по созданию комплексных бизнес-планов. Мы помогаем предпринимателям и инноваторам разрабатывать профессиональные стратегии для запуска своих проектов в <span className="font-semibold text-text-primary">Астана Хаб</span>.
            </p>
          </div>

          <div className="mb-12">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Что мы предлагаем</h2>
            <ul className="space-y-3 text-text-secondary">
              <li className="flex items-start gap-3">
                <span className="text-text-primary font-bold mt-0.5">•</span>
                <span>Создание бизнес-планов на основе данных, адаптированных к требованиям Астана Хаб</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-text-primary font-bold mt-0.5">•</span>
                <span>Прогнозирование финансов и анализ рынка на основе ИИ</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-text-primary font-bold mt-0.5">•</span>
                <span>Профессиональное форматирование документов, готовых к презентациям</span>
              </li>
            </ul>
          </div>

          <div className="mb-12">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Пример работы сайта</h2>
            <div className="rounded-lg border-2 border-[var(--border)] overflow-hidden shadow-lg bg-[var(--surface)]">
              <img 
                src="/business_plan_edit_demo.gif" 
                alt="Пример работы сайта - редактирование бизнес-плана"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>

        {/* Beta test description */}

        {/* Registration Request Form */}
        <div className="w-full max-w-md mx-auto mb-8">
          <div className="bg-[var(--surface)] rounded-lg border-2 border-[var(--border)] shadow-xl p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-text-primary mb-6 text-center">
              Оставить заявку на получение эксклюзивного доступа
            </h2>
            
            {error && (
              <div className="mb-4 p-3 bg-[var(--error-background)] border border-[var(--error-border)] text-[var(--error-text)] rounded-lg text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg text-sm">
                {success}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleRegisterRequest}>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                value={registerRequestData.email}
                onChange={(e) =>
                  setRegisterRequestData({ ...registerRequestData, email: e.target.value })
                }
                className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Номер телефона
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-primary pointer-events-none">
                  +
                </span>
                <input
                  type="tel"
                  placeholder="77001234567"
                  value={registerRequestData.phone_number}
                  onChange={(e) => {
                    // Remove any non-digit characters (including +)
                    const digitsOnly = e.target.value.replace(/\D/g, '');
                    setRegisterRequestData({ ...registerRequestData, phone_number: digitsOnly });
                  }}
                  className="w-full pl-8 pr-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary transition-colors"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Пароль
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={registerRequestData.password}
                onChange={(e) =>
                  setRegisterRequestData({ ...registerRequestData, password: e.target.value })
                }
                className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Подтвердите пароль
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={registerRequestData.confirmPassword}
                onChange={(e) =>
                  setRegisterRequestData({ ...registerRequestData, confirmPassword: e.target.value })
                }
                className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-accent text-accent-foreground rounded-lg font-medium transition-all hover:opacity-90 active:scale-95 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Загрузка..." : "Отправить заявку"}
            </button>
          </form>
          </div>
        </div>

        {/* Login section */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-text-secondary">Уже зарегистрированы?</span>
          <button 
            onClick={handleOpenLogin}
            className="flex h-12 items-center justify-center rounded-lg bg-accent text-accent-foreground px-8 transition-all hover:opacity-90 active:scale-95 font-medium">
            Войти
          </button>
        </div>
      </main>

      {/* Login Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[var(--modal-backdrop)] flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--modal-background)] rounded-lg max-w-md w-full shadow-lg border border-[var(--modal-border)]">
            {/* Header */}
            <div className="flex justify-between items-start p-6 pb-0">
              <div>
                <h2 className="text-2xl font-bold text-text-primary mb-1">
                  Войти
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setError(null);
                }}
                className="text-[var(--tab-inactive-text)] hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form content */}
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-[var(--error-background)] border border-[var(--error-border)] text-[var(--error-text)] rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({ ...loginData, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Пароль
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-accent text-accent-foreground rounded-lg font-medium transition-all hover:opacity-90 active:scale-95 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Загрузка..." : "Войти"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
