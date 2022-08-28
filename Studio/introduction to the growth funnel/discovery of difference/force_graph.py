import networkx as nx

global graph

# me - this DAT
# scriptOp - the OP which is cooking
#
# press 'Setup Parameters' in the OP to call this function to re-create the parameters.
def onSetupParameters(scriptOp):
	page = scriptOp.appendCustomPage('Custom')
	return

# called whenever custom pulse parameter is pushed
def onPulse(par):
	
	return

def onCook(scriptOp):
	scriptOp.clear()

	ideas = scriptOp.inputs[0]

	graph = get_graph(scriptOp)

	max = 0

	num_rows = ideas.numRows

	for i in range(num_rows):
		val = ideas[i,0]
		if val > max:
			max = val
		
		
	
	for i in range(num_rows):
		scriptOp.appendRow([float(ideas[i,0]) / float(max) * 255.0])
	

	#scriptOp.copy(scriptOp.inputs[0])	# no need to call .clear() above when copying
	#scriptOp.insertRow(['color', 'size', 'shape'], 0)
	#scriptOp.appendRow(['red', '3', 'square'])
	#scriptOp[1,0] += '**'

	return


def get_graph(scriptOp):
	if not 'graph' in globals():
		global graph
		graph = nx.Graph()
		setup_graph(graph, scriptOp)
	return graph

def setup_graph(graph, scriptOp):
	ideas = scriptOp.inputs[0]

	num_rows = ideas.numRows
	for i in range(num_rows):
		graph.add_node(i, weight=ideas[i,0])

	# add random edges for now
	for i in range(num_rows):
		for j in range(num_rows):
			if i != j:
				graph.add_edge(i, j)

	return graph

