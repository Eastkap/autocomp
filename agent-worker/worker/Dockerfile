FROM python:3.12-slim
# browser-use drives Chromium via Playwright. channel="chrome" uses real Chrome if
# present in the profile; the bundled Chromium is the fallback.
ENV PIP_NO_CACHE_DIR=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt && \
    python -m playwright install --with-deps chromium
COPY worker.py .
CMD ["python", "-u", "worker.py"]
