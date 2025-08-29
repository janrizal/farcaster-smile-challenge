// ---------------------------------------------------------------
// app.js – Farcaster Smile Challenge + Sepolia Reward Contract
// ---------------------------------------------------------------

console.log("🔧 app.js loaded");

// -------------------------------------------------------------------
// 1️⃣  CONTRACT SETTINGS – UPDATE THESE VALUES BEFORE DEPLOYING
// -------------------------------------------------------------------
const CONTRACT_ADDRESS = "0x14f67cd3deb2f35c973bf2a764f11139af96c06d"; // your verified contract
const SEPOLIA_RPC = "https://eth-sepolia.g.alchemy.com/v2/a2_3mv-yTn8OlncFqRT22"; // your Alchemy Sepolia RPC

// -------------------------------------------------------------------
// 2️⃣  ABI – this matches the verified contract on Sepolia
// -------------------------------------------------------------------
const SMILE_REWARD_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "score", "type": "uint256" }],
    "name": "claimReward",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getEligibility",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "lastClaimTime",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "rewardRate",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// -------------------------------------------------------------------
// 3️⃣  GLOBAL STATE & UI REFS
// -------------------------------------------------------------------
let provider, signer;
let isConnected = false;
let farcasterConnected = false;
let currentPhoto, smileScore, ipfsCid;
let modelsLoaded = false;

let statusEl, connectBtn, connectFarcasterBtn, cameraEl, captureBtn, claimBtn, scoreEl, postBtn;

// -------------------------------------------------------------------
// Helper: status messages
// -------------------------------------------------------------------
function setStatus(msg) {
  console.log("ℹ️ Status:", msg);
  if (statusEl) statusEl.innerText = msg;
}

// -------------------------------------------------------------------
// Helper: get MetaMask provider
// -------------------------------------------------------------------
function getEthereumProvider() {
  const eth = window.ethereum || (window.web3 && window.web3.currentProvider) || null;
  console.log("🔍 Ethereum provider detected:", eth);
  return eth;
}

// -------------------------------------------------------------------
// Load face-api.js models (local folder `weights/`)
// -------------------------------------------------------------------
async function loadFaceApiModels() {
  console.log("🤖 Loading face detection models...");
  setStatus("🤖 Loading AI models...");

  try {
    const MODEL_URL = '/weights'; // folder inside repo
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
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

// -------------------------------------------------------------------
// DOMContentLoaded – bind UI & start model loading
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  console.log("🟢 DOMContentLoaded");

  statusEl            = document.getElementById('status');
  connectBtn          = document.getElementById('connectBtn');
  connectFarcasterBtn = document.getElementById('connectFarcasterBtn');
  cameraEl            = document.getElementById('camera');
  captureBtn          = document.getElementById('captureBtn');
  claimBtn            = document.getElementById('claimBtn'); // claim button reference
  scoreEl             = document.getElementById('score');
  postBtn             = document.getElementById('postBtn'); // post button reference

  // UI listeners
  connectBtn.addEventListener('click', onConnectWallet);
  connectFarcasterBtn.addEventListener('click', onConnectFarcaster);
  captureBtn.addEventListener('click', onCaptureSmile);
  claimBtn.addEventListener('click', () => claimReward(smileScore));
  postBtn.addEventListener('click', onPostToFarcaster);

  // Load AI models
  loadFaceApiModels();
});

// -------------------------------------------------------------------
// 4️⃣  WALLET CONNECTION
// -------------------------------------------------------------------
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

    // Use BrowserProvider (Ethers v6)
    provider = new window.ethers.BrowserProvider(eth);
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

// -------------------------------------------------------------------
// 5️⃣  FARCASTER (simulated) CONNECTION
// -------------------------------------------------------------------
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
    setStatus("📷 Camera ready! Click Capture.");
  } catch (e) {
    console.error("❌ Camera init failed:", e);
    setStatus("❌ Camera access denied");
    captureBtn.disabled = true;
  }
}

