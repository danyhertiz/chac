import json
from collections import defaultdict

movies_file = 'scripts/movies.json'
report_file = 'duplicate_posters_report.md'

def generate_duplicate_report():
    try:
        with open(movies_file, 'r', encoding='utf-8') as f:
            movies = json.load(f)
    except Exception as e:
        print(f"Error reading movies.json: {e}")
        return

    # Group movies by poster path
    poster_to_movies = defaultdict(list)
    for movie in movies:
        poster = movie.get('poster')
        if poster:
            poster_to_movies[poster].append(movie)

    # Filter to only shared posters
    duplicates = {poster: m_list for poster, m_list in poster_to_movies.items() if len(m_list) > 1}

    # Generate Markdown content
    md_lines = [
        "# Informe de Películas con Póster Compartido",
        f"\n**Total de pósters compartidos:** {len(duplicates)}",
        "\nEste informe lista las películas que utilizan el mismo archivo de póster dentro del catálogo.",
        "\n---"
    ]

    if not duplicates:
        md_lines.append("\nNo se encontraron películas que compartan el mismo póster.")
    else:
        for poster, m_list in sorted(duplicates.items()):
            md_lines.append(f"\n### Póster: `{poster}`")
            md_lines.append(f"**Número de películas:** {len(m_list)}")
            md_lines.append("\n| Título | Año | TMDB ID |")
            md_lines.append("| :--- | :--- | :--- |")
            for m in m_list:
                title = m.get('title', 'N/A')
                year = m.get('year', 'N/A')
                tmdb_id = m.get('tmdbId', 'N/A')
                md_lines.append(f"| {title} | {year} | {tmdb_id} |")
            md_lines.append("\n---")

    # Write report
    try:
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(md_lines))
        print(f"Report generated successfully: {report_file}")
        print(f"Found {len(duplicates)} shared posters.")
    except Exception as e:
        print(f"Error writing report: {e}")

if __name__ == "__main__":
    generate_duplicate_report()
