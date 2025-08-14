import { BeliefGraph, BeliefNode } from './knowledge-graph.js';
import { graph } from './tools.js';

let cy = null; let edgeSourceNode = null;
const infoPanel = document.getElementById('info-panel'); const infoPanelContent = document.getElementById('info-panel-content');
const infoPanelActions = document.getElementById('info-panel-actions'); const infoPanelCloseBtn = document.getElementById('info-panel-close');
const addNodeBtn = document.getElementById('add-node-btn'); const cancelEdgeBtn = document.getElementById('cancel-edge-btn');
const modalOverlay = document.getElementById('input-modal-overlay'); const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body'); const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const filterBtn = document.getElementById('filter-btn');
const filterPanel = document.getElementById('filter-panel');
const filterLabelInput = document.getElementById('filter-label-input');
const filterTypeSelect = document.getElementById('filter-type-select');
const filterConnectionsInput = document.getElementById('filter-connections-input');
const applyFilterBtn = document.getElementById('apply-filter-btn');
const clearFilterBtn = document.getElementById('clear-filter-btn');
let onModalSave = null;

const ZOOM_LABEL_THRESHOLD = 0.95;
const baseColorPool = ['#311b92', '#4a148c', '#004d40', '#b71c1c', '#bf360c', '#3e2723', '#1b5e20', '#880e4f', '#263238', '#0d47a1'];
let typeToColorMap = new Map();
let availableColors = [];

function resetColorAssigner() {
    typeToColorMap.clear();
    availableColors = [...baseColorPool];
}
function djb2Hash(str) { let hash = 5381; for (let i = 0; i < str.length; i++) { hash = (hash * 33) ^ str.charCodeAt(i); } return hash; }
function getColorForType(type) {
    if (!type) return baseColorPool[8];
    const lcaseType = type.toLowerCase();
    if (typeToColorMap.has(lcaseType)) return typeToColorMap.get(lcaseType);
    let color;
    if (availableColors.length > 0) color = availableColors.shift();
    else color = baseColorPool[Math.abs(djb2Hash(lcaseType)) % baseColorPool.length];
    typeToColorMap.set(lcaseType, color);
    return color;
}
function adjustColor(color, percent) { let f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = Math.abs(percent), R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF; return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1); }
function createGradientUri(color) { const centerColor = adjustColor(color, 0.25); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><radialGradient id="grad" cx="50%" cy="50%" r="50%"><stop offset="0%" style="stop-color:${centerColor};stop-opacity:1" /><stop offset="100%" style="stop-color:${color};stop-opacity:1" /></radialGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#grad)" /></svg>`; return `data:image/svg+xml;base64,${btoa(svg)}`; }
function getNodeColor(node) { return getColorForType(node.data('type')); }

function saveGraphState() { sessionStorage.setItem('KNOWLEDGE_GRAPH_STATE', graph.toJSON()); renderGraph(); }

function showInfoPanel(element) {
    const data = element.data(); let content = ''; infoPanelActions.innerHTML = '';
    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('_') || ['id', 'source', 'target'].includes(key)) continue;
        let displayValue = (typeof value === 'object' && value !== null) ? JSON.stringify(value, null, 2) : value;
        content += `<div class="attr"><span class="attr-key">${key.replace(/_/g, ' ')}</span><pre class="attr-value">${displayValue}</pre></div>`;
    }
    infoPanelContent.innerHTML = content;
    if (element.isNode()) {
        infoPanelActions.innerHTML = `<button id="start-edge-btn" class="action-btn">Connect...</button><button id="delete-node-btn" class="action-btn delete-btn">Delete Node</button>`;
        document.getElementById('start-edge-btn').onclick = () => startEdgeCreation(data.id);
        document.getElementById('delete-node-btn').onclick = () => { if (confirm(`Delete node "${data.label}"?`)) { graph.removeNode(data.id); saveGraphState(); hideInfoPanel(); } };
    } else if (element.isEdge()) {
        infoPanelActions.innerHTML = `<button id="delete-edge-btn" class="action-btn delete-btn">Delete Edge</button>`;
        document.getElementById('delete-edge-btn').onclick = () => { if (confirm(`Delete edge "${data.label}"?`)) { graph.removeEdge(data.source, data.target, data.label); saveGraphState(); hideInfoPanel(); } };
    }
    infoPanel.style.display = 'flex';
}
function hideInfoPanel() {
    infoPanel.style.display = 'none';
    cy.elements().removeClass('selected highlighted dimmed');
}
function showModal(title, bodyHtml, onSaveCallback) {
    modalTitle.textContent = title; modalBody.innerHTML = bodyHtml; onModalSave = onSaveCallback; modalOverlay.style.display = 'flex';
    const confidenceSlider = document.getElementById('node-confidence'); const confidenceValue = document.getElementById('confidence-value');
    if (confidenceSlider && confidenceValue) confidenceSlider.addEventListener('input', () => confidenceValue.textContent = confidenceSlider.value);
    const edgeConfidenceSlider = document.getElementById('edge-confidence'); const edgeConfidenceValue = document.getElementById('edge-confidence-value');
    if (edgeConfidenceSlider && edgeConfidenceValue) edgeConfidenceSlider.addEventListener('input', () => edgeConfidenceValue.textContent = edgeConfidenceSlider.value);
}
function hideModal() { modalOverlay.style.display = 'none'; onModalSave = null; }

