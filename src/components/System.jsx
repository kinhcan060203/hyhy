import { useEffect, useState } from "react";

function System() {
  const [count, setCount] = useState(0);

  async function handleFetchSystemOrg() {
    const res1 = await window.lemon.basedata.fetchSystemOrg({});
    console.log(res1);
  }
  async function handleLogout() {
    const res = await window.lemon.login.logout();
    console.log(res);
  }
  async function handleFetchDeviceList() {
    const res = await window.lemon.basedata
      .fetchDeviceList({
        page_size: 10,
        page_index: 1,
      })
      .then((resp) => {
        console.log(resp);
      })
      .catch((err) => {
        console.error(err);
      });

    console.log(res);
  }
  async function handlePullVideo() {
    const res = await window.lemon.call
      .pullVideo({
        basedata_id:
          "fd88c15f15d090841a29b5be71c004f0d66f57e383353c029917375692537320",
        video_frame_size: 3,
        hook_flag: 0,
      })
      .then((resp) => {
        console.log(resp);
      })
      .catch((err) => {
        console.error(err);
      });

    console.log(res);
  }
  async function handleMakeVideoCall() {
    const res = await window.lemon.call
      .makeVideoCall({
        basedata_id:
          "fd88c15f15d090841a29b5be71c004f0d66f57e383353c029917375692537320",

        video_frame_size: 3,
        hook_flag: 1,
      })
      .then((resp) => {
        console.log(resp);
      })
      .catch((err) => {
        console.error(err);
      });

    console.log(res);
  }
  async function handlMakeVoiceCall() {
    const res = await window.lemon.call
      .makeVoiceCall({
        basedata_id:
          "fd88c15f15d090841a29b5be71c004f0d66f57e383353c029917375692537320",
        duplex_flag: 1,
        hook_flag: 0,
      })
      .then((resp) => {
        console.log(resp);
      })
      .catch((err) => {
        console.error(err);
      });

    console.log(res);
  }
  async function handleLogin() {
    let userInfo = {
      username: "becamex2",
      password: "vn123456",
      realm: "puc.com",
      webpucUrl: "https://45.118.137.185:16888",
    };
    const res = await window.lemon.login
      .login(userInfo)

      .then((resp) => {
        alert("Login success");
      })
      .catch((err) => {
        alert("Login failed");
      });
    console.log(res);
  }
  return (
    <>
      <button onClick={async () => await handleLogin()}>Login</button>
      <button onClick={async () => await handleLogout()}>Logout</button>
      <button onClick={async () => await handleFetchDeviceList()}>
        fetchDeviceList
      </button>
      {/* <button onClick={async () => await handleFetchDeviceMedia()}>
        fetchDeviceList
      </button> */}
      <button onClick={async () => await handleFetchSystemOrg()}>
        fetchSystemOrg
      </button>
    </>
  );
}

export default System;
