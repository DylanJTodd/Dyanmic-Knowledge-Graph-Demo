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

    def add_edge(self, from_node_id: str, to_node_id: str, label: str):
        assert from_node_id and to_node_id, "Both from_node and to_node must be specified."

        self.graph.add_edge(from_node_id, to_node_id, key=label)

    def get_node(self, node_id: str) -> Optional[Dict]:
        return self.graph.nodes.get(node_id, None)

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

    def save_to_file(self, file_path: str):
        with open(file_path, 'w') as f:
            f.write(self.to_json())

    def load_from_file(self, file_path: str):
        with open(file_path, 'r') as f:
            self.from_json(f.read())

    def get_neighbors(self, node_id: str) -> List[str]:
        return list(self.graph.predecessors(node_id)) + list(self.graph.successors(node_id))

    def has_node(self, node_id: str) -> bool:
        return self.graph.has_node(node_id)

    def has_edge(self, from_node: str, to_node: str, label: str) -> bool:
        return self.graph.has_edge(from_node, to_node, key=label)

    def remove_node(self, node_id: str):
        if self.graph.has_node(node_id):
            self.graph.remove_node(node_id)

    def remove_edge(self, from_node: str, to_node: str, label: str):
        if self.graph.has_edge(from_node, to_node, key=label):
            self.graph.remove_edge(from_node, to_node, key=label)
