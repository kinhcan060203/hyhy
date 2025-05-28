import { useRef, useState, useEffect } from "react";
import {
  handleAttemptLogin,
  handleAttemptLogout,
  handleFetchDeviceList,
  handleQueryRecordGPS,
  getAccountInfo,
} from "../utils/common";

import { generateFakeGPSData, median } from "../utils/tool";
import { connectSocket } from "../utils/function";

import {USER_INFO, MQTT_CONFIG_DEV, MQTT_CONFIG_PROD, CALL_CONFIG_DEFAULT, WS_ENDPOINT} from "../utils/constants"

function AutoLogin() {

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
      handleLogin(USER_INFO);
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

  function setupWebSocket() {

  const socket = new WebSocket(WS_ENDPOINT);
  socketRef.current = socket;
  socket.onopen = () => {
    console.log("####  WebSocket Connected");
    const session = sessionId?.current;

    socket.send(JSON.stringify({
      type: "call.event",
      data: {
        status: "idle",
        basedata_id: null,
        session_id: session,
      },
    }));

    if (session) {
      socket.send(JSON.stringify({
        type: "master.add",
        data: { master_id: session },
      }));
    }
  };

  socket.onmessage = async (event) => {
    try {
        const message = JSON.parse(event.data);
        const { type, data } = message;
        console.log("### $$$ WebSocket message received:", message);

      if (type === "master.reconnect") {
        actionStatus.current = "idle";
        token.current = null;
        handleLogin(USER_INFO);
      }
      else if (type === "call.offer") {
        console.log("### Received call.offer:", data);
        const { deviceId } = data;
        const device = deviceListInfo[deviceId];

        if (!device || !device.basedata_id) {
          socket.send(JSON.stringify({
            type: "call.answer",
            data: {
              url: "",
              statusCode: 404,
              msg: "Device not found or missing basedata_id",
            },
          }));
          return;
        }

        const url = `https://security.becawifi.vn/sdk/stream/${CALL_CONFIG_DEFAULT.call_type}/${CALL_CONFIG_DEFAULT.call_mode}?session_id=${sessionId.current}&hookFlag=${CALL_CONFIG_DEFAULT.hookFlag}&duplexFlag=${CALL_CONFIG_DEFAULT.duplexFlag}&basedata_id=${device.basedata_id}`;
        
        socket.send(JSON.stringify({
          type: "call.answer",
          data: {
            url,
            statusCode: 200,
            msg: "success",
          },
        }));

        console.log(" Sent call.answer with URL:", url);
      }

      else if (type === "call.event") {
        const { status, session_id } = data;
        console.log("##### Socket call status:", status, session_id, sessionId?.current);

        if (status === "call") {
          actionStatus.current = "call";
          await handleAttemptLogout();
        } else if (status === "idle" && session_id === sessionId?.current) {
          actionStatus.current = "idle";
          await handleLogin(USER_INFO);
        } else if (status === "turn_off") {
        } else {
          actionStatus.current = "disabled";
        }
      }
    } catch (err) {
      console.error("### WebSocket message error:", err);
    }
  };

  socket.onerror = (err) => {
    console.error("### WebSocket Error:", err);
  };

  socket.onclose = () => {
    console.warn("### WebSocket Closed");
  };
}


  const fakeRecordGPS = async () => {
    let gpsDataList = generateFakeGPSData(5);
    mqttClientDevGPS.publish(MQTT_CONFIG_DEV.MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
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
        console.warn("####  Không có thiết bị con để truy vấn GPS");
        return [];
      }

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 30 * 1000);
 
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
            console.error(`##### Failed to get GPS for device ${alias}:`, err);
          }
        }
      }
    
      if (gpsDataList.length === 0) {
        console.warn("#### Không có dữ liệu GPS nào được tìm thấy");
        return [];
      }

      mqttClientDev.current?.publish(MQTT_CONFIG_DEV.MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
      mqttClientProd.current?.publish(MQTT_CONFIG_PROD.MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
      console.log("####  GPS data:", gpsDataList);
      return gpsDataList;
    } catch (err) {
      console.error("### queryRecordGPS failed:", err);
      return [];

    }
  };
  const handleLogin = async (userInfo) => {
    if (!userInfo) {
      console.warn("### No user info provided for login")
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
                // console.log("#####  Busy");
                
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

    handleLogin(USER_INFO);

    setupWebSocket();
    intervalGPSRef.current = setInterval(() => {
      queryRecordGPS();
    }, 30 * 1000);

    loginCheckRef.current = setInterval(() => {
        handleLogin(USER_INFO);
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



    const listenCallRequest = (mqtt_client, config) => {
      if (mqtt_client) {
        mqtt_client.onMessageArrived = async (message) => {
          try {
            console.log("#### 📩 MQTT message received:", message.payloadString, config);
            if (message.destinationName === config.MQTT_TOPIC) {
              const payload = JSON.parse(message.payloadString);
              const alias = payload.DeviceId;
              const formated_alias = alias; 

              let devices_info = await handleFetchDeviceList();

              if (devices_info && Object.keys(devices_info).length > 0) {
                deviceListInfo.current = devices_info;

              } else if (deviceListInfo.current && Object.keys(deviceListInfo.current).length > 0) {
                devices_info = deviceListInfo.current;
              } else {
                console.log("####  No device info available", devices_info);
                return;
              }

              const basedata_id = devices_info[formated_alias]?.basedata_id;
          
              const responsePayload = basedata_id
                ? {
                    DeviceId: alias,
                    url: `https://security.becawifi.vn/sdk/stream/${CALL_CONFIG_DEFAULT.call_type}/${CALL_CONFIG_DEFAULT.call_mode}?session_id=${sessionId.current}&hookFlag=${CALL_CONFIG_DEFAULT.hookFlag}&duplexFlag=${CALL_CONFIG_DEFAULT.duplexFlag}&basedata_id=${basedata_id}`,
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
              mqtt_client.publish(
                config.MQTT_TOPIC_RESPONSE,
                JSON.stringify(responsePayload)
              );
            }
          } catch (err) {
            console.error(" Error handling MQTT message:", err);
          }
      }
    }
    console.log("### mqtt_client",mqtt_client)
    return mqtt_client;

  } 

  useEffect(() => {

    const clientId = `${Math.random()}`;
    sessionId.current = clientId;
    
    const mqtt_client_dev = connectSocket(
      clientId,
      MQTT_CONFIG_DEV.MQTT_BROKER,
      MQTT_CONFIG_DEV.MQTT_USERNAME,
      MQTT_CONFIG_DEV.MQTT_PASSWORD,
      MQTT_CONFIG_DEV.MQTT_TOPIC
    );

    const mqtt_client_prod = connectSocket(
      clientId,
      MQTT_CONFIG_PROD.MQTT_BROKER,
      MQTT_CONFIG_PROD.MQTT_USERNAME,
      MQTT_CONFIG_PROD.MQTT_PASSWORD,
      MQTT_CONFIG_PROD.MQTT_TOPIC
    );

    mqttClientDev.current = listenCallRequest(mqtt_client_dev, MQTT_CONFIG_DEV);
    mqttClientProd.current = listenCallRequest(mqtt_client_prod, MQTT_CONFIG_PROD);
    
  return () => {
    console.log("#### 🔌 Disconnecting MQTT...");
    if (mqttClientDev.current) mqttClientDev.current.disconnect();
    if (mqttClientProd.current) mqttClientProd.current.disconnect();
    
  };
}, []);


  const onUnload = () => {
    window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId?.current);
    window.lemon.call.removeIncomingEvt(incomingEvtGuid?.current);
    window.lemon.call.removeAnswerAckEvt(answerAckGuid?.current);
    socketRef.current?.close();
  };

  
  useEffect(() => {
    const onBasedataIdChange = (event) => {
      if (event.key !== "basedata_id") return;

      const newValue = event.newValue;
      console.log("### basedata_id changed:", newValue);

      if (!newValue) {
        console.log("### basedata_id removed — reattempting login");
        handleLogin(USER_INFO);
      } else {
        console.log("### basedata_id set — logging out");
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
      console.warn(" No incoming call to answer");
      return;
    }

    const { duplex_flag, listen_flag } = incomingCall.attribute || {};
    const { caller_alias, call_id: callId } = incomingCall;

    console.log("📞 Answering call:", callId);
    console.log("📥 Incoming call data:", incomingCall);

    if (!callId || !caller_alias) {
      console.error(" Missing callId or caller_alias");
      return;
    }

    try {
      const streamUrl = `http://192.168.101.3:8173/stream/video/1?duplex_flag=${duplex_flag}&listen_flag=${listen_flag}&call_id=${callId}&caller_alias=${caller_alias}`;
      setEmbeddedCallId(streamUrl);
      console.log(" Call stream URL set:", streamUrl);
    } catch (error) {
      console.error("🔥 Error setting up call stream:", error);
    }
  };

  return (
    <>
      <img
        src="/sdk/images/hytera-01.png"
        alt="Hytera Logo"
        class="h-[70vh] object-contain rounded-full shadow-md mx-auto"
      />

      <h1 className="m-10">Smart SDK Manager</h1>
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
