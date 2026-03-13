import { createWalletClient, createPublicClient, custom, http } from 'viem';
import { hardhat } from 'viem/chains';
import abiData from './PatientRegistry.json';

const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjN2VjMzVmMi03NzczLTQyYmItOTRkOC01N2JmOWY5ODU0MzAiLCJlbWFpbCI6ImRheWN1bmdhZXNvcEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiNTYzZTE2MmViOGNiMDk3MDZkYjciLCJzY29wZWRLZXlTZWNyZXQiOiI5MDhjNTcyZTgzOWViOThmY2FlNTcyY2JmZWU4MTViYzM4YTRjNzVjMWNjZjg1YWQyZDUxZTQ0ZWYwMzAxMDg1IiwiZXhwIjoxODA0OTM5MDY2fQ.6tlJTtB979MkLlj1jdMKNzTJJdhasCLW1bmCdTI3ApA'; 
const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const abi = abiData.abi;

const publicClient = createPublicClient({ chain: hardhat, transport: http() });
const walletClient = createWalletClient({ chain: hardhat, transport: custom(window.ethereum) });

let userAccount = '';

function showSection(sectionId) {
    document.querySelectorAll('.main-content').forEach(s => s.style.display = 'none');
    document.getElementById(sectionId).style.display = 'flex';
    
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    const btnMap = { 'landingPage': 'menuHome', 'registerPage': 'menuRegister', 'loginPage': 'menuLogin', 'dashboard': 'menuDashboard' };
    if(btnMap[sectionId]) document.getElementById(btnMap[sectionId]).classList.add('active');
}

async function uploadToPinata(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${PINATA_JWT}`
        },
        body: formData
    });
    
    if (!res.ok) throw new Error("Lỗi khi upload lên Pinata");
    const data = await res.json();
    return data.IpfsHash;
}

function loadDashboard(data) {
    document.getElementById('menuRegister').style.display = 'none';
    document.getElementById('menuLogin').style.display = 'none';
    
    // Hiện Dashboard và Logout
    document.getElementById('menuDashboard').style.display = 'block';
    document.getElementById('menuLogout').style.display = 'block';

    document.getElementById('dashboardUserName').innerText = data[0];
    document.getElementById('dashName').innerText = data[0];
    document.getElementById('dashEmail').innerText = data[1];
    document.getElementById('dashDoB').innerText = data[2];
    document.getElementById('dashBlood').innerText = data[4]; 
    document.getElementById('dashAddress').innerText = userAccount;

    const modal = document.getElementById('profileModal');
    document.getElementById('viewProfileBtn').onclick = () => modal.style.display = 'flex';
    document.getElementById('closeProfileModal').onclick = () => modal.style.display = 'none';
    
    document.getElementById('viewRecordBtn').onclick = () => window.open(`https://gateway.pinata.cloud/ipfs/${data[3]}`, '_blank');
    
    // Nút update giờ mở đúng trang updatePage
    document.getElementById('updateRecordsBtn').onclick = () => showSection('updatePage');

    showSection('dashboard');
}

// Hàm Xử lý Update Record
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
            account,
            address: contractAddress,
            abi: abi,
            functionName: 'updateRecord',
            args: [newIpfsHash] // Chỉ truyền mã Hash mới vào
        });
        
        const txHash = await walletClient.writeContract(request);
        alert(`Cập nhật hồ sơ thành công!\nMã giao dịch: ${txHash}`);
        
        // Tải lại dữ liệu mới nhất
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

document.getElementById('regSubmit').onclick = async () => {
    const name = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const dob = document.getElementById('regDoB').value;
    const bloodGroup = document.getElementById('regBloodGroup').value;
    const fileInput = document.getElementById('regFile');

    if (!name || !email || !dob || !fileInput.files[0]) {
        alert("Vui lòng điền đầy đủ thông tin và chọn file!");
        return;
    }

    try {
        const [account] = await walletClient.requestAddresses();
        alert("Đang tải file lên IPFS (Pinata)...");
        const ipfsHash = await uploadToPinata(fileInput.files[0]);

        const { request } = await publicClient.simulateContract({
            account, address: contractAddress, abi: abi,
            functionName: 'registerPatient',
            args: [name, email, dob, bloodGroup, ipfsHash] 
        });
        
        const txHash = await walletClient.writeContract(request);
        alert(`Đăng ký thành công!\nMã giao dịch: ${txHash}`);
        showSection('loginPage'); 

    } catch (error) {
        console.error(error);
        alert("Lỗi đăng ký: " + (error.shortMessage || error.message));
    }
};

document.getElementById('loginSubmit').onclick = async () => {
    const email = document.getElementById('loginEmail').value;
    try {
        const [account] = await walletClient.requestAddresses();
        userAccount = account;
        const data = await publicClient.readContract({
            address: contractAddress, abi,
            functionName: 'getMyDetails', account
        });

        if (data[1].toLowerCase() === email.toLowerCase()) {
            loadDashboard(data);
        } else { alert("Email không khớp!"); }
    } catch (e) { alert("Ví chưa đăng ký hoặc có lỗi xảy ra!"); }
};

// Chức năng Logout
document.getElementById('menuLogout').onclick = () => {
    userAccount = '';
    document.getElementById('menuLogout').style.display = 'none';
    document.getElementById('menuDashboard').style.display = 'none';
    document.getElementById('menuRegister').style.display = 'block';
    document.getElementById('menuLogin').style.display = 'block';
    showSection('landingPage');
};

document.getElementById('menuDashboard').onclick = () => showSection('dashboard');
document.getElementById('menuHome').onclick = () => showSection('landingPage');
document.getElementById('menuRegister').onclick = () => showSection('registerPage');
document.getElementById('menuLogin').onclick = () => showSection('loginPage');

document.getElementById('landingGetStarted').onclick = () => showSection('registerPage');
document.getElementById('regClose').onclick = () => showSection('landingPage');
document.getElementById('loginClose').onclick = () => showSection('landingPage');
document.getElementById('updateClose').onclick = () => showSection('dashboard');

showSection('landingPage');