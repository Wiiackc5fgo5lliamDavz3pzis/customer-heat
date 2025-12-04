# BankCustomerHeatFHE.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract BankCustomerHeatFHE is SepoliaConfig {

    struct EncryptedCustomerData {
        uint256 id;
        euint32 encryptedInteractionCount;  // Encrypted interaction count
        euint32 encryptedRiskScore;         // Encrypted churn risk
        euint32 encryptedManagerFeedback;   // Encrypted manager feedback
        uint256 timestamp;
    }

    struct DecryptedCustomerData {
        uint32 interactionCount;
        uint32 riskScore;
        uint32 managerFeedback;
        bool isRevealed;
    }

    uint256 public customerCount;
    mapping(uint256 => EncryptedCustomerData) public encryptedCustomers;
    mapping(uint256 => DecryptedCustomerData) public decryptedCustomers;

    mapping(string => euint32) private encryptedRiskBuckets;
    string[] private riskLevels;

    mapping(uint256 => uint256) private decryptionRequests;

    event CustomerDataSubmitted(uint256 indexed id, uint256 timestamp);
    event DecryptionRequested(uint256 indexed id);
    event CustomerDataDecrypted(uint256 indexed id);

    modifier onlyAuthorized(uint256 customerId) {
        _;
    }

    /// @notice Submit encrypted customer data
    function submitEncryptedCustomerData(
        euint32 encryptedInteractionCount,
        euint32 encryptedRiskScore,
        euint32 encryptedManagerFeedback
    ) public {
        customerCount += 1;
        uint256 newId = customerCount;

        encryptedCustomers[newId] = EncryptedCustomerData({
            id: newId,
            encryptedInteractionCount: encryptedInteractionCount,
            encryptedRiskScore: encryptedRiskScore,
            encryptedManagerFeedback: encryptedManagerFeedback,
            timestamp: block.timestamp
        });

        decryptedCustomers[newId] = DecryptedCustomerData({
            interactionCount: 0,
            riskScore: 0,
            managerFeedback: 0,
            isRevealed: false
        });

        emit CustomerDataSubmitted(newId, block.timestamp);
    }

    /// @notice Request decryption of a customer's data
    function requestCustomerDataDecryption(uint256 customerId) public onlyAuthorized(customerId) {
        EncryptedCustomerData storage data = encryptedCustomers[customerId];
        require(!decryptedCustomers[customerId].isRevealed, "Already decrypted");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(data.encryptedInteractionCount);
        ciphertexts[1] = FHE.toBytes32(data.encryptedRiskScore);
        ciphertexts[2] = FHE.toBytes32(data.encryptedManagerFeedback);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptCustomerData.selector);
        decryptionRequests[reqId] = customerId;

        emit DecryptionRequested(customerId);
    }

    /// @notice Callback for decrypted customer data
    function decryptCustomerData(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 customerId = decryptionRequests[requestId];
        require(customerId != 0, "Invalid request");

        EncryptedCustomerData storage eData = encryptedCustomers[customerId];
        DecryptedCustomerData storage dData = decryptedCustomers[customerId];
        require(!dData.isRevealed, "Already decrypted");

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32[] memory results = abi.decode(cleartexts, (uint32[]));

        dData.interactionCount = results[0];
        dData.riskScore = results[1];
        dData.managerFeedback = results[2];
        dData.isRevealed = true;

        string memory level = getRiskLevel(dData.riskScore);
        if (!FHE.isInitialized(encryptedRiskBuckets[level])) {
            encryptedRiskBuckets[level] = FHE.asEuint32(0);
            riskLevels.push(level);
        }

        encryptedRiskBuckets[level] = FHE.add(
            encryptedRiskBuckets[level],
            FHE.asEuint32(1)
        );

        emit CustomerDataDecrypted(customerId);
    }

    /// @notice Get decrypted customer data
    function getDecryptedCustomerData(uint256 customerId) public view returns (
        uint32 interactionCount,
        uint32 riskScore,
        uint32 managerFeedback,
        bool isRevealed
    ) {
        DecryptedCustomerData storage data = decryptedCustomers[customerId];
        return (data.interactionCount, data.riskScore, data.managerFeedback, data.isRevealed);
    }

    /// @notice Get encrypted count by risk level
    function getEncryptedRiskCount(string memory level) public view returns (euint32) {
        return encryptedRiskBuckets[level];
    }

    /// @notice Request decryption of risk bucket count
    function requestRiskCountDecryption(string memory level) public {
        euint32 count = encryptedRiskBuckets[level];
        require(FHE.isInitialized(count), "Risk level not found");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptRiskCount.selector);
        decryptionRequests[reqId] = bytes32ToUint(keccak256(abi.encodePacked(level)));
    }

    /// @notice Callback for decrypted risk count
    function decryptRiskCount(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 levelHash = decryptionRequests[requestId];
        string memory level = getLevelFromHash(levelHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));
        // Handle decrypted risk count as needed
    }

    // Helper functions
    function bytes32ToUint(bytes32 b) private pure returns (uint256) {
        return uint256(b);
    }

    function getLevelFromHash(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < riskLevels.length; i++) {
            if (bytes32ToUint(keccak256(abi.encodePacked(riskLevels[i]))) == hash) {
                return riskLevels[i];
            }
        }
        revert("Risk level not found");
    }

    function getRiskLevel(uint32 riskScore) private pure returns (string memory) {
        if (riskScore < 30) return "Low";
        if (riskScore < 70) return "Medium";
        return "High";
    }
}
