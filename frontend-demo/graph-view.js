// graph-view.js
import { BeliefGraph, BeliefNode } from './knowledge-graph.js';
import { graph } from './tools.js';

let cy = null; let edgeSourceNode = null;
const infoPanel = document.getElementById('info-panel'); const infoPanelContent = document.getElementById('info-panel-content');
const infoPanelActions = document.getElementById('info-panel-actions'); const infoPanelCloseBtn = document.getElementById('info-panel-close');
const addNodeBtn = document.getElementById('add-node-btn'); const cancelEdgeBtn = document.getElementById('cancel-edge-btn');
const modalOverlay = document.getElementById('input-modal-overlay'); const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body'); const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
let onModalSave = null;

// REVISED: Darker, less saturated color palette
const typeColorMap = [ '#311b92', '#4a148c', '#004d40', '#b71c1c', '#bf360c', '#3e2723', '#1b5e20', '#880e4f', '#263238', '#0d47a1' ];
function djb2Hash(str) { let hash = 5381; for (let i = 0; i < str.length; i++) { hash = (hash * 33) ^ str.charCodeAt(i); } return hash; }
function stringToColor(str) { if (!str) return typeColorMap[8]; const hash = djb2Hash(str.toLowerCase()); return typeColorMap[Math.abs(hash) % typeColorMap.length]; }
function adjustColor(color, percent) { let f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = Math.abs(percent), R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF; return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1); }
function createGradientUri(color) { const centerColor = adjustColor(color, 0.25); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><radialGradient id="grad" cx="50%" cy="50%" r="50%"><stop offset="0%" style="stop-color:${centerColor};stop-opacity:1" /><stop offset="100%" style="stop-color:${color};stop-opacity:1" /></radialGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#grad)" /></svg>`; return `data:image/svg+xml;base64,${btoa(svg)}`; }
function getNodeColor(node) { return stringToColor(node.data('type')); }

function saveGraphState() { sessionStorage.setItem('KNOWLEDGE_GRAPH_STATE', graph.toJSON()); renderGraph(); }

function showInfoPanel(element) {
    const data = element.data(); let content = ''; infoPanelActions.innerHTML = '';
    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('_') || (key === 'id' && element.isEdge())) continue;
        let displayValue = (typeof value === 'object' && value !== null) ? JSON.stringify(value, null, 2) : value;
        content += `<div class="attr"><span class="attr-key">${key.replace(/_/g, ' ')}</span><pre class="attr-value">${displayValue}</pre></div>`;
    }
    infoPanelContent.innerHTML = content;
    if (element.isNode()) {
        infoPanelActions.innerHTML = `<button id="start-edge-btn" class="action-btn">Connect...</button><button id="delete-node-btn" class="action-btn delete-btn">Delete Node</button>`;
        document.getElementById('start-edge-btn').onclick = () => startEdgeCreation(data.id);
        document.getElementById('delete-node-btn').onclick = () => { if (confirm(`Delete node "${data.label}"?`)) { graph.removeNode(data.id); saveGraphState(); } };
    } else if (element.isEdge()) {
        infoPanelActions.innerHTML = `<button id="delete-edge-btn" class="action-btn delete-btn">Delete Edge</button>`;
        document.getElementById('delete-edge-btn').onclick = () => { if (confirm(`Delete edge "${data.label}"?`)) { graph.removeEdge(data.source, data.target, data.label); saveGraphState(); } };
    }
    infoPanel.style.display = 'flex';
}
function hideInfoPanel() { infoPanel.style.display = 'none'; cancelEdgeCreation(); }
function showModal(title, bodyHtml, onSaveCallback) {
    modalTitle.textContent = title; modalBody.innerHTML = bodyHtml; onModalSave = onSaveCallback; modalOverlay.style.display = 'flex';
    const confidenceSlider = document.getElementById('node-confidence'); const confidenceValue = document.getElementById('confidence-value');
    if (confidenceSlider && confidenceValue) { confidenceSlider.addEventListener('input', () => confidenceValue.textContent = confidenceSlider.value); }
}
function hideModal() { modalOverlay.style.display = 'none'; onModalSave = null; }

function handleAddNode() {
    showModal('Add New Node', `<div class="form-group"><label for="node-label">Label (a full sentence)</label><input type="text" id="node-label" placeholder="e.g., I believe trust must be earned."></div><div class="form-group"><label for="node-type">Type (e.g., belief, emotion, question)</label><input type="text" id="node-type" placeholder="belief"></div><div class="form-group"><label for="node-confidence">Confidence: <span id="confidence-value">0.5</span></label><input type="range" id="node-confidence" min="0" max="1" step="0.05" value="0.5"></div>`, 
    () => {
        const label = document.getElementById('node-label').value.trim(); const type = document.getElementById('node-type').value.trim() || 'belief'; const confidence = parseFloat(document.getElementById('node-confidence').value);
        if (!label) { alert('Label cannot be empty.'); return; }
        graph.addNode(new BeliefNode(label, type, confidence)); saveGraphState(); hideModal();
    });
}
function startEdgeCreation(sourceId) {
    edgeSourceNode = sourceId;
    hideInfoPanel();
    cy.elements().removeClass('selected highlighted');
    cy.$id(sourceId).addClass('selected');
    cy.nodes().not(`[id = "${sourceId}"]`).addClass('highlighted');
    cancelEdgeBtn.style.display = 'block'; addNodeBtn.style.display = 'none';
    cancelEdgeBtn.textContent = 'Connecting...';
}
function cancelEdgeCreation() {
    if (!edgeSourceNode) return;
    edgeSourceNode = null;
    cy.elements().removeClass('selected highlighted');
    cancelEdgeBtn.style.display = 'none'; addNodeBtn.style.display = 'block';
    cancelEdgeBtn.textContent = 'Cancel Edge';
}
function completeEdgeCreation(targetId) {
    if (!edgeSourceNode || edgeSourceNode === targetId) { cancelEdgeCreation(); return; }
    showModal('Add New Edge', `<div class="form-group"><label for="edge-label">Label (relationship)</label><input type="text" id="edge-label" placeholder="e.g., reinforces, contradicts"></div>`, () => {
        const label = document.getElementById('edge-label').value.trim(); if (!label) { alert('Label cannot be empty.'); return; }
        graph.addEdge(edgeSourceNode, targetId, label, 1.0);
        saveGraphState(); hideModal(); cancelEdgeCreation();
    });
}

