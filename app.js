console.log("🔧 app.js loaded");

// Global state
let provider, signer;
let isConnected = false;
let farcasterConnected = false;
let currentPhoto, smileScore, ipfsCid;
let modelsLoaded = false; // Flag to check if face-api models are loaded

// Mock IPFS upload (no external services needed for now)
async function uploadToIPFS(dataUrl) {
  console.log("📤 Mock image processing");
  await new Promise(r => setTimeout(r, 800));
  const fakeId = 'IMG' + Math.random().toString(36).substr(2, 9);
  console.log("✅ Mock processing result:", fakeId);
  return fakeId;
}

// DOM references
let statusEl, connectBtn, connectFarcasterBtn, cameraEl, captureBtn, scoreEl, postBtn;

function setStatus(msg) {
  console.log("ℹ️ Status:", msg);
  if (statusEl) statusEl.innerText = msg;
}

function getEthereumProvider() {
  const eth = window.ethereum || (window.web3 && window.web3.currentProvider) || null;
  console.log("🔍 Ethereum provider detected:", eth);
  return eth;
}

// Load face-api.js models
async function loadFaceApiModels() {
  console.log("🤖 Loading face detection models...");
  setStatus("🤖 Loading AI models...");
  
  try {
    // IMPORTANT: This path assumes you have the 'weights' folder in the same directory as your index.html
    // Download the 'weights' folder from https://github.com/justadudewhohacks/face-api.js/tree/master/weights
    // and place it in your project root.
    const MODEL_URL = '/weights'; 
    
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL); // Needed for face expressions
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    
    modelsLoaded = true;
    console.log("✅ Face API models loaded successfully");
    setStatus("✅ AI models loaded! Connect your wallet to start.");
  } catch (error) {
    console.error("❌ Failed to load face API models:", error);
    setStatus("❌ Failed to load AI models. Using fallback mode.");
    modelsLoaded = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log("🟢 DOMContentLoaded");

  // Grab elements
  statusEl             = document.getElementById('status');
  connectBtn           = document.getElementById('connectBtn');
  connectFarcasterBtn  = document.getElementById('connectFarcasterBtn');
  cameraEl             = document.getElementById('camera');
  captureBtn           = document.getElementById('captureBtn');
  scoreEl              = document.getElementById('score');
  postBtn              = document.getElementById('postBtn');

  // Attach handlers
  connectBtn.addEventListener('click', onConnectWallet);
  connectFarcasterBtn.addEventListener('click', onConnectFarcaster);
  captureBtn.addEventListener('click', onCaptureSmile);
  postBtn.addEventListener('click', onPostToFarcaster);

  // Load face detection models on startup
  loadFaceApiModels();
});

async function onConnectWallet() {
  console.log("▶️ onConnectWallet()");
  setStatus("🔄 Connecting wallet…");

  const eth = getEthereumProvider();
  if (!eth) {
    setStatus("❌ No Ethereum provider found. Install MetaMask.");
    return;
  }

  try {
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    console.log("✅ Accounts returned:", accounts);
    if (!accounts.length) throw new Error("No accounts");

    provider = new ethers.BrowserProvider(eth);
    signer   = await provider.getSigner();
    const addr = await signer.getAddress();
    console.log("🔑 Signer address:", addr);

    setStatus(`✅ Wallet connected: ${addr.slice(0,6)}…${addr.slice(-4)}`);
    isConnected = true;
    connectBtn.disabled = true;
    connectFarcasterBtn.disabled = false;
  } catch (e) {
    console.error("❌ onConnectWallet error:", e);
    setStatus("❌ Wallet connection failed: " + (e.message||e));
  }
}

async function onConnectFarcaster() {
  console.log("▶️ onConnectFarcaster()");
  if (!isConnected) {
    alert("Please connect your wallet first!");
    return;
  }

  farcasterConnected = true;
  connectFarcasterBtn.disabled = true;
  setStatus("✅ Farcaster connected (simulated)");
  captureBtn.disabled = false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraEl.srcObject = stream;
    cameraEl.classList.remove('hidden');
    setStatus("📷 Camera is ready! Click Capture to analyze your smile.");
  } catch (e) {
    console.error("❌ Camera init failed:", e);
    setStatus("❌ Camera access denied");
    captureBtn.disabled = true;
  }
}

