// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IOracle{
    function getReportTimestampByIndex(uint256 _requestId, uint256 _index) external view returns(uint256);
    function getValueByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(bytes memory);
    function getBlockNumberByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(uint256);
    function getReporterByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(address);
    function miningLock() external view returns(uint256);
    function removeValue(uint256 _requestId, uint256 _timestamp) external;
    function getReportsSubmittedByAddress(address _reporter) external view returns(uint256);
    function getTipsByUser(address _user) external view returns(uint256);
    function addTip(uint256 _id, uint256 _tip) external;
    function addNewId(bytes calldata _details) external;
    function submitValue(uint256 _id, bytes calldata _value) external;
    function burnTips() external;
    function verify() external pure returns(uint);
    function changeMiningLock(uint256 _newMiningLock) external;
    function getTipsById(uint _id) external view returns(uint256);
    function getReportDetails(uint256 _id) external view returns(bytes memory);
    function getTimestampCountByID(uint256 _id) external view returns(uint256);
    function getTimestampIndexByTimestamp(uint256 _id, uint256 _timestamp) external view returns(uint256);
}