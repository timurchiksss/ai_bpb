"""
Prompts for the Draft Generator Agent

Section-specific prompts for generating business plan sections from form data.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from utils.oked import get_oked_name

from agents.schemas import DraftFormData, DraftGenerationState


def format_oked_code(code: str) -> str:
    """Format OKED code with its name"""
    name = get_oked_name(code)
    if name:
        return f"{code} ({name})"
    return code


def format_form_data_for_section(form_data: DraftFormData, section_num: int) -> str:
    """Extract and format relevant form data for a specific section"""
    if section_num == 1:
        # Section 1: Наименование проекта
        parts = []
        if form_data.website_url:
            parts.append(f"Ссылка на сайт/приложение: {form_data.website_url}")
        if form_data.problem_description:
            parts.append(f"Описание проблемы: {form_data.problem_description}")
        if form_data.solution_description:
            parts.append(f"Описание решения: {form_data.solution_description}")
        if form_data.project_goals:
            parts.append(f"Цели проекта: {form_data.project_goals}")
        if form_data.project_tasks:
            parts.append(f"Задачи проекта: {form_data.project_tasks}")
        return "\n".join(parts) if parts else "Данные не предоставлены"
    
    elif section_num == 2:
        # Section 2: Место реализации проекта
        parts = []
        if form_data.region:
            parts.append(f"Регион: {form_data.region}")
        if form_data.target_market_description:
            parts.append(f"Описание целевого рынка: {form_data.target_market_description}")
        if form_data.market_volume:
            parts.append(f"Объем рынка: {form_data.market_volume}")
        if form_data.market_trends:
            parts.append(f"Тенденции рынка: {form_data.market_trends}")
        if form_data.competitors_info:
            parts.append(f"Информация о конкурентах: {form_data.competitors_info}")
        if form_data.market_share:
            parts.append(f"Доля рынка: {form_data.market_share}")
        return "\n".join(parts) if parts else "Данные не предоставлены"
    
    elif section_num == 3:
        # Section 3: Права на интеллектуальную собственность
        parts = []
        if form_data.ip_description:
            parts.append(f"Описание ИС: {form_data.ip_description}")
        if form_data.ip_documents:
            parts.append("Документы ИС:")
            for doc in form_data.ip_documents:
                parts.append(f"  - Тип: {doc.type}, Номер: {doc.number}, Владелец: {doc.owner}")
        return "\n".join(parts) if parts else "Данные не предоставлены"
    
    elif section_num == 4:
        # Section 4: Сведения о команде
        if form_data.team_members:
            parts = []
            for i, member in enumerate(form_data.team_members, 1):
                parts.append(f"Член команды {i}:")
                if member.name:
                    parts.append(f"  ФИО: {member.name}")
                if member.position:
                    parts.append(f"  Должность: {member.position}")
                if member.education:
                    parts.append(f"  Образование: {member.education}")
                if member.experience:
                    parts.append(f"  Опыт: {member.experience}")
                if member.skills:
                    parts.append(f"  Навыки: {member.skills}")
                if member.responsibilities:
                    parts.append(f"  Обязанности: {member.responsibilities}")
                parts.append("")
            return "\n".join(parts).strip()
        return "Данные не предоставлены"
    
    elif section_num == 5:
        # Section 5: Стадия готовности проекта
        parts = []
        if form_data.project_stage:
            parts.append(f"Стадия проекта: {form_data.project_stage}")
        if form_data.existing_results:
            parts.append(f"Существующие результаты: {form_data.existing_results}")
        if form_data.completed_work_stages:
            parts.append(f"Завершенные этапы: {form_data.completed_work_stages}")
        if form_data.readiness_degree:
            parts.append(f"Степень готовности: {form_data.readiness_degree}")
        return "\n".join(parts) if parts else "Данные не предоставлены"
    
    elif section_num == 6:
        # Section 6: KPI - обычно генерируется на основе других данных
        return "Сгенерируй ключевые показатели эффективности на основе информации о проекте"
    
    elif section_num == 7:
        # Section 7: Техническое описание - может быть в других полях
        return "Сгенерируй техническое описание проекта на основе информации о проекте"
    
    elif section_num == 8:
        # Section 8: Смета планируемых расходов
        parts = []
        if form_data.estimated_salaries:
            parts.append(f"Зарплатный фонд: {form_data.estimated_salaries}")
        if form_data.estimated_servers:
            parts.append(f"Аренда серверов: {form_data.estimated_servers}")
        if form_data.estimated_marketing:
            parts.append(f"Маркетинг: {form_data.estimated_marketing}")
        if form_data.estimated_operations:
            parts.append(f"Операционные расходы: {form_data.estimated_operations}")
        return "\n".join(parts) if parts else "Данные не предоставлены"
    
    elif section_num == 9:
        # Section 9: Виды товаров/услуг
        parts = []
        if form_data.product_service_types:
            parts.append(f"Виды товаров/услуг: {form_data.product_service_types}")
        if form_data.sales_model:
            parts.append(f"Модель продаж: {form_data.sales_model}")
        if form_data.revenue_model:
            parts.append(f"Модель дохода: {form_data.revenue_model}")
        if form_data.sales_strategy:
            parts.append(f"Стратегия продаж: {form_data.sales_strategy}")
        if form_data.sales_channels:
            parts.append(f"Каналы продаж: {form_data.sales_channels}")
        return "\n".join(parts) if parts else "Данные не предоставлены"
    
    elif section_num == 10:
        # Section 10: Клиенты/потенциальные клиенты
        parts = []
        if form_data.target_audience:
            parts.append(f"Целевая аудитория: {form_data.target_audience}")
        if form_data.current_clients:
            parts.append(f"Текущие клиенты: {form_data.current_clients}")
        if form_data.client_categories:
            parts.append(f"Категории клиентов: {form_data.client_categories}")
        if form_data.customer_profile:
            parts.append(f"Портрет клиента: {form_data.customer_profile}")
        return "\n".join(parts) if parts else "Данные не предоставлены"
    
    elif section_num == 11:
        # Section 11: План мероприятий - генерируется на основе других данных
        return "Сгенерируй план мероприятий на основе информации о проекте"
    
    elif section_num == 12:
        # Section 12: Общественная значимость проекта
        parts = []
        if form_data.regional_significance:
            parts.append(f"Региональная значимость: {form_data.regional_significance}")
        if form_data.economic_significance:
            parts.append(f"Экономическая значимость: {form_data.economic_significance}")
        if form_data.social_significance:
            parts.append(f"Социальная значимость: {form_data.social_significance}")
        if form_data.planned_jobs:
            parts.append(f"Планируемые рабочие места: {form_data.planned_jobs}")
        return "\n".join(parts) if parts else "Данные не предоставлены"
    
    return "Данные не предоставлены"


def get_section_specific_instructions(section_num: int, participation_years: int) -> str:
    """Get section-specific generation instructions"""
    current_year = datetime.now(ZoneInfo("UTC")).year
    participation_years_range = f"{participation_years} года" if participation_years == 1 else f"{participation_years} года" if participation_years < 5 else f"{participation_years} лет"
    
    instructions = {
        1: """
