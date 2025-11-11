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
    const fontFamilySelect = document.getElementById('fontFamily');
    const fontSizeSelect = document.getElementById('fontSize');
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

    let currentFontFamily = 'Arial';
    let currentFontSize = 16;
    let currentTextColor = '#000000';
    let currentAlign = 'center';
    let currentBold = false;

    function setStatus(message, isError = false) {
        if (!exportStatus) return;
        exportStatus.textContent = message;
        exportStatus.style.color = isError ? '#c22727' : '#1f7a3d';
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
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
            color: currentTextColor,
            size: currentFontSize,
            weight: currentBold ? '700' : '400',
            align: currentAlign,
            fontFamily: currentFontFamily
        };
    }

    function buildLabelHtml(text, options) {
        const safeText = escapeHtml(text);
        const formatted = safeText.replace(/\n/g, '<br>');
        return `<div class="text-label" style="color:${options.color};font-size:${options.size}px;font-weight:${options.weight};text-align:${options.align};font-family:${options.fontFamily};">${formatted}</div>`;
    }

    function updateMarkerLabel(marker, text, options) {
        marker.setIcon(L.divIcon({
            className: 'text-label-icon',
            html: buildLabelHtml(text, options)
        }));
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
            openTextEditor(marker);
        });

        drawnItems.addLayer(marker);
    }

    function openTextEditor(marker) {
        const originalText = marker.options.textContent || '';
        const originalOptions = {
            color: '#000000',
            size: 16,
            weight: '400',
            align: 'center',
            fontFamily: 'Arial',
            ...(marker.options.textOptions || {})
        };

        if (document.body.querySelector('.text-editor-overlay')) {
            return;
        }

        marker.options.textOptions = { ...originalOptions };
        updateMarkerLabel(marker, originalText, marker.options.textOptions);

        const overlay = document.createElement('div');
        overlay.className = 'text-editor-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'text-editor-dialog';
        overlay.appendChild(dialog);

        const title = document.createElement('h2');
        title.textContent = 'Éditer le texte';
        dialog.appendChild(title);

        const fields = document.createElement('div');
        fields.className = 'editor-fields';
        dialog.appendChild(fields);

        const textLabel = document.createElement('label');
        textLabel.textContent = 'Contenu';
        const textArea = document.createElement('textarea');
        textArea.value = originalText;
        textLabel.appendChild(textArea);
        fields.appendChild(textLabel);

        const fontLabel = document.createElement('label');
        fontLabel.textContent = 'Police';
        const fontSelect = document.createElement('select');
        ['Arial', 'Verdana', 'Courier New', 'Roboto', 'Times New Roman'].forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            fontSelect.appendChild(option);
        });
        fontSelect.value = originalOptions.fontFamily || 'Arial';
        fontLabel.appendChild(fontSelect);
        fields.appendChild(fontLabel);

        const sizeLabel = document.createElement('label');
        sizeLabel.textContent = 'Taille';
        const sizeSelect = document.createElement('select');
        [12, 14, 16, 18, 24, 32].forEach((value) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `${value} px`;
            sizeSelect.appendChild(option);
        });
        if (Number.isFinite(originalOptions.size) && ![...sizeSelect.options].some((opt) => Number(opt.value) === Number(originalOptions.size))) {
            const customOption = document.createElement('option');
            customOption.value = originalOptions.size;
            customOption.textContent = `${originalOptions.size} px`;
            sizeSelect.appendChild(customOption);
        }
        sizeSelect.value = String(originalOptions.size || 16);
        sizeLabel.appendChild(sizeSelect);
        fields.appendChild(sizeLabel);

        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Couleur';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = originalOptions.color || '#000000';
        colorLabel.appendChild(colorInput);
        fields.appendChild(colorLabel);

        const alignLabel = document.createElement('label');
        alignLabel.textContent = 'Alignement';
        const alignSelect = document.createElement('select');
        [
            { value: 'left', text: 'Gauche' },
            { value: 'center', text: 'Centre' },
            { value: 'right', text: 'Droite' }
        ].forEach((item) => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.text;
            alignSelect.appendChild(option);
        });
        alignSelect.value = originalOptions.align || 'center';
        alignLabel.appendChild(alignSelect);
        fields.appendChild(alignLabel);

        const boldLabel = document.createElement('label');
        boldLabel.className = 'inline-checkbox';
        const boldInput = document.createElement('input');
        boldInput.type = 'checkbox';
        boldInput.checked = ['700', 'bold', 700].includes(originalOptions.weight);
        const boldSpan = document.createElement('span');
        boldSpan.textContent = 'Gras';
        boldLabel.appendChild(boldInput);
        boldLabel.appendChild(boldSpan);
        fields.appendChild(boldLabel);

        const actions = document.createElement('div');
        actions.className = 'dialog-actions';
        dialog.appendChild(actions);

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Annuler';
        const confirmButton = document.createElement('button');
        confirmButton.type = 'button';
        confirmButton.className = 'primary';
        confirmButton.textContent = 'Fermer';
        actions.appendChild(cancelButton);
        actions.appendChild(confirmButton);

        function applyChanges() {
            const options = {
                color: colorInput.value,
                size: Number(sizeSelect.value) || 16,
                weight: boldInput.checked ? '700' : '400',
                align: alignSelect.value,
                fontFamily: fontSelect.value
            };
            const textValue = textArea.value;
            marker.options.textContent = textValue;
            marker.options.textOptions = { ...options };
            updateMarkerLabel(marker, textValue, marker.options.textOptions);
        }

        function revertChanges() {
            marker.options.textContent = originalText;
            marker.options.textOptions = { ...originalOptions };
            updateMarkerLabel(marker, originalText, marker.options.textOptions);
        }

        function closeEditor(keepChanges) {
            document.removeEventListener('keydown', onKeyDown);
            if (!keepChanges) {
                revertChanges();
            }
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeEditor(false);
            }
        }

        textArea.addEventListener('input', applyChanges);
        fontSelect.addEventListener('change', applyChanges);
        sizeSelect.addEventListener('change', applyChanges);
        colorInput.addEventListener('input', applyChanges);
        alignSelect.addEventListener('change', applyChanges);
        boldInput.addEventListener('change', applyChanges);

        cancelButton.addEventListener('click', () => {
            closeEditor(false);
        });

        confirmButton.addEventListener('click', () => {
            closeEditor(true);
        });

        document.addEventListener('keydown', onKeyDown);
        document.body.appendChild(overlay);
        textArea.focus();
        textArea.setSelectionRange(textArea.value.length, textArea.value.length);
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

    if (fontFamilySelect) {
        currentFontFamily = fontFamilySelect.value || currentFontFamily;
        fontFamilySelect.addEventListener('change', (event) => {
            currentFontFamily = event.target.value;
        });
    }

    if (fontSizeSelect) {
        currentFontSize = Number(fontSizeSelect.value) || currentFontSize;
        fontSizeSelect.addEventListener('change', (event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) {
                currentFontSize = value;
            }
        });
    }

    if (textColorInput) {
        currentTextColor = textColorInput.value || currentTextColor;
        textColorInput.addEventListener('input', (event) => {
            currentTextColor = event.target.value;
        });
    }

    if (textBoldInput) {
        currentBold = Boolean(textBoldInput.checked);
        textBoldInput.addEventListener('change', (event) => {
            currentBold = event.target.checked;
        });
    }

    if (textAlignSelect) {
        currentAlign = textAlignSelect.value || currentAlign;
        textAlignSelect.addEventListener('change', (event) => {
            currentAlign = event.target.value;
        });
    }

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
