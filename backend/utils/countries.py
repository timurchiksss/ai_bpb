"""
Country data with ISO codes and names
"""

from typing import TypedDict


class CountryInfo(TypedDict):
    code: str
    name: str
    name_ru: str


COUNTRIES: dict[str, CountryInfo] = {
    "KZ": {"code": "KZ", "name": "Kazakhstan", "name_ru": "Казахстан"},
    "UZ": {"code": "UZ", "name": "Uzbekistan", "name_ru": "Узбекистан"},
    "KG": {"code": "KG", "name": "Kyrgyzstan", "name_ru": "Кыргызстан"},
    "TJ": {"code": "TJ", "name": "Tajikistan", "name_ru": "Таджикистан"},
    "TM": {"code": "TM", "name": "Turkmenistan", "name_ru": "Туркменистан"},
    "RU": {"code": "RU", "name": "Russia", "name_ru": "Россия"},
    "UA": {"code": "UA", "name": "Ukraine", "name_ru": "Украина"},
    "BY": {"code": "BY", "name": "Belarus", "name_ru": "Беларусь"},
    "AM": {"code": "AM", "name": "Armenia", "name_ru": "Армения"},
    "AZ": {"code": "AZ", "name": "Azerbaijan", "name_ru": "Азербайджан"},
    "GE": {"code": "GE", "name": "Georgia", "name_ru": "Грузия"},
    "US": {"code": "US", "name": "United States", "name_ru": "США"},
    "GB": {"code": "GB", "name": "United Kingdom", "name_ru": "Великобритания"},
    "DE": {"code": "DE", "name": "Germany", "name_ru": "Германия"},
    "FR": {"code": "FR", "name": "France", "name_ru": "Франция"},
    "IT": {"code": "IT", "name": "Italy", "name_ru": "Италия"},
    "ES": {"code": "ES", "name": "Spain", "name_ru": "Испания"},
    "CN": {"code": "CN", "name": "China", "name_ru": "Китай"},
    "JP": {"code": "JP", "name": "Japan", "name_ru": "Япония"},
    "KR": {"code": "KR", "name": "South Korea", "name_ru": "Южная Корея"},
    "IN": {"code": "IN", "name": "India", "name_ru": "Индия"},
    "BR": {"code": "BR", "name": "Brazil", "name_ru": "Бразилия"},
    "MX": {"code": "MX", "name": "Mexico", "name_ru": "Мексика"},
    "CA": {"code": "CA", "name": "Canada", "name_ru": "Канада"},
    "AU": {"code": "AU", "name": "Australia", "name_ru": "Австралия"},
    "NZ": {"code": "NZ", "name": "New Zealand", "name_ru": "Новая Зеландия"},
    "TR": {"code": "TR", "name": "Turkey", "name_ru": "Турция"},
    "SA": {"code": "SA", "name": "Saudi Arabia", "name_ru": "Саудовская Аравия"},
    "AE": {"code": "AE", "name": "United Arab Emirates", "name_ru": "ОАЭ"},
    "SG": {"code": "SG", "name": "Singapore", "name_ru": "Сингапур"},
    "MY": {"code": "MY", "name": "Malaysia", "name_ru": "Малайзия"},
    "TH": {"code": "TH", "name": "Thailand", "name_ru": "Таиланд"},
    "ID": {"code": "ID", "name": "Indonesia", "name_ru": "Индонезия"},
    "PH": {"code": "PH", "name": "Philippines", "name_ru": "Филиппины"},
    "VN": {"code": "VN", "name": "Vietnam", "name_ru": "Вьетнам"},
    "PL": {"code": "PL", "name": "Poland", "name_ru": "Польша"},
    "NL": {"code": "NL", "name": "Netherlands", "name_ru": "Нидерланды"},
    "BE": {"code": "BE", "name": "Belgium", "name_ru": "Бельгия"},
    "CH": {"code": "CH", "name": "Switzerland", "name_ru": "Швейцария"},
    "AT": {"code": "AT", "name": "Austria", "name_ru": "Австрия"},
    "SE": {"code": "SE", "name": "Sweden", "name_ru": "Швеция"},
    "NO": {"code": "NO", "name": "Norway", "name_ru": "Норвегия"},
    "DK": {"code": "DK", "name": "Denmark", "name_ru": "Дания"},
    "FI": {"code": "FI", "name": "Finland", "name_ru": "Финляндия"},
    "IE": {"code": "IE", "name": "Ireland", "name_ru": "Ирландия"},
    "PT": {"code": "PT", "name": "Portugal", "name_ru": "Португалия"},
    "GR": {"code": "GR", "name": "Greece", "name_ru": "Греция"},
    "CZ": {"code": "CZ", "name": "Czech Republic", "name_ru": "Чехия"},
    "HU": {"code": "HU", "name": "Hungary", "name_ru": "Венгрия"},
    "RO": {"code": "RO", "name": "Romania", "name_ru": "Румыния"},
    "BG": {"code": "BG", "name": "Bulgaria", "name_ru": "Болгария"},
    "HR": {"code": "HR", "name": "Croatia", "name_ru": "Хорватия"},
    "SK": {"code": "SK", "name": "Slovakia", "name_ru": "Словакия"},
    "SI": {"code": "SI", "name": "Slovenia", "name_ru": "Словения"},
    "LT": {"code": "LT", "name": "Lithuania", "name_ru": "Литва"},
    "LV": {"code": "LV", "name": "Latvia", "name_ru": "Латвия"},
    "EE": {"code": "EE", "name": "Estonia", "name_ru": "Эстония"},
    "IL": {"code": "IL", "name": "Israel", "name_ru": "Израиль"},
    "EG": {"code": "EG", "name": "Egypt", "name_ru": "Египет"},
    "ZA": {"code": "ZA", "name": "South Africa", "name_ru": "ЮАР"},
    "NG": {"code": "NG", "name": "Nigeria", "name_ru": "Нигерия"},
    "KE": {"code": "KE", "name": "Kenya", "name_ru": "Кения"},
    "AR": {"code": "AR", "name": "Argentina", "name_ru": "Аргентина"},
    "CL": {"code": "CL", "name": "Chile", "name_ru": "Чили"},
    "CO": {"code": "CO", "name": "Colombia", "name_ru": "Колумбия"},
    "PE": {"code": "PE", "name": "Peru", "name_ru": "Перу"},
    "VE": {"code": "VE", "name": "Venezuela", "name_ru": "Венесуэла"},
}


def get_country_info(country_code: str) -> CountryInfo | None:
    """Get country information by code"""
    return COUNTRIES.get(country_code.upper())


def is_valid_country(country_code: str) -> bool:
    """Check if country code is valid"""
    return country_code.upper() in COUNTRIES

