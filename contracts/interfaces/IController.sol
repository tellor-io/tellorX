// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IController{
    function balanceOf(address _user) external view returns (uint256);
    function balanceOfAt(address _user, uint256 _blockNumber) external view returns (uint256);
    function addresses(bytes32 _b) external view returns(address);
    function uints(bytes32 _b) external view returns(uint256);
    function transferFrom(address _from, address _to, uint256 _amount) external returns(bool);
    function approveAndTransferFrom(address _from, address _to, uint256 _amount) external returns(bool);
    function changeStakingStatus(address _reporter, uint256 _status) external;
    function getStakerInfo(address _reporter) external returns(uint256, uint256);
    function slashMiner(address _reporter, address _disputer) external;
    function transfer(address _to, uint256 _amount) external returns (bool success);
    function burn(uint256 _amount) external;
    function mint(address _to, uint256 _amount) external;
}