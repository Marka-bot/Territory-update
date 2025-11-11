(function () {
    const context = window.APP_CONTEXT || {};
    const mapId = context.mapId;
    if (!mapId || !window[mapId]) {
        console.warn('Carte Folium introuvable.');
        return;
    }

    const map = window[mapId];

    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const centerButton = document.getElementById('center-map');
    const toolButtons = document.querySelectorAll('.tool-button');
    const lineColorInput = document.getElementById('lineColor');
    const lineWeightInput = document.getElementById('lineWeight');
    const lineWeightValue = document.getElementById('lineWeightValue');
    const textColorInput = document.getElementById('textColor');
    const textSizeSelect = document.getElementById('textSize');
    const textBoldInput = document.getElementById('textBold');
    const textAlignSelect = document.getElementById('textAlign');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportDocxBtn = document.getElementById('export-docx');
    const exportStatus = document.getElementById('export-status');

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    let activeTool = 'select';
    let polylineDrawer = null;
    let editToolbar = null;
    let deleteToolbar = null;
    let textMode = false;

    function setStatus(message, isError = false) {
        if (!exportStatus) return;
        exportStatus.textContent = message;
        exportStatus.style.color = isError ? '#c22727' : '#1f7a3d';
    }

    function escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function updateInputsFromMap() {
        if (!latInput || !lngInput) {
            return;
        }
        const center = map.getCenter();
        latInput.value = center.lat.toFixed(6);
        lngInput.value = center.lng.toFixed(6);
    }

    function disableTextMode() {
        textMode = false;
        map.getContainer().classList.remove('text-mode');
    }

    function disableToolHandlers() {
        if (polylineDrawer) {
            polylineDrawer.disable();
            polylineDrawer = null;
        }
        if (editToolbar) {
            editToolbar.disable();
            editToolbar = null;
        }
        if (deleteToolbar) {
            deleteToolbar.disable();
            deleteToolbar = null;
        }
        disableTextMode();
    }

    function getLineOptions() {
        const color = lineColorInput ? lineColorInput.value : '#3388ff';
        const weight = lineWeightInput ? Number(lineWeightInput.value) || 3 : 3;
        return { color, weight };
    }

    function refreshPolylineDrawer() {
        if (activeTool !== 'draw') {
            return;
        }
        if (polylineDrawer) {
            polylineDrawer.disable();
        }
        polylineDrawer = new L.Draw.Polyline(map, { shapeOptions: getLineOptions() });
        polylineDrawer.enable();
    }

    function getTextOptions() {
        return {
            color: textColorInput ? textColorInput.value : '#111111',
            size: textSizeSelect ? Number(textSizeSelect.value) || 16 : 16,
            weight: textBoldInput && textBoldInput.checked ? '700' : '400',
            align: textAlignSelect ? textAlignSelect.value : 'center'
        };
    }

    function buildLabelHtml(text, options) {
        const safeText = escapeHtml(text);
        return `<div class="text-label" style="color:${options.color};font-size:${options.size}px;font-weight:${options.weight};text-align:${options.align};">${safeText}</div>`;
    }

    function setActiveTool(tool) {
        if (tool === activeTool && tool !== 'text') {
            return;
        }
        disableToolHandlers();
        activeTool = tool;
        toolButtons.forEach((button) => {
            button.classList.toggle('active', button.dataset.tool === tool);
        });

        switch (tool) {
            case 'draw':
                polylineDrawer = new L.Draw.Polyline(map, { shapeOptions: getLineOptions() });
                polylineDrawer.enable();
                break;
            case 'edit':
                editToolbar = new L.EditToolbar.Edit(map, {
                    featureGroup: drawnItems,
                    selectedPathOptions: { maintainColor: true }
                });
                editToolbar.enable();
                break;
            case 'delete':
                deleteToolbar = new L.EditToolbar.Delete(map, {
                    featureGroup: drawnItems
                });
                deleteToolbar.enable();
                break;
            case 'text':
                textMode = true;
                map.getContainer().classList.add('text-mode');
                break;
            default:
                activeTool = 'select';
                break;
        }
    }

    function createTextMarker(latlng, text) {
        const options = getTextOptions();
        const marker = L.marker(latlng, {
            draggable: true,
            icon: L.divIcon({
                className: 'text-label-icon',
                html: buildLabelHtml(text, options)
            })
        });

        marker.options.textContent = text;
        marker.options.textOptions = { ...options };

        marker.on('dblclick', (event) => {
            L.DomEvent.stop(event);
            const currentText = marker.options.textContent || '';
            const updated = window.prompt('Modifier le texte :', currentText);
            if (updated === null) {
                return;
            }
            const trimmed = updated.trim();
            if (!trimmed) {
                return;
            }
            marker.options.textContent = trimmed;
            marker.setIcon(L.divIcon({
                className: 'text-label-icon',
                html: buildLabelHtml(trimmed, marker.options.textOptions)
            }));
        });

        drawnItems.addLayer(marker);
    }

    map.on('draw:created', (event) => {
        if (!event.layer) {
            return;
        }
        const layer = event.layer;
        if (typeof layer.setStyle === 'function') {
            layer.setStyle(getLineOptions());
        }
        drawnItems.addLayer(layer);
        setActiveTool('select');
    });

    map.on('draw:editstop', () => {
        setActiveTool('select');
    });

    map.on('draw:deletestop', () => {
        setActiveTool('select');
    });

    map.on('click', (event) => {
        if (!textMode) {
            return;
        }
        const value = window.prompt('Texte du label :');
        if (!value) {
            return;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return;
        }
        createTextMarker(event.latlng, trimmed);
    });

    if (lineWeightInput && lineWeightValue) {
        lineWeightValue.textContent = `${lineWeightInput.value} px`;
        lineWeightInput.addEventListener('input', (event) => {
            lineWeightValue.textContent = `${event.target.value} px`;
            refreshPolylineDrawer();
        });
    }

    if (lineColorInput) {
        lineColorInput.addEventListener('input', refreshPolylineDrawer);
    }

    toolButtons.forEach((button) => {
        button.addEventListener('click', () => {
            setActiveTool(button.dataset.tool);
        });
    });

    if (centerButton) {
        centerButton.addEventListener('click', () => {
            if (!latInput || !lngInput) {
                return;
            }
            const lat = parseFloat(latInput.value);
            const lng = parseFloat(lngInput.value);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                setStatus('Coordonnées invalides.', true);
                return;
            }
            map.setView([lat, lng], map.getZoom());
        });
    }

    map.on('moveend', updateInputsFromMap);
    updateInputsFromMap();

    async function exportMap(format) {
        const targetUrl = format === 'pdf' ? context.exportPdfUrl : context.exportDocxUrl;
        if (!targetUrl) {
            setStatus('URL d\'export introuvable.', true);
            return;
        }
        const mapElement = document.getElementById('map-wrapper');
        if (!mapElement) {
            setStatus('Carte introuvable pour export.', true);
            return;
        }

        setStatus('Capture de la carte en cours...');
        try {
            const canvas = await html2canvas(mapElement, {
                useCORS: true,
                logging: false,
                backgroundColor: null
            });
            const image = canvas.toDataURL('image/png');
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image })
            });

            if (!response.ok) {
                let errorMessage = `Erreur serveur (${response.status})`;
                try {
                    const payload = await response.json();
                    if (payload && payload.error) {
                        errorMessage = payload.error;
                    }
                } catch (jsonError) {
                    console.debug('Réponse non JSON pour erreur d\'export.', jsonError);
                }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = format === 'pdf' ? 'carte.pdf' : 'carte.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            setStatus(`Export ${format.toUpperCase()} prêt.`);
        } catch (error) {
            console.error(error);
            setStatus(`Erreur lors de l'export : ${error.message}`, true);
        }
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => exportMap('pdf'));
    }

    if (exportDocxBtn) {
        exportDocxBtn.addEventListener('click', () => exportMap('docx'));
    }

    setTimeout(() => {
        if (map && typeof map.invalidateSize === 'function') {
            map.invalidateSize();
        }
    }, 250);
})();
