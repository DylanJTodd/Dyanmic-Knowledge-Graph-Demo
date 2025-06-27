import uuid
from datetime import datetime

class BeliefNode:
    def __init__(self, label, belief_type, confidence, node_id=None, history=None):
        self.id = node_id if node_id else str(uuid.uuid4())
        self.label = label
        self.type = belief_type
        self.confidence = confidence
        self.history = history if history else []

    def to_dict(self):
        return {
            "id": self.id,
            "label": self.label,
            "type": self.type,
            "confidence": self.confidence,
            "history": self.history
        }

    @staticmethod
    def from_dict(data):
        if not isinstance(data, dict):
            raise ValueError("Input must be a dictionary.")
        
        if "id" not in data:
            raise ValueError("Node must have an 'id' field.")
        if "label" not in data:
            raise ValueError("Node must have a 'label' field.")
        if "type" not in data:
            raise ValueError("Node must have a 'type' field.")
        if "confidence" not in data:
            raise ValueError("Node must have a 'confidence' field.")
        if "history" not in data:
            data["history"] = []

        return BeliefNode(
            label=data["label"],
            belief_type=data.get("type"),
            confidence=data.get("confidence"),
            history=data.get("history"),
            node_id=data["id"]
        )
    
    def add_history(self, action):
        timestamp = datetime.now().isoformat()
        self.history.append({
            "action": action,
            "timestamp": timestamp
        })
        if len(self.history) > 5:
            self.history.pop(0)
