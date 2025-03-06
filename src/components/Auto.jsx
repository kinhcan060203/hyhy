import { useRef, useState, useEffect } from "react";

function Auto() {
  const [count, setCount] = useState(0);
  const [loginStatusCallbackId, setLoginStatusCallbackId] = useState(null);

  const userInfo = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };
  const onLoginStatusChange = (loginStatus) => {
    console.log("Login status changed", loginStatus);
    if (
      loginStatus.login_status === 0 ||
      loginStatus.login_status === 2 ||
      loginStatus.login_status === 3
    ) {
      // setTimeout(() => {
      //   handleLogin();
      // }, 5000);
    let token = localStorage.getItem("basedata_id");
    if (!token) {
      handleLogin();
    }
}
  };
  useEffect(() => {
      let loginStatusId =
      window.lemon.login.addLoginStatusChangeListener(onLoginStatusChange);
      setLoginStatusCallbackId(loginStatusId);
      handleLogin();
    return () => {
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
    };
  }, []);

  const handleLogin = async () => {
    console.log("Attempting login");
    const res = await window.lemon.login
      .login(userInfo)
      .then((resp) => {
        console.log(resp);
        if (resp.result !== 0) {
          console.log("Login failed");
        } else {
          console.log("Login success");
        }
      })
      .catch((err) => {});
  };
  async function handleLogout() {
    const res = await window.lemon.login.logout();
    console.log(res);
  }
  window.addEventListener("storage", (event) => {
    if (event.key === "basedata_id") {
      console.log("Token đã thay đổi:", event.newValue);
      if (!event.newValue) {
        console.log("Token đã bị xóa, dang nhap lai");
        handleLogin();
        let loginStatusId = window.lemon.login.addLoginStatusChangeListener(onLoginStatusChange);
        setLoginStatusCallbackId(loginStatusId);
      } else {
          console.log("Token đã được cập nhật, logout");
        window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
        handleLogout();
      }
    }
  });

  return (
    <>
      <h1>Auto Login</h1>
    </>
  );
}

export default Auto;
