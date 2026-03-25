// Currency data with ISO codes and names
export interface Currency {
  code: string;
  name: string;
  nameRu: string;
  symbol: string;
}

export const currencies: Currency[] = [
  { code: "KZT", name: "Kazakhstani Tenge", nameRu: "Казахстанский тенге", symbol: "₸" },
  { code: "UZS", name: "Uzbekistani Som", nameRu: "Узбекский сум", symbol: "so'm" },
  { code: "KGS", name: "Kyrgystani Som", nameRu: "Кыргызский сом", symbol: "с" },
  { code: "TJS", name: "Tajikistani Somoni", nameRu: "Таджикский сомони", symbol: "ЅМ" },
  { code: "TMT", name: "Turkmenistani Manat", nameRu: "Туркменский манат", symbol: "m" },
  { code: "RUB", name: "Russian Ruble", nameRu: "Российский рубль", symbol: "₽" },
  { code: "BYN", name: "Belarusian Ruble", nameRu: "Белорусский рубль", symbol: "Br" },
  { code: "UAH", name: "Ukrainian Hryvnia", nameRu: "Украинская гривна", symbol: "₴" },
  { code: "AMD", name: "Armenian Dram", nameRu: "Армянский драм", symbol: "֏" },
  { code: "AZN", name: "Azerbaijani Manat", nameRu: "Азербайджанский манат", symbol: "₼" },
  { code: "GEL", name: "Georgian Lari", nameRu: "Грузинский лари", symbol: "₾" },
  { code: "USD", name: "US Dollar", nameRu: "Доллар США", symbol: "$" },
  { code: "EUR", name: "Euro", nameRu: "Евро", symbol: "€" },
  { code: "GBP", name: "British Pound", nameRu: "Британский фунт", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", nameRu: "Японская иена", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", nameRu: "Китайский юань", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", nameRu: "Индийская рупия", symbol: "₹" },
  { code: "KRW", name: "South Korean Won", nameRu: "Южнокорейская вона", symbol: "₩" },
  { code: "BRL", name: "Brazilian Real", nameRu: "Бразильский реал", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", nameRu: "Мексиканское песо", symbol: "$" },
  { code: "CAD", name: "Canadian Dollar", nameRu: "Канадский доллар", symbol: "$" },
  { code: "AUD", name: "Australian Dollar", nameRu: "Австралийский доллар", symbol: "$" },
  { code: "NZD", name: "New Zealand Dollar", nameRu: "Новозеландский доллар", symbol: "$" },
  { code: "CHF", name: "Swiss Franc", nameRu: "Швейцарский франк", symbol: "Fr" },
  { code: "SEK", name: "Swedish Krona", nameRu: "Шведская крона", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", nameRu: "Норвежская крона", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", nameRu: "Датская крона", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", nameRu: "Польский злотый", symbol: "zł" },
  { code: "CZK", name: "Czech Koruna", nameRu: "Чешская крона", symbol: "Kč" },
  { code: "HUF", name: "Hungarian Forint", nameRu: "Венгерский форинт", symbol: "Ft" },
  { code: "RON", name: "Romanian Leu", nameRu: "Румынский лей", symbol: "lei" },
  { code: "TRY", name: "Turkish Lira", nameRu: "Турецкая лира", symbol: "₺" },
  { code: "SAR", name: "Saudi Riyal", nameRu: "Саудовский риал", symbol: "﷼" },
  { code: "AED", name: "UAE Dirham", nameRu: "Дирхам ОАЭ", symbol: "د.إ" },
  { code: "SGD", name: "Singapore Dollar", nameRu: "Сингапурский доллар", symbol: "$" },
  { code: "MYR", name: "Malaysian Ringgit", nameRu: "Малайзийский ринггит", symbol: "RM" },
  { code: "THB", name: "Thai Baht", nameRu: "Тайский бат", symbol: "฿" },
  { code: "IDR", name: "Indonesian Rupiah", nameRu: "Индонезийская рупия", symbol: "Rp" },
  { code: "PHP", name: "Philippine Peso", nameRu: "Филиппинское песо", symbol: "₱" },
  { code: "VND", name: "Vietnamese Dong", nameRu: "Вьетнамский донг", symbol: "₫" },
  { code: "ZAR", name: "South African Rand", nameRu: "Южноафриканский рэнд", symbol: "R" },
  { code: "EGP", name: "Egyptian Pound", nameRu: "Египетский фунт", symbol: "£" },
  { code: "ILS", name: "Israeli Shekel", nameRu: "Израильский шекель", symbol: "₪" },
  { code: "ARS", name: "Argentine Peso", nameRu: "Аргентинское песо", symbol: "$" },
  { code: "CLP", name: "Chilean Peso", nameRu: "Чилийское песо", symbol: "$" },
  { code: "COP", name: "Colombian Peso", nameRu: "Колумбийское песо", symbol: "$" },
  { code: "PEN", name: "Peruvian Sol", nameRu: "Перуанский соль", symbol: "S/" },
];

