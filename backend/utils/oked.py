"""
OKED classifier utilities
"""

from typing import List, Dict, Any
from config import OKED_CLASSIFIER


def extract_all_oked_codes(classifier: List[Dict[str, Any]], codes: List[str] = None) -> List[str]:
    """
    Recursively extract all OKED codes from the classifier structure.
    Returns a flat list of all valid OKED codes.
    """
    if codes is None:
        codes = []
    
    for item in classifier:
        if "code" in item:
            code = item["code"]
            # Skip section headers like "Раздел A"
            if not code.startswith("Раздел"):
                codes.append(code)
        
        if "items" in item:
            extract_all_oked_codes(item["items"], codes)
    
    return codes


def is_valid_oked_code(code: str) -> bool:
    """
    Check if an OKED code exists in the classifier.
    """
    all_codes = extract_all_oked_codes(OKED_CLASSIFIER)
    return code in all_codes


def validate_oked_codes(codes: List[str]) -> List[str]:
    """
    Validate a list of OKED codes.
    Returns list of invalid codes.
    """
    all_codes = extract_all_oked_codes(OKED_CLASSIFIER)
    invalid = [code for code in codes if code not in all_codes]
    return invalid


def get_oked_name(code: str) -> str | None:
    """
    Get the name for an OKED code.
    Returns None if code not found.
    """
    def search_in_items(items: List[Dict[str, Any]], target_code: str) -> str | None:
        for item in items:
            if item.get("code") == target_code:
                return item.get("name")
            if "items" in item:
                result = search_in_items(item["items"], target_code)
                if result:
                    return result
        return None
    
    return search_in_items(OKED_CLASSIFIER, code)

