"""Serve training-standalone.html as a shareable Streamlit app.

training-standalone.html is a generated, self-contained build of
frontend/src/pages/standalone/TrainingStandalone.jsx (built via
`npm run build:standalone` in frontend/, see vite.standalone.config.js) - every script and
stylesheet is inlined into the one file, so it can be embedded directly with no second
hosting step, the same pattern streamlit_adaptation/streamlit_app.py uses for
adaptation.html. Rebuild and re-copy that file here whenever the training module source
changes; this app does not build it itself.

Run locally:   streamlit run streamlit_training/streamlit_app.py
"""
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

HTML_PATH = Path(__file__).resolve().parent / "training-standalone.html"

st.set_page_config(page_title="LexPace Training", layout="wide")

# Remove Streamlit's default padding/header so the page fills the window.
st.markdown(
    """
    <style>
      .block-container {padding: 0 !important; max-width: 100% !important;}
      header, footer, #MainMenu {visibility: hidden; height: 0;}
      iframe {height: calc(100vh - 8px) !important; display: block;}
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data
def load_html() -> str:
    return HTML_PATH.read_text(encoding="utf-8")


components.html(load_html(), height=1000, scrolling=True)
