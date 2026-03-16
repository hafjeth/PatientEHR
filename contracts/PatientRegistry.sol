// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PatientRegistry {

    // Mỗi file trong 1 lần khám
    struct RecordFile {
        string ipfsHash;
        string fileName;   // tên file để hiển thị
        uint256 uploadedAt;
    }

    // 1 lần khám = 1 record, có thể có nhiều file
    struct MedicalRecord {
        string      title;
        string      recordType;
        string      examDate;
        string      doctor;
        uint256     createdAt;
        RecordFile[] files;     // danh sách file
    }

    struct Patient {
        string name;
        string email;
        string dob;
        string bloodGroup;
        string passwordHash;
        bool   isRegistered;
    }

    struct DoctorAccess {
        bool    hasAccess;
        uint256 grantedAt;
    }

    mapping(address => Patient)                          private patients;
    mapping(address => MedicalRecord[])                  private records;
    mapping(string  => address)                          private emailToAddress;
    mapping(address => mapping(address => DoctorAccess)) private accessControl;
    mapping(address => address[])                        private authorizedDoctors;

    event PatientRegistered(address indexed patient, string name, string email);
    event RecordAdded      (address indexed patient, uint256 recordIndex, string title);
    event FileAdded        (address indexed patient, uint256 recordIndex, string fileName);
    // RecordUpdated event removed — no editing allowed
    event ProfileUpdated   (address indexed patient);
    event AccessGranted    (address indexed patient, address indexed doctor);
    event AccessRevoked    (address indexed patient, address indexed doctor);

    // ===== REGISTER =====
    function registerPatient(
        string memory _name,
        string memory _email,
        string memory _dob,
        string memory _bloodGroup,
        string memory _passwordHash
    ) public {
        require(!patients[msg.sender].isRegistered,   "Error: Wallet already registered!");
        require(emailToAddress[_email] == address(0), "Error: Email already in use!");

        patients[msg.sender] = Patient({
            name: _name, email: _email, dob: _dob,
            bloodGroup: _bloodGroup, passwordHash: _passwordHash, isRegistered: true
        });
        emailToAddress[_email] = msg.sender;
        emit PatientRegistered(msg.sender, _name, _email);
    }

    // ===== ADD NEW VISIT RECORD (no file required at creation) =====
    function addRecord(
        string memory _title,
        string memory _recordType,
        string memory _examDate,
        string memory _doctor
    ) public {
        require(patients[msg.sender].isRegistered, "Error: Not registered!");

        uint256 idx = records[msg.sender].length;
        records[msg.sender].push();
        MedicalRecord storage r = records[msg.sender][idx];
        r.title      = _title;
        r.recordType = _recordType;
        r.examDate   = _examDate;
        r.doctor     = _doctor;
        r.createdAt  = block.timestamp;

        emit RecordAdded(msg.sender, idx, _title);
    }

    // ===== ADD FILE TO EXISTING RECORD =====
    function addFileToRecord(
        uint256 _recordIndex,
        string memory _fileHash,
        string memory _fileName
    ) public {
        require(patients[msg.sender].isRegistered,              "Error: Not registered!");
        require(_recordIndex < records[msg.sender].length,      "Error: Invalid record index!");

        records[msg.sender][_recordIndex].files.push(RecordFile({
            ipfsHash:   _fileHash,
            fileName:   _fileName,
            uploadedAt: block.timestamp
        }));
        emit FileAdded(msg.sender, _recordIndex, _fileName);
    }

    // updateRecordInfo removed — blockchain records are immutable

    // ===== VIEW: get record count =====
    function getRecordCount() public view returns (uint256) {
        require(patients[msg.sender].isRegistered, "Error: Not registered!");
        return records[msg.sender].length;
    }

    // ===== VIEW: get record info (no files) =====
    struct RecordInfo {
        string  title;
        string  recordType;
        string  examDate;
        string  doctor;
        uint256 createdAt;
        uint256 fileCount;
    }

    function getRecordInfo(uint256 _index) public view returns (RecordInfo memory) {
        require(patients[msg.sender].isRegistered,         "Error: Not registered!");
        require(_index < records[msg.sender].length,       "Error: Invalid index!");
        MedicalRecord storage r = records[msg.sender][_index];
        return RecordInfo({
            title:      r.title,
            recordType: r.recordType,
            examDate:   r.examDate,
            doctor:     r.doctor,
            createdAt:  r.createdAt,
            fileCount:  r.files.length
        });
    }

    // ===== VIEW: get all files of a record =====
    function getRecordFiles(uint256 _recordIndex) public view returns (RecordFile[] memory) {
        require(patients[msg.sender].isRegistered,              "Error: Not registered!");
        require(_recordIndex < records[msg.sender].length,      "Error: Invalid index!");
        return records[msg.sender][_recordIndex].files;
    }

    // ===== PROFILE =====
    function getMyDetails() public view returns (
        string memory name, string memory email,
        string memory dob,  string memory bloodGroup
    ) {
        require(patients[msg.sender].isRegistered, "Error: Not registered!");
        Patient memory p = patients[msg.sender];
        return (p.name, p.email, p.dob, p.bloodGroup);
    }

    function isUserRegistered(address _addr) public view returns (bool) {
        return patients[_addr].isRegistered;
    }

    function updateProfile(string memory _name, string memory _dob, string memory _bloodGroup) public {
        require(patients[msg.sender].isRegistered, "Error: Not registered!");
        patients[msg.sender].name       = _name;
        patients[msg.sender].dob        = _dob;
        patients[msg.sender].bloodGroup = _bloodGroup;
        emit ProfileUpdated(msg.sender);
    }

    // ===== PASSWORD =====
    function verifyPassword(string memory _passwordHash) public view returns (bool) {
        require(patients[msg.sender].isRegistered, "Error: Not registered!");
        return keccak256(abi.encodePacked(patients[msg.sender].passwordHash))
            == keccak256(abi.encodePacked(_passwordHash));
    }

    function updatePassword(string memory _old, string memory _new) public {
        require(patients[msg.sender].isRegistered, "Error: Not registered!");
        require(
            keccak256(abi.encodePacked(patients[msg.sender].passwordHash))
            == keccak256(abi.encodePacked(_old)), "Error: Wrong old password!"
        );
        patients[msg.sender].passwordHash = _new;
    }

    // ===== DOCTOR ACCESS =====
    function grantAccess(address _doctor) public {
        require(patients[msg.sender].isRegistered,             "Error: Not registered!");
        require(_doctor != msg.sender,                         "Error: Cannot grant to yourself!");
        require(!accessControl[msg.sender][_doctor].hasAccess, "Error: Already has access!");
        accessControl[msg.sender][_doctor] = DoctorAccess({ hasAccess: true, grantedAt: block.timestamp });
        authorizedDoctors[msg.sender].push(_doctor);
        emit AccessGranted(msg.sender, _doctor);
    }

    function revokeAccess(address _doctor) public {
        require(patients[msg.sender].isRegistered,            "Error: Not registered!");
        require(accessControl[msg.sender][_doctor].hasAccess, "Error: No access to revoke!");
        accessControl[msg.sender][_doctor].hasAccess = false;
        emit AccessRevoked(msg.sender, _doctor);
    }

    function checkDoctorAccess(address _patient, address _doctor) public view returns (bool) {
        return accessControl[_patient][_doctor].hasAccess;
    }
}
