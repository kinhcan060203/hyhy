import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";
import Paho from "paho-mqtt";
import { format, parseISO } from "date-fns";
import {
  handleAttemptLogin,
  handleAttemptLogout,
  handleFetchDeviceList,
  handleFetchSubDeviceList,
  handleQueryRecordGPS,
  getAccountInfo,
} from "../utils/common";
import { generateFakeGPSData, median } from "../utils/tool";

function AutoLogin() {
  const userInfo = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };

  const [embeddedCallId, setEmbeddedCallId] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const sessionId = useRef(null);
  const intervalGPSRef = useRef(null);
  const socketRef = useRef(null);
  const mqttClientDev = useRef(null);
  const mqttClientProd = useRef(null);
  const mqttClientDevGPS = useRef(null);
  const deviceListInfo = useRef({});
  const subDeviceList = useRef([]);
  const actionStatus = useRef("idle");
  const loginCheckRef = useRef(null);



  // const MQTT_BROKER =
  // const MQTT_PORT = "1883"; "192.168.255.202";
  // const MQTT_USERNAME = "becaai";
  // const MQTT_PASSWORD = "becaai@2025";


  const MQTT_BROKER = "103.129.80.171";
  const MQTT_PORT = "8099";
  const MQTT_USERNAME = "securityalert";
  const MQTT_PASSWORD = "securityalert";
  const MQTT_GPS_TOPIC = "alert-security-gps";
  const MQTT_TOPIC = "alert-security-media";
  const MQTT_TOPIC_RESPONSE = "alert-security-media-response";
  const call_mode = 0; // 0: listen, 1: duplex
  const hookFlag = 0;
  const duplexFlag = 1;
  const call_type = "video";

  const incomingEvtGuid = useRef(null);;
  const answerAckGuid = useRef(null);;
  const hangupEvtGuid = useRef(null);;
  const forceHangupEvtGuid = useRef(null);;
  const loginStatusCallbackId = useRef(null);
  const token = useRef(null);

  const handleIncomingCall = async (incomingInfo) => {
    if ([0, 2].includes(incomingInfo.attribute.call_mode)) {
      setIncomingCall(incomingInfo);
    }
  };

  const handleLoginStatusChange = (loginStatus) => {
    if ([0, 2, 3].includes(loginStatus.login_status)) {
      handleLogin(userInfo);
    }
  };

  const handleEndCall = async () => {
    setEmbeddedCallId(null);
    setIncomingCall(null);
  };
  function teardownCallHandlers() {
    if (hangupEvtGuid?.current) {
      window.lemon.call.removeHangupEvt(hangupEvtGuid.current);
    }
    if (forceHangupEvtGuid?.current) {
      window.lemon.call.removeForceHangupEvt(forceHangupEvtGuid.current);
    }

    if (incomingEvtGuid?.current) {
      window.lemon.call.removeIncomingEvt(incomingEvtGuid.current);
    }
    if (answerAckGuid?.current) {

      window.lemon.call.removeAnswerAckEvt(answerAckGuid.current);
    }
  }

  console.log("#### 📡 status", status);
  function setupWebSocket() {
    const SOCKET_URL = "http://192.168.101.3:6173";
    const STREAM_BASE_URL = "http://192.168.101.3:8173/sdk/stream";

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // 🔌 Khi kết nối thành công
    socket.on("connect", () => {
      console.log("#### ✅ WebSocket Connected");
      // Gửi trạng thái ban đầu để sync
      socket.emit("call", {
        status: "idle",
        basedata_id: null,
        session_id: sessionId?.current,
      });
      if (sessionId?.current) {
        socket.emit("add_master", { master_id: sessionId.current });
      }
    });
    socket.on("restart_master", (data) => {
      actionStatus.current = "idle";    
      token.current = null;
        handleLogin(userInfo);
    });
    // ☎️ Khi nhận cuộc gọi đến
    socket.on("call.offer", async (offer) => {
      try {
        console.log("📞 Received call.offer:", offer);
        const { deviceId } = offer;
        const device = deviceListInfo[deviceId];

        if (!device || !device.basedata_id) {
          socket.emit("call.answer", {
            url: "",
            statusCode: 404,
            msg: "Device not found or missing basedata_id",
          });
          return;
        }

        // Các thông số stream
        const url = `${STREAM_BASE_URL}/${call_type}/0?hookFlag=${hookFlag}&duplexFlag=${duplexFlag}&basedata_id=${device.basedata_id}`;

        socket.emit("call.answer", {
          url,
          statusCode: 200,
          msg: "success",
        });

        console.log("✅ Sent call.answer with URL:", url);
      } catch (err) {
        console.error("❌ Error handling call.offer:", err);
        socket.emit("call.answer", {
          url: "",
          statusCode: 500,
          msg: "Internal error",
        });
      }
    });
    socket.on("call", async ({ status, session_id }) => {
        console.log("##### 🔄 Socket call status: ", status, session_id , sessionId?.current);

      if (status === "call") {
        actionStatus.current = "call";
        await handleAttemptLogout(); 
      } else if (status === "idle" && session_id === sessionId?.current) {
        actionStatus.current = "idle";
        await handleLogin(userInfo); 
      } else if (status === "turn_off") {
        // setTimeout(() => {
        //   console.log("##### 🔄 Socket call turn_off: ", socketRef.current);
        //   socketRef.current.emit("call", {
        //     status: "idle",
        //     basedata_id: null,
        //     session_id: sessionId?.current,
        //   });
        //   resolve();
        // }
        // , Math.random() * 2000);
      } else {
        actionStatus.current = "disabled";
      }
    });
  }

  const fakeRecordGPS = async () => {
    let gpsDataList = generateFakeGPSData(5);
    mqttClientDevGPS.publish(MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
    return gpsDataList;
  };

  const queryRecordGPS = async () => {
    try {
      let devicesSubGPS = await handleFetchDeviceList();
      if (devicesSubGPS && Object.keys(devicesSubGPS).length > 0) {
        subDeviceList.current = devicesSubGPS;
      } else if (subDeviceList.current && Object.keys(subDeviceList.current).length > 0) {
        devicesSubGPS = subDeviceList.current;
      } else {
        console.warn("#### ⚠️ Không có thiết bị con để truy vấn GPS");
        return [];
      }
      console.log("#### 📡 devicesSubGPS:", devicesSubGPS);

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
 
      const fromTime = oneMinuteAgo.toISOString();
      const toTime = now.toISOString();
      if (Object.keys(devicesSubGPS).length === 0) return [];

      let gpsDataList = [];

      for (const alias of Object.keys(devicesSubGPS)) {
        const device = devicesSubGPS[alias];
        let basedata_id = device.basedata_id;
        if (basedata_id) {
          try {
            // await new Promise(resolve => setTimeout(resolve, 10));
            const response = await handleQueryRecordGPS(
              basedata_id,
              fromTime,
              toTime
            );
            if (response?.length > 0) {
              const longitudes = response.map(item => item.longitude);
              const latitudes = response.map(item => item.latitude);
              const medianLongitude = median(longitudes);
              const medianLatitude = median(latitudes);
      
              gpsDataList.push({
                deviceId: alias,
                lng: medianLongitude,
                lat: medianLatitude,
                dateTime: toTime,
              });
            }
          } catch (err) {
            console.error(`##### ❌ Failed to get GPS for device ${alias}:`, err);
          }
        }
      }
    
      if (gpsDataList.length === 0) {
        console.warn("#### ⚠️ Không có dữ liệu GPS nào được tìm thấy");
        return [];
      }

      mqttClientDev.current.publish(MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
      mqttClientProd.current.publish(MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
      console.log("#### 📡 GPS data:", gpsDataList);
      return gpsDataList;
    } catch (err) {
      console.error("❌ queryRecordGPS failed:", err);
      return [];

    }
  };
  const handleLogin = async (userInfo) => {
    if (!userInfo) {
      console.warn("🚫 No user info provided for login")
      return;
    }
    if (token.current === null) {
        handleAttemptLogin(userInfo).then((resp) => {
            token.current = resp?.token;
        })

    } else {
        const resp_token = await getAccountInfo();
        if (resp_token !== token.current) {
            if (actionStatus.current === "idle") {
                handleAttemptLogin(userInfo).then((resp) => {
                    token.current = resp?.token;
                })
            } else {
                // console.log("##### 🚫 Busy");
                
            }
        } 
    }

  };
  useEffect(() => {

    incomingEvtGuid.current = window.lemon.call.addIncomingEvt(handleIncomingCall);
    answerAckGuid.current = window.lemon.call.addAnswerAckEvt(() =>
      setEmbeddedCallId(null)
    );
    hangupEvtGuid.current = window.lemon.call.addHangupEvt(handleEndCall);
    forceHangupEvtGuid.current = window.lemon.call.addForceHangupEvt(handleEndCall);
    loginStatusCallbackId.current = window.lemon.login.addLoginStatusChangeListener(handleLoginStatusChange);

    handleLogin(userInfo);


    setupWebSocket();
    intervalGPSRef.current = setInterval(() => {
      queryRecordGPS();
    }, 60 * 1000);

    loginCheckRef.current = setInterval(() => {
        handleLogin(userInfo);
    }, 5 * 1000);

      
    window.addEventListener("unload", onUnload);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(intervalGPSRef.current);
      clearInterval(loginCheckRef.current);
      window.removeEventListener("unload", onUnload);
      window.removeEventListener("beforeunload", onUnload);
      teardownCallHandlers();
    };
  }, []);
  const connectSocket = (clientId ,endpoint, username, password, topic=null) => {
    try{
      const mqtt_client = new Paho.Client(
        // `wss://mqtt.becawifi.vn/ws`,
        // `wss://${MQTT_BROKER}:${MQTT_PORT}/ws`,
        endpoint,
        clientId
      );
      mqtt_client.onConnectionLost = (responseObject) => {
        console.warn("#### 📡 MQTT Connection lost:", responseObject.errorMessage);
      };

      mqtt_client.connect({
        onSuccess: () => {
          console.log("##### ✅ MQTT Connected:", clientId);
          if (topic) {
            mqtt_client.subscribe(topic);
          }
        },
        onFailure: (error) => {
          console.log("### ❌ MQTT Connection failed:", error.errorMessage);
        },
        userName: username,
        password: password,
        reconnect: true,
        keepAliveInterval: 10,
      });
      return mqtt_client;
    } 
    catch (error) {
      console.error("❌ Error disconnecting MQTT client:", error);
      return null;
    }
  }
  useEffect(() => {

    const clientId = `${Math.random()}`;
    sessionId.current = clientId;
    
    const mqtt_client_dev = connectSocket(
      clientId,
      `ws://${MQTT_BROKER}:${MQTT_PORT}/ws`,
      MQTT_USERNAME,
      MQTT_PASSWORD,
      MQTT_TOPIC
    );

    const mqtt_client_prod = connectSocket(
      clientId,
      `wss://mqtt.becawifi.vn/ws`,
      MQTT_USERNAME,
      MQTT_PASSWORD,
      MQTT_TOPIC
    );
    
    mqttClientDev.current = mqtt_client_dev;
    mqttClientProd.current = mqtt_client_prod;

    if (mqtt_client_prod) {
      mqtt_client_prod.onMessageArrived = async (message) => {
        try {
          console.log("#### 📩 MQTT message received:", message.payloadString);

          if (message.destinationName === MQTT_TOPIC) {
            const payload = JSON.parse(message.payloadString);
            const alias = payload.DeviceId;
            const formated_alias = alias; // You can format here if needed

            let devices_info = await handleFetchDeviceList();

            if (devices_info && Object.keys(devices_info).length > 0) {
              deviceListInfo.current = devices_info;

            } else if (deviceListInfo.current && Object.keys(deviceListInfo.current).length > 0) {
              devices_info = deviceListInfo.current;
            } else {
              console.log("#### ⚠️ No device info available", devices_info);
              return;
            }

            const basedata_id = devices_info[formated_alias]?.basedata_id;
        
            const responsePayload = basedata_id
              ? {
                  DeviceId: alias,
                  url: `https://security.becawifi.vn/sdk/stream/${call_type}/${call_mode}?session_id=${sessionId.current}&hookFlag=${hookFlag}&duplexFlag=${duplexFlag}&basedata_id=${basedata_id}`,
                  statusCode: 200,
                  msg: "success",
                }
              : {
                  DeviceId: alias,
                  url: "",
                  statusCode: 404,
                  msg: "basedata_id not found",
                };

            console.log("#### 📤 MQTT response:", responsePayload);
            mqtt_client_prod.publish(
              MQTT_TOPIC_RESPONSE,
              JSON.stringify(responsePayload)
            );
          }
        } catch (err) {
          console.error("❌ Error handling MQTT message:", err);
        }
    }
  }

  return () => {
    console.log("#### 🔌 Disconnecting MQTT...");
    if (mqtt_client_dev) mqtt_client_dev.disconnect();
    if (mqtt_client_prod) mqtt_client_prod.disconnect();
    
  };
}, []);





  const onUnload = () => {
    window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId?.current);
    window.lemon.call.removeIncomingEvt(incomingEvtGuid?.current);
    window.lemon.call.removeAnswerAckEvt(answerAckGuid?.current);
    socketRef.current?.disconnect();
  };

  
  useEffect(() => {
    const onBasedataIdChange = (event) => {
      if (event.key !== "basedata_id") return;

      const newValue = event.newValue;
      console.log("🛠️ basedata_id changed:", newValue);

      if (!newValue) {
        console.log("🔁 basedata_id removed — reattempting login");
        handleLogin(userInfo);
      } else {
        console.log("🔒 basedata_id set — logging out");
        handleAttemptLogout();
      }
    };

    window.addEventListener("storage", onBasedataIdChange);

    return () => {
      window.removeEventListener("storage", onBasedataIdChange);
    };
  }, []);

  const handleAnswerCall = async () => {
    if (!incomingCall) {
      console.warn("🚫 No incoming call to answer");
      return;
    }

    const { duplex_flag, listen_flag } = incomingCall.attribute || {};
    const { caller_alias, call_id: callId } = incomingCall;

    console.log("📞 Answering call:", callId);
    console.log("📥 Incoming call data:", incomingCall);

    if (!callId || !caller_alias) {
      console.error("❌ Missing callId or caller_alias");
      return;
    }

    try {
      const streamUrl = `http://192.168.101.3:8173/stream/video/1?duplex_flag=${duplex_flag}&listen_flag=${listen_flag}&call_id=${callId}&caller_alias=${caller_alias}`;
      setEmbeddedCallId(streamUrl);
      console.log("✅ Call stream URL set:", streamUrl);
    } catch (error) {
      console.error("🔥 Error setting up call stream:", error);
    }
  };

  return (
    <>
      <h1>Smart SDK Manager</h1>
      {incomingCall && (
        <div>
          <p>Cuộc gọi đến từ: {incomingCall.caller_number}</p>
          <input type="text" value={embeddedCallId} />
          {/* <button onClick={() => handleAnswerCall()}>Trả lời</button> */}
          {/* <button onClick={async () => await handleHangup(currentCallId)}>
      Tắt cuộc gọi
    </button> */}
        </div>
      )}
    </>
  );
}

export default AutoLogin;
