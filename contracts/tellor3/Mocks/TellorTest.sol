// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Tellor.sol";
import "../../TellorVars.sol";


contract TellorTest is Tellor, TellorVars {
    uint256 version = 3000;
   
    /*Functions*/
    /**
     * @dev Constructor to set extension address
     * @param _ext Extension address
    */
    constructor(address _ext) Tellor(_ext){
    }

    function updateMaster(address m) public {
        // For this to work need to convert the variable from constant to normal variable.
        TELLOR_ADDRESS = m;
    }

    /*This is a cheat for demo purposes, is not on main Tellor*/
    function theLazyCoon(address _address, uint256 _amount) public {
        uints[_TOTAL_SUPPLY] += _amount;
        TellorTransfer._updateBalanceAtNow(_address, uint128(_amount));
    }

    /*This function uses all the functionality of submitMiningSolution, but bypasses verifyNonce*/
    function testSubmitMiningSolution(
        string calldata _nonce,
        uint256[5] calldata _requestId,
        uint256[5] calldata _value
    ) external {
        bytes32 _hashMsgSender = keccak256(abi.encode(msg.sender));
        require(
            uints[_hashMsgSender] == 0 ||
                block.timestamp - uints[_hashMsgSender] > 15 minutes,
            "Miner can only win rewards once per 15 min"
        );
        _submitMiningSolution(_nonce, _requestId, _value);
    }

    /*allows manually setting the difficulty in tests*/
    function manuallySetDifficulty(uint256 _diff) public {
        uints[_DIFFICULTY] = _diff;
    }

    function bumpVersion() external {
        version++;
    }

    function verify() external view override returns (uint256) {
        return version;
    }
}
