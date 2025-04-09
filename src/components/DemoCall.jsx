import { use } from "react";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import Paho from 'paho-mqtt'; 

function DemoCall() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [socket, setSocket] = useState(null);
  const [videoLink, setVideoLink] = useState(null);
  const [client, setClient] = useState(null);

  const devices = ["device_name"];
  const hookFlag = 0;
  const duplexFlag = 1;
  const basedata_id =
    "fd88c15f15d090841a29b5be71c004f07ded053d6865c0c78ace4755b7aecab4";
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentCallId, setCurrentCallId] = useState(null);

  const [isConnected, setIsConnected] = useState(false);
  const MQTT_BROKER = "103.129.80.171"; 
  const MQTT_PORT = 27018;
  const MQTT_OPTIONS = {
    username: "securityalert",
    password: "securityalert",
    reconnectPeriod: 1000, // Tự động reconnect mỗi 1 giây
  };

  const MQTT_TOPIC = "alert-security-media"; 
  const MQTT_TOPIC_RESPONSE = "alert-security-media-response"; 

  const handleClick = (call_type) => {
    navigate(`/stream/${call_type}/0?hookFlag=${hookFlag}&duplexFlag=${duplexFlag}&basedata_id=${basedata_id}`);
    // /stream/1/0
    // window.open(
    //   `/stream/0/${call_type}/${hookFlag}/${duplexFlag}/${basedata_id}`,
    //   "_blank",
    //   "width=840,height=840"
    // );
    // window.focus();
  };
  // const handleAnswerCall = (call_type) => {
  //   window.open(
  //     `/stream/1/${call_type}/${incomingCall}`,
  //     "_blank",
  //     "width=640,height=640"
  //   );
  //   window.focus();
  // };
  // useEffect(() => {
  //   incomingEvtGuid = window.lemon.call.addIncomingEvt(handleIncomingCall);
  //   return () => {
  //     if (incomingEvtGuid) {
  //       window.lemon.call.removeIncomingEvt(incomingEvtGuid);
  //     }
  //   };
  // }, []);

  // const handleIncomingCall = async (incomingInfo) => {
  //   console.log("Cuộc gọi đến:", incomingInfo);
  //   if ([0, 2].includes(incomingInfo.attribute.call_mode)) {
  //     setIncomingCall(incomingInfo);
  //     setCurrentCallId(incomingInfo.call_id);
  //   }
  // };

  function get_account_info() {
    window.lemon.login
      .getLoginAccountInfo()
      .then((res) => {
        console.log(res);
        return res.account_info;
      })
      .catch((err) => {
        console.error("Error getting account info", err);
        return null;
      });
  }
  
  function handleCall() {
    console.log("Gọi video", socket);
    socket.emit("call.offer", {
      deviceId: "BoDam9",
    });
  }
  function setupSocket() {
    const newSocket = io("http://192.168.101.3:6173");
    setSocket(newSocket);
    newSocket.on("connect", () => console.log("✅ WebSocket Connected"));
    newSocket.on("call.answer", (data) => {
      console.log("%% ✅ Answered call:", data);
      setVideoLink(data.url);
    });
    newSocket.emit("call", {
      status: "idle",
      basedata_id: null,
    });
  }
  function endCall() {
    console.log("Kết thúc cuộc gọi");
    setVideoLink(null);
  }
  useEffect(() => {

    setupSocket()   
  }, []);
  // async function handleHangup(callId) {
  //   console.log("Ngắt cuộc gọi:", callId);
  //   try {
  //     await window.lemon.call
  //       .hangupCall({ call_id: callId })
  //       .then((res) => {
  //         console.log("Cuộc gọi đã ngắt thành công:", res);
  //       })
  //       .catch((err) => {
  //         console.error(err);
  //       });
  //   } catch (error) {
  //     console.error("Lỗi khi ngắt cuộc gọi:", error, callId);
  //   }
  // }

    useEffect(() => {
        // Khởi tạo MQTT Client
        const clientId = "myClient-" + Math.random().toString(16).substr(2, 8);
        const mqttClient = new Paho.Client(`ws://103.129.80.171:8099/ws`, clientId);

        // Xử lý khi kết nối mất
        mqttClient.onConnectionLost = (responseObject) => {
        console.log("Mất kết nối:", responseObject.errorMessage);
        };

        // Xử lý khi nhận tin nhắn
        mqttClient.onMessageArrived = (message) => {
        console.log("Nhận tin nhắn:", message.payloadString);
        console.log("%%%%",message.destinationName);
        if (message.destinationName === MQTT_TOPIC) {
            console.log("Đã nhận tin nhắn từ MQTT:", message.payloadString);
            const data = JSON.parse(message.payloadString);
            console.log("Data:", data);
        }
        if (message.destinationName === MQTT_TOPIC_RESPONSE) {
            console.log("Đã nhận tin nhắn từ MQTT:", message.payloadString);
            const data = JSON.parse(message.payloadString);
            console.log("Data:", data);
        }
        };

        // Kết nối MQTT
        mqttClient.connect({
            onSuccess: () => {
            console.log("Đã kết nối MQTT");
            mqttClient.subscribe(MQTT_TOPIC_RESPONSE);

            },
            onFailure: (error) => {
                console.error("❌ Lỗi kết nối MQTT:", error.errorMessage);
              },
            userName: "ems",
            password: "ems",
        });
        setClient(mqttClient);
        return () => {
            console.log("Ngắt kết nối MQTT");
        };
    }, []);

  const publishMessage = () => {
    if (client && client.isConnected()) {
      const message = new Paho.Message( JSON.stringify({ "DeviceId": "BoDam5" }));
      message.destinationName = MQTT_TOPIC;
      client.send(message);
      console.log("✅ Đã gửi tin nhắn:", message.payloadString);
    } else {
      console.error("❌ Chưa kết nối MQTT! Thử lại sau...");
    }
  };
  
  return (
    <div className="flex items-center justify-center">
      <button onClick={() => handleClick("voice")} className="">
        Voice Call
      </button>
      <button onClick={() => handleClick("video")} className="">
        Video Call
      </button>
      <button onClick={() => handleCall("video")} className="">
        Video Call websocket
      </button>
      <button onClick={() => get_account_info()} className="">
        get account info
      </button>
      <button onClick={() => publishMessage()} className="">
        Call with mqtt
      </button>
      <iframe src={videoLink} 
      allow="microphone; camera"
      width={500} height={500} frameborder="0"></iframe>
      <button onClick={() => endCall()} className="">
        endCall 
      </button>
      {/* <div>
        {incomingCall && (
          <div>
            <p>Cuộc gọi đến từ: {incomingCall.caller_number}</p>
            <button
              onClick={() => handleAnswerCall(incomingCall.call_id, 1, 0)}
            >
              Trả lời
            </button>
            <button onClick={async () => await handleHangup(currentCallId)}>
              Tắt cuộc gọi
            </button>
          </div>
        )}
      </div> */}
    </div>
  );
}

export default DemoCall;
