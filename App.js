import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import './App.css';

const SIGNALING_SERVER_URL = "http://localhost:3001";
const API_ANALYZE_URL = "http://localhost:8000/analisar";

export default function App() {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);

  const [mediaStream, setMediaStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlobs, setRecordedBlobs] = useState([]);
  const [result, setResult] = useState('');
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [, setRoomId] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = () => {
    if (username.trim() && password.trim()) {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Por favor, preencha usuário e senha');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setResult('');
    stopStream();
  };

  const handleUseWebcam = async () => {
    if (mediaStream) stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      resetQrAndRoom();
    } catch (err) {
      alert("Erro ao acessar webcam: " + err.message);
    }
  };

  const handleShareScreen = async () => {
    if (mediaStream) stopStream();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setMediaStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      resetQrAndRoom();
    } catch (err) {
      alert("Erro ao compartilhar tela: " + err.message);
    }
  };

  const handleConnectMobile = () => {
    const id = Math.random().toString(36).substring(2, 8);
    setRoomId(id);
    setQrCodeValue(`${window.location.origin}/?roomId=${id}`);
    setResult('Aponte a câmera do celular para o QR code para conectar.');

    socketRef.current = window.io ? window.io(SIGNALING_SERVER_URL) : null;
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('signal', { roomId: id, data: { candidate: event.candidate } });
      }
    };

    pcRef.current.ontrack = (event) => {
      if (videoRef.current) videoRef.current.srcObject = event.streams[0];
      setMediaStream(event.streams[0]);
      setResult('Recebendo vídeo do celular');
    };

    if (socketRef.current) {
      socketRef.current.on('signal', async ({ data }) => {
        if (data.sdp) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === 'offer') {
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            socketRef.current.emit('signal', { roomId: id, data: { sdp: pcRef.current.localDescription } });
          }
        } else if (data.candidate) {
          await pcRef.current.addIceCandidate(data.candidate).catch(console.error);
        }
      });
    }
  };

  const handleUseIPCam = () => {
    alert('Funcionalidade IP Cam precisa ser implementada conforme seu dispositivo e protocolo.');
  };

  const stopStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      resetQrAndRoom();
    }
  };

  const startRecording = () => {
    if (!mediaStream) {
      alert('Nenhum vídeo para gravar.');
      return;
    }
    let options = { mimeType: 'video/webm;codecs=vp9' };
    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(mediaStream, options);
    } catch (e) {
      options = { mimeType: 'video/webm;codecs=vp8' };
      mediaRecorder = new MediaRecorder(mediaStream, options);
    }
    mediaRecorderRef.current = mediaRecorder;
    setRecordedBlobs([]);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        setRecordedBlobs((prev) => [...prev, event.data]);
      }
    };
    mediaRecorder.start();
    setRecording(true);
    setResult('Gravando...');
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setRecording(false);
    setResult('Enviando vídeo para análise...');

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(recordedBlobs, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('file', blob, 'video.webm');

      const basicAuth = 'Basic ' + btoa(`${username}:${password}`);

      try {
        const response = await fetch(API_ANALYZE_URL, {
          method: 'POST',
          body: formData,
          headers: { Authorization: basicAuth },
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        setResult('Resultado da análise: ' + (data.resultado || 'sem dados'));
      } catch (err) {
        setResult('Erro na análise: ' + err.message);
      }
    };
  };

  const resetQrAndRoom = () => {
    setQrCodeValue('');
    setRoomId('');
  };

  return (
    <div style={{ padding: 20 }}>
      {!isLoggedIn ? (
        <div style={{ marginBottom: 20 }}>
          <h2 className='login'>Login</h2>
          <input className='usuario' type="text" placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} style={{ marginRight: 10 }} />
          <input className='senha' type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginRight: 10 }} />
          <button className='en' onClick={handleLogin}>Entrar</button>
          {loginError && <p style={{ color: 'red' }}>{loginError}</p>}
        </div>
      ) : (
        <>
          <button className='adm' onClick={handleLogout} style={{ marginBottom: 20 }}>
            Logout ({username})
          </button>
          <h2 className='gravar'>Gravar vídeo da webcam, tela ou celular</h2>
          <button className='senh' onClick={handleUseWebcam}>Usar Webcam</button>
          <button className='sen' onClick={handleShareScreen}>Compartilhar Tela</button>
          <button className='se' onClick={handleConnectMobile}>Conectar Câmera do Celular (QR Code)</button>
          <button className='sn' onClick={handleUseIPCam}>Usar IP Câmera</button>
          <br /><br />
          <video ref={videoRef} width="620" height="240" autoPlay muted playsInline></video>
          <br />
          <button className='cli' onClick={startRecording} disabled={!mediaStream || recording}>Gravar</button>
          <button className='clik' onClick={stopRecording} disabled={!recording}>Parar e Analisar</button>
          <p>{result}</p>
          {qrCodeValue && (
            <div style={{ marginTop: 20 }}>
              <p>Escaneie o QR Code para conectar o celular:</p>
              <QRCodeCanvas value={qrCodeValue} size={200} />
            </div>
          )}
        </>
      )}
    </div>
  );
}