from flask import Flask
from flask_heroku import Heroku
app = Flask(__name__)
heroku = Heroku(app)

@app.route("/<path:path>")
def static_path(path):
    return app.send_static_file(path)

@app.route("/")
def index():
    return app.send_static_file("index.html")