// -------------------------------------------------------------------
// 6️⃣  CAPTURE & SMILE ANALYSIS
// -------------------------------------------------------------------
async function onCaptureSmile() {
  console.log("▶️ onCaptureSmile()");
  if (!farcasterConnected) return alert("Connect Farcaster first");

  setStatus("📸 Capturing & analyzing...");
  captureBtn.disabled = true;

  try {
    // Snapshot video to canvas
    const canvas = document.createElement('canvas');
    canvas.width  = cameraEl.videoWidth;
    canvas.height = cameraEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraEl, 0, 0);
    currentPhoto = canvas.toDataURL('image/png');

    // Run AI if models loaded, else fallback random score
    if (modelsLoaded) {
      setStatus("🤖 AI analyzing smile...");
      smileScore = await analyzeSmile(canvas);
    } else {
      console.log("⚠️ Using fallback random score");
      smileScore = Math.floor(Math.random() * 41) + 60;
    }

    // Mock IPFS (replace later if you want real IPFS)
    setStatus("⏳ Processing results...");
    ipfsCid = await uploadToIPFS(currentPhoto);

    // Show results & enable claim/post buttons
    scoreEl.classList.remove('hidden');
    scoreEl.innerText = `😊 Smile Score: ${smileScore}/100\n${getSmileMessage(smileScore)}\nImage ID: ${ipfsCid}`;
    claimBtn.classList.remove('hidden');
    postBtn.classList.remove('hidden');
    setStatus("😃 Analysis done! Claim reward or post to Farcaster.");

  } catch (e) {
    console.error("❌ Capture/analysis error:", e);
    setStatus("❌ Error: " + (e.message||e));
  } finally {
    captureBtn.disabled = false;
  }
}

// -------------------------------------------------------------------
// 7️⃣  SMILE ANALYSIS (face-api)
// -------------------------------------------------------------------
async function analyzeSmile(canvas) {
  try {
    console.log("🔍 Detecting faces & expressions...");
    const detections = await faceapi
      .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();

    console.log("👥 Faces detected:", detections.length);
    if (detections.length === 0) throw new Error("No face detected");

    const expr = detections[0].expressions;
    console.log("😊 Expressions:", expr);
    const happiness = expr.happiness || 0;
    const score = Math.round(happiness * 100);
    console.log(`✅ Smile score: ${score}%`);
    return Math.max(score, 10); // minimum 10
  } catch (err) {
    console.error("❌ Face API error:", err);
    throw err;
  }
}

// -------------------------------------------------------------------
// 8️⃣  UI Helpers
// -------------------------------------------------------------------
function getSmileMessage(score) {
  if (score >= 90) return "🌟 Amazing smile!";
  if (score >= 80) return "😄 Great smile!";
  if (score >= 70) return "😊 Nice smile!";
  if (score >= 60) return "🙂 Good smile!";
  if (score >= 50) return "😐 Not bad!";
  return "😔 Try again!";
}

// -------------------------------------------------------------------
// 9️⃣  MOCK IPFS (replace with real IPFS later if desired)
// -------------------------------------------------------------------
async function uploadToIPFS(dataUrl) {
  console.log("📤 Mock IPFS upload");
  await new Promise(r => setTimeout(r, 800));
  const fakeId = 'IMG' + Math.random().toString(36).substr(2, 9);
  console.log("✅ Mock CID:", fakeId);
  return fakeId;
}

// -------------------------------------------------------------------
// 🔟  CLAIM REWARD – INTERACT WITH YOUR CONTRACT
// -------------------------------------------------------------------
async function claimReward(score) {
  console.log("▶️ claimReward() called with score:", score);
  try {
    if (!window.ethereum) {
      alert("MetaMask not detected – install it first!");
      return;
    }

    // Ask MetaMask to connect (if not already)
    await window.ethereum.request({ method: "eth_requestAccounts" });

    // Use BrowserProvider (Ethers v6)
    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer   = await provider.getSigner();

    // Contract instance
    const contract = new window.ethers.Contract(
      CONTRACT_ADDRESS,
      SMILE_REWARD_ABI,
      signer
    );

    // Check eligibility (once per 24h)
    const [eligible, secsUntilNext] = await contract.getEligibility();
    if (!eligible) {
      const hrs = Math.ceil(secsUntilNext / 3600);
      alert(`You can claim once per day. Please wait ${hrs} hour(s).`);
      return;
    }

    // Send claim transaction
    const tx = await contract.claimReward(score);
    setStatus("⏳ Claim transaction sent – awaiting confirmation...");
    await tx.wait();
    setStatus("✅ Reward claimed! Check your Sepolia wallet.");

  } catch (err) {
    console.error("❌ Claim error:", err);
    setStatus("❌ Claim failed: " + (err.message || "unknown"));
  }
}

// -------------------------------------------------------------------
// 1️⃣1️⃣  POST TO FARCASTER (simulated)
// -------------------------------------------------------------------
async function onPostToFarcaster() {
  console.log("▶️ onPostToFarcaster() called");
  setStatus("📝 Posting to Farcaster (simulated)…");
  postBtn.disabled = true;

  await new Promise(r => setTimeout(r, 1500));
  setStatus("🎉 Posted to Farcaster!");
  console.log(`Simulated post: score=${smileScore}, CID=${ipfsCid}`);

  setTimeout(() => {
    scoreEl.classList.add('hidden');
    postBtn.classList.add('hidden');
    claimBtn.classList.add('hidden'); // hide claim button after posting
    postBtn.disabled = false;
    setStatus("Ready for another smile! 😊");
  }, 2000);
}
