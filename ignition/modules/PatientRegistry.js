import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PatientRegistryModule = buildModule("PatientRegistryModule", (m) => {
  // Triển khai hợp đồng PatientRegistry
  const patientRegistry = m.contract("PatientRegistry");

  return { patientRegistry };
});

export default PatientRegistryModule;