FROM python:3.12.4-slim-bullseye

WORKDIR /app

COPY ./deployment/server/requirements.txt .
RUN pip install -r requirements.txt 
COPY ./src/python/ .

CMD [ "python", "server.py"]
