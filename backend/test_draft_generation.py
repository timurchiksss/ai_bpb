#!/usr/bin/env python3
"""
Test script for business plan draft generation endpoint.

This script sends a POST request to generate a draft and polls for status.
"""
import asyncio

import requests
import time
import json
from uuid import uuid4

# Configuration
BASE_URL = "http://localhost:8000/api"
BUSINESS_PLAN_ID = "06989859-2134-7ed6-8000-c9ec71218fe0"  # Replace with actual ID
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwNjk0M2UxYS1iOGRiLTc5MWYtODAwMC1mMWZhNGMwY2Y2YjIiLCJlbWFpbCI6InVzZXJAbWFpbC5reiIsImV4cCI6MTc3MTg3NjU1Mn0.O_2e2-v7K21yUeG8GVATvV1TAiTSFWjj5rqgcUDWnPo"  # Replace with your access token from login

# For testing, you can get a token by logging in first:
# POST /api/auth/login with {"email": "your@email.com", "password": "yourpassword"}
# The token will be in the response cookies as "access_token"

# Agartu Space - Automation for Business
form_data = {
    # Section 1: Наименование проекта
    "website_url": "https://agartu.space",
    "problem_description": "Малый и средний бизнес в Казахстане сталкивается с проблемой рутинных операций, которые отнимают много времени и ресурсов. Отсутствие автоматизации приводит к человеческим ошибкам, задержкам в обработке данных и снижению эффективности бизнес-процессов.",
    "solution_description": "Agartu Space предоставляет платформу для автоматизации бизнес-процессов с использованием no-code решений. Мы создаем готовые автоматизации для типовых задач: обработка заказов, управление клиентской базой, интеграция с CRM и ERP системами, автоматизация отчетности и аналитики.",
    "project_goals": "Создать доступную платформу автоматизации для малого и среднего бизнеса в Казахстане, снизить операционные расходы клиентов на 30-40%, увеличить скорость обработки бизнес-процессов в 3-5 раз, обеспечить масштабируемость решений.",
    "project_tasks": "Разработка no-code платформы для создания автоматизаций, интеграция с популярными бизнес-системами (1С, Битрикс24, amoCRM), создание библиотеки готовых шаблонов автоматизаций, обучение клиентов работе с платформой, техническая поддержка и сопровождение.",
    
    # Section 2: Место реализации проекта
    "region": "Республика Казахстан, г. Алматы",
    "target_market_description": "Целевой рынок - малый и средний бизнес в Казахстане (от 10 до 500 сотрудников), работающий в сферах: розничная торговля, услуги, производство, логистика. Общий объем рынка автоматизации для МСБ в Казахстане оценивается в $50-70 млн в год.",
    "market_volume": "Рынок автоматизации для МСБ в Казахстане составляет около $60 млн в год и растет на 15-20% ежегодно. Количество потенциальных клиентов - около 150,000 компаний малого и среднего бизнеса.",
    "market_trends": "Растущий спрос на автоматизацию из-за цифровизации экономики, увеличение количества удаленных сотрудников требует новых инструментов, снижение стоимости облачных решений делает автоматизацию доступнее, государственная поддержка цифровизации бизнеса через программы развития.",
    "competitors_info": "Основные конкуренты: международные платформы (Zapier, Make.com) - высокая стоимость и сложность для казахстанского рынка; локальные разработчики - ограниченный функционал и отсутствие готовых решений; крупные IT-компании - фокус на крупный бизнес.",
    "market_share": "Планируем занять 2-3% рынка в течение первых 3 лет, что составит около 3,000-4,500 клиентов. Фокус на качество и локализацию решений для казахстанского рынка.",
    
    # Section 3: Права на интеллектуальную собственность
    "ip_description": "Платформа Agartu Space является собственной разработкой. Используются собственные алгоритмы обработки данных, уникальный интерфейс no-code конструктора, специализированные интеграции с казахстанскими бизнес-системами. Часть кода защищена авторским правом.",
    "ip_documents": [
        {
            "type": "Авторское право",
            "number": "Свидетельство о регистрации программы для ЭВМ",
            "owner": "ТОО Agartu Space"
        }
    ],
    
    # Section 4: Сведения о команде
    "team_members": [
        {
            "name": "Иванов Иван Иванович",
            "position": "Генеральный директор",
            "education": "Высшее техническое образование, MBA",
            "experience": "15 лет опыта в IT-индустрии, 8 лет в управлении проектами автоматизации",
            "skills": "Стратегическое планирование, управление продуктом, продажи B2B",
            "responsibilities": "Общее руководство компанией, стратегическое развитие, работа с ключевыми клиентами"
        },
        {
            "name": "Петрова Мария Сергеевна",
            "position": "Технический директор",
            "education": "Высшее техническое образование, магистр информатики",
            "experience": "12 лет опыта в разработке программного обеспечения, 5 лет в области автоматизации",
            "skills": "Архитектура систем, разработка платформ, управление технической командой",
            "responsibilities": "Техническое руководство разработкой, архитектура платформы, управление разработчиками"
        },
        {
            "name": "Сидоров Алексей Дмитриевич",
            "position": "Lead Developer",
            "education": "Высшее техническое образование",
            "experience": "10 лет опыта в backend разработке, специализация на интеграциях и API",
            "skills": "Python, Node.js, микросервисная архитектура, интеграции с внешними системами",
            "responsibilities": "Разработка ядра платформы, создание интеграций, техническое руководство разработкой"
        }
    ],
    
    # Section 5: Стадия готовности проекта
    "project_stage": "Проект находится на стадии MVP (Minimum Viable Product). Разработана базовая версия платформы с основным функционалом, проведено тестирование с 5 пилотными клиентами.",
    "existing_results": "Создана рабочая версия no-code платформы, реализованы интеграции с 1С, Битрикс24, amoCRM, разработано 10 готовых шаблонов автоматизаций, привлечено 5 пилотных клиентов, получены положительные отзывы и обратная связь.",
    "completed_work_stages": "Завершены этапы: исследование рынка и конкурентов, разработка технического задания, создание архитектуры платформы, разработка MVP, интеграция с основными системами, пилотное тестирование, сбор обратной связи от клиентов.",
    "readiness_degree": "Проект готов к масштабированию. Техническая платформа функционирует, есть подтвержденный спрос от пилотных клиентов, команда сформирована и имеет необходимый опыт. Требуется финансирование для масштабирования продаж и расширения функционала.",
    
    # Section 8: Смета планируемых расходов
    "estimated_salaries": "Зарплаты команды разработки (5 человек) - 15,000,000 тенге в год, зарплаты отдела продаж (3 человека) - 8,000,000 тенге в год, зарплаты поддержки (2 человека) - 4,000,000 тенге в год. Итого: 27,000,000 тенге.",
    "estimated_servers": "Облачная инфраструктура (AWS/Azure) для хостинга платформы, резервное копирование, мониторинг - 2,400,000 тенге в год. Включает серверы, хранилище данных, CDN, системы мониторинга.",
    "estimated_marketing": "Маркетинг и продвижение: контекстная реклама, контент-маркетинг, участие в выставках и конференциях, партнерские программы - 6,000,000 тенге в год.",
    "estimated_operations": "Операционные расходы: офис, коммунальные услуги, связь, программное обеспечение, юридические и бухгалтерские услуги, страхование - 3,600,000 тенге в год.",
    
    # Section 9: Виды товаров/услуг
    "product_service_types": "SaaS-платформа для автоматизации бизнес-процессов. Основные услуги: доступ к no-code конструктору автоматизаций, готовые шаблоны автоматизаций, интеграции с популярными бизнес-системами, техническая поддержка и консультации, обучение работе с платформой.",
    "sales_model": "Подписочная модель (SaaS) с ежемесячной или годовой оплатой. Тарифы: Базовый (до 10 автоматизаций) - 15,000 тенге/месяц, Профессиональный (до 50 автоматизаций) - 45,000 тенге/месяц, Корпоративный (безлимит) - от 120,000 тенге/месяц. Также возможна индивидуальная разработка автоматизаций по запросу.",
    "revenue_model": "Основной доход от подписок на платформу. Дополнительные источники: индивидуальная разработка автоматизаций, интеграции по запросу, обучение и консультации, партнерские комиссии от интеграций с другими сервисами.",
    "sales_strategy": "Прямые продажи через отдел продаж (B2B), партнерская программа для IT-компаний и консультантов, контент-маркетинг и SEO для привлечения органического трафика, участие в бизнес-конференциях и выставках, реферальная программа для существующих клиентов.",
    "sales_channels": "Прямые продажи через сайт и отдел продаж, партнерская сеть IT-компаний, интеграторы и консультанты, онлайн-маркетинг (контекстная реклама, соцсети), участие в отраслевых мероприятиях, рекомендации от существующих клиентов.",
    
    # Section 10: Клиенты/потенциальные клиенты
    "target_audience": "Малый и средний бизнес в Казахстане: компании розничной торговли (магазины, сети), сервисные компании (логистика, доставка, услуги), производственные предприятия малого и среднего размера, компании сферы услуг (консалтинг, маркетинг, финансы).",
    "current_clients": "На данный момент 5 пилотных клиентов: сеть магазинов электроники (автоматизация обработки заказов), логистическая компания (автоматизация доставок), производственное предприятие (интеграция 1С с CRM), сервисная компания (автоматизация отчетности), консалтинговая фирма (автоматизация клиентской базы).",
    "client_categories": "Основные категории: розничная торговля (30% целевой аудитории), услуги и сервисы (25%), производство (20%), логистика и доставка (15%), другие отрасли (10%). Фокус на компании с 10-500 сотрудниками и оборотом от 50 млн до 2 млрд тенге в год.",
    "customer_profile": "Типичный клиент: директор или владелец компании малого/среднего бизнеса, возраст 35-50 лет, понимает важность автоматизации, имеет опыт работы с IT-решениями, ищет способы оптимизации бизнес-процессов, готов инвестировать в технологии для роста бизнеса.",
    
    # Section 12: Общественная значимость проекта
    "regional_significance": "Проект способствует цифровизации экономики Казахстана, повышению конкурентоспособности малого и среднего бизнеса, созданию рабочих мест в IT-сфере, развитию технологического предпринимательства в регионе, укреплению технологического суверенитета страны.",
    "economic_significance": "Повышение производительности труда в МСБ на 20-30%, снижение операционных расходов компаний, увеличение налоговых поступлений за счет роста бизнеса клиентов, создание новых рабочих мест (планируется 15-20 новых позиций в течение 3 лет), привлечение инвестиций в IT-сектор.",
    "social_significance": "Улучшение условий труда за счет автоматизации рутинных процессов, повышение качества услуг для конечных потребителей, развитие цифровых навыков у сотрудников клиентских компаний, создание возможностей для карьерного роста в IT-сфере, поддержка малого и среднего бизнеса как основы экономики.",
    "planned_jobs": "В течение 3 лет планируется создать 15-20 новых рабочих мест: разработчики (8-10 позиций), отдел продаж (4-5 позиций), техническая поддержка (3-4 позиции), маркетинг (2-3 позиции). Также косвенно создаются рабочие места у клиентов за счет роста их бизнеса."
}

