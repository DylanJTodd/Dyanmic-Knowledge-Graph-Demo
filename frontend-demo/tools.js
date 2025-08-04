// tools.js
import { BeliefGraph, BeliefNode } from './knowledge-graph.js';

export const graph = new BeliefGraph();

export const toolRegistry = {};
export const toolSchemas = {};

function registerTool({ name, description, parameters }, fn) {
  toolRegistry[name] = fn;
  toolSchemas[name] = { name, description, parameters, type: 'function' };
}

registerTool({
  name: "addNode",
  description: "Create a belief node and return its id.",
  parameters: {
    type: "object",
    properties: {
      label: { type: "string" },
      belief_type: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["label", "belief_type", "confidence"]
  }
}, ({ label, belief_type, confidence }) => {
  const node = new BeliefNode(label, belief_type, confidence);
  return graph.addNode(node);
});

registerTool({
  name: "updateNode",
  description: "Update fields of an existing belief node.",
  parameters: {
    type: "object",
    properties: {
      node_id: { type: "string" },
      label: { type: "string" },
      belief_type: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 }
    },
    required: ["node_id"]
  }
}, ({ node_id, label, belief_type, confidence }) => {
  const updates = {};
  if (label !== undefined) updates.label = label;
  if (belief_type !== undefined) updates.type = belief_type;
  if (confidence !== undefined) updates.confidence = confidence;
  graph.updateNode(node_id, updates);
  return { status: "ok" };
});

registerTool({
  name: "deleteNode",
  description: "Delete a belief node.",
  parameters: {
    type: "object",
    properties: { node_id: { type: "string" } },
    required: ["node_id"]
  }
}, ({ node_id }) => {
  graph.removeNode(node_id);
  return { status: "ok" };
});

registerTool({
  name: "addHistory",
  description: "Append an action to a node's history.",
  parameters: {
    type: "object",
    properties: {
      node_id: { type: "string" },
      action: { type: "string" }
    },
    required: ["node_id", "action"]
  }
}, ({ node_id, action }) => {
  graph.addHistory(node_id, action);
  return { status: "ok" };
});

registerTool({
  name: "addEdge",
  description: "Create a directed edge.",
  parameters: {
    type: "object",
    properties: {
      from_node_id: { type: "string" },
      to_node_id: { type: "string" },
      label: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1, default: 1.0 }
    },
    required: ["from_node_id", "to_node_id", "label"]
  }
}, ({ from_node_id, to_node_id, label, confidence = 1.0 }) => {
  graph.addEdge(from_node_id, to_node_id, label, confidence);
  return { status: "ok" };
});

registerTool({
  name: "updateEdgeConfidence",
  description: "Update an edge's confidence score.",
  parameters: {
    type: "object",
    properties: {
      from_node_id: { type: "string" },
      to_node_id: { type: "string" },
      label: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 }
    },
    required: ["from_node_id", "to_node_id", "label", "confidence"]
  }
}, ({ from_node_id, to_node_id, label, confidence }) => {
  graph.updateEdgeConfidence(from_node_id, to_node_id, label, confidence);
  return { status: "ok" };
});

registerTool({
  name: "deleteEdge",
  description: "Delete an edge.",
  parameters: {
    type: "object",
    properties: {
      from_node_id: { type: "string" },
      to_node_id: { type: "string" },
      label: { type: "string" }
    },
    required: ["from_node_id", "to_node_id", "label"]
  }
}, ({ from_node_id, to_node_id, label }) => {
  graph.removeEdge(from_node_id, to_node_id, label);
  return { status: "ok" };
});

registerTool({
  name: "getNode",
  description: "Retrieve a node.",
  parameters: {
    type: "object",
    properties: { node_id: { type: "string" } },
    required: ["node_id"]
  }
}, ({ node_id }) => {
  const node = graph.getNode(node_id);
  return node ? node.toDict() : null;
});

registerTool({
  name: "getNeighbors",
  description: "Get neighbors of a node.",
  parameters: {
    type: "object",
    properties: {
      node_id: { type: "string" },
      as_objects: { type: "boolean", default: true }
    },
    required: ["node_id"]
  }
}, ({ node_id, as_objects = true }) => {
  return graph.getNeighbors(node_id, as_objects);
});

registerTool({
  name: "getNodeHistory",
  description: "Retrieves a global history of most recent node changes.",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
}, () => graph.getNodeHistory());

registerTool({
  name: "getEdgeHistory",
  description: "Retrieves a global history of most recent edge changes.",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
}, () => graph.getEdgeHistory());
