from api.shared_graph import  shared_graph as graph
from typing import Dict, Any

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
