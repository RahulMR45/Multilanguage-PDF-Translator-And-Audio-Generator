import os
import tempfile
import traceback
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from PyPDF2 import PdfReader
import openai
import gtts
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Comprehensive list of language codes
LANGUAGES = {
    'hi': 'Hindi',
    'kn': 'Kannada',
    'en': 'English'
}

app = Flask(__name__)
CORS(app)

# Initialize OpenAI client
openai.api_key = os.getenv('OPENAI_API_KEY')

# Ensure temp directory exists
TEMP_DIR = tempfile.mkdtemp()

# Register fonts
FONT_PATH_KANNADA = "static/fonts/NotoSansKannada-Regular.ttf"
FONT_PATH_HINDI = "static/fonts/NotoSansDevanagari-Regular.ttf"
pdfmetrics.registerFont(TTFont("NotoSansKannada", FONT_PATH_KANNADA))
pdfmetrics.registerFont(TTFont("NotoSansDevanagari", FONT_PATH_HINDI))

@app.route('/translate', methods=['POST'])
def translate_pdf():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        pdf_file = request.files['file']
        target_language = request.form.get('language', 'hi')  # Default to English
        
        # Validate language code
        if target_language not in LANGUAGES:
            return jsonify({'error': f'Unsupported language. Supported languages are: {", ".join(LANGUAGES.keys())}'}), 400
        
        # Read PDF
        pdf_reader = PdfReader(pdf_file)
        full_text = ''
        for page in pdf_reader.pages:
            full_text += page.extract_text()
        
        # Translate text using OpenAI API

        
        translation_response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": f"Translate the following text to {LANGUAGES[target_language]} language. Ensure proper use of grammar, sentence structure, and cultural context. Keep the original meaning intact."},
            {"role": "user", "content": full_text}
            ],
        timeout=60
        )
        translated_text = translation_response['choices'][0]['message']['content']
        # Create translated PDF
        temp_pdf = os.path.join(TEMP_DIR, f'translated_{os.urandom(8).hex()}.pdf')
        can = canvas.Canvas(temp_pdf, pagesize=letter)
        text_object = can.beginText(inch, letter[1] - inch)
        
        # Select font based on language
        if target_language == 'kn':
            text_object.setFont("NotoSansKannada", 12)
        elif target_language == 'hi':
            text_object.setFont("NotoSansDevanagari", 12)
        else:
            text_object.setFont("Helvetica", 12)  
        
        # Write translated text to PDF
        for line in translated_text.split('\n'):
            text_object.textLine(line)
        
        can.drawText(text_object)
        can.save()
        
        # Create TTS audio (note: gTTS may have limited support for some languages)
        temp_audio = os.path.join(TEMP_DIR, f'translation_{os.urandom(8).hex()}.mp3')
        try:
            tts = gtts.gTTS(translated_text, lang=target_language)
            tts.save(temp_audio)
        except Exception as tts_error:
            print(f"TTS generation failed: {tts_error}")
            temp_audio = None
        
        return jsonify({
            'translated_text': translated_text,
            'pdf_path': temp_pdf,
            'audio_path': temp_audio,
            'language': LANGUAGES[target_language]
        })
    
    except openai.error.OpenAIError as e:
        print(f"OpenAI API Error: {e}")
        return jsonify({'error': f'OpenAI Translation Error: {str(e)}'}), 500
    except Exception as e:
        print(f"Unexpected Translation Error: {traceback.format_exc()}")
        return jsonify({'error': f'Unexpected Translation Error: {str(e)}'}), 500

@app.route('/get_audio', methods=['GET'])
def get_audio():
    audio_path = request.args.get('path')
    if not audio_path:
        return jsonify({'error': 'No audio path provided'}), 400
    
    try:
        return send_file(audio_path, mimetype='audio/mp3')
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve audio: {str(e)}'}), 500

@app.route('/download/pdf', methods=['POST'])
def download_pdf():
    try:
        pdf_path = request.json.get('pdf_path')
        if not pdf_path:
            return jsonify({'error': 'No PDF path provided'}), 400
        return send_file(pdf_path, as_attachment=True, download_name='translated.pdf')
    except Exception as e:
        return jsonify({'error': f'PDF download failed: {str(e)}'}), 500

@app.route('/download/audio', methods=['POST'])
def download_audio():
    try:
        audio_path = request.json.get('audio_path')
        if not audio_path:
            return jsonify({'error': 'No audio path provided'}), 400
        return send_file(audio_path, as_attachment=True, download_name='translation.mp3')
    except Exception as e:
        return jsonify({'error': f'Audio download failed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
