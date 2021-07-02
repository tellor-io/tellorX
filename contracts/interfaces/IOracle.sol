// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IOracle{
    function getTimestampCountByID(uint256 _id) external view returns(uint256);
    function getReportTimestampByIndex(uint256 _requestId, uint256 _index) external view returns(uint256);
    function getValueByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(bytes memory);
    function getBlockNumberByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(uint256);
    function getReporterByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(address);
    function miningLock() external view returns(uint256);
    function addTip(uint256 _requestId, uint256 _tip) external;
    function removeValue(uint256 _requestId, uint256 _timestamp) external;
    function getReportsSubmittedByAddress(address _reporter) external view returns(uint256);
    function getTipsByUser(address _user) external view returns(uint256);
}