# LLM Configuration
MODEL = "gpt-5.1"  # Adjust based on available models
PROVIDER = "openai"  # Adjust based on available providers


def send_draft_generation_request(business_plan_id: str, access_token: str) -> dict:
    """Send POST request to generate draft"""
    url = f"{BASE_URL}/tasks/business-plans/{business_plan_id}/generate-draft"
    
    headers = {
        "Content-Type": "application/json",
        "Cookie": f"access_token={access_token}"
    }
    
    params = {
        "model": MODEL,
        "provider": PROVIDER
    }
    
    print(f"Sending request to {url}")
    print(f"Model: {MODEL}, Provider: {PROVIDER}")
    print(f"Business Plan ID: {business_plan_id}")
    print()
    
    response = requests.post(
        url,
        json=form_data,
        headers=headers,
        params=params
    )
    
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None
    
    result = response.json()
    print(f"Task enqueued successfully!")
    print(f"Task ID: {result['task_id']}")
    print(f"Status: {result['status']}")
    print()
    
    return result


def get_task_status(task_id: str, access_token: str) -> dict:
    """Get task status"""
    url = f"{BASE_URL}/tasks/{task_id}/status"
    
    headers = {
        "Cookie": f"access_token={access_token}"
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"Error getting status: {response.status_code}")
        print(response.text)
        return None
    
    return response.json()


