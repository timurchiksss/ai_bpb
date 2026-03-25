import markdown
from weasyprint import HTML


def markdown_to_pdf(markdown_text, output_pdf):
    # Convert markdown to HTML
    html_content = markdown.markdown(markdown_text)

    # Add some CSS for better spacing
    css_styles = """
    <style>
        /* Add your custom CSS here */
body {
	font-family: Barlow, sans-serif;
	line-height: 1.6;
	padding: 20px;
	margin: 0;
}

pre {
	background: #2d2d2d;
	border-radius: 4px;
	margin: 0.5em 0;
}

code {
	font-family: 'Fira Code', Consolas, Monaco, monospace;
	white-space: pre-wrap;
	word-wrap: break-word;
	overflow-wrap: anywhere;
}

:not(pre)>code {
	background: #f0f0f0;
	padding: 2px 4px;
	border-radius: 3px;
	color: #e83e8c;
}

img {
	max-width: 100%;
}

table {
	border-collapse: collapse;
	width: 100%;
	margin: 1em 0;
}

th,
td {
	border: 1px solid #ddd;
	padding: 8px;
}

th {
	background-color: #f4f4f4;
}

blockquote {
	border-left: 4px solid #ddd;
	padding-left: 1em;
	margin-left: 0;
	color: #666;
}

h1 {
	font-size: 2.2em;
	color: #2c3e50;
	border-bottom: 2px solid #eee;
	padding-bottom: 0.5rem;
	margin: 1.5rem 0;
}

h2 {
	font-size: 1.8em;
	color: #34495e;
	margin: 1.5rem 0;
}

h3 {
	font-size: 1.4em;
	color: #455a64;
}
                
    </style>
    """

    # Wrap the markdown content in HTML structure and add custom styles
    html_content = f"<html><head>{css_styles}</head><body>{html_content}</body></html>"

    # Create a PDF from the styled HTML content
    HTML(string=html_content).write_pdf(output_pdf)


markdown_text = """# Спринт 1 (4 нобря - 11 ноября)

## Разработка
- Создан репозиторий на Github
- Поднят сервер на субдомене agartu.space

## Сайт
- Сделана стартовая страница
- Сделана аутентификация
"""

markdown_to_pdf(markdown_text, "output.pdf")
