// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./interfaces/IController.sol";
import "./tellor3/TellorVars.sol";

contract Treasury is TellorVars{
    uint256 public totalLocked;
    uint256 public treasuryCount;
    mapping(uint => TreasuryDetails) public treasury;
    struct TreasuryDetails{
        uint256 dateStarted;
        uint256 amount;
        uint256 rate;
        uint256 purchased;
        address[] owners;
        mapping(address => uint256) accounts;
        mapping(address => bool) paid;
    }

    event TreasuryIssued(uint256 _id,uint256 _amount,uint256 _rate);
    event TreasuryPaid(address _investor, uint256 _amount);
    event TreasuryPurchased(address _investor,uint256 _amount);

    //_amount of TRB, _rate in bp
    function issueTreasury(uint256 _amount, uint256 _rate, uint256 _duration) external{
        require(msg.sender == ControllerInterface(TELLOR_ADDRESS).addresses[_GOVERNANCE_CONTRACT]);
        require(ControllerInterface(TELLOR_ADDRESS).balanceOf(address(this) - totalLocked > _amount));
        totalLocked += _amount;
        treasuryCount++;
        treasury[treasuryCount] = TreasuryDetails{
            dateStared: block.timestamp,
            amount: _amount,
            rate: _rate,
            duration: _duration
        };
        emit TreasuryIssued(treasuryCount,_amount,_rate);
    }

    function payTreasury(address _investor,uint256 _id) external{
        //calculate number of votes in governance contract when issue
        TreasuryDetails storage treas = treasury[_id];
        require(_id < treasuryCount);
        require(treas.dateStarted + treas.duration <= block.timestamp);
        require(!treas.paid[_investor]);
        uint256 _mintAmount = treas.accounts[_investor] * treas.rate;
        ControllerInterface(TELLOR_ADDRESS).mint(address(this),_mintAmount);
        ControllerInterface(TELLOR_ADDRESS).transfer(_investor,_mintAmount + treas.accounts[_investor]);
        treas.paid[_investor] = true;
        emit TreasuryPaid(_investor,_mintAmount + treas.accounts[_investor]);
    }

    function buyTreasury(uint256 _id,uint256 _amount, address _delegate) external{
        //deposit money into a Treasury
        require(ControllerInterface(TELLOR_ADDRESS).transferFrom(msg.sender,address(this),_amount));
        TreasuryDetails storage treas = treasury[_id];
        require(_amount <= treas.amount - treas.purchased);
        treas.purchased += _amount;
        treas.accounts[msg.sender] += _amount;      
        treas.owners.push(msg.sender);
        emit TreasuryPurchased();
    }

    function getTreasuryDetails(uint256 _id) external view returns(uint256,uint256,uint256,uint256){
        TreasuryDetails memory treas = treasury[_id];
        return(treas.dateStarted,treas.amount,treas.rate,treas.purchased);
    }
    
    function getTreasuryAccount(uint256 _id, address _investor) external view returns(uint256){
        return (treasury[_id].accounts[_investor]);
    }

    function getTreasuryOwners(uint256 _id) external view returns(address[] memory){
        return treasury[_id].owners;
    }

    function wasPaid(uint256 _id, address _investor) external view returns(bool){
        return treasury[_id].paid[_investor];
    }

    function verify() public returns(uint){
        return 9999;
    }
}