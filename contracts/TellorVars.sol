
// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./tellor3/TellorVariables.sol";
/**
 @author Tellor Inc.
 @title TellorVariables
 @dev Helper contract to store hashes of variables
*/
contract TellorVars is TellorVariables{
    address constant TELLOR_ADDRESS = 0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0;
    bytes32 constant _GOVERNANCE_CONTRACT =
        0xefa19baa864049f50491093580c5433e97e8d5e41f8db1a61108b4fa44cacd93; //keccak256("_TOTAL_TIP");
    bytes32 constant _ORACLE_CONTRACT =
        0xfa522e460446113e8fd353d7fa015625a68bc0369712213a42e006346440891e;
    bytes32 constant _TREASURY_CONTRACT =
        0x1436a1a60dca0ebb2be98547e57992a0fa082eb479e7576303cbd384e934f1fa; //keccak256("_VALUE");

}