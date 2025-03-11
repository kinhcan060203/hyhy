FROM python:3.12.4-slim-bullseye

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app

# Install any dependencies
COPY ./deployment/server/requirements.txt .
RUN pip install -r requirements.txt 
COPY ./server.py ./server.py

CMD [ "python", "server.py"]
