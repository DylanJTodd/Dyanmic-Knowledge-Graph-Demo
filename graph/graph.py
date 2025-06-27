import networkx as nx
import json
from typing import List, Dict, Optional
from graph.node import BeliefNode

class BeliefGraph:
    def __init__(self):
        self.graph = nx.MultiDiGraph()

    def add_node(self, node: BeliefNode):
        assert node, "Node cannot be empty."
        assert isinstance(node, BeliefNode), "Node must be an instance of BeliefNode."

        if self.graph.has_node(node.id):
            raise ValueError(f"Node with id {node.id} already exists.")
        self.graph.add_node(node.id, **node.to_dict())

    def update_node(self, node_id: str, **updates):
        '''
        **updates = {
            "confidence": 0.6,
            "label": "Pain teaches resilience."
        }
        '''
        assert node_id, "Node ID must be specified."
        assert updates, "Updates cannot be empty."
        if not self.graph.has_node(node_id):
            raise ValueError("Node does not exist.")

        node_data = self.graph.nodes[node_id]
        belief_node = BeliefNode.from_dict(node_data)

        for item, value in updates.items():
            if hasattr(belief_node, item):
                setattr(belief_node, item, value)

        self.graph.nodes[node_id].update(belief_node.to_dict())

    def add_edge(self, from_node_id: str, to_node_id: str, label: str):
        assert from_node_id and to_node_id, "Both from_node and to_node must be specified."
        assert label, "Edge label must be specified."
        if not self.graph.has_node(from_node_id):
            raise ValueError(f"From node {from_node_id} does not exist.")
        if not self.graph.has_node(to_node_id):
            raise ValueError(f"To node {to_node_id} does not exist.")
        if self.graph.has_edge(from_node_id, to_node_id, key=label):
            raise ValueError(f"Edge from {from_node_id} to {to_node_id} with label '{label}' already exists.")

        self.graph.add_edge(from_node_id, to_node_id, key=label)

    def add_history(self, node_id: str, action: str):
        assert node_id, "Node ID must be specified."
        if not self.graph.has_node(node_id):
            raise ValueError("Node does not exist.")
        
        node = self.graph.nodes[node_id]
        belief_node = BeliefNode.from_dict(node)
        belief_node.add_history(action)
        self.graph.nodes[node_id] = belief_node.to_dict()

    def get_node(self, node_id: str) -> Optional[BeliefNode]:
        return BeliefNode.from_dict(self.graph.nodes[node_id])

    def get_nodes(self) -> List[Dict]:
        return [
            {"id": node_id, **data} for node_id, data in self.graph.nodes(data=True)
        ]

    def get_edges(self) -> List[Dict]:
        return [
            {
                "source": u,
                "target": v,
                "label": k,
                **d
            }
            for u, v, k, d in self.graph.edges(keys=True, data=True)
        ]

    def to_json(self) -> str:
        data = nx.readwrite.json_graph.node_link_data(self.graph)
        return json.dumps(data)

    def from_json(self, json_str: str):
        data = json.loads(json_str)
        self.graph = nx.readwrite.json_graph.node_link_graph(data)
        
    def to_dict(self) -> Dict:
        return {
            "nodes": self.get_nodes(),
            "edges": self.get_edges()
        }

    def save_to_file(self, file_path: str):
        with open(file_path, 'w') as f:
            f.write(self.to_json())

    def validate_graph(self):
        for node_id, data in self.graph.nodes(data=True):
            try:
                BeliefNode.from_dict(data)
            except Exception as e:
                raise ValueError(f"Node {node_id} failed validation: {e}")
            
        for u, v, k, d in self.graph.edges(keys=True, data=True):
            if not isinstance(k, str):
                raise ValueError(f"Edge label (key) must be a string between {u} and {v}")
        

    def load_from_file(self, file_path: str):
        with open(file_path, 'r') as f:
            self.from_json(f.read())
        self.validate_graph()

    def get_neighbors(self, node_id: str, as_objects: bool = True) -> List[BeliefNode]:
        assert node_id, "Node ID must be specified."
        if not self.graph.has_node(node_id):
            raise ValueError(f"Node {node_id} does not exist.")

        neighbor_ids = set(self.graph.predecessors(node_id)).union(self.graph.successors(node_id))

        if as_objects:
            return [
                BeliefNode.from_dict(self.graph.nodes[n_id]) for n_id in neighbor_ids
            ]
        else:
            return [
                {"id": n_id, **self.graph.nodes[n_id]} for n_id in neighbor_ids
            ]


    def has_node(self, node_id: str) -> bool:
        assert node_id, "Node ID must be specified."
        return self.graph.has_node(node_id)

    def has_edge(self, from_node: str, to_node: str, label: str) -> bool:
        assert from_node and to_node, "Both from_node and to_node must be specified."
        return self.graph.has_edge(from_node, to_node, key=label)

    def remove_node(self, node_id: str):
        assert node_id, "Node ID must be specified."
        if self.graph.has_node(node_id):
            self.graph.remove_node(node_id)

    def remove_edge(self, from_node: str, to_node: str, label: str):
        assert from_node and to_node, "Both from_node and to_node must be specified."
        if self.graph.has_edge(from_node, to_node, key=label):
            self.graph.remove_edge(from_node, to_node, key=label)
