import os
import sys

# Ensure backend root is on sys.path so tests can import `app` directly.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