def poll_task_status(task_id: str, access_token: str, poll_interval: int = 5):
    """Poll task status until completion or failure"""
    print(f"Polling task status (checking every {poll_interval} seconds)...")
    print()
    
    while True:
        status = get_task_status(task_id, access_token)
        
        if not status:
            print("Failed to get task status")
            time.sleep(5)
            continue

    
        print(status)
        current_status = status.get("status")
        current_section = status.get("current_section", 0)
        total_sections = status.get("total_sections", 12)
        completed_sections = status.get("completed_sections", [])
        error = status.get("error")
        
        print(f"Status: {current_status}")
        print(f"Progress: {current_section}/{total_sections} sections")
        print(f"Completed sections: {completed_sections}")
        
        if error:
            print(f"Error: {error}")
        
        print("-" * 50)
        
        if current_status == "completed":
            print("✅ Draft generation completed successfully!")
            break
        elif current_status == "failed":
            print("❌ Draft generation failed!")
            break
        
        time.sleep(poll_interval)


def main():
    """Main test function"""
    print("=" * 60)
    print("Business Plan Draft Generation Test Script")
    print("Company: Agartu Space - Automation for Business")
    print("=" * 60)
    print()
    
    if not ACCESS_TOKEN:
        print("⚠️  WARNING: ACCESS_TOKEN is not set!")
        print("Please login first and set the access_token in this script.")
        print("You can get a token by:")
        print("  1. POST /api/auth/login with email and password")
        print("  2. Extract 'access_token' from response cookies")
        print("  3. Set ACCESS_TOKEN variable in this script")
        print()
        return
    
    # Send draft generation request
    result = send_draft_generation_request(BUSINESS_PLAN_ID, ACCESS_TOKEN)
    
    if not result:
        print("Failed to enqueue draft generation task")
        return
    
    task_id = result["task_id"]
    
    # Poll for status
    poll_task_status(task_id, ACCESS_TOKEN)


if __name__ == "__main__":
    main()

