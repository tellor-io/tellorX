// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./tellor3/TellorStorage.sol";
import "./TellorVars.sol";
import "./interfaces/IOracle.sol";
import "hardhat/console.sol";

// Needs access to TellorStorage, TellorVars
contract Getters is TellorStorage, TellorVars {

  // isInDispute() ??

  function getNewValueCountbyRequestId(bytes32 _id) public view returns(uint256) {
      return(IOracle(addresses[_ORACLE_CONTRACT]).getTimestampCountById(_id));
  }

  function getTimestampbyRequestIDandIndex(bytes32 _id, uint256 _index) public view returns(uint256) {
      return(IOracle(addresses[_ORACLE_CONTRACT]).getReportTimestampByIndex(_id, _index));
  }

  function retrieveData(bytes32 _id, uint256 _timestamp) public view returns(bytes memory) {
      return(IOracle(addresses[_ORACLE_CONTRACT]).getValueByTimestamp(_id, _timestamp));
  }
}
