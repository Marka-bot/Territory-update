import base64
import binascii
import os
from datetime import datetime
from io import BytesIO
from pathlib import Path
import tempfile

from flask import Flask, jsonify, render_template, request, send_file
import folium
from docx import Document
from docx.shared import Inches
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, template_folder=str(BASE_DIR / "templates"), static_folder=str(BASE_DIR / "static"))


def _safe_float(value, fallback):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def create_map(latitude: float, longitude: float):
    folium_map = folium.Map(location=[latitude, longitude], zoom_start=15, control_scale=True)
    folium.Marker([latitude, longitude], tooltip="Centre sélectionné").add_to(folium_map)

    map_id = folium_map.get_name()
    map_html = folium_map._repr_html_()
    return map_html, map_id


@app.route("/", methods=["GET", "POST"])
def index():
    default_latitude = 48.8566
    default_longitude = 2.3522

    latitude_input = request.form.get("latitude") if request.method == "POST" else request.args.get("latitude")
    longitude_input = request.form.get("longitude") if request.method == "POST" else request.args.get("longitude")

    latitude = _safe_float(latitude_input, default_latitude)
    longitude = _safe_float(longitude_input, default_longitude)

    map_html, map_id = create_map(latitude, longitude)
    return render_template(
        "index.html",
        latitude=latitude,
        longitude=longitude,
        map_html=map_html,
        map_id=map_id,
    )


def _decode_base64_image(data_uri: str) -> bytes:
    if not data_uri:
        raise ValueError("Image data is required")
    if data_uri.startswith("data:image"):
        header, encoded = data_uri.split(",", 1)
    else:
        encoded = data_uri
    try:
        return base64.b64decode(encoded)
    except (ValueError, TypeError, binascii.Error) as exc:
        raise ValueError("Invalid image data") from exc


def _register_cleanup(path: str):
    """Register a cleanup hook for a temporary file."""

    if not path:
        return

    def _cleanup(response):
        try:
            os.remove(path)
        except OSError:
            pass
        return response

    from flask import after_this_request

    after_this_request(_cleanup)


@app.post("/export/pdf")
def export_pdf():
    data = request.get_json(silent=True) or {}
    image_data = data.get("image")

    if not image_data:
        return jsonify({"error": "Aucune image reçue."}), 400

    try:
        image_bytes = _decode_base64_image(image_data)
    except ValueError:
        return jsonify({"error": "Image invalide."}), 400

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
            pdf_path = temp_pdf.name
        pdf_canvas = canvas.Canvas(pdf_path, pagesize=A4)
        page_width, page_height = A4
        margin = 36  # 0.5 inch margin

        image_reader = ImageReader(BytesIO(image_bytes))
        img_width, img_height = image_reader.getSize()
        aspect_ratio = img_width / img_height

        available_width = page_width - margin * 2
        available_height = page_height - margin * 2

        draw_width = available_width
        draw_height = draw_width / aspect_ratio

        if draw_height > available_height:
            draw_height = available_height
            draw_width = draw_height * aspect_ratio

        x_position = (page_width - draw_width) / 2
        y_position = (page_height - draw_height) / 2

        pdf_canvas.drawImage(image_reader, x_position, y_position, width=draw_width, height=draw_height)
        pdf_canvas.showPage()
        pdf_canvas.save()
    except Exception:
        if "pdf_path" in locals():
            try:
                os.remove(pdf_path)
            except OSError:
                pass
        app.logger.exception("Failed to generate PDF export")
        return jsonify({"error": "Impossible de générer le PDF."}), 500

    _register_cleanup(pdf_path)
    return send_file(pdf_path, mimetype="application/pdf", as_attachment=True, download_name="carte.pdf")


@app.post("/export/docx")
def export_docx():
    data = request.get_json(silent=True) or {}
    image_data = data.get("image")

    if not image_data:
        return jsonify({"error": "Aucune image reçue."}), 400

    try:
        image_bytes = _decode_base64_image(image_data)
    except ValueError:
        return jsonify({"error": "Image invalide."}), 400

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_png:
            temp_png.write(image_bytes)
            png_path = temp_png.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_docx:
            docx_path = temp_docx.name

        document = Document()
        document.add_paragraph(datetime.now().strftime("Carte exportée le %d/%m/%Y à %H:%M"))
        document.add_picture(png_path, width=Inches(6.5))
        document.save(docx_path)
    except Exception:
        for path in (locals().get("png_path"), locals().get("docx_path")):
            if path:
                try:
                    os.remove(path)
                except OSError:
                    pass
        app.logger.exception("Failed to generate DOCX export")
        return jsonify({"error": "Impossible de générer le DOCX."}), 500

    _register_cleanup(png_path)
    _register_cleanup(docx_path)
    return send_file(docx_path, mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document", as_attachment=True, download_name="carte.docx")


if __name__ == "__main__":
    app.run(debug=True)
