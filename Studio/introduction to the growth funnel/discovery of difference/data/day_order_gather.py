# run this on my mac!!

import pandas as pd
from pathlib import Path
import csv

# global vars
obsdn_path = "/Users/alex//worlds/basis/basis-language/"

# local store
paths = []
num_day_lookup = {}

########################################################################################

# store the file path
for path in Path(obsdn_path + "00_chaos/daily/").rglob('*.md'):
    paths.append(path)
    
    # format: YYYY-MM-DD
    day = path.name.split("/daily/")[0].replace(".md", "")
    
    # skip if before date 2019-07-24 or if date is not in that format
    if day < "2019-07-24" or len(day) != 10:
        continue
    
    # convert to number of days since 2019-07-24
    num_day = (pd.to_datetime(day) - pd.to_datetime("2019-07-24")).days
    num_day_lookup[day] = num_day

    # sort num_day_lookup
    num_day_lookup = dict(sorted(num_day_lookup.items()))


# delete all the lines in the file
with open('day_order.csv', 'w') as f:
    f.truncate()

with open('day_order.csv', 'w') as f:
    ## dict to csv
    w = csv.writer(f)
    w.writerows(num_day_lookup.items())
