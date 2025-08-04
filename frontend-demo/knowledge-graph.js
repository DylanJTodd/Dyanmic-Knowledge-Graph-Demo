// BeliefNode class
export class BeliefNode {
  constructor(label, type, confidence = 1.0, id = null, history = []) {
    this.id = id;
    this.label = label;
    this.type = type;
    this.confidence = confidence;
    this.history = history;
  }

  toDict() {
    return {
      id: this.id,
      label: this.label,
      type: this.type,
      confidence: this.confidence,
      history: this.history,
    };
  }

  static fromDict(data) {
    if (!data || typeof data !== "object") throw new Error("Data must be a dictionary.");
    const { id, label, type, confidence, history = [] } = data;
    if (!id || !label || !type || typeof confidence !== "number") {
      throw new Error("Missing required fields in node data.");
    }
    return new BeliefNode(label, type, confidence, id, history);
  }

  addHistory(action) {
    const timestamp = new Date().toISOString();
    this.history.push({ action, timestamp });
    if (this.history.length > 10) this.history.shift();
  }
}

// BeliefGraph class
export class BeliefGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = []; // { source, target, label, confidence, ...attrs }
    this.nodeCounter = 0;
    this.nodeHistory = [];
    this.edgeHistory = [];
  }

  addNode(beliefNode) {
    if (!(beliefNode instanceof BeliefNode)) throw new Error("Invalid node type");
    beliefNode.id = `belief_${this.nodeCounter++}`;
    if (this.nodes.has(beliefNode.id)) throw new Error("Node already exists");
    this.nodes.set(beliefNode.id, beliefNode);
    this.updateNodeHistory(beliefNode.id, "Add Node", beliefNode.toDict());
    return beliefNode.id;
  }

  updateNode(nodeId, updates) {
    if (!this.nodes.has(nodeId)) throw new Error("Node not found");
    const node = this.nodes.get(nodeId);
    for (const key in updates) {
      if (key in node) node[key] = updates[key];
    }
    this.nodes.set(nodeId, node);
    this.updateNodeHistory(nodeId, "Update Node", node.toDict());
  }

  updateNodeHistory(nodeId, action, updates) {
    if (!this.nodes.has(nodeId)) throw new Error("Node not found");
    const updatesStr = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
    const record = `node_id: ${nodeId}, Action: ${action}, ${updatesStr}`;
    if (this.nodeHistory.length >= 15) this.nodeHistory.shift();
    this.nodeHistory.push(record);
  }

  updateEdgeHistory(fromId, toId, action, label = null, confidence = null, ...args) {
    if (action !== "Add Edge" && !this.hasEdge(fromId, toId, label)) {
      throw new Error("Edge does not exist.");
    }
    if (this.edgeHistory.length >= 15) this.edgeHistory.shift();
    this.edgeHistory.push({ from: fromId, to: toId, action, label, confidence, args });
  }

  addEdge(fromId, toId, label, confidence = 1.0, attrs = {}) {
    if (!this.nodes.has(fromId)) throw new Error("From node does not exist");
    if (!this.nodes.has(toId)) throw new Error("To node does not exist");
    if (this.hasEdge(fromId, toId, label)) throw new Error("Edge already exists");
    const edge = { source: fromId, target: toId, label, confidence, ...attrs };
    this.edges.push(edge);
    this.updateEdgeHistory(fromId, toId, "Add Edge", label, confidence, attrs);
  }

  updateEdgeConfidence(fromId, toId, label, newConfidence) {
    if (!this.hasEdge(fromId, toId, label)) throw new Error("Edge not found");
    const edge = this.edges.find(e => e.source === fromId && e.target === toId && e.label === label);
    edge.confidence = newConfidence;
    this.updateEdgeHistory(fromId, toId, "Update Edge Confidence", label, newConfidence);
  }

  addHistory(nodeId, action) {
    if (!this.nodes.has(nodeId)) throw new Error("Node not found");
    const node = this.getNode(nodeId);
    node.addHistory(action);
    this.nodes.set(nodeId, node);
  }

  getNodeHistory() { return this.nodeHistory; }
  getEdgeHistory() { return this.edgeHistory; }

  getNode(nodeId) {
    if (!this.nodes.has(nodeId)) throw new Error("Node not found");
    return this.nodes.get(nodeId);
  }

  getNodes() {
    return Array.from(this.nodes.entries()).map(([id, node]) => ({ id, ...node.toDict() }));
  }

  getEdges() {
    return this.edges.map(e => ({ ...e }));
  }

  getNeighbors(nodeId, asObjects = true) {
    if (!this.nodes.has(nodeId)) throw new Error("Node not found");
    const neighbors = new Set();
    for (const edge of this.edges) {
      if (edge.source === nodeId) neighbors.add(edge.target);
      if (edge.target === nodeId) neighbors.add(edge.source);
    }
    return asObjects
      ? Array.from(neighbors).map(id => this.getNode(id))
      : Array.from(neighbors).map(id => ({ id, ...this.getNode(id).toDict() }));
  }

  hasNode(nodeId) {
    return this.nodes.has(nodeId);
  }

  hasEdge(fromId, toId, label) {
    return this.edges.some(e => e.source === fromId && e.target === toId && e.label === label);
  }

  removeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    const node = this.getNode(nodeId);
    this.updateNodeHistory(nodeId, "Remove Node", node.toDict());
    this.nodes.delete(nodeId);
    this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
  }

  removeEdge(fromId, toId, label) {
    if (!this.hasEdge(fromId, toId, label)) return;
    this.updateEdgeHistory(fromId, toId, "Remove Edge", label);
    this.edges = this.edges.filter(e => !(e.source === fromId && e.target === toId && e.label === label));
  }

  toDict() {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
    };
  }

  toCytoscapeElements() {
    return [
      ...this.getNodes().map(n => ({ group: 'nodes', data: n })),
      ...this.getEdges().map(e => ({ group: 'edges', data: { ...e, id: `${e.source}_${e.label}_${e.target}` } }))
    ];
  }

  toJSON() {
    return JSON.stringify({
      nodes: this.getNodes(),
      edges: this.getEdges(),
      nodeCounter: this.nodeCounter,
      nodeHistory: this.nodeHistory,
      edgeHistory: this.edgeHistory
    });
  }

  fromJSON(jsonStr) {
    const data = JSON.parse(jsonStr);
    this.nodes = new Map(data.nodes.map(n => [n.id, BeliefNode.fromDict(n)]));
    this.edges = data.edges || [];
    this.nodeCounter = data.nodeCounter || 0;
    this.nodeHistory = data.nodeHistory || [];
    this.edgeHistory = data.edgeHistory || [];
  }

  validateGraph() {
    for (const node of this.nodes.values()) {
      BeliefNode.fromDict(node.toDict());
    }
    for (const edge of this.edges) {
      if (typeof edge.label !== 'string') {
        throw new Error(`Edge label must be a string`);
      }
    }
  }

  saveToFile(filename = 'belief_graph.json') {
    const json = this.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { status: 'ok', path: filename };
  }

  loadFromFile(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.fromJSON(reader.result);
        callback({ status: 'ok' });
      } catch (e) {
        callback({ status: 'error', message: e.message });
      }
    };
    reader.readAsText(file);
  }
}