export function initGraphVisualization(containerId) {
    if (cy) return;
    cy = cytoscape({
        container: document.getElementById(containerId), autoungrabify: true,
        style: [
            { selector: 'node', style: { 'shape': 'ellipse', 'label': 'data(type)', 'text-valign': 'center', 'text-halign': 'center', 'color': '#f0e6ff', 'font-size': '16px', 'font-weight': 'bold', 'width': '120px', 'height': '120px', 'background-color': getNodeColor, 'background-image': (node) => createGradientUri(getNodeColor(node)), 'background-fit': 'cover', 'border-width': 3, 'border-color': (node) => adjustColor(getNodeColor(node), 0.5), 'border-opacity': 0.8, 'transition-property': 'border-width, border-color, border-opacity, box-shadow', 'transition-duration': '0.3s' } },
            { selector: 'edge', style: { 'width': 2.5, 'line-color': '#5b3c7a', 'target-arrow-color': '#5b3c7a', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'transition-property': 'line-color, target-arrow-color' } },
            { selector: '.selected', style: { 'border-color': 'var(--primary-glow)', 'border-opacity': 1, 'border-width': 4 } },
            { selector: '.highlighted', style: { 'border-color': 'var(--secondary-glow)', 'border-opacity': 1 } },
            { selector: '.node-added, .edge-added', style: { 'animation': 'pulse-glow-add 1.5s infinite' } },
            { selector: '.node-updated, .edge-updated', style: { 'animation': 'pulse-glow-update 1.5s infinite' } },
            { selector: '.edge-added', style: { 'line-color': 'var(--primary-glow)', 'target-arrow-color': 'var(--primary-glow)' } },
            { selector: '.edge-updated', style: { 'line-color': '#ffab00', 'target-arrow-color': '#ffab00' } }
        ],
        layout: { name: 'cose', idealEdgeLength: 200, nodeOverlap: 25, refresh: 20, fit: true, padding: 50, randomize: true, componentSpacing: 150, nodeRepulsion: 600000, edgeElasticity: 100, nestingFactor: 5, gravity: 80, numIter: 1000 }
    });
    infoPanelCloseBtn.addEventListener('click', hideInfoPanel);
    addNodeBtn.addEventListener('click', handleAddNode);
    cancelEdgeBtn.addEventListener('click', cancelEdgeCreation);
    modalCancelBtn.addEventListener('click', hideModal);
    modalSaveBtn.addEventListener('click', () => onModalSave && onModalSave());

    cy.on('tap', 'node', (e) => {
        const node = e.target;
        if (edgeSourceNode) {
            completeEdgeCreation(node.id());
        } else {
            cy.elements().removeClass('selected highlighted');
            node.addClass('selected').neighborhood().addClass('highlighted');
            showInfoPanel(node);
        }
        e.stopPropagation();
    });
    cy.on('tap', 'edge', (e) => {
        if (edgeSourceNode) return;
        cy.elements().removeClass('selected highlighted');
        const edge = e.target;
        edge.addClass('selected').source().addClass('highlighted'); edge.target().addClass('highlighted');
        showInfoPanel(edge);
    });
    cy.on('tap', (e) => { if (e.target === cy) { edgeSourceNode ? cancelEdgeCreation() : hideInfoPanel(); } });
}

export function renderGraph() {
    if (!cy) return;
    hideInfoPanel();
    try {
        const graphJSON = sessionStorage.getItem('KNOWLEDGE_GRAPH_STATE');
        const tempGraph = new BeliefGraph();
        if (graphJSON) tempGraph.fromJSON(graphJSON);
        
        cy.elements().remove();
        cy.add(tempGraph.toCytoscapeElements());
        
        // FIXED & ENHANCED: Diff visualization logic
        const diffJSON = sessionStorage.getItem('GRAPH_DIFF');
        if (diffJSON) {
            const diff = JSON.parse(diffJSON);
            diff.nodes.added.forEach(n => cy.$id(n.id).addClass('node-added'));
            diff.nodes.updated.forEach(n => cy.$id(n.id).addClass('node-updated'));
            diff.edges.added.forEach(e => cy.$id(`${e.source}_${e.label}_${e.target}`).addClass('edge-added'));
            diff.edges.updated.forEach(e => cy.$id(`${e.source}_${e.label}_${e.target}`).addClass('edge-updated'));
            sessionStorage.removeItem('GRAPH_DIFF');
        }

        cy.layout({ name: 'cose', padding: 50, fit: true }).run();
    } catch (error) { console.error("Failed to render graph:", error); }
}

window.addEventListener('storage', (e) => { if (e.key === 'KNOWLEDGE_GRAPH_STATE' && document.getElementById('graphView').style.display !== 'none') { renderGraph(); } });