function handleAddNode() {
    showModal('Add New Node', `<div class="form-group"><label for="node-label">Label (a full sentence)</label><input type="text" id="node-label" placeholder="e.g., I believe trust must be earned."></div><div class="form-group"><label for="node-type">Type (e.g., belief, emotion, question)</label><input type="text" id="node-type" placeholder="belief"></div><div class="form-group"><label for="node-confidence">Confidence: <span id="confidence-value">0.5</span></label><input type="range" id="node-confidence" min="0" max="1" step="0.05" value="0.5"></div>`,
    () => {
        const label = document.getElementById('node-label').value.trim();
        const type = document.getElementById('node-type').value.trim() || 'belief';
        const confidence = parseFloat(document.getElementById('node-confidence').value);
        if (!label) { alert('Label cannot be empty.'); return; }
        graph.addNode(new BeliefNode(label, type, confidence)); saveGraphState(); hideModal();
    });
}
function startEdgeCreation(sourceId) {
    edgeSourceNode = sourceId;
    infoPanel.style.display = 'none';
    cy.elements().removeClass('selected highlighted dimmed');
    cy.$id(sourceId).addClass('selected');
    cy.nodes().not(`[id = "${sourceId}"]`).addClass('highlighted');
    cancelEdgeBtn.style.display = 'block'; addNodeBtn.style.display = 'none';
    cancelEdgeBtn.textContent = 'Cancel Connecting';
}
function cancelEdgeCreation() {
    if (!edgeSourceNode) return;
    edgeSourceNode = null;
    cy.elements().removeClass('selected highlighted dimmed');
    cancelEdgeBtn.style.display = 'none'; addNodeBtn.style.display = 'block';
    cancelEdgeBtn.textContent = 'Cancel Edge';
}
function completeEdgeCreation(targetId) {
    if (!edgeSourceNode || edgeSourceNode === targetId) { cancelEdgeCreation(); return; }
    const modalHtml = `
        <div class="form-group"><label for="edge-label">Label (relationship)</label><input type="text" id="edge-label" placeholder="e.g., reinforces, contradicts"></div>
        <div class="form-group"><label for="edge-confidence">Confidence: <span id="edge-confidence-value">1.0</span></label><input type="range" id="edge-confidence" min="0" max="1" step="0.05" value="1.0"></div>
    `;
    showModal('Add New Edge', modalHtml, () => {
        const label = document.getElementById('edge-label').value.trim();
        const confidence = parseFloat(document.getElementById('edge-confidence').value);
        if (!label) { alert('Label cannot be empty.'); return; }
        graph.addEdge(edgeSourceNode, targetId, label, confidence);
        saveGraphState(); hideModal(); cancelEdgeCreation();
    });
}

function populateTypeFilter() {
    if (!cy) return;
    const types = new Set(cy.nodes().map(node => node.data('type')).filter(Boolean));
    const currentVal = filterTypeSelect.value;
    filterTypeSelect.innerHTML = '<option value="">All Types</option>';
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        filterTypeSelect.appendChild(option);
    });
    filterTypeSelect.value = currentVal;
}

const defaultLayout = {
    name: 'cose', idealEdgeLength: 200, nodeOverlap: 25, refresh: 20, fit: false, padding: 50,
    randomize: true, componentSpacing: 150, nodeRepulsion: 600000, edgeElasticity: 100,
    nestingFactor: 5, gravity: 80, numIter: 1000,
};

