"""
Business Plan utilities
"""

import re
from schemas.sqlalchemy import BusinessPlan
from .oked import get_oked_name


def generate_business_plan_template(business_plan: BusinessPlan) -> str:
    """
    Generate initial template content for a business plan.
    
    This function creates a template that will be saved in both user_content
    and llm_content when a business plan is first created. The template uses
    existing data from the business plan (like OKED codes, priority activities, etc.)
    to pre-populate relevant sections.
    
    Args:
        business_plan: The BusinessPlan object containing all necessary data
                      including company relationship (name, type, bin, oked_codes),
                      title, priority_activities, participation_period_years,
                      and planned_submission_year.
    
    Returns:
        A markdown string containing the initial business plan template.
    """
    # Format OKED codes with their names
    def format_oked_code(code: str) -> str:
        name = get_oked_name(code)
        if name:
            return f"{code} ({name})"
        return code
    
    # Extract data from business plan
    title = business_plan.title
    priority_activities = business_plan.priority_activities
    oked_codes = business_plan.company.oked_codes if business_plan.company else []
    
    # Format priority activities as list items, escaping numeration
    def escape_numeration(text: str) -> str:
        """Escape numbers followed by period to prevent markdown numbered lists"""
        return re.sub(r'(\d+)\.', r'\1\\.', text)
    
    priority_activities_list = "\n".join(
        f"- {escape_numeration(activity)}" for activity in priority_activities
    )
    
    # Format OKED codes as list items
    oked_list = "\n".join(f"- {format_oked_code(code)}" for code in oked_codes)
    
    # Build template
    template = f"""# Бизнес-план для Astana Hub – {title}

# 1. Наименование проекта с его описанием, целями и задачами

## Вид деятельности
{priority_activities_list}

## ОКЭД
{oked_list}
"""
    
    return template

