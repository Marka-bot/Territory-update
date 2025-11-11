(function () {
    const context = window.APP_CONTEXT || {};
    const mapId = context.mapId;
    if (!mapId || !window[mapId]) {
        console.warn('Carte Folium introuvable.');
        return;
    }

    const map = window[mapId];
    let drawnItems = null;

    map.eachLayer((layer) => {
        if (layer instanceof L.FeatureGroup && !layer._url) {
            drawnItems = layer;
        }
    });

    if (!drawnItems) {
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
    }

    const colorPicker = document.getElementById('color-picker');
    const textInput = document.getElementById('text-input');
    const addTextBtn = document.getElementById('add-text-btn');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportDocxBtn = document.getElementById('export-docx');
    const exportStatus = document.getElementById('export-status');

    let currentColor = colorPicker ? colorPicker.value : '#ff0000';
    let textMode = false;

    function setStatus(message, isError = false) {
        if (!exportStatus) return;
        exportStatus.textContent = message;
        exportStatus.style.color = isError ? '#c22727' : '#1f7a3d';
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function ensureFeature(layer, type) {
        if (!layer.feature) {
            layer.feature = { type: 'Feature', properties: {} };
        }
        layer.feature.properties = layer.feature.properties || {};
        layer.feature.properties.type = type;
        if (!layer.feature.properties.color) {
            layer.feature.properties.color = currentColor;
        }
    }

    function applyShapeColor(layer, color) {
        if (typeof layer.setStyle === 'function') {
            layer.setStyle({ color, fillColor: color });
        } else if (layer instanceof L.Polyline) {
            layer.setStyle({ color });
        }
        if (layer.options) {
            layer.options.color = color;
            layer.options.fillColor = color;
        }
    }

    map.on(L.Draw.Event.CREATED, function (event) {
        const { layerType, layer } = event;
        if (layerType === 'marker') {
            // Ignore marker creation via toolbar since text tool handles markers
            return;
        }
        applyShapeColor(layer, currentColor);
        ensureFeature(layer, layerType);
        drawnItems.addLayer(layer);
    });

    map.on(L.Draw.Event.EDITED, function (event) {
        const layers = event.layers;
        layers.eachLayer((layer) => {
            ensureFeature(layer, layer.feature?.properties?.type || 'shape');
        });
    });

    if (colorPicker) {
        colorPicker.addEventListener('input', (event) => {
            currentColor = event.target.value;
        });
    }

    if (addTextBtn) {
        addTextBtn.addEventListener('click', () => {
            textMode = true;
            setStatus('Cliquez sur la carte pour placer le texte.');
            map.getContainer().classList.add('text-mode');
        });
    }

    function createTextMarker(latlng, textValue) {
        const safeText = escapeHtml(textValue);
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'text-marker',
                html: `<span style="color:${currentColor}">${safeText}</span>`
            }),
            interactive: true
        });
        ensureFeature(marker, 'text');
        marker.feature.properties.text = textValue;
        drawnItems.addLayer(marker);
    }

    map.on('click', (event) => {
        if (!textMode) {
            return;
        }
        const value = textInput ? textInput.value.trim() : '';
        if (!value) {
            setStatus('Veuillez entrer un texte avant de le placer.', true);
            return;
        }
        createTextMarker(event.latlng, value);
        setStatus('Texte ajouté sur la carte.');
        textMode = false;
        map.getContainer().classList.remove('text-mode');
    });

    function getAnnotations() {
        try {
            return drawnItems.toGeoJSON();
        } catch (error) {
            console.error('Impossible de convertir les annotations :', error);
            return null;
        }
    }

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
        setStatus('Export en cours...');
        try {
            const canvas = await html2canvas(mapElement, { useCORS: true, logging: false });
            const imageData = canvas.toDataURL('image/png');
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData,
                    annotations: getAnnotations(),
                    latitude: document.getElementById('latitude')?.value,
                    longitude: document.getElementById('longitude')?.value
                })
            });
            if (!response.ok) {
                throw new Error('Réponse invalide du serveur');
            }
            const result = await response.json();
            if (result.success) {
                setStatus(`Fichier ${format.toUpperCase()} créé : ${result.filename}`);
            } else {
                throw new Error(result.error || 'Export impossible');
            }
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