function applyGraphFilter() {
    if (!cy) return;
    const labelFilter = filterLabelInput.value.toLowerCase().trim();
    const typeFilter = filterTypeSelect.value;
    const connectionsFilter = parseInt(filterConnectionsInput.value, 10);
    cy.batch(() => {
        const filteredNodes = cy.nodes().filter(node => {
            let pass = true;
            if (labelFilter && !node.data('label').toLowerCase().includes(labelFilter)) pass = false;
            if (typeFilter && node.data('type') !== typeFilter) pass = false;
            if (!isNaN(connectionsFilter) && node.degree() < connectionsFilter) pass = false;
            return pass;
        });
        const elementsToShow = filteredNodes.union(filteredNodes.edgesWith(filteredNodes));
        cy.elements().style('display', 'none');
        elementsToShow.style('display', 'element');
    });
    cy.layout(defaultLayout).run();
    cy.animate({ fit: { eles: cy.elements(':visible'), padding: 50 }, duration: 500 });
}

function clearGraphFilter() {
    if (!cy) return;
    filterLabelInput.value = '';
    filterTypeSelect.value = '';
    filterConnectionsInput.value = '';
    cy.elements().style('display', 'element');
    cy.layout(defaultLayout).run();
    cy.animate({ fit: { padding: 50 }, duration: 500 });
}

// --- Dynamic Label Logic ---
function applyZoomLabelMode() {
    if (!cy) return;
    const zoomLevel = cy.zoom();
    const showFull = zoomLevel >= ZOOM_LABEL_THRESHOLD;
    cy.batch(() => {
        cy.nodes().forEach(node => {
            if (showFull) {
                node.style({ 'label': node.data('label') || '', 'text-opacity': 1, 'font-size': '12px', 'text-max-width': '110px' });
            } else {
                const t = node.data('type') || '';
                node.style({ 'label': t, 'text-opacity': t ? 1 : 0, 'font-size': '11px', 'text-max-width': '80px' });
            }
        });
        cy.edges().forEach(edge => {
            edge.style('text-opacity', showFull ? 1 : 0);
        });
    });
}

export function initGraphVisualization(containerId) {
    if (cy) return;
    const homeBtn = document.getElementById('home-btn');
    cy = cytoscape({
        container: document.getElementById(containerId), autoungrabify: true,
        style: [
            { selector: 'node', style: { 'shape': 'ellipse', 'label': 'data(label)', 'text-wrap': 'wrap', 'text-max-width': '110px', 'text-valign': 'center', 'text-halign': 'center', 'color': '#f0e6ff', 'font-size': '12px', 'text-opacity': 1, 'width': '120px', 'height': '120px', 'background-color': getNodeColor, 'background-image': (node) => createGradientUri(getNodeColor(node)), 'background-fit': 'cover', 'border-width': 3, 'border-color': (node) => adjustColor(getNodeColor(node), 0.5), 'border-opacity': 0.8, 'box-shadow': '0 0 0 rgba(0,0,0,0)', 'transition-property': 'border-width, border-color, border-opacity, box-shadow, opacity, display, text-opacity', 'transition-duration': '0.3s' } },
            { selector: 'edge', style: { 'width': 2.5, 'line-color': '#5b3c7a', 'target-arrow-color': '#5b3c7a', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'label': 'data(label)', 'color': '#e0c8ff', 'font-size': '10px', 'text-rotation': 'autorotate', 'text-margin-y': -10, 'text-opacity': 1, 'transition-property': 'line-color, target-arrow-color, opacity, text-opacity, width, display', 'transition-duration': '0.3s', 'text-wrap': 'wrap', 'text-max-width': '90px', 'text-outline-color': '#1a001a', 'text-outline-width': 3 } },
            { selector: '.dimmed', style: { 'opacity': 0.25 } },
            { selector: 'node.node-added, node.node-updated', style: { 'border-color': '#FFD700', 'border-width': '5px', 'border-style': 'solid', 'box-shadow': '0 0 20px #FFD700' } },
            { selector: 'edge.edge-added, edge.edge-updated', style: { 'line-color': '#FFD700', 'target-arrow-color': '#FFD700', 'width': '5px', 'z-index': 99 } },
            { selector: 'edge.highlighted, edge:selected', style: { 'line-color': '#00e5ff', 'target-arrow-color': '#00e5ff', 'width': 4, 'z-index': 100, 'text-opacity': 1 } },
            { selector: 'node:selected', style: { 'border-color': '#00e5ff', 'border-width': 4, 'border-opacity': 1, 'box-shadow': '0 0 20px #00e5ff' } },
            { selector: 'node.highlighted', style: { 'border-color': '#00e5ff', 'border-width': 5, 'border-opacity': 1, 'box-shadow': '0 0 20px #00e5ff' } },
        ],
    });
    infoPanelCloseBtn.addEventListener('click', hideInfoPanel);
    addNodeBtn.addEventListener('click', handleAddNode);
    cancelEdgeBtn.addEventListener('click', cancelEdgeCreation);
    homeBtn.addEventListener('click', () => cy.animate({ fit: { padding: 50 }, duration: 500 }));
    modalCancelBtn.addEventListener('click', hideModal);
    modalSaveBtn.addEventListener('click', () => onModalSave && onModalSave());

    filterBtn.addEventListener('click', () => {
        filterPanel.style.display = filterPanel.style.display === 'flex' ? 'none' : 'flex';
        if (filterPanel.style.display === 'flex') populateTypeFilter();
    });
    applyFilterBtn.addEventListener('click', applyGraphFilter);
    clearFilterBtn.addEventListener('click', clearGraphFilter);

    cy.on('tap', 'node', (e) => {
        const node = e.target;
        if (edgeSourceNode) { completeEdgeCreation(node.id()); } 
        else {
            const neighborhood = node.neighborhood();
            cy.elements().removeClass('selected highlighted dimmed');
            node.addClass('selected');
            neighborhood.addClass('highlighted');
            cy.elements().not(node).not(neighborhood).addClass('dimmed');
            showInfoPanel(node);
        }
        e.stopPropagation();
    });
    cy.on('tap', 'edge', (e) => {
        if (edgeSourceNode) return;
        const edge = e.target;
        const connectedNodes = edge.source().union(edge.target());
        cy.elements().removeClass('selected highlighted dimmed');
        edge.addClass('selected');
        connectedNodes.addClass('highlighted');
        cy.elements().not(edge).not(connectedNodes).addClass('dimmed');
        showInfoPanel(edge);
        e.stopPropagation();
    });
    cy.on('tap', (e) => { if (e.target === cy) { edgeSourceNode ? cancelEdgeCreation() : hideInfoPanel(); } });

    cy.on('zoom', applyZoomLabelMode);

    applyZoomLabelMode();
}

