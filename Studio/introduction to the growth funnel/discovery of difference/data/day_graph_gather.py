# run this on my mac!!

import pandas as pd
from pathlib import Path
import csv
import re
import collections

# global vars
obsdn_path = "/Users/alex/worlds/basis/basis-language/"

# local store
daily_paths = []
# day :: num_day
num_day_lookup = {}
# pretty name :: path
path_lookup = {}

# find double bracket wiki link


def get_links(text):
    matches = re.findall('\[\[.*?\]\]', text)
    num_matches = len(matches)
    words = []
    for match in matches:
        words.append(match.replace("[[", "").replace("]]", "").split("|")[0])

    return words


########################################################################################

# delete all the lines in the file
with open('day_graph.csv', 'w') as f:
    f.truncate()

for path in Path(obsdn_path).rglob('*.md'):
    name = path.name.replace(".md", "").split("/")[0]
    path_lookup[name] = str(path)

# find daily files, store them
for path in Path(obsdn_path + "00_chaos/daily/").rglob('*.md'):
    # format: YYYY-MM-DD
    day = path.name.split("/daily/")[0].replace(".md", "")

    # skip if before date 2019-07-24 or if date is not in that format
    if day < "2019-07-24" or len(day) != 10:
        continue

    # convert to number of days since 2019-07-24
    num_day = (pd.to_datetime(day) - pd.to_datetime("2019-07-24")).days
    num_day_lookup[str(path)] = num_day

    # sort num_day_lookup
    num_day_lookup = dict(sorted(num_day_lookup.items()))

# loop thorugh daily_paths and write to csv
with open('day_graph.csv', 'w') as f:
    for day_path in num_day_lookup:
        # open file
        with open(day_path, 'r+') as day_file:
            num_day = num_day_lookup[day_path]
            daily_text = day_file.read()
            # end up with arr of words
            links = get_links(daily_text)
            num_links = len(links)

            clean_name = day_path.split("/daily/")[1].replace(".md", "")
            for link in links:
                # catch error if link is not in path_lookup
                if link not in path_lookup:
                    continue
                sub_path = path_lookup[link]
                sub_text = open(sub_path, 'r+').read()
                sub_links = get_links(sub_text)
                for sub_link in sub_links:
                    f.write(str(num_day) + "," + clean_name + "," + link + "," + sub_link + "\n")
