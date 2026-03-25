"""
Tools for the Business Plan Constructor Agent
"""
import json
from typing import Annotated

from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.callbacks import adispatch_custom_event
from langgraph.prebuilt import InjectedState
from loguru import logger

from agents.schemas import AgentState


@tool(parse_docstring=True)
async def write(
    content: str,
) -> str:
    """
    Write or rewrite the entire business plan.
    
    This tool performs a COMPLETE WRITE or REWRITE of the business plan. It replaces
    the entire existing content (if any) with the new content provided. Use this tool
    when you need to write a new business plan or completely rewrite an existing one.
    
    IMPORTANT: This tool will REPLACE ALL existing content. For partial edits or
    modifications to specific sections, use the search_replace tool instead.
    
    Use this tool when the user asks you to write, create, or completely rewrite the
    business plan. The content should be the complete business plan in markdown format.
    
    Args:
        content: The full content of the business plan in markdown format.
                 Include all sections - this replaces the entire document.
    
    """
    # Emit custom event - the event handler will update the database and notify frontend
    await adispatch_custom_event(
        "business_plan_updated",
        {"content": content},
    )
    
    return f"Business plan written/rewritten successfully ({len(content)} characters)"

@tool(parse_docstring=True)
async def search_replace(
        state: Annotated[AgentState, InjectedState],
        old_string: str,
        new_string: str,
        replace_all: bool = False
):
    """Performs exact string replacements in business plan.

Usage:
- When editing text, ensure you preserve the exact indentation (tabs/spaces) as it appears before.
- ALWAYS prefer editing existing business plan. NEVER write business plan unless explicitly required.
- Avoid adding emojis to business plan unless asked.
- The edit will FAIL if old_string is not unique in the business plan. Either provide a larger string with more surrounding context to make it unique or use replace_all to change every instance of old_string.
- Use replace_all for replacing and renaming strings across the business plan. This parameter is useful if you want to rename a variable for instance.
- To create or overwrite a business plan, you should prefer the write tool.

Args:
    old_string: The text to replace
    new_string: The text to replace it with (must be different from old_string)
    replace_all: Replace all occurrences of old_string (default false)
"""
    logger.debug("search replace tool called")

    current_business_plan_content = state.business_plan.llm_content
    
    # Check if old_string and new_string are the same
    if old_string == new_string:
        raise ValueError(
            "Error calling tool: There was an error with the search/replace, and it was NOT applied.\n\n"
            "old_string and new_string are exactly the same."
        )
    
    # Count occurrences of old_string
    count = current_business_plan_content.count(old_string)
    
    # Check if old_string was not found
    if count == 0:
        raise ValueError(
            "Error calling tool: There was an error with the search/replace, and it was NOT applied.\n\n"
            "old_string was not found in the business plan"
        )
    
    # Check if old_string appears more than once and replace_all is False
    if count > 1 and not replace_all:
        raise ValueError(
            "Error calling tool: There was an error with the search/replace, and it was NOT applied.\n\n"
            f"old_string was found {count} times in the business plan. "
            "Either provide a larger string with more surrounding context to make it unique, "
            "or set replace_all=True to replace all occurrences."
        )
    
    # Perform the replacement
    if replace_all:
        new_content = current_business_plan_content.replace(old_string, new_string)
    else:
        # Replace only the first occurrence
        new_content = current_business_plan_content.replace(old_string, new_string, 1)
    
    # Emit custom event - the event handler will update the database and notify frontend
    await adispatch_custom_event(
        "business_plan_updated",
        {"content": new_content},
    )

    logger.debug("updated business plan")
    
    return "The business plan has been updated"

@tool(parse_docstring=True)
async def append(
    state: Annotated[AgentState, InjectedState],
    text: str,
) -> str:
    """
    Append text to the end of the business plan.
    
    This tool adds new content to the end of the existing business plan without
    modifying any existing content. Use this tool when you need to add new sections,
    paragraphs, or content to the business plan.
    
    Args:
        text: The text to append to the business plan. This will be added at the
              end of the current content.
    """
    logger.debug("append tool called")
    
    current_business_plan_content = state.business_plan.llm_content
    new_content = current_business_plan_content + text
    
    # Emit custom event - the event handler will update the database and notify frontend
    await adispatch_custom_event(
        "business_plan_updated",
        {"content": new_content},
    )
    
    logger.debug("appended text to business plan")
    
    return f"Text appended successfully ({len(text)} characters added)"

def handle_tool_errors(error: Exception) -> str:
    """
    Handle tool execution errors by returning them as ToolMessage to the LLM.

    This function catches general exceptions and converts them to error messages
    that are returned to the LLM, preventing the exception from propagating
    and breaking the agent workflow.

    Args:
        error: The exception that occurred during tool execution

    Returns:
        ToolMessage: A ToolMessage containing the error information for the LLM
    """
    error_message = f"Error calling tool: {str(error)}"
    logger.debug(f"handling error: {error_message}")
    return error_message

TOOLS_LIST = [write, search_replace, append]

