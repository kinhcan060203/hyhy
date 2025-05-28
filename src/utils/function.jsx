import Paho from "paho-mqtt";


export const connectSocket = (clientId ,endpoint, username, password, topic=null) => {
    try{
      const mqtt_client = new Paho.Client(
        endpoint,
        clientId
      );
      mqtt_client.onConnectionLost = (responseObject) => {
        console.warn("#### MQTT Connection lost:", responseObject.errorMessage);
      };

      mqtt_client.connect({
        onSuccess: () => {
          console.log("##### MQTT Connected:", clientId);
          if (topic) {
            mqtt_client.subscribe(topic);
          }
        },
        onFailure: (error) => {
          console.log("### MQTT Connection failed:", error.errorMessage);
        },
        userName: username,
        password: password,
        reconnect: true,
        keepAliveInterval: 10,
      });
      return mqtt_client;
    } 
    catch (error) {
      console.error("### Error disconnecting MQTT client:", error);
      return null;
    }
  }