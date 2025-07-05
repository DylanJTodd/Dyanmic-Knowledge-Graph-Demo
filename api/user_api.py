from api.shared_graph import  shared_graph as graph
from typing import Dict, Any, Tuple

def save_graph(path: str = "belief_graph.json") -> Dict[str, Any]:
    try:
        graph.save_to_file(path)
        return {"status": "ok", "path": path}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def load_graph(path: str = "belief_graph.json") -> Dict[str, Any]:
    try:
        graph.load_from_file(path)
        return {"status": "ok", "path": path}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def export_graph_json() -> str:
    return graph.to_json()

def get_graph_diff(graph_a: Dict[str, Any], graph_b: Dict[str, Any]) -> Dict[str, Any]:
    def node_map(nodes: list) -> Dict[str, Dict]:
        return {node["id"]: node for node in nodes}

    def edge_key(edge: Dict) -> Tuple[str, str, str]:
        return (edge["source"], edge["target"], edge["label"])

    def edge_map(edges: list) -> Dict[Tuple[str, str, str], Dict]:
        return {edge_key(edge): edge for edge in edges}

    # Node comparison
    nodes_a = node_map(graph_a.get("nodes", []))
    nodes_b = node_map(graph_b.get("nodes", []))

    added_nodes = [n for nid, n in nodes_b.items() if nid not in nodes_a]
    removed_nodes = [n for nid, n in nodes_a.items() if nid not in nodes_b]
    updated_nodes = [
        nodes_b[nid] for nid in nodes_b
        if nid in nodes_a and nodes_b[nid] != nodes_a[nid]
    ]

    # Edge comparison
    edges_a = edge_map(graph_a.get("edges", []))
    edges_b = edge_map(graph_b.get("edges", []))

    added_edges = [e for k, e in edges_b.items() if k not in edges_a]
    removed_edges = [e for k, e in edges_a.items() if k not in edges_b]
    updated_edges = [
        edges_b[k] for k in edges_b
        if k in edges_a and edges_b[k] != edges_a[k]
    ]

    return {
        "nodes": {
            "added": added_nodes,
            "removed": removed_nodes,
            "updated": updated_nodes
        },
        "edges": {
            "added": added_edges,
            "removed": removed_edges,
            "updated": updated_edges
        }
    }


def import_graph_json(json_str: str) -> Dict[str, Any]:
    try:
        graph.from_json(json_str)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_graph_dict() -> Dict[str, Any]:
    return graph.to_dict()

def get_nodes() -> list:
    return graph.get_nodes()

def get_edges() -> list:
    return graph.get_edges()

def has_node(node_id: str) -> bool:
    return graph.has_node(node_id)

def has_edge(from_node: str, to_node: str, label: str) -> bool:
    return graph.has_edge(from_node, to_node, label)
