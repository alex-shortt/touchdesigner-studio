# run this on my mac!!

import pandas as pd
import os
import glob
from pathlib import Path
import csv

obsdn_path = "/Users/alex//worlds/basis/basis-language/"

paths = []


# find double bracket wiki link
def get_num_links(text):
	num_links = 0
	for line in text:
		if "[[" in line:
			num_links = line.count("[[") if "]]" in line else 0
	return num_links

def get_idea_data(path):
	num_links = get_num_links(idea_text)
	named_mediation = str(path).replace("/Users/alex/worlds/basis/basis-language/", "").replace(path.name, "")


	return { "num_links": num_links, "named_mediation": named_mediation }




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
		with open(path, 'r+') as idea_text:
			data = get_idea_data(path)
			df = pd.DataFrame(data, index=[0]) 
			df.to_csv(r'ideas.csv', mode = 'a', index = False, header=False)

