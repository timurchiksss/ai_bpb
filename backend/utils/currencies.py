"""
Currency data with ISO codes, names, and symbols
"""

from typing import TypedDict


class CurrencyInfo(TypedDict):
    code: str
    name: str
    name_ru: str
    symbol: str


CURRENCIES: dict[str, CurrencyInfo] = {
    "KZT": {"code": "KZT", "name": "Kazakhstani Tenge", "name_ru": "Казахстанский тенге", "symbol": "₸"},
    "UZS": {"code": "UZS", "name": "Uzbekistani Som", "name_ru": "Узбекский сум", "symbol": "so'm"},
    "KGS": {"code": "KGS", "name": "Kyrgystani Som", "name_ru": "Кыргызский сом", "symbol": "с"},
    "TJS": {"code": "TJS", "name": "Tajikistani Somoni", "name_ru": "Таджикский сомони", "symbol": "ЅМ"},
    "TMT": {"code": "TMT", "name": "Turkmenistani Manat", "name_ru": "Туркменский манат", "symbol": "m"},
    "RUB": {"code": "RUB", "name": "Russian Ruble", "name_ru": "Российский рубль", "symbol": "₽"},
    "BYN": {"code": "BYN", "name": "Belarusian Ruble", "name_ru": "Белорусский рубль", "symbol": "Br"},
    "UAH": {"code": "UAH", "name": "Ukrainian Hryvnia", "name_ru": "Украинская гривна", "symbol": "₴"},
    "AMD": {"code": "AMD", "name": "Armenian Dram", "name_ru": "Армянский драм", "symbol": "֏"},
    "AZN": {"code": "AZN", "name": "Azerbaijani Manat", "name_ru": "Азербайджанский манат", "symbol": "₼"},
    "GEL": {"code": "GEL", "name": "Georgian Lari", "name_ru": "Грузинский лари", "symbol": "₾"},
    "USD": {"code": "USD", "name": "US Dollar", "name_ru": "Доллар США", "symbol": "$"},
    "EUR": {"code": "EUR", "name": "Euro", "name_ru": "Евро", "symbol": "€"},
    "GBP": {"code": "GBP", "name": "British Pound", "name_ru": "Британский фунт", "symbol": "£"},
    "JPY": {"code": "JPY", "name": "Japanese Yen", "name_ru": "Японская иена", "symbol": "¥"},
    "CNY": {"code": "CNY", "name": "Chinese Yuan", "name_ru": "Китайский юань", "symbol": "¥"},
    "INR": {"code": "INR", "name": "Indian Rupee", "name_ru": "Индийская рупия", "symbol": "₹"},
    "KRW": {"code": "KRW", "name": "South Korean Won", "name_ru": "Южнокорейская вона", "symbol": "₩"},
    "BRL": {"code": "BRL", "name": "Brazilian Real", "name_ru": "Бразильский реал", "symbol": "R$"},
    "MXN": {"code": "MXN", "name": "Mexican Peso", "name_ru": "Мексиканское песо", "symbol": "$"},
    "CAD": {"code": "CAD", "name": "Canadian Dollar", "name_ru": "Канадский доллар", "symbol": "$"},
    "AUD": {"code": "AUD", "name": "Australian Dollar", "name_ru": "Австралийский доллар", "symbol": "$"},
    "NZD": {"code": "NZD", "name": "New Zealand Dollar", "name_ru": "Новозеландский доллар", "symbol": "$"},
    "CHF": {"code": "CHF", "name": "Swiss Franc", "name_ru": "Швейцарский франк", "symbol": "Fr"},
    "SEK": {"code": "SEK", "name": "Swedish Krona", "name_ru": "Шведская крона", "symbol": "kr"},
    "NOK": {"code": "NOK", "name": "Norwegian Krone", "name_ru": "Норвежская крона", "symbol": "kr"},
    "DKK": {"code": "DKK", "name": "Danish Krone", "name_ru": "Датская крона", "symbol": "kr"},
    "PLN": {"code": "PLN", "name": "Polish Zloty", "name_ru": "Польский злотый", "symbol": "zł"},
    "CZK": {"code": "CZK", "name": "Czech Koruna", "name_ru": "Чешская крона", "symbol": "Kč"},
    "HUF": {"code": "HUF", "name": "Hungarian Forint", "name_ru": "Венгерский форинт", "symbol": "Ft"},
    "RON": {"code": "RON", "name": "Romanian Leu", "name_ru": "Румынский лей", "symbol": "lei"},
    "TRY": {"code": "TRY", "name": "Turkish Lira", "name_ru": "Турецкая лира", "symbol": "₺"},
    "SAR": {"code": "SAR", "name": "Saudi Riyal", "name_ru": "Саудовский риал", "symbol": "﷼"},
    "AED": {"code": "AED", "name": "UAE Dirham", "name_ru": "Дирхам ОАЭ", "symbol": "د.إ"},
    "SGD": {"code": "SGD", "name": "Singapore Dollar", "name_ru": "Сингапурский доллар", "symbol": "$"},
    "MYR": {"code": "MYR", "name": "Malaysian Ringgit", "name_ru": "Малайзийский ринггит", "symbol": "RM"},
    "THB": {"code": "THB", "name": "Thai Baht", "name_ru": "Тайский бат", "symbol": "฿"},
    "IDR": {"code": "IDR", "name": "Indonesian Rupiah", "name_ru": "Индонезийская рупия", "symbol": "Rp"},
    "PHP": {"code": "PHP", "name": "Philippine Peso", "name_ru": "Филиппинское песо", "symbol": "₱"},
    "VND": {"code": "VND", "name": "Vietnamese Dong", "name_ru": "Вьетнамский донг", "symbol": "₫"},
    "ZAR": {"code": "ZAR", "name": "South African Rand", "name_ru": "Южноафриканский рэнд", "symbol": "R"},
    "EGP": {"code": "EGP", "name": "Egyptian Pound", "name_ru": "Египетский фунт", "symbol": "£"},
    "ILS": {"code": "ILS", "name": "Israeli Shekel", "name_ru": "Израильский шекель", "symbol": "₪"},
    "ARS": {"code": "ARS", "name": "Argentine Peso", "name_ru": "Аргентинское песо", "symbol": "$"},
    "CLP": {"code": "CLP", "name": "Chilean Peso", "name_ru": "Чилийское песо", "symbol": "$"},
    "COP": {"code": "COP", "name": "Colombian Peso", "name_ru": "Колумбийское песо", "symbol": "$"},
    "PEN": {"code": "PEN", "name": "Peruvian Sol", "name_ru": "Перуанский соль", "symbol": "S/"},
}


def get_currency_info(currency_code: str) -> CurrencyInfo | None:
    """Get currency information by code"""
    return CURRENCIES.get(currency_code.upper())


def is_valid_currency(currency_code: str) -> bool:
    """Check if currency code is valid"""
    return currency_code.upper() in CURRENCIES

