// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IController{
    function balanceOf(address _user) external view returns (uint256);
    function balanceOfAt(address _user, uint256 _blockNumber) external view returns (uint256);
}