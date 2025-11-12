let leafletMap = null;
let exportButton = null;

function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Élément #map introuvable.');
        return;
    }
    if (typeof L === 'undefined') {
        console.error('Leaflet n\'est pas chargé.');
        return;
    }

    leafletMap = L.map(mapElement, {
        center: [46.2276, 2.2137],
        zoom: 6,
        zoomSnap: 0.33,
        zoomDelta: 0.33,
        scrollWheelZoom: true,
        wheelDebounceTime: 10,
        wheelPxPerZoomLevel: 60
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs'
    }).addTo(leafletMap);

    setTimeout(() => {
        leafletMap.invalidateSize();
    }, 0);
}

async function exportMapToPDF() {
    if (!exportButton) {
        exportButton = document.getElementById('exportButton');
    }

    if (exportButton) {
        exportButton.disabled = true;
    }

    try {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            throw new Error('Carte introuvable');
        }
        if (typeof html2canvas !== 'function') {
            throw new Error('html2canvas indisponible');
        }

        const canvas = await html2canvas(mapElement, {
            useCORS: true,
            scale: 2
        });
        const imageData = canvas.toDataURL('image/png');

        const response = await fetch('/export/pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ imageData })
        });

        if (!response.ok) {
            throw new Error('Export PDF échoué');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'carte.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error(error);
        alert('Une erreur est survenue lors de l\'export PDF.');
    } finally {
        if (exportButton) {
            exportButton.disabled = false;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    exportButton = document.getElementById('exportButton');
    initializeMap();
});

window.exportMapToPDF = exportMapToPDF;
