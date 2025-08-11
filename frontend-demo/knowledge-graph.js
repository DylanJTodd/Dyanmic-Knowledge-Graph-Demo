export class BeliefNode {
  constructor(label, type, confidence = 1.0, id = null, history = []) {
    this.id = id; this.label = label; this.type = type; this.confidence = confidence; this.history = history;
  }
  toDict() { return { id: this.id, label: this.label, type: this.type, confidence: this.confidence, history: this.history, }; }
  static fromDict(data) {
    if (!data || typeof data !== "object") throw new Error("Data must be a dictionary.");
    const { id, label, type, confidence, history = [] } = data;
    if (!id || !label || !type || typeof confidence !== "number") { throw new Error("Missing required fields in node data."); }
    return new BeliefNode(label, type, confidence, id, history);
  }
  addHistory(action) { const timestamp = new Date().toISOString(); this.history.push({ action, timestamp }); if (this.history.length > 10) this.history.shift(); }
}

export class BeliefGraph {
  constructor() {
    this.nodes = new Map(); this.edges = []; this.nodeCounter = 0; this.edgeHistory = [];
  }
  addNode(beliefNode) {
    if (!(beliefNode instanceof BeliefNode)) throw new Error("Invalid node type");
    beliefNode.id = `belief_${this.nodeCounter++}`;
    if (this.nodes.has(beliefNode.id)) throw new Error("Node already exists");
    this.nodes.set(beliefNode.id, beliefNode);
    beliefNode.addHistory("Node Created");
    return beliefNode.id;
  }
  updateNode(nodeId, updates) {
    if (!this.nodes.has(nodeId)) throw new Error("Node not found");
    const node = this.nodes.get(nodeId);
    let historyMsg = "Update Node: "; const changed = [];
    for (const key in updates) {
      if (key in node && key !== 'history' && JSON.stringify(node[key]) !== JSON.stringify(updates[key])) {
        node[key] = updates[key];
        changed.push(key);
      }
    }
    if (changed.length > 0) { node.addHistory(historyMsg + changed.join(', ')); }
  }
  updateEdgeHistory(fromId, toId, action, label = null, confidence = null, ...args) {
    if (action !== "Add Edge" && !this.hasEdge(fromId, toId, label)) { throw new Error("Edge does not exist."); }
    if (this.edgeHistory.length >= 15) this.edgeHistory.shift();
    this.edgeHistory.push({ from: fromId, to: toId, action, label, confidence, args });
  }
  addEdge(fromId, toId, label, confidence = 1.0, attrs = {}) {
    if (!this.nodes.has(fromId)) throw new Error("From node does not exist");
    if (!this.nodes.has(toId)) throw new Error("To node does not exist");
    if (this.hasEdge(fromId, toId, label)) { console.warn("Edge already exists"); return; }
    const edge = { source: fromId, target: toId, label, confidence, ...attrs };
    this.edges.push(edge);
    this.updateEdgeHistory(fromId, toId, "Add Edge", label, confidence, attrs);
  }
  updateEdgeConfidence(fromId, toId, label, newConfidence) {
    const edge = this.edges.find(e => e.source === fromId && e.target === toId && e.label === label);
    if (edge) { edge.confidence = newConfidence; this.updateEdgeHistory(fromId, toId, "Update Edge Confidence", label, newConfidence); }
  }
  addHistory(nodeId, action) {
    if (!this.nodes.has(nodeId)) throw new Error("Node not found");
    this.getNode(nodeId).addHistory(action);
  }
  getEdgeHistory() { return this.edgeHistory; }
  getNode(nodeId) { if (!this.nodes.has(nodeId)) throw new Error("Node not found"); return this.nodes.get(nodeId); }
  getNodes() { return Array.from(this.nodes.values()).map(node => node.toDict()); }
  getEdges() { return this.edges.map(e => ({ ...e })); }
  hasNode(nodeId) { return this.nodes.has(nodeId); }
  hasEdge(fromId, toId, label) { return this.edges.some(e => e.source === fromId && e.target === toId && e.label === label); }
  removeNode(nodeId) { if (!this.nodes.has(nodeId)) return; this.nodes.delete(nodeId); this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId); }
  removeEdge(fromId, toId, label) { if (!this.hasEdge(fromId, toId, label)) return; this.updateEdgeHistory(fromId, toId, "Remove Edge", label); this.edges = this.edges.filter(e => !(e.source === fromId && e.target === toId && e.label === label)); }
  toDict() { return { nodes: this.getNodes(), edges: this.getEdges() }; }
  toCytoscapeElements() { return [ ...this.getNodes().map(n => ({ group: 'nodes', data: n })), ...this.getEdges().map(e => ({ group: 'edges', data: { ...e, id: `${e.source}_${e.label}_${e.target}` } })) ]; }
  toJSON() { return JSON.stringify({ nodes: this.getNodes(), edges: this.getEdges(), nodeCounter: this.nodeCounter, edgeHistory: this.edgeHistory }); }
  fromJSON(jsonStr) {
    const data = JSON.parse(jsonStr);
    this.nodes.clear();
    (data.nodes || []).forEach(n => this.nodes.set(n.id, BeliefNode.fromDict(n)));
    this.edges = data.edges || [];
    this.nodeCounter = data.nodeCounter || 0;
    this.edgeHistory = data.edgeHistory || [];
  }
}