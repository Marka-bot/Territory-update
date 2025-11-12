from flask import Flask, render_template, request, send_file, jsonify
from io import BytesIO
import base64
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

app = Flask(__name__)


def decode_image(data_url: str) -> BytesIO:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    image_bytes = base64.b64decode(data_url)
    return BytesIO(image_bytes)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/export/pdf", methods=["POST"])
def export_pdf():
    payload = request.get_json(silent=True) or {}
    image_data = payload.get("imageData")
    if not image_data:
        return jsonify({"error": "Image data missing"}), 400

    image_buffer = decode_image(image_data)
    image = Image.open(image_buffer)

    pdf_buffer = BytesIO()
    page_width, page_height = A4
    margin = 36
    available_width = page_width - 2 * margin
    available_height = page_height - 2 * margin

    image_ratio = image.width / image.height
    page_ratio = available_width / available_height

    if image_ratio > page_ratio:
        draw_width = available_width
        draw_height = available_width / image_ratio
    else:
        draw_height = available_height
        draw_width = available_height * image_ratio

    x = (page_width - draw_width) / 2
    y = (page_height - draw_height) / 2

    pdf = canvas.Canvas(pdf_buffer, pagesize=A4)
    pdf.drawImage(ImageReader(image), x, y, width=draw_width, height=draw_height, preserveAspectRatio=True, mask="auto")
    pdf.showPage()
    pdf.save()

    pdf_buffer.seek(0)
    return send_file(pdf_buffer, mimetype="application/pdf", as_attachment=True, download_name="carte.pdf")


if __name__ == "__main__":
    app.run(debug=True)