Данный раздел выступает своеобразным итогом всего того, что будет раскрыто в последующих разделах бизнес-плана, поэтому в нем необходимо кратко изложить задумку проекта, отметив все его достоинства. Помимо характеристики продукта/услуги по проекту в данном разделе можно обозначить сферу применения разработок компании, целевую аудиторию, рынки сбыта и определить виды деятельности, планируемые к осуществлению в рамках режима Astana Hub. При этом последнее зачастую сопряжено с определенными сложностями.

Раздел должен содержать:
- Краткое описание компании
- Все приоритетные виды деятельности(ПВД)
- Все коды общего классификатора экономической деятельности(ОКЭД)
- Название проекта
- Ссылка на сайт/приложение(если есть)
- Описание проблемы и предлагаемого решения
- Цель проекта: укажите эффекты, которых возможно достичь в результате реализации проекта (технические, технологические, технико-экономические, и иные). Необходимо отразить, что достигается посредством реализации проекта к сроку, в течение которого пользователь планирует участвовать в Астана хаб. Это может быть либо полное разрешение какой-то проблемы, либо существенное снижение её остроты, которое является в дальнейшем предпосылкой ее полного разрешения.
- Приведите перечень и описание основных задач, решение которых требуется в рамках реализации проекта;
""",
        2: """
Обязательно уточни **ВСЕ** данные из этого раздела у пользователя, не придумывай.
Раздел должен описать регион реализации проекта: анализ целевого рынка: внутренний и мировой, если уместен в рамках проекта.
- Общее описание целевого рынка
- Оценка объема рынка. Сделай таблицу, если применимо
- Тенденции развития рынка
- Сравнительный анализ основных конкурентов, чем они занимаются, чем проект пользователя отличается от них
- Описание текущей и прогнозной доли рынка
""",
        3: """
Раздел должен содержать информацию о патентах, лицензиях, авторских правах, а также номера таких документов(если есть).
Здесь нужны только патенты, связанные с проектом.
Это может быть:
- Информация о зарегистрированные правах или наличие патентов / заявок на патентование
- Информация об авторе и правообладателе интеллектуальной собственности
""",
        4: """
