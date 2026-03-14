import { createWalletClient, createPublicClient, custom, http } from 'viem';
import { hardhat } from 'viem/chains';
import abiData from './PatientRegistry.json';

const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI0NDE4YTk0Ni01NDZhLTQ5M2QtYWY5MC1mOTgyYjBlYjYwNzMiLCJlbWFpbCI6ImRpZXBudHQyMzQxMTFlQHN0LnVlbC5lZHUudm4iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiZTdkNjYwYWFmMWQ5MTUwZWQzNDQiLCJzY29wZWRLZXlTZWNyZXQiOiIwMDc0YTI1Y2EwYWYxNjc1NGQ3NWMwMGI4OTA2ZmNjMDQ4ZjE0MWQ1MTUwYmU3ZTVkZDJiMzk3ZjUzNTU4ODgzIiwiZXhwIjoxODA0OTg0NzcxfQ.FwjtUX5IN4xG9WRVSCSwRBszz8OlDk1kYlMQ3TFvF1o'; 
const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const abi = abiData.abi;

const publicClient = createPublicClient({ chain: hardhat, transport: http() });
const walletClient = createWalletClient({ chain: hardhat, transport: custom(window.ethereum) });

let userAccount = '';

function showSection(sectionId) {
    document.querySelectorAll('.main-content').forEach(s => s.style.display = 'none');
    document.getElementById(sectionId).style.display = 'flex';
    
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    const btnMap = { 
        'landingPage': 'menuHome', 
        'registerPage': 'menuRegister', 
        'loginPage': 'menuLogin', 
        'dashboard': 'menuDashboard' 
    };
    if(btnMap[sectionId]) document.getElementById(btnMap[sectionId]).classList.add('active');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function uploadToPinata(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
        body: formData
    });
    
    if (!res.ok) throw new Error("Lỗi khi upload lên Pinata");
    const data = await res.json();
    return data.IpfsHash;
}

function loadDashboard(data) {
    document.getElementById('menuRegister').style.display = 'none';
    document.getElementById('menuLogin').style.display = 'none';
    document.getElementById('menuDashboard').style.display = 'block';
    document.getElementById('menuLogout').style.display = 'block';

    document.getElementById('dashboardUserName').innerText = data[0];
    document.getElementById('dashName').innerText = data[0];
    document.getElementById('dashName2').innerText = data[0];
    document.getElementById('dashEmail').innerText = data[1];
    document.getElementById('dashDoB').innerText = data[2];
    document.getElementById('dashBlood').innerText = data[4]; 
    document.getElementById('dashAddress').innerText = userAccount;

    const modal = document.getElementById('profileModal');
    document.getElementById('viewProfileBtn').onclick = () => modal.style.display = 'flex';
    document.getElementById('closeProfileModal').onclick = () => modal.style.display = 'none';
    
    document.getElementById('viewRecordBtn').onclick = () => window.open(`https://gateway.pinata.cloud/ipfs/${data[3]}`, '_blank');
    document.getElementById('updateRecordsBtn').onclick = () => showSection('updatePage');

    showSection('dashboard');
}

// ===== UPDATE RECORD =====
document.getElementById('updateSubmit').onclick = async () => {
    const fileInput = document.getElementById('updateFile');
    if (!fileInput.files[0]) {
        alert("Vui lòng chọn file hồ sơ mới để cập nhật!");
        return;
    }

    try {
        const [account] = await walletClient.requestAddresses();
        alert("Đang tải file mới lên IPFS (Pinata)... Vui lòng đợi!");
        const newIpfsHash = await uploadToPinata(fileInput.files[0]);

        alert("Đang yêu cầu xác nhận giao dịch trên MetaMask...");
        const { request } = await publicClient.simulateContract({
            account, address: contractAddress, abi,
            functionName: 'updateRecord',
            args: [newIpfsHash]
        });
        
        const txHash = await walletClient.writeContract(request);
        alert(`Cập nhật hồ sơ thành công!\nMã giao dịch: ${txHash}`);
        
        const data = await publicClient.readContract({
            address: contractAddress, abi,
            functionName: 'getMyDetails', account
        });
        loadDashboard(data);

    } catch (error) {
        console.error(error);
        alert("Lỗi cập nhật: " + (error.shortMessage || error.message));
    }
};

// ===== PASSWORD TOGGLE (show/hide) =====
document.querySelectorAll('.cih-pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        btn.querySelector('.eye-show').style.display = isHidden ? 'none' : '';
        btn.querySelector('.eye-hide').style.display = isHidden ? '' : 'none';
    });
});

