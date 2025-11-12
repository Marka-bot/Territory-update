function initializeMap() {
    const map = L.map('map', {
        center: [46.2276, 2.2137],
        zoom: 6,
        zoomSnap: 0.33,
        zoomDelta: 0.33,
        scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const exportButton = document.getElementById('exportButton');

    async function exportMapToPDF() {
        if (!exportButton) {
            return;
        }
        exportButton.disabled = true;
    try {
        const mapElement = document.getElementById('map');
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
            throw new Error('Export failed');
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
        alert("Une erreur est survenue lors de l'export PDF.");
    } finally {
        exportButton.disabled = false;
    }
    }

    if (exportButton) {
        exportButton.addEventListener('click', exportMapToPDF);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMap);
} else {
    initializeMap();
}
