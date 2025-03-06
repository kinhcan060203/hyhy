import { useRef, useState, useEffect } from "react";
function AutoLogin() {
  const userInfo = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };
  const [deviceList, setDeviceList] = useState({ hehe: "haha" });

  const attemptLogin = async () => {
    console.log("Attempting login");
    try {
      const response = await window.lemon.login.login(userInfo);
      if (response.result !== 0) {
        console.log("Login failed, retrying...");
        setTimeout(attemptLogin, 1000);
      } else {
        console.log("Login successful");
        await handleFetchDeviceList();
      }
    } catch (error) {
      console.log("Login error, retrying...");
      setTimeout(attemptLogin, 1000);
    }
  };

  const attemptLogout = async () => {
    console.log("Logging out");
    await window.lemon.login.logout();
  };

  const handleLoginStatusChange = (loginStatus) => {
    console.log("Login status changed", loginStatus);
    if ([0, 2, 3].includes(loginStatus.login_status)) {
      const storedToken = localStorage.getItem("basedata_id");
      if (!storedToken) {
        attemptLogin();
      }
    }
  };
  async function handleFetchDeviceList() {
    try {
      const resp = await window.lemon.basedata.fetchDeviceList({
        page_size: 200,
        page_index: 1,
      });

      if (!resp.device_list) {
        console.warn("%% No devices found");
        return;
      }

      const newDeviceList = resp.device_list.reduce((acc, device) => {
        acc[device.alias] = {
          basedata_id: device.basedata_id,
          number: device.number,
        };
        return acc;
      }, {});
      setDeviceList(newDeviceList);
    } catch (error) {
      console.error("Error fetching device list:", error);
    }
  }
  useEffect(() => {
    const loginStatusCallbackId =
      window.lemon.login.addLoginStatusChangeListener(handleLoginStatusChange);
    localStorage.removeItem("basedata_id");
    attemptLogin();

    return () => {
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
    };
  }, []);
  useEffect(() => {
    console.log("%% deviceList changed", deviceList);

    return () => {};
  }, [deviceList]);
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === "basedata_id") {
        console.log("basedata_id changed:", event.newValue);
        if (!event.newValue) {
          console.log("basedata_id removed, reattempting login");
          attemptLogin();
        } else {
          console.log("basedata_id updated, logging out");
          attemptLogout();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return <h1>Auto Login</h1>;
}

export default AutoLogin;
