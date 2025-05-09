from flask import Flask, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = "secret!"
socketio = SocketIO(app, cors_allowed_origins="*")

clients = set()


@socketio.on("connect")
def handle_connect():
    clients.add(request.sid)
    print(f"🟢 Client {request.sid} đã kết nối!")
    emit("server_message", {"message": "Bạn đã kết nối đến signaling server."})


@socketio.on("disconnect")
def handle_disconnect():
    clients.discard(request.sid)
    print(f"🔴 Client {request.sid} đã ngắt kết nối!")


@socketio.on("offer")
def handle_offer(data):
    print(f"📩 Nhận OFFER từ {request.sid}: {data}")
    emit("offer", data, broadcast=True, include_self=False)  # Gửi đến các client khác


@socketio.on("call")
def handle_answer(data):
    print(f"📩 Nhận call từ {request.sid}: {data}")
    emit("call", data, broadcast=True, include_self=False)  # Gửi đến các client khác


@socketio.on("call.offer")
def handle_request_call(data):
    print(f"📩 Nhận request call từ {request.sid}: {data}")
    emit(
        "call.offer", data, broadcast=True, include_self=False
    )  # Gửi đến các client khác


@socketio.on("call.answer")
def handle_answer_call(data):
    print(f"📩 Nhận answer call từ {request.sid}: {data}")
    emit("call.answer", data, broadcast=True, include_self=False)

# http://45.118.136.10:8006/Device/Gps
@app.route("/")
def index():
    return "🔥 WebRTC Signaling Server đang chạy!"


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=6173, debug=True)
