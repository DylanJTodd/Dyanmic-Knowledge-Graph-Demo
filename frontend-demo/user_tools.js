import { graph } from './tools.js';

export function clearGraph() {
  try {
    graph.fromJSON(JSON.stringify({
      nodes: [],
      edges: [],
      nodeCounter: 0,
      nodeHistory: [],
      edgeHistory: []
    }));
    return { status: 'ok' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

export function saveGraph() {
  try {
    const json = graph.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'belief_graph.json';
    a.click();
    URL.revokeObjectURL(url);
    return { status: 'ok', path: 'belief_graph.json' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

export function loadGraphFromFile(file, callback) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      graph.fromJSON(reader.result);
      callback({ status: 'ok' });
    } catch (e) {
      callback({ status: 'error', message: e.message });
    }
  };
  reader.readAsText(file);
}

export function loadGraphFromJSON(jsonString) {
    graph.fromJSON(jsonString);
}

export function exportGraphJson() {
  return graph.toJSON();
}

export function importGraphJson(jsonStr) {
  try {
    graph.fromJSON(jsonStr);
    return { status: 'ok' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

export function getGraphDict() {
  return graph.toDict();
}

export function getNodes() {
  return graph.getNodes();
}

export function getEdges() {
  return graph.getEdges();
}

export function hasNode(nodeId) {
  return graph.hasNode(nodeId);
}

export function hasEdge(fromId, toId, label) {
  return graph.hasEdge(fromId, toId, label);
}

export function getGraphDiff(graphA, graphB) {
  const nodeMap = (nodes) => Object.fromEntries(nodes.map(n => [n.id, n]));
  const edgeKey = (e) => `${e.source}|${e.target}|${e.label}`;
  const edgeMap = (edges) => Object.fromEntries(edges.map(e => [edgeKey(e), e]));

  const nodesA = nodeMap(graphA.nodes || []);
  const nodesB = nodeMap(graphB.nodes || []);
  const addedNodes = Object.entries(nodesB).filter(([id]) => !(id in nodesA)).map(([, n]) => n);
  const removedNodes = Object.entries(nodesA).filter(([id]) => !(id in nodesB)).map(([, n]) => n);
  const updatedNodes = Object.entries(nodesB).filter(([id]) => id in nodesA && JSON.stringify(nodesB[id]) !== JSON.stringify(nodesA[id])).map(([, n]) => n);

  const edgesA = edgeMap(graphA.edges || []);
  const edgesB = edgeMap(graphB.edges || []);
  const addedEdges = Object.entries(edgesB).filter(([k]) => !(k in edgesA)).map(([, e]) => e);
  const removedEdges = Object.entries(edgesA).filter(([k]) => !(k in edgesB)).map(([, e]) => e);
  const updatedEdges = Object.entries(edgesB).filter(([k]) => k in edgesA && JSON.stringify(edgesB[k]) !== JSON.stringify(edgesA[k])).map(([, e]) => e);

  return {
    nodes: { added: addedNodes, removed: removedNodes, updated: updatedNodes },
    edges: { added: addedEdges, removed: removedEdges, updated: updatedEdges }
  };
}

export function getEdgeHistory() {
  return graph.getEdgeHistory();
}