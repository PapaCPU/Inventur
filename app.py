# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

data_storage = []

@app.route('/submit_data', methods=['POST'])
def submit_data():
    try:
        data = request.json
        data_storage.append(data)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/get_data', methods=['GET'])
def get_data():
    try:
        return jsonify(data_storage)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"status": "error", "message": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)