export function renderGraph() {
    if (!cy) return;
    hideInfoPanel();
    resetColorAssigner();
    try {
        const graphJSON = sessionStorage.getItem('KNOWLEDGE_GRAPH_STATE');
        const tempGraph = new BeliefGraph();
        if (graphJSON) { tempGraph.fromJSON(graphJSON); } 
        else { cy.elements().remove(); return; }

        cy.elements().remove();
        cy.add(tempGraph.toCytoscapeElements());

        const diffJSON = sessionStorage.getItem('GRAPH_DIFF');
        if (diffJSON) {
            const diff = JSON.parse(diffJSON);
            (diff.nodes?.added || []).forEach(n => cy.$id(n.id).addClass('node-added'));
            (diff.nodes?.updated || []).forEach(n => cy.$id(n.id).addClass('node-updated'));
            const addedEdges = diff.edges?.added || [];
            const updatedEdges = diff.edges?.updated || [];
            cy.edges().forEach(edge => {
                const edgeData = edge.data();
                if (addedEdges.some(e => e.source === edgeData.source && e.target === edgeData.target && e.label === edgeData.label)) {
                    edge.addClass('edge-added');
                }
                if (updatedEdges.some(e => e.source === edgeData.source && e.target === edgeData.target && e.label === edgeData.label)) {
                    edge.addClass('edge-updated');
                }
            });
        }
        
        document.getElementById('personality-archetype').textContent = sessionStorage.getItem('PERSONALITY_ARCHETYPE') || '';
        document.getElementById('turn-summary').textContent = sessionStorage.getItem('TURN_SUMMARY') || '';

        const layout = cy.layout(defaultLayout);
        layout.on('layoutstop', () => {
            cy.fit(undefined, 50);
            applyZoomLabelMode();
        });
        layout.run();
        
        populateTypeFilter();

    } catch (error) {
        console.error("Failed to render graph:", error);
        cy.elements().remove();
    }
}

window.addEventListener('storage', (e) => { if (e.key === 'KNOWLEDGE_GRAPH_STATE' && document.getElementById('graphView').style.display !== 'none') { renderGraph(); } });