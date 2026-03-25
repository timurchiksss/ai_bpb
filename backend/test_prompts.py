#!/usr/bin/env python3
"""
Test script to print prompts for all sections of business plan draft generation.
"""

from agents.draft_generator.prompt import get_section_prompt
from agents.schemas import DraftFormData, DraftGenerationState, IPDocument, TeamMember
from schemas.sqlalchemy import BusinessPlan, Company
from uuid import uuid4
from datetime import datetime

# Create sample form data (Agartu Space - Automation for Business)
form_data = DraftFormData(
    # Section 1: Наименование проекта
    website_url="https://agartu.space",
    problem_description="Малый и средний бизнес в Казахстане сталкивается с проблемой рутинных операций, которые отнимают много времени и ресурсов.",
    solution_description="Agartu Space предоставляет платформу для автоматизации бизнес-процессов с использованием no-code решений.",
    project_goals="Создать доступную платформу автоматизации для малого и среднего бизнеса в Казахстане.",
    project_tasks="Разработка no-code платформы для создания автоматизаций, интеграция с популярными бизнес-системами.",
    
    # Section 2: Место реализации проекта
    region="Республика Казахстан, г. Алматы",
    target_market_description="Целевой рынок - малый и средний бизнес в Казахстане (от 10 до 500 сотрудников).",
    market_volume="Рынок автоматизации для МСБ в Казахстане составляет около $60 млн в год.",
    market_trends="Растущий спрос на автоматизацию из-за цифровизации экономики.",
    competitors_info="Основные конкуренты: международные платформы (Zapier, Make.com) - высокая стоимость.",
    market_share="Планируем занять 2-3% рынка в течение первых 3 лет.",
    
    # Section 3: Права на интеллектуальную собственность
    ip_description="Платформа Agartu Space является собственной разработкой. Используются собственные алгоритмы обработки данных.",
    ip_documents=[
        IPDocument(
            type="Авторское право",
            number="Свидетельство о регистрации программы для ЭВМ",
            owner="ТОО Agartu Space"
        )
    ],
    
    # Section 4: Сведения о команде
    team_members=[
        TeamMember(
            name="Иванов Иван Иванович",
            position="Генеральный директор",
            education="Высшее техническое образование, MBA",
            experience="15 лет опыта в IT-индустрии, 8 лет в управлении проектами автоматизации",
            skills="Стратегическое планирование, управление продуктом, продажи B2B",
            responsibilities="Общее руководство компанией, стратегическое развитие, работа с ключевыми клиентами"
        ),
        TeamMember(
            name="Петрова Мария Сергеевна",
            position="Технический директор",
            education="Высшее техническое образование, магистр информатики",
            experience="12 лет опыта в разработке программного обеспечения, 5 лет в области автоматизации",
            skills="Архитектура систем, разработка платформ, управление технической командой",
            responsibilities="Техническое руководство разработкой, архитектура платформы, управление разработчиками"
        )
    ],
    
    # Section 5: Стадия готовности проекта
    project_stage="Проект находится на стадии MVP (Minimum Viable Product).",
    existing_results="Создана рабочая версия no-code платформы, реализованы интеграции с 1С, Битрикс24, amoCRM.",
    completed_work_stages="Завершены этапы: исследование рынка и конкурентов, разработка технического задания, создание архитектуры платформы.",
    readiness_degree="Проект готов к масштабированию. Техническая платформа функционирует, есть подтвержденный спрос от пилотных клиентов.",
    
    # Section 8: Смета планируемых расходов
    estimated_salaries="Зарплаты команды разработки (5 человек) - 15,000,000 тенге в год.",
    estimated_servers="Облачная инфраструктура (AWS/Azure) для хостинга платформы - 2,400,000 тенге в год.",
    estimated_marketing="Маркетинг и продвижение: контекстная реклама, контент-маркетинг - 6,000,000 тенге в год.",
    estimated_operations="Операционные расходы: офис, коммунальные услуги, связь - 3,600,000 тенге в год.",
    
    # Section 9: Виды товаров/услуг
    product_service_types="SaaS-платформа для автоматизации бизнес-процессов. Основные услуги: доступ к no-code конструктору автоматизаций.",
    sales_model="Подписочная модель (SaaS) с ежемесячной или годовой оплатой. Тарифы: Базовый - 15,000 тенге/месяц.",
    revenue_model="Основной доход от подписок на платформу. Дополнительные источники: индивидуальная разработка автоматизаций.",
    sales_strategy="Прямые продажи через отдел продаж (B2B), партнерская программа для IT-компаний и консультантов.",
    sales_channels="Прямые продажи через сайт и отдел продаж, партнерская сеть IT-компаний, онлайн-маркетинг.",
    
    # Section 10: Клиенты/потенциальные клиенты
    target_audience="Малый и средний бизнес в Казахстане: компании розничной торговли, сервисные компании, производственные предприятия.",
    current_clients="На данный момент 5 пилотных клиентов: сеть магазинов электроники, логистическая компания.",
    client_categories="Основные категории: розничная торговля (30% целевой аудитории), услуги и сервисы (25%), производство (20%).",
    customer_profile="Типичный клиент: директор или владелец компании малого/среднего бизнеса, возраст 35-50 лет.",
    
    # Section 12: Общественная значимость проекта
    regional_significance="Проект способствует цифровизации экономики Казахстана, повышению конкурентоспособности малого и среднего бизнеса.",
    economic_significance="Повышение производительности труда в МСБ на 20-30%, снижение операционных расходов компаний.",
    social_significance="Улучшение условий труда за счет автоматизации рутинных процессов, повышение качества услуг для конечных потребителей.",
    planned_jobs="В течение 3 лет планируется создать 15-20 новых рабочих мест: разработчики (8-10 позиций), отдел продаж (4-5 позиций)."
)

# Create mock business plan and company
company = Company(
    id=uuid4(),
    user_id=uuid4(),
    name="ТОО Agartu Space",
    type="ТОО",
    bin="123456789012",
    oked_codes=["62010", "62020", "62090"]
)

business_plan = BusinessPlan(
    id=uuid4(),
    company_id=company.id,
    title="Бизнес-план развития платформы автоматизации Agartu Space",
    priority_activities=["Разработка программного обеспечения", "Консалтинг в области информационных технологий"],
    participation_period_years=3,
    planned_submission_year=2025,
    llm_content="",
    user_content=""
)

# Set company relationship
business_plan.company = company

# Create draft generation state
state = DraftGenerationState(
    business_plan=business_plan,
    form_data=form_data,
    company=company,
    accumulated_content="",
    current_section=0,
    completed_sections=[]
)

# Print prompts for all sections
print("=" * 80)
print("BUSINESS PLAN DRAFT GENERATION PROMPTS")
print("=" * 80)
print()

for section_num in range(1, 13):
    print("=" * 80)
    print(f"SECTION {section_num}")
    print("=" * 80)
    print()
    
    prompt = get_section_prompt(section_num=section_num, state=state)
    print(prompt)
    print()
    print()

