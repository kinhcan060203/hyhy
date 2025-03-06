import { useRef, useState } from "react";

function Fake() {
  const inputRef = useRef(null);
  const iframeRef = useRef(null);
  const [src, setSrc] = useState("");

  const handleOk = () => {
    if (inputRef.current) {
      setSrc(inputRef.current.value);
    }
  };

  const handleRemove = () => {
    setSrc(""); 
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input ref={inputRef} type="text" placeholder="Enter URL..." />
      <button onClick={handleOk}>OK</button>
      <button onClick={handleRemove}>Remove</button>
      <iframe
        ref={iframeRef}
        src={src}
        width="840"
        height="840"
        frameBorder="0"
      ></iframe>
    </div>
  );
}

export default Fake;
