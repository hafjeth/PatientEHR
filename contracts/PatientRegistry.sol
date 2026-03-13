// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PatientRegistry {
    struct Patient {
        string name;
        string email;
        string dob;         // Đổi age thành dob (Ngày sinh) để khớp với input type="date"
        string bloodGroup;  // Thêm Nhóm máu
        string recordHash;  // Mã CID từ IPFS
        bool isRegistered;
    }

    // Mapping từ địa chỉ ví sang thông tin bệnh nhân
    mapping(address => Patient) private patients;
    // Mapping từ email sang địa chỉ ví (để hỗ trợ login bằng email)
    mapping(string => address) private emailToAddress;

    event PatientRegistered(address indexed patientAddress, string name, string email);
    event RecordUpdated(address indexed patientAddress, string newRecordHash);

    /**
     * @dev Đăng ký bệnh nhân mới
     */
    function registerPatient(
        string memory _name, 
        string memory _email, 
        string memory _dob, 
        string memory _bloodGroup,
        string memory _hash
    ) public {
        require(!patients[msg.sender].isRegistered, "Loi: Vi nay da duoc dang ky!");
        require(emailToAddress[_email] == address(0), "Loi: Email nay da duoc su dung!");
        
        patients[msg.sender] = Patient({
            name: _name,
            email: _email,
            dob: _dob,
            bloodGroup: _bloodGroup,
            recordHash: _hash,
            isRegistered: true
        });

        emailToAddress[_email] = msg.sender;

        emit PatientRegistered(msg.sender, _name, _email);
    }

    /**
     * @dev Cập nhật hồ sơ bệnh án mới (Chỉ cập nhật mã băm IPFS)
     */
    function updateRecord(string memory _newHash) public {
        require(patients[msg.sender].isRegistered, "Loi: Ban chua dang ky thong tin!");
        patients[msg.sender].recordHash = _newHash;
        
        emit RecordUpdated(msg.sender, _newHash);
    }

    /**
     * @dev Lấy thông tin cá nhân của chính mình
     * Trả về đúng 5 trường dữ liệu để Frontend map vào giao diện
     */
    function getMyDetails() public view returns (
        string memory name, 
        string memory email, 
        string memory dob, 
        string memory recordHash, 
        string memory bloodGroup
    ) {
        require(patients[msg.sender].isRegistered, "Loi: Ban chua dang ky thong tin!");
        Patient memory p = patients[msg.sender];
        // Trả về theo thứ tự: 0=name, 1=email, 2=dob, 3=recordHash, 4=bloodGroup
        return (p.name, p.email, p.dob, p.recordHash, p.bloodGroup);
    }

    /**
     * @dev Kiểm tra đăng ký bằng địa chỉ ví
     */
    function isUserRegistered(address _addr) public view returns (bool) {
        return patients[_addr].isRegistered;
    }
}