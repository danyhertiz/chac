import json
import os

movies_file = 'scripts/movies.json'
posters_dir = 'posters'

def analyze_posters():
    if not os.path.exists(movies_file):
        print(f"Error: {movies_file} not found.")
        return

    if not os.path.exists(posters_dir):
        print(f"Error: {posters_dir} not found.")
        return

    with open(movies_file, 'r', encoding='utf-8') as f:
        movies = json.load(f)

    valid_ids = {str(movie['tmdbId']) for movie in movies if 'tmdbId' in movie}
    
    poster_files = os.listdir(posters_dir)
    
    unused_files = []
    found_ids = set()
    
    for filename in poster_files:
        stem, ext = os.path.splitext(filename)
        if stem in valid_ids:
            found_ids.add(stem)
        else:
            unused_files.append(filename)
            
    missing_ids = valid_ids - found_ids
    
    print(f"Total movies in JSON: {len(movies)}")
    print(f"Total valid tmdbIds: {len(valid_ids)}")
    print(f"Total files in posters/: {len(poster_files)}")
    print(f"Total posters found for movies: {len(found_ids)}")
    print(f"Total unused files: {len(unused_files)}")
    print(f"Total missing posters: {len(missing_ids)}")
    
    print("\n--- Unused Files ---")
    for f in sorted(unused_files):
        print(f)
        
    print("\n--- Missing Posters ---")
    for i in sorted(missing_ids, key=int):
        print(i)

if __name__ == "__main__":
    analyze_posters()
