// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IGovernance{
    function updateMinDisputeFee() external;
    function delegate(address _delegate) external;
}