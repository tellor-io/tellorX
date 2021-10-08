// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./tellor3/TellorStorage.sol";
import "./TellorVars.sol";
import "./interfaces/IOracle.sol";

/**
 @author Tellor Inc.
 @title Getters
* @dev The Getters contract links to the Oracle contract and
* allows parties to continue to use the master
* address to access bytes values. All parties should be reading values
* through this address
*/
contract Getters is TellorStorage, TellorVars {

  // Functions
  /**
   * @dev Counts the number of values that have been submitted for the request.
   * @param _id the id to look up
   * @return uint256 count of the number of values received for the id
   */
  function getNewValueCountbyRequestId(bytes32 _id) public view returns(uint256) {
      return(IOracle(addresses[_ORACLE_CONTRACT]).getTimestampCountById(_id));
  }

  /**
   * @dev Gets the timestamp for the value based on their index
   * @param _id is the id to look up
   * @param _index is the value index to look up
   * @return uint256 timestamp
   */
  function getTimestampbyRequestIDandIndex(bytes32 _id, uint256 _index) public view returns(uint256) {
      return(IOracle(addresses[_ORACLE_CONTRACT]).getReportTimestampByIndex(_id, _index));
  }

  /**
   * @dev Retrieve value from oracle based on timestamp
   * @param _id being requested
   * @param _timestamp to retrieve data/value from
   * @return bytes value for timestamp submitted
   */
  function retrieveData(bytes32 _id, uint256 _timestamp) public view returns(bytes memory) {
      return(IOracle(addresses[_ORACLE_CONTRACT]).getValueByTimestamp(_id, _timestamp));
  }
}