Раздел должен содержать информацию о ключевых участниках команды:
- ФИО
- занимаемая должность в компании/роль
- образование, дополнительные курсы и полученные сертификаты
- опыт работы: предыдущие места работы, наиболее значимые проекты, участие в конференциях и митапах
- ключевые навыки и компетенции, в том числе инструменты и технологии, которыми овладел специалист
- выполняемые в компании функции и зона ответственности
- организационная структура, квалификация, стаж, опыт работы в отрасли
""",
        5: """
- Опишите существующие результаты по проекту как производственные, так и интеллектуальные (в случае если компания продуктовая). В частности, укажите на какой стадии находится разработка продукта, наличие прототипа опытно-промышленного образца, интеллектуальной собственности. Для действующих проектов укажите наличие производственных активов для реализации проекта
- Укажите основные этапы уже произведенных работ с указанием результатов
- Степень готовности проекта выхода на рынок (рыночная, операционная и т.д.)
""",
        6: f"""
Перечислите ключевые показатели эффективности проекта, выраженные в цифрах и определяемые стратегией проекта, механизмы их измерения, которые компания пользователя планирует достичь в течение срока участия в Технопарке или к сроку завершения участия в Технопарке Например: производственные мощности, которые пользователь планирует достигнуть в течение срока участия в Технопарке и/или количество пользователей, которые будут пользоваться услугами/продуктом пользователя (ежедневно/ежемесячно/ежегодно или к завершению срока участия в Технопарке и т.д.) и/или объемы продаж, которые пользователь планирует достичь на ежедневной/ежемесячной/ежегодной основе или к завершению срока участия в Технопарке и т.д.). Желательно использовать таблицы для этого
""",
        7: """
Описание технологических решений, используемых для реализации проекта:
- Описание применяемого технологического стека (языки программирования, платформы, базы данных)
- Пошаговая схема реализации продукта
- Схема / описание функциональной архитектуры
- Названия, назначения и описание функциональных модулей
В случае если компания сервисная описываете часто используемые технологические решения

Описание должно быть детальным:
- НЕ просто перечислять технологии (Python, React и т.д.)
- ОБЯЗАТЕЛЬНО описать:
  * Архитектуру системы (схема компонентов)
  * Структуру решения (frontend, backend, база данных, API)
  * Применяемые решения и их обоснование
  * Пошаговую схему реализации
""",
        8: f"""
Сводная таблица расходов на производство и реализацию проекта. Необходимо указать примерные расходы вашего проекта на **ВЕСЬ** срок участия в Технопарке ({participation_years_range}):
- Зарплатный фонд (разбивка по годам)
- Аренда серверных мощностей (разбивка по годам)
- Маркетинговые расходы (разбивка по годам)
- Операционные расходы (разбивка по годам)
Обязательно сделай таблицу с разбивкой по годам, начиная с {current_year} года.
""",
        9: f"""
Способ продаж и ожидаемый ежегодный объем предполагаемых продаж, выручка (доход) (указывается на период участия в Технопарке)
- Опишите конкретные виды товаров, работ и услуг, планируемых к реализации в рамках выбранных пунктов из перечня Приоритетных видов деятельности.
- Опишите модель получения дохода от продажи продукта / оказания услуг и приложите сводную таблицу ожидаемого объема выручки (в динамике по годам на весь срок участия в Технопарке({participation_years_range})).
- Опишите стратегию развития продаж и продвижение проекта.
- Опишите основные и дополнительные каналы продаж
Обязательно сделай таблицу с разбивкой по годам, начиная с {current_year} года.
""",
        10: """
Опишите целевую аудиторию и основные сегменты потребления:
- Текущие клиенты;
- Модель продаж: B2C, B2B, B2G
- Клиенты (указываются категории клиентов: малый и средний бизнес, крупные предприятия, продукт массового потребления и т.д.);
- в случае если разработка делается на заказ, то необходимо указать краткие сведения о заказчике, заключенном договоре/предварительном соглашении/договоре намерений/меморандуме и т.д.;
- в случае если продукт/услуга B2B, необходимо указать краткую информацию о потенциальном клиенте, договорах и предзаказах;
- в случае если продукт/услуга B2C, Портрет клиента/целевой аудитории (customer profile), подтвержденный спрос на разработку
- заинтересованная аудитория и анализ рынка сбыта;
- описание целевой аудитории – потребителей продукта проекта.
""",
        11: f"""
