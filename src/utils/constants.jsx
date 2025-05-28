

export const USER_INFO = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://puc.becawifi.vn/",
    pwdNeedEncrypt: false,
  };

export const GPS_SUBSCRIPTION_INTERVAL = 30 * 1000;

export const MQTT_CONFIG_DEV = {
  MQTT_BROKER: "ws://103.129.80.171:8099/ws",
  MQTT_USERNAME: "securityalert",
  MQTT_PASSWORD: "securityalert",
  MQTT_GPS_TOPIC: "alert-security-gps",
  MQTT_TOPIC: "alert-security-media",
  MQTT_TOPIC_RESPONSE: "alert-security-media-response",

}

export const MQTT_CONFIG_PROD = {
  MQTT_BROKER: "wss://mqtt.becawifi.vn/ws",
  MQTT_USERNAME: "securityalert",
  MQTT_PASSWORD: "securityalert",
  MQTT_GPS_TOPIC: "alert-security-gps",
  MQTT_TOPIC: "alert-security-media",
  MQTT_TOPIC_RESPONSE: "alert-security-media-response",

}

export const CALL_CONFIG_DEFAULT = {
  call_mode: 0,  
  hookFlag: 0, 
  duplexFlag: 1,
  call_type: "video",
};

export const WS_ENDPOINT = "wss://security.becawifi.vn/sdk-ws";