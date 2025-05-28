from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import random
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from logger import logger


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clients: Set[WebSocket] = set()
masters: Dict[str, WebSocket] = {}
socket_to_master_id: Dict[WebSocket, str] = {}


async def broadcast(message_type: str, data: dict, exclude: WebSocket = None):
    for client in clients:
        if client != exclude:
            await client.send_json({"type": message_type, "data": data})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    logger.info(f"Client {id(websocket)} connected.")

    await websocket.send_json(
        {
            "type": "server_message",
            "data": {"message": "You are now connected to the websocket server."},
        }
    )

    try:
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")
            data = msg.get("data", {})

            if msg_type == "master.add":
                master_id = data.get("master_id")
                masters[master_id] = websocket
                socket_to_master_id[websocket] = master_id
                logger.info(f"Master {master_id} (WS: {id(websocket)}) added.")
            elif msg_type == "call.event":
                logger.info(f"Received CALL.EVENT from {id(websocket)}: {data}")
                await broadcast("call.event", data, exclude=websocket)

            elif msg_type == "call.offer":
                logger.info(f"Received CALL.OFFER from {id(websocket)}: {data}")
                await broadcast("call.offer", data, exclude=websocket)

            elif msg_type == "call.answer":
                logger.info(f"Received CALL.ANSWER from {id(websocket)}: {data}")
                await broadcast("call.answer", data, exclude=websocket)

    except WebSocketDisconnect:
        clients.discard(websocket)
        logger.warning(f"Client {id(websocket)} disconnected.")

        if websocket in socket_to_master_id:
            master_id = socket_to_master_id.pop(websocket)
            masters.pop(master_id, None)
            logger.warning(f"Master {master_id} disconnected.")
            if masters:
                random_master_id = random.choice(list(masters.keys()))
                await masters[random_master_id].send_json(
                    {
                        "type": "master.reconnect",
                        "data": {"message": f"Master {master_id} disconnected."},
                    }
                )
            else:
                logger.warning("No remaining masters to notify.")


@app.get("/")
def index():
    return {"message": "Websocket Server is running!"}


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=6173, reload=True)