async function onCaptureSmile() {
  console.log("▶️ onCaptureSmile()");
  if (!farcasterConnected) return alert("Connect Farcaster first");
  
  setStatus("📸 Capturing and analyzing smile...");
  captureBtn.disabled = true;

  try {
    // Create canvas from video
    const canvas = document.createElement('canvas');
    canvas.width  = cameraEl.videoWidth;
    canvas.height = cameraEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraEl, 0, 0);
    currentPhoto = canvas.toDataURL('image/png');

    // Analyze smile using face-api.js
    if (modelsLoaded) {
      setStatus("🤖 AI analyzing your smile...");
      smileScore = await analyzeSmile(canvas);
    } else {
      // Fallback to random score if models failed to load
      console.log("⚠️ Using fallback random score");
      smileScore = Math.floor(Math.random() * 41) + 60;
    }

    // Process and display results
    setStatus("⏳ Processing results...");
    ipfsCid = await uploadToIPFS(currentPhoto); // This is the mock IPFS upload
    
    scoreEl.classList.remove('hidden');
    scoreEl.innerText = `😊 Smile Score: ${smileScore}/100\n${getSmileMessage(smileScore)}\nImage ID: ${ipfsCid}`;
    postBtn.classList.remove('hidden');
    setStatus("😃 Analysis complete! Ready to post.");
    
  } catch (e) {
    console.error("❌ Smile analysis failed:", e);
    setStatus("❌ Smile analysis failed: " + (e.message || e));
  } finally {
    captureBtn.disabled = false;
  }
}

// Real smile detection using face-api.js
async function analyzeSmile(canvas) {
  try {
    console.log("🔍 Detecting faces and expressions...");
    
    // Detect faces with expressions
    const detections = await faceapi
      .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();

    console.log("👥 Detected faces:", detections.length);

    if (detections.length === 0) {
      throw new Error("No face detected. Please ensure your face is visible and try again.");
    }

    if (detections.length > 1) {
      console.log("⚠️ Multiple faces detected, using the first one");
    }

    // Get the first face's expressions
    const expressions = detections[0].expressions;
    console.log("😊 Face expressions:", expressions);
    console.log("DEBUG: Raw happiness value from expressions:", expressions.happiness); // ADDED DEBUG LOG

    const happiness = expressions.happiness || 0;
    const score = Math.round(happiness * 100);

    console.log(`✅ Smile analysis complete: ${score}% happiness`);
    console.log("DEBUG: Score before Math.max:", score); // ADDED DEBUG LOG

    return Math.max(score, 10); // Minimum score of 10 for participation

  } catch (error) {
    console.error("❌ Face analysis error:", error);
    throw error;
  }
}

// Get encouraging message based on smile score
function getSmileMessage(score) {
  if (score >= 90) return "🌟 Amazing smile! You're radiating joy!";
  if (score >= 80) return "😄 Great smile! You're looking fantastic!";
  if (score >= 70) return "😊 Nice smile! Keep spreading positivity!";
  if (score >= 60) return "🙂 Good smile! You're doing great!";
  if (score >= 50) return "😐 Not bad! Try a bigger smile next time!";
  return "😔 Let's see that beautiful smile! Try again!";
}

async function onPostToFarcaster() {
  console.log("▶️ onPostToFarcaster()");
  setStatus("📝 Posting to Farcaster (simulated)…");
  postBtn.disabled = true;

  await new Promise(r => setTimeout(r, 1500));
  setStatus("🎉 Posted to Farcaster!");
  console.log(`Posted (simulated): score=${smileScore}, id=${ipfsCid}`);

  setTimeout(() => {
    scoreEl.classList.add('hidden');
    postBtn.classList.add('hidden');
    postBtn.disabled = false;
    setStatus("Ready for another smile! 😊");
  }, 2000);
}
