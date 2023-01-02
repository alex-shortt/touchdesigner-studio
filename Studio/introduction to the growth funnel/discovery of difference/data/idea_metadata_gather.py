from pathlib import Path
import re

# global vars
obsdn_path = "/Users/alex/worlds/basis/basis-language/"

# local store
paths = []


def get_links(text):
    words = []
    matches = re.findall('\[\[.*?\]\]', text)
    for match in matches:
        words.append(match.replace("[[", "").replace("]]", "").split("|")[0])

    return words


########################################################################################


# clear the csv to start
with open('ideas_metadata.csv', 'w') as f:
    f.truncate()

# find all files
with open('ideas_metadata.csv', 'w') as f:
    for path in Path(obsdn_path).rglob('*.md'):
        clean_name = path.name.replace(".md", "").split("/")[0]
        idea_text = path.read_text()
        links = get_links(idea_text)
        unique_links = list(set(links))

        clean_path = str(path).replace(obsdn_path, "").replace(".md", "")
        num_links = len(links)
        num_unique_links = len(unique_links)
        character_count = len(idea_text)
        word_count = len(idea_text.split(" "))

        f.write("\"" + clean_name + "\",\"" + clean_path + "\"," + str(character_count) + "," +
                str(word_count) + "," + str(num_links) + "," + str(num_unique_links) + "\n")
