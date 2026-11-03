"""Serve adaptation.html as a shareable Streamlit app.

Run locally:   streamlit run streamlit_adaptation/streamlit_app.py
"""
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

HTML_PATH = Path(__file__).resolve().parent.parent / "adaptation.html"

st.set_page_config(page_title="LexPace – Adaptation", layout="wide")

# Remove Streamlit's default padding/header so the page fills the window.
st.markdown(
    """
    <style>
      .block-container {padding: 0 !important; max-width: 100% !important;}
      header, footer, #MainMenu {visibility: hidden; height: 0;}
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data
def load_html() -> str:
    return HTML_PATH.read_text(encoding="utf-8")


components.html(load_html(), height=1000, scrolling=True)
