from graph.graph import BeliefGraph
from graph.node import BeliefNode
from typing import Optional, Dict, Any
from api.shared_graph import  shared_graph as graph

tool_registry: Dict[str, Any] = {}
tool_schemas: Dict[str, Dict[str, Any]] = {}


def register_tool(*, name: str, description: str, parameters: dict):
    def decorator(func):
        tool_registry[name] = func
        tool_schemas[name] = {
            "name": name,
            "description": description,
            "parameters": parameters,
        }
        return func
    return decorator

@register_tool(
    name="addNode",
    description="Create a belief node and return its id.",
    parameters={
        "type": "object",
        "properties": {
            "label": {"type": "string"},
            "belief_type": {"type": "string"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["label", "belief_type", "confidence"],
    },
)
def add_node(label: str, belief_type: str, confidence: float):
    node = BeliefNode(label=label, belief_type=belief_type, confidence=confidence)
    return graph.add_node(node)


@register_tool(
    name="updateNode",
    description="Update fields of an existing belief node.",
    parameters={
        "type": "object",
        "properties": {
            "node_id": {"type": "string"},
            "label": {"type": "string"},
            "belief_type": {"type": "string"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["node_id"],
    },
)
def update_node(
    node_id: str,
    label: Optional[str] = None,
    belief_type: Optional[str] = None,
    confidence: Optional[float] = None,
):
    updates = {
        k: v
        for k, v in {
            "label": label,
            "type": belief_type,
            "confidence": confidence,
        }.items()
        if v is not None
    }
    graph.update_node(node_id, **updates)
    return {"status": "ok"}


@register_tool(
    name="deleteNode",
    description="Delete a belief node.",
    parameters={
        "type": "object",
        "properties": {"node_id": {"type": "string"}},
        "required": ["node_id"],
    },
)
def delete_node(node_id: str):
    graph.remove_node(node_id)
    return {"status": "ok"}


@register_tool(
    name="addHistory",
    description="Append an action to a node's history.",
    parameters={
        "type": "object",
        "properties": {
            "node_id": {"type": "string"},
            "action": {"type": "string"},
        },
        "required": ["node_id", "action"],
    },
)
def add_history(node_id: str, action: str):
    graph.add_history(node_id, action)
    return {"status": "ok"}


@register_tool(
    name="addEdge",
    description="Create a directed edge.",
    parameters={
        "type": "object",
        "properties": {
            "from_node_id": {"type": "string"},
            "to_node_id": {"type": "string"},
            "label": {"type": "string"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1, "default": 1.0},
        },
        "required": ["from_node_id", "to_node_id", "label"],
    },
)
def add_edge(
    from_node_id: str,
    to_node_id: str,
    label: str,
    confidence: float = 1.0,
    **attrs,
):
    graph.add_edge(from_node_id, to_node_id, label, confidence, **attrs)
    return {"status": "ok"}


@register_tool(
    name="updateEdgeConfidence",
    description="Update an edge's confidence score.",
    parameters={
        "type": "object",
        "properties": {
            "from_node_id": {"type": "string"},
            "to_node_id": {"type": "string"},
            "label": {"type": "string"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["from_node_id", "to_node_id", "label", "confidence"],
    },
)
def update_edge_confidence(
    from_node_id: str,
    to_node_id: str,
    label: str,
    confidence: float,
):
    graph.update_edge_confidence(from_node_id, to_node_id, label, confidence)
    return {"status": "ok"}


@register_tool(
    name="deleteEdge",
    description="Delete an edge.",
    parameters={
        "type": "object",
        "properties": {
            "from_node_id": {"type": "string"},
            "to_node_id": {"type": "string"},
            "label": {"type": "string"},
        },
        "required": ["from_node_id", "to_node_id", "label"],
    },
)
def delete_edge(from_node_id: str, to_node_id: str, label: str):
    graph.remove_edge(from_node_id, to_node_id, label)
    return {"status": "ok"}


@register_tool(
    name="getNode",
    description="Retrieve a node.",
    parameters={
        "type": "object",
        "properties": {"node_id": {"type": "string"}},
        "required": ["node_id"],
    },
)
def get_node(node_id: str):
    node = graph.get_node(node_id)
    return node.to_dict() if node else None


@register_tool(
    name="getNeighbors",
    description="Get neighbors of a node.",
    parameters={
        "type": "object",
        "properties": {
            "node_id": {"type": "string"},
            "as_objects": {"type": "boolean", "default": True},
        },
        "required": ["node_id"],
    },
)
def get_neighbors(node_id: str, as_objects: bool = True):
    return graph.get_neighbors(node_id, as_objects)

@register_tool(
    name="getNodeHistory",
    description="Retrieves a global history of most recent node changes.",
    parameters={
    "type": "object",
    "properties": {},
    "required": []
}
)
def get_node_history():
    return graph.get_node_history()

@register_tool(
    name="getEdgeHistory",
    description="Retrieves a global history of most recent edge changes.",
    parameters={
    "type": "object",
    "properties": {},
    "required": []
}
)

def get_edge_history():
    return graph.get_edge_history()


