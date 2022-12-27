# run this on my mac!!

import pandas as pd
from pathlib import Path
import csv
import re
import collections
import json 

# global vars
obsdn_path = "/Users/alex//worlds/basis/basis-language/"

# local store
paths = []

# data collection
nodes = []
links = []

# find double bracket wiki link
def get_num_links(name, text):
	num_links = 0
	matches = re.findall('\[\[.*?\]\]', text)
	num_matches = len(matches)
	words = []
	for match in matches:
		words.append(match.replace("[[", "").replace("]]", "").split("|")[0])

	counter = collections.Counter(words)
	for key in counter.keys():
		links.append({
			'source': name, 
			'target': key, 
			'value': counter[key]
		})
	
	return num_matches


def get_idea_data(idea_text):
	num_links = get_num_links(path.name.replace(".md", ""), idea_text)
	named_mediation = str(path).replace(
        "/Users/alex/worlds/basis/basis-language/", "").replace(path.name, "")

	return {"num_links": num_links, "named_mediation": named_mediation}




# store the file path
for path in Path(obsdn_path).rglob('*.md'):
    paths.append(path)

# delete all the lines in the file
with open('ideas.csv', 'w') as f:
    f.truncate()

# write names to file
with open('ideas.csv', 'r+') as idea_csv:
    writer = csv.writer(idea_csv)
    for path in paths:
        with open(path, 'r+') as idea_file:
            data = get_idea_data(idea_file.read())
            nodes.append({
				'id': path.name.replace(".md", ""), 
				'radius': data["num_links"]
			})
            df = pd.DataFrame(data, index=[0])
            df.to_csv(r'ideas.csv', mode='a', index=False, header=False)

# clean up links
for link in links:
	target = link["target"]
	found = False
	for node in nodes:
		if node["id"] == target:
			found = True
			break
	if not found:
		print("not found: " + target)
		links.remove(link)


master = {'nodes': nodes, 'links': links}
json_object = json.dumps(master, indent = 4) 

with open('d3data.json', 'w') as f:
    f.write(json_object)