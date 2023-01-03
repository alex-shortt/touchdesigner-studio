from pathlib import Path
import re

# global vars
obsdn_path = "/Users/alex/worlds/basis/basis-language/"

# pretty name :: path
path_lookup = {}


def get_links(text):
    words = []
    matches = re.findall('\[\[.*?\]\]', text)
    for match in matches:
        words.append(match.replace("[[", "").replace("]]", "").split("|")[0])

    return words


########################################################################################


# clear the csv to start
with open('idea_links.csv', 'w') as f:
    f.truncate()

for path in Path(obsdn_path).rglob('*.md'):
    name = path.name.replace(".md", "").split("/")[0]
    path_lookup[name] = str(path)

# find all files
with open('idea_links.csv', 'w') as f:
    ## add columns
    for name in path_lookup:
        f.write(",\"" + name + "\"")

    f.write("\n")

    for name in path_lookup:
        path = Path(path_lookup[name])
        idea_text = path.read_text()
        links = get_links(idea_text)
        f.write("\"" + name + "\",")

        for name in path_lookup:

            num_times = links.count(name)
            f.write(str(num_times) + ",")

        f.write("\n")