FROM python:3.12-slim
# stdlib-only worker — no pip deps to install.
WORKDIR /app
COPY worker.py .
CMD ["python", "-u", "worker.py"]
