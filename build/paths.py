"""Where the NASA files and the site's data folder are.

Set two environment variables before running the scripts, or edit the defaults below:

    LS_NASA_DIR   folder with the downloaded NASA files: LDEM_*.IMG, AVGVISIB_*.IMG, the 5 m site maps,
                  the Diviner maps, regions/regions.geojson (default: a folder "nasa" next to this file)
    LS_DATA_DIR   the data/ folder of the site (default: ../data)

Run the scripts from this folder: they read each other and a few files they leave here.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
NASA = os.path.join(os.environ.get("LS_NASA_DIR", os.path.join(HERE, "nasa")), "")
DATA = os.path.join(os.environ.get("LS_DATA_DIR", os.path.join(HERE, "..", "data")), "")
