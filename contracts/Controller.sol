// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./Token.sol";
import "./Transition.sol";
import "./tellor3/TellorStorage";

contract Controller is Token,Transition{

    constructor(address _governance, address _oracle, address _treasury, address _oldTellor){
        addresses[GOVERNANCE_CONTRACT] = _gvernance;
        addresses[ORACLE_CONTRACT] = _oracle;
        addresses[TREASURY_CONTRACT] = _treasury;
        addresses[OLD_TELLOR] = _oldTellor; //used for falling back in the case of disputes right after the switch
    }

    function changeGovernanceContract(address _newGovernance) external{
        require(msg.sender == addresses[GOVERNANCE_CONTRACT]);
        require(isValid(_newGovernance));
        addresses[GOVERNANCE_CONTRACT] = _newGovernance;
    }

    function changeOracleContract(address _newOracle) external {
        require(msg.sender == addresses[GOVERNANCE_CONTRACT]);
        require(isValid(_newOracle));
        addresses[ORACLE_CONTRACT] = _newOracle;

    }

    function changeTreasuryContract(address _newTreasury){
        require(msg.sender == addresses[GOVERNANCE_CONTRACT]);
        require(isValid(_newTreasury));
        addreesses[TREASURY_CONTRACT] = _newTreasury;

    }

    function changeControllerContract(address _newController) external{
        require(msg.sender == addresses[GOVERNANCE_CONTRACT]);
        require(isValid(_newController));
        addresses[_TELLOR_CONTRACT] = _newController;//name _TELLOR_CONTRACT is hardcoded in
        assembly {
            sstore(_EIP_SLOT, _newController)
        }
    }

    function migrate() external{
        require(!migrated[_user], "Already migrated");
        _doMint(_user, ITellor(addresses[_OLD_TELLOR]).balanceOf(_user));
        migrated[_user] = true;
    }

    function mint(address _reciever, uint _amount) external{
        require(msg.sender == addresses[GOVERNANCE_CONTRACT] || msg.sender == addresses[TREASURY_CONTRACT]);
        _doMint(_reciever, _amount);
    }

    function isValid(address _contract) internal{
        (bool success, bytes memory data) =
            address(_contract).call(
                abi.encodeWithSelector(0xfc735e99, "") //verify() signature
            );
        require(
            success && abi.decode(data, (uint256)) > 9000, //just an arbitrary number to ensure that the contract is valid
            "new contract is invalid"
        );
    }
}