// Simple hash function for frontend password storage
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== REGISTER =====
document.getElementById('regSubmit').onclick = async () => {
    const name = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const dob = document.getElementById('regDoB').value;
    const bloodGroup = document.getElementById('regBloodGroup').value;
    const fileInput = document.getElementById('regFile');
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (!name || !email || !dob || !fileInput.files[0]) {
        alert("Please fill in all required fields and select a file!");
        return;
    }
    if (!password || password.length < 6) {
        alert("Password must be at least 6 characters!");
        return;
    }
    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    try {
        const [account] = await walletClient.requestAddresses();
        alert("Uploading file to IPFS (Pinata)...");
        const ipfsHash = await uploadToPinata(fileInput.files[0]);

        const { request } = await publicClient.simulateContract({
            account, address: contractAddress, abi,
            functionName: 'registerPatient',
            args: [name, email, dob, bloodGroup, ipfsHash] 
        });
        
        const txHash = await walletClient.writeContract(request);

        // Save hashed password to localStorage keyed by email
        const hashed = await hashPassword(password);
        localStorage.setItem(`ehr_pw_${email.toLowerCase()}`, hashed);

        alert(`Registration successful!\nTransaction hash: ${txHash}`);
        showSection('loginPage'); 

    } catch (error) {
        console.error(error);
        alert("Registration error: " + (error.shortMessage || error.message));
    }
};

// ===== LOGIN =====
document.getElementById('loginSubmit').onclick = async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert("Please enter your email and password!");
        return;
    }

    try {
        // Check password against stored hash first
        const storedHash = localStorage.getItem(`ehr_pw_${email.toLowerCase()}`);
        if (storedHash) {
            const inputHash = await hashPassword(password);
            if (inputHash !== storedHash) {
                alert("Incorrect password!");
                return;
            }
        }

        const [account] = await walletClient.requestAddresses();
        userAccount = account;
        const data = await publicClient.readContract({
            address: contractAddress, abi,
            functionName: 'getMyDetails', account
        });

        if (data[1].toLowerCase() === email.toLowerCase()) {
            loadDashboard(data);
        } else { 
            alert("Email does not match this wallet!"); 
        }
    } catch (e) { 
        alert("Wallet not registered or an error occurred!"); 
    }
};

// ===== LOGOUT =====
document.getElementById('menuLogout').onclick = () => {
    userAccount = '';
    document.getElementById('menuLogout').style.display = 'none';
    document.getElementById('menuDashboard').style.display = 'none';
    document.getElementById('menuRegister').style.display = 'block';
    document.getElementById('menuLogin').style.display = 'block';
    showSection('landingPage');
};

// ===== FILE UPLOAD UI =====
function setupFileUpload(areaId, inputId, labelId) {
    const area = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    
    if (!area || !input) return;
    
    area.onclick = () => input.click();
    input.onchange = () => {
        if (input.files[0] && label) {
            label.innerHTML = `<strong>✓ ${input.files[0].name}</strong>`;
            area.style.borderColor = '#0a6e5e';
            area.style.background = 'rgba(10,110,94,0.04)';
        }
    };
    
    area.ondragover = (e) => {
        e.preventDefault();
        area.style.borderColor = '#0a6e5e';
    };
    
    area.ondragleave = () => {
        area.style.borderColor = '';
    };
    
    area.ondrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            if (label) label.innerHTML = `<strong>✓ ${file.name}</strong>`;
            area.style.borderColor = '#0a6e5e';
        }
    };
}

setupFileUpload('fileUploadArea', 'regFile', 'fileLabel');
setupFileUpload('updateFileArea', 'updateFile', 'updateFileLabel');

// ===== NAVIGATION =====
document.getElementById('menuDashboard').onclick = () => showSection('dashboard');
document.getElementById('menuHome').onclick = () => showSection('landingPage');
document.getElementById('menuRegister').onclick = () => showSection('registerPage');
document.getElementById('menuLogin').onclick = () => showSection('loginPage');

document.getElementById('landingGetStarted').onclick = () => showSection('registerPage');
document.getElementById('landingLoginBtn').onclick = () => showSection('loginPage');
document.getElementById('headerRegisterBtn').onclick = () => showSection('registerPage');
document.getElementById('regClose').onclick = () => showSection('landingPage');
document.getElementById('loginClose').onclick = () => showSection('landingPage');
document.getElementById('updateClose').onclick = () => showSection('dashboard');

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.getElementById('mainHeader');
    if (window.scrollY > 10) {
        header.style.boxShadow = '0 4px 30px rgba(10,110,94,0.15)';
    } else {
        header.style.boxShadow = '0 2px 20px rgba(10,110,94,0.1)';
    }
});

showSection('landingPage');
// Extra nav link
document.getElementById('goToRegisterFromLogin')?.addEventListener('click', (e) => { e.preventDefault(); showSection('registerPage'); });