Опишите пошаговый план реализации проекта (в динамике по годам на весь срок участия в Технопарке ({participation_years_range})).
- Приложите календарный план мероприятий по реализации проекта с указанием промежуточных результатов, достигаемых на каждом из этапов.
- Укажите взаимосвязь различных задач и результатов их решения, ключевые точки контроля.
Обязательно распиши план по годам, начиная с {current_year} года.
""",
        12: """
- Опишите значимость проекта для региона реализации проекта.
- Опишите экономическую и социальную значимость проекта или деятельность компании:
  * Увеличение количества новых специалистов
  * Улучшение инвестиционного климата
  * Улучшение общей IT-грамотности
- Количество создаваемых рабочих мест (по годам, если указано)
- Влияние на общество и экономику региона/страны
"""
    }
    
    return instructions.get(section_num, "")


def get_section_prompt(
    section_num: int,
    state: DraftGenerationState
) -> str:
    """
    Generate prompt for a specific section.
    
    Args:
        section_num: Section number (1-12)
        state: Draft generation state containing all necessary information
    
    Returns:
        Complete prompt string for the section
    """
    current_year = datetime.now(ZoneInfo("UTC")).year
    
    # Format OKED codes
    oked_formatted = ", ".join([format_oked_code(code) for code in state.company.oked_codes])
    
    # Format priority activities
    pvd_formatted = ", ".join(state.business_plan.priority_activities) if state.business_plan.priority_activities else "Не указаны"
    
    # Get section-specific form data
    section_form_data = format_form_data_for_section(state.form_data, section_num)
    
    # Get section-specific instructions
    section_instructions = get_section_specific_instructions(section_num, state.business_plan.participation_period_years)
    
    # Section titles mapping
    section_titles = {
        1: "Наименование проекта",
        2: "Место реализации проекта",
        3: "Права на интеллектуальную собственность",
        4: "Сведения о команде",
        5: "Стадия готовности проекта",
        6: "Ключевые показатели эффективности (KPI)",
        7: "Техническое описание проекта",
        8: "Смета планируемых расходов",
        9: "Виды товаров/услуг",
        10: "Клиенты/потенциальные клиенты",
        11: "План мероприятий",
        12: "Общественная значимость проекта"
    }
    
    section_title = section_titles.get(section_num, f"Раздел {section_num}")
    
    # Build current content section only if there's content
    current_content_section = ""
    if state.accumulated_content:
        current_content_section = f"""
# Текущее содержание бизнес-плана
Твой текст будет использован как продолжение для Раздела {section_num}. {section_title}.
<content>
{state.accumulated_content}
</content>
"""
    
    prompt = f"""Ты создаешь бизнес план. Сгенерируй Раздел {section_num}. {section_title}.

# Контекст компании
- Название компании: {state.company.name}
- Тип компании: {state.company.type}
- БИН: {state.company.bin}
- Коды ОКЭД: {oked_formatted}
- Приоритетные виды деятельности: {pvd_formatted}
- Срок участия в Технопарке: {state.business_plan.participation_period_years} года
- Год планируемой подачи: {state.business_plan.planned_submission_year}
- Текущий год: {current_year}
{current_content_section}
# Данные из формы пользователя
{section_form_data}

# Инструкции для раздела {section_num}
{section_instructions}

## Стиль текста
- **По умолчанию пиши связным текстом (параграфами)** — бизнес-план должен читаться как профессиональный документ, а не как набор буллетов
- Списки (буллеты, нумерация) используй только когда это реально улучшает читаемость:
  * Перечисление 3+ однотипных коротких элементов (технологии, документы, названия)
  * Пошаговые этапы или процессы
  * Чёткие требования или характеристики
- Таблицы — для числовых данных, сравнений, планов по годам
- **Не превращай** каждую мысль или предложение в отдельный пункт списка — это выглядит как AI-генерация

# Критически важно
- Генерируй ТОЛЬКО содержание раздела {section_num}. {section_title}. Запрещается генерировать что-то кроме этого раздела и задавать дополнительные вопросы
- НЕ включай заголовок раздела (он будет добавлен автоматически)
- Разделяй текст подразделы (##) без нумерации
- НЕ вызывай инструменты (tools) - только генерируй текст
- Твой ответ должен содержать тег <content>. Его содержимое будет использовано в бизнес плане:
<content>
[Твое содержание раздела в формате Markdown здесь]
</content>

- Используй профессиональный деловой язык на русском
- Будь детальным и конкретным
- Если применимо к разделу, используй таблицы для числовых данных и планов по годам
- Если данных из формы недостаточно, используй разумные предположения на основе контекста
- Ты генерируешь только один раздел бизнес плана. Не нужно слишком сильно его раздувать"""
    
    return prompt

