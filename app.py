from flask import Flask
app = Flask(__name__)

@app.route("/<path:path>")
def static_path(path):
    return app.send_static_file(path)

@app.route("/")
def index():
    return app.send_static_file("index